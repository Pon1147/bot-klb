/**
 * Unit tests cho df-claim.db.ts — Bảng SQLite df_claim_sessions & atomic claim operations.
 *
 * Yêu cầu nghiệp vụ & bảo mật (Rule: security-review, tdd-workflow):
 * 1. Khởi tạo bảng df_claim_sessions với unique index và CHECK status.
 * 2. Lưu expires_at dạng numeric Unix timestamp (giây) để không phụ thuộc múi giờ.
 * 3. Migration chuẩn hóa datetime string và timestamp ms về numeric Unix timestamp (giây).
 * 4. Atomic consume trong transaction: chỉ consume claim pending chưa hết hạn.
 * 5. Chống replay/duplicate: một mã claim chỉ được consume duy nhất 1 lần.
 * 6. Hủy bỏ (invalidate) các pending claim cũ của user khi khởi tạo mã mới.
 * 7. Dọn dẹp retention an toàn và phòng thủ khi database đã đóng (defensive open check).
 */

import Database from 'better-sqlite3';
import {
  initializeClaimSessionsTable,
  migrateClaimSessionsToNumeric,
  createClaimSession,
  atomicConsumeClaim,
  invalidateUserClaims,
  cleanupExpiredClaimSessions,
} from '../../src/database/df-claim.db.js';

