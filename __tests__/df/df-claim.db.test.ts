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
 */

import Database from 'better-sqlite3';
import {
  initializeClaimSessionsTable,
  migrateClaimSessionsToNumeric,
  createClaimSession,
  atomicConsumeClaim,
  invalidateUserClaims,
} from '../../src/database/df-claim.db.js';

describe('df-claim.db — SQLite Claim Sessions & Atomic Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory SQLite database riêng biệt cho mỗi test để cô lập hoàn toàn
    db = new Database(':memory:');
    initializeClaimSessionsTable(db);
  });

  afterEach(() => {
    db.close();
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
      const userA = 'user-a';
      const userB = 'user-b';
      const nowMs = Date.now() + 60000;

      createClaimSession(db, 'CODE_A1', userA, nowMs);
      createClaimSession(db, 'CODE_A2', userA, nowMs);
      createClaimSession(db, 'CODE_B1', userB, nowMs);

      invalidateUserClaims(db, userA);

      const sessionA1 = db.prepare('SELECT status FROM df_claim_sessions WHERE code = ?').get('CODE_A1') as any;
      const sessionA2 = db.prepare('SELECT status FROM df_claim_sessions WHERE code = ?').get('CODE_A2') as any;
      const sessionB1 = db.prepare('SELECT status FROM df_claim_sessions WHERE code = ?').get('CODE_B1') as any;

      expect(sessionA1.status).toBe('expired');
      expect(sessionA2.status).toBe('expired');
      // Mã của user B không bị ảnh hưởng
      expect(sessionB1.status).toBe('pending');

      // Mã đã expired thì không thể atomicConsumeClaim
      expect(atomicConsumeClaim(db, 'CODE_A1')).toBeNull();
    });
  });

  describe('migrateClaimSessionsToNumeric', () => {
    it('nên chuẩn hóa các dòng datetime string và timestamp millisecond sang numeric seconds', () => {
      // Chèn các dòng định dạng cũ để test migration
      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('LEGACY_STR', 'user-1', 'pending', '2026-10-06 12:00:00')
      `).run();

      db.prepare(`
        INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
        VALUES ('LEGACY_MS', 'user-2', 'pending', 1700000000000.5)
      `).run();

      migrateClaimSessionsToNumeric(db);

      const strRow = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('LEGACY_STR') as any;
      const msRow = db.prepare('SELECT expires_at FROM df_claim_sessions WHERE code = ?').get('LEGACY_MS') as any;

      // Không còn chứa ký tự ':' hoặc decimal ms > 1e12
      expect(typeof strRow.expires_at).toBe('number');
      expect(typeof msRow.expires_at).toBe('number');
      expect(msRow.expires_at).toBe(1700000000);
    });

    it('không làm gì nếu không có dòng nào cần migrate', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      migrateClaimSessionsToNumeric(db);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