describe('df-claim.db — SQLite Claim Sessions & Atomic Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory SQLite database riêng biệt cho mỗi test để cô lập hoàn toàn
    db = new Database(':memory:');
    initializeClaimSessionsTable(db);
  });

  afterEach(() => {
    if (db.open) {
      db.close();
    }
  });

  describe('initializeClaimSessionsTable', () => {
    it('nên tạo bảng df_claim_sessions với các cột và chỉ mục cần thiết', () => {
      const tableInfo = db.pragma('table_info(df_claim_sessions)') as Array<{ name: string; type: string }>;
      const columnNames = tableInfo.map((c) => c.name);

      expect(columnNames).toContain('code');
      expect(columnNames).toContain('discord_user_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('expires_at');
      expect(columnNames).toContain('consumed_at');
    });
  });

  describe('createClaimSession & atomicConsumeClaim', () => {
    it('nên tạo và tiêu thụ (consume) claim session thành công khi mã hợp lệ và còn hạn', () => {
      const code = 'TEST01';
      const discordUserId = 'discord-user-123';
      const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 phút sau

      createClaimSession(db, code, discordUserId, expiresAtMs);

      // Lần consume đầu tiên: thành công, trả về đúng discordUserId
      const consumedUserId = atomicConsumeClaim(db, code);
      expect(consumedUserId).toBe(discordUserId);

      // Kiểm tra trạng thái đã chuyển sang 'consumed'
      const session = db.prepare('SELECT status, consumed_at FROM df_claim_sessions WHERE code = ?').get(code) as any;
      expect(session.status).toBe('consumed');
      expect(session.consumed_at).toBeTruthy();
    });

    it('nên từ chối tiêu thụ lần 2 khi cùng một mã bị gọi lại (chống replay/duplicate attack)', () => {
      const code = 'REPLAY99';
      const discordUserId = 'user-replay';
      const expiresAtMs = Date.now() + 60000;

      createClaimSession(db, code, discordUserId, expiresAtMs);

      const firstConsume = atomicConsumeClaim(db, code);
      expect(firstConsume).toBe(discordUserId);

      // Thử tiêu thụ lại lần 2
      const secondConsume = atomicConsumeClaim(db, code);
      expect(secondConsume).toBeNull();
    });

    it('nên trả về null khi mã claim đã hết hạn', () => {
      const code = 'EXPIRE88';
      const discordUserId = 'user-expired';
      // Hết hạn từ 10 phút trước
      const expiredMs = Date.now() - 10 * 60 * 1000;

      createClaimSession(db, code, discordUserId, expiredMs);

      const result = atomicConsumeClaim(db, code);
      expect(result).toBeNull();

      // Kiểm tra trạng thái vẫn là pending (chưa bị consume)
      const session = db.prepare('SELECT status FROM df_claim_sessions WHERE code = ?').get(code) as any;
      expect(session.status).toBe('pending');
    });

    it('nên trả về null khi mã claim không tồn tại trong database', () => {
      const result = atomicConsumeClaim(db, 'NON_EXISTENT');
      expect(result).toBeNull();
    });
  });

  describe('invalidateUserClaims', () => {
    it('nên đánh dấu tất cả các mã pending cũ của user thành expired', () => {
      const userId = 'user-invalidate-1';
      const futureMs = Date.now() + 600000;

      createClaimSession(db, 'CODE_A', userId, futureMs);
      createClaimSession(db, 'CODE_B', userId, futureMs);

      // Invalidate toàn bộ pending claims của user
      invalidateUserClaims(db, userId);

      const rows = db.prepare('SELECT code, status FROM df_claim_sessions WHERE discord_user_id = ?').all(userId) as any[];
      expect(rows.length).toBe(2);
      expect(rows.every((r) => r.status === 'expired')).toBe(true);

      // Không thể consume mã đã bị expired
      expect(atomicConsumeClaim(db, 'CODE_A')).toBeNull();
      expect(atomicConsumeClaim(db, 'CODE_B')).toBeNull();
    });
  });

  describe('migrateClaimSessionsToNumeric', () => {
    it('nên chuẩn hóa các dòng datetime string và timestamp millisecond sang numeric seconds', () => {
      // Setup dữ liệu cũ chưa migrate:
      // 1. Dòng kiểu datetime string chứa ':'
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('LEGACY_STR', 'user-1', 'expired', '2026-06-09 12:00:00')
      `).run();

      // 2. Dòng kiểu ms timestamp có dấu chấm hoặc > 1e12
      const msValue = 1750000000123.45;
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('LEGACY_MS', 'user-2', 'expired', ?)
      `).run(msValue);

      // 3. Dòng chuẩn đã là seconds (< 1e11)
      const validSec = 1750000000;
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('VALID_SEC', 'user-3', 'expired', ?)
      `).run(validSec);

      // Thực thi migration
      migrateClaimSessionsToNumeric(db);

      // Kiểm tra kết quả
      const rowStr = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('LEGACY_STR') as any;
      expect(typeof rowStr.expires_at).toBe('number');
      expect(rowStr.expires_at).toBeGreaterThan(0);

      const rowMs = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('LEGACY_MS') as any;
      expect(typeof rowMs.expires_at).toBe('number');
      expect(rowMs.expires_at).toBe(Math.floor(msValue / 1000));

      const rowValid = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('VALID_SEC') as any;
      expect(rowValid.expires_at).toBe(validSec);
    });

    it('không làm gì nếu không có dòng nào cần migrate', () => {
      const validSec = 1750000000;
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('CLEAN_01', 'user-clean', 'pending', ?)
      `).run(validSec);

      expect(() => migrateClaimSessionsToNumeric(db)).not.toThrow();

      const row = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('CLEAN_01') as any;
      expect(row.expires_at).toBe(validSec);
    });
  });

  describe('cleanupExpiredClaimSessions (NEW-03)', () => {
    it('xóa các claim session đã expired hoặc consumed vượt quá thời hạn retention (mặc định 7 ngày)', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const eightDaysAgoSec = nowSec - 8 * 86400;
      const threeDaysAgoSec = nowSec - 3 * 86400;
      const tenMinutesLaterSec = nowSec + 600;

      // 1. Session đã consumed quá 7 ngày -> PHẢI BỊ XÓA
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('OLD_CONSUMED', 'user-1', 'consumed', ?)
      `).run(eightDaysAgoSec);

      // 2. Session đã expired quá 7 ngày -> PHẢI BỊ XÓA
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('OLD_EXPIRED', 'user-2', 'expired', ?)
      `).run(eightDaysAgoSec);

      // 3. Session pending nhưng đã quá 7 ngày -> PHẢI BỊ XÓA
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('OLD_PENDING', 'user-3', 'pending', ?)
      `).run(eightDaysAgoSec);

      // 4. Session đã expired mới 3 ngày trước (trong retention window 7 ngày) -> GIỮ LẠI ĐỂ AUDIT
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('RECENT_EXPIRED', 'user-4', 'expired', ?)
      `).run(threeDaysAgoSec);

      // 5. Session đang active còn hạn (pending, expires_at > now) -> TUYỆT ĐỐI KHÔNG BỊ XÓA
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('ACTIVE_PENDING', 'user-5', 'pending', ?)
      `).run(tenMinutesLaterSec);

      const deletedCount = cleanupExpiredClaimSessions(db, 7);

      expect(deletedCount).toBe(3);

      const remaining = db.prepare('SELECT code FROM df_claim_sessions').all() as Array<{ code: string }>;
      const remainingCodes = remaining.map((r) => r.code);

      expect(remainingCodes).not.toContain('OLD_CONSUMED');
      expect(remainingCodes).not.toContain('OLD_EXPIRED');
      expect(remainingCodes).not.toContain('OLD_PENDING');
      expect(remainingCodes).toContain('RECENT_EXPIRED');
      expect(remainingCodes).toContain('ACTIVE_PENDING');
    });

    it('hỗ trợ tùy chỉnh maxAgeDays và fallback an toàn 7 ngày khi giá trị không hợp lệ', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const fourDaysAgoSec = nowSec - 4 * 86400;

      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('FOUR_DAYS_OLD', 'user-custom', 'expired', ?)
      `).run(fourDaysAgoSec);

      // Với maxAgeDays = 5 -> phiên 4 ngày chưa đủ điều kiện xóa
      const deleted5 = cleanupExpiredClaimSessions(db, 5);
      expect(deleted5).toBe(0);

      // Với maxAgeDays = 3 -> phiên 4 ngày đã vượt quá -> bị xóa
      const deleted3 = cleanupExpiredClaimSessions(db, 3);
      expect(deleted3).toBe(1);

      // Chèn lại bản ghi cũ 8 ngày
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('EIGHT_DAYS_OLD', 'user-fallback', 'expired', ?)
      `).run(nowSec - 8 * 86400);

      // Giá trị không hợp lệ (0, âm, NaN) -> fallback về 7 ngày -> phiên 8 ngày bị xóa
      expect(cleanupExpiredClaimSessions(db, 0)).toBe(1);

      // Chèn tiếp
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('EIGHT_DAYS_OLD_2', 'user-fallback', 'expired', ?)
      `).run(nowSec - 8 * 86400);

      expect(cleanupExpiredClaimSessions(db, -10)).toBe(1);

      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('EIGHT_DAYS_OLD_3', 'user-fallback', 'expired', ?)
      `).run(nowSec - 8 * 86400);

      expect(cleanupExpiredClaimSessions(db, NaN as any)).toBe(1);
    });

    it('phòng thủ và trả về 0 khi database connection đã đóng (db.open === false) hoặc null', () => {
      expect(cleanupExpiredClaimSessions(null as any)).toBe(0);

      db.close();
      expect(cleanupExpiredClaimSessions(db)).toBe(0);
    });
  });
});
