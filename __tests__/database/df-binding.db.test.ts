/// <reference types="jest" />
/**
 * Unit tests cho df-binding.db.ts — Quản lý account binding trên SQLite & sync MongoDB.
 *
 * Kiểm tra các nghiệp vụ & behavior:
 * 1. Khởi tạo bảng df_account_bindings và indices.
 * 2. upsertAccountBinding: mặc định key_version = 'v1', upsert conflict resolution.
 * 3. getActiveBindingByOpenid: tìm kiếm binding theo openid.
 * 4. expireBinding / expireBindingAsync: cập nhật conditional với cred_nonce và xóa legacy token an toàn.
 * 5. revokeBinding / revokeBindingAsync: Persistent Store First, conditional update với cred_nonce.
 * 6. touchLastOk: cập nhật last_ok_at và trigger Mongo nếu connected.
 * 7. updateLastError: cập nhật last_error với cắt ngắn tối đa 500 ký tự.
 * 8. Conditional update & race condition prevention: generation mismatch, database unavailable.
 * 9. syncBindingsFromMongoToSqlite: reconciliation dọn phantom active bindings ngay cả khi Mongo rỗng, và abort an toàn khi Mongo null.
 */

import Database from 'better-sqlite3';
import {
  initializeAccountBindingsTable,
  upsertAccountBinding,
  getActiveBinding,
  getActiveBindingByOpenid,
  expireBinding,
  expireBindingAsync,
  revokeBinding,
  revokeBindingAsync,
  touchLastOk,
  updateLastError,
  syncBindingsFromMongoToSqlite,
} from '../../src/database/df-binding.db.js';
import { initializeDfTokensTable, saveDfToken, getDfToken } from '../../src/database/df.token.db.js';
import * as mongoModule from '../../src/database/mongo/index.js';

jest.mock('../../src/database/mongo/index.js', () => ({
  isMongoConnected: jest.fn(() => false),
  upsertAccountBindingToMongo: jest.fn().mockResolvedValue(true),
  expireAccountBindingInMongo: jest.fn().mockResolvedValue({
    success: true,
    status: 'updated',
    modifiedCount: 1,
  }),
  revokeAccountBindingInMongo: jest.fn().mockResolvedValue({
    success: true,
    status: 'updated',
    modifiedCount: 1,
  }),
  touchLastOkInMongo: jest.fn().mockResolvedValue(undefined),
  loadAllActiveBindingsFromMongo: jest.fn().mockResolvedValue([]),
}));

describe('database/df-binding.db', () => {
  let db: Database.Database;

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);
    (mongoModule.expireAccountBindingInMongo as jest.Mock).mockResolvedValue({
      success: true,
      status: 'updated',
      modifiedCount: 1,
    });
    (mongoModule.revokeAccountBindingInMongo as jest.Mock).mockResolvedValue({
      success: true,
      status: 'updated',
      modifiedCount: 1,
    });

    // Dùng in-memory database cô lập cho từng test
    db = new Database(':memory:');
    initializeAccountBindingsTable(db);
    initializeDfTokensTable(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('initializeAccountBindingsTable', () => {
    it('khởi tạo schema đầy đủ các cột và indices', () => {
      const tableInfo = db.pragma('table_info(df_account_bindings)') as Array<{ name: string }>;
      const cols = tableInfo.map((c) => c.name);

      expect(cols).toContain('discord_user_id');
      expect(cols).toContain('openid');
      expect(cols).toContain('cred_nonce');
      expect(cols).toContain('cred_ciphertext');
      expect(cols).toContain('cred_tag');
      expect(cols).toContain('key_version');
      expect(cols).toContain('status');
      expect(cols).toContain('last_ok_at');
      expect(cols).toContain('last_error');
    });
  });

  describe('upsertAccountBinding', () => {
    it('lưu binding với keyVersion mặc định là "v1" khi không truyền tham số thứ 7', () => {
      const result = upsertAccountBinding(
        db,
        'user-111',
        'openid-aaa',
        'nonce-123',
        'cipher-456',
        'tag-789',
      );

      expect(result).toBe(true);

      const row = getActiveBinding(db, 'user-111');
      expect(row).toBeDefined();
      expect(row?.discord_user_id).toBe('user-111');
      expect(row?.openid).toBe('openid-aaa');
      expect(row?.key_version).toBe('v1');
      expect(row?.status).toBe('active');
    });

    it('cập nhật binding khi discord_user_id đã tồn tại (ON CONFLICT)', () => {
      upsertAccountBinding(
        db,
        'user-111',
        'openid-first',
        'nonce-1',
        'cipher-1',
        'tag-1',
        'v1',
      );

      const updated = upsertAccountBinding(
        db,
        'user-111',
        'openid-second',
        'nonce-2',
        'cipher-2',
        'tag-2',
        'v2',
      );

      expect(updated).toBe(true);
      const row = getActiveBinding(db, 'user-111');
      expect(row?.openid).toBe('openid-second');
      expect(row?.key_version).toBe('v2');
      expect(row?.cred_nonce).toBe('nonce-2');
    });

    it('trigger upsertAccountBindingToMongo khi isMongoConnected() === true và syncToMongo !== false', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

      upsertAccountBinding(
        db,
        'user-222',
        'openid-bbb',
        'nonce-bbb',
        'cipher-bbb',
        'tag-bbb',
      );

      expect(mongoModule.upsertAccountBindingToMongo).toHaveBeenCalledWith({
        discord_user_id: 'user-222',
        openid: 'openid-bbb',
        cred_nonce: 'nonce-bbb',
        cred_ciphertext: 'cipher-bbb',
        cred_tag: 'tag-bbb',
        key_version: 'v1',
      });
    });

    it('không trigger upsertAccountBindingToMongo khi syncToMongo === false', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

      upsertAccountBinding(
        db,
        'user-333',
        'openid-ccc',
        'nonce-ccc',
        'cipher-ccc',
        'tag-ccc',
        'v1',
        false,
      );

      expect(mongoModule.upsertAccountBindingToMongo).not.toHaveBeenCalled();
    });
  });

  describe('getActiveBindingByOpenid', () => {
    it('trả về active binding tương ứng khi tìm theo openid', () => {
      upsertAccountBinding(db, 'user-333', 'openid-shared', 'nonce-3', 'cipher-3', 'tag-3');

      const found = getActiveBindingByOpenid(db, 'openid-shared');
      expect(found).toBeDefined();
      expect(found?.discord_user_id).toBe('user-333');
    });

    it('trả về undefined nếu openid không tồn tại hoặc không ở trạng thái active', () => {
      upsertAccountBinding(db, 'user-444', 'openid-revoked', 'nonce-4', 'cipher-4', 'tag-4');
      revokeBinding(db, 'user-444');

      expect(getActiveBindingByOpenid(db, 'openid-revoked')).toBeUndefined();
      expect(getActiveBindingByOpenid(db, 'openid-nonexistent')).toBeUndefined();
    });
  });

  describe('expireBinding', () => {
    it('cập nhật status thành "expired" và xóa token legacy trong df_tokens', () => {
      saveDfToken(db, 'user-exp', 'openid-exp', 'token-val');
      upsertAccountBinding(db, 'user-exp', 'openid-exp', 'nonce-exp', 'cipher', 'tag');

      expect(getDfToken(db, 'user-exp')).toBeDefined();
      expect(getActiveBinding(db, 'user-exp')).toBeDefined();

      expireBinding(db, 'user-exp');

      expect(getActiveBinding(db, 'user-exp')).toBeUndefined();
      expect(getDfToken(db, 'user-exp')).toBeUndefined();
    });

    it('trigger expireAccountBindingInMongo với expectedNonce khi isMongoConnected() === true (BUG-03)', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-exp-mongo', 'openid-m', 'nonce-exp-123', 'cipher', 'tag');

      expireBinding(db, 'user-exp-mongo');

      expect(mongoModule.expireAccountBindingInMongo).toHaveBeenCalledWith('user-exp-mongo', 'nonce-exp-123');
      expect(getActiveBinding(db, 'user-exp-mongo')).toBeUndefined();
    });

    it('không gây lỗi khi isMongoConnected() === false', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);
      upsertAccountBinding(db, 'user-exp-nomongo', 'openid-nom', 'nonce', 'cipher', 'tag');

      expect(() => expireBinding(db, 'user-exp-nomongo')).not.toThrow();
      expect(getActiveBinding(db, 'user-exp-nomongo')).toBeUndefined();
    });

    it('expireBindingAsync chờ Mongo update hoàn tất và cập nhật SQLite', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-async', 'openid-async', 'nonce-async-1', 'cipher', 'tag');

      const result = await expireBindingAsync(db, 'user-async');

      expect(result.success).toBe(true);
      expect(mongoModule.expireAccountBindingInMongo).toHaveBeenCalledWith('user-async', 'nonce-async-1');
      expect(getActiveBinding(db, 'user-async')).toBeUndefined();
    });

    it('expireBindingAsync phát hiện database_unavailable từ MongoDB', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.expireAccountBindingInMongo as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 'not_matched',
        reason: 'unavailable',
      });
      upsertAccountBinding(db, 'user-down', 'openid-down', 'nonce-down', 'cipher', 'tag');

      const result = await expireBindingAsync(db, 'user-down');

      expect(result.success).toBe(false);
      expect(result.error).toBe('database_unavailable');
    });

    it('expireBindingAsync phát hiện generation_mismatch từ MongoDB', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.expireAccountBindingInMongo as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 'not_matched',
        reason: 'generation_mismatch',
      });
      upsertAccountBinding(db, 'user-mis', 'openid-mis', 'nonce-mis', 'cipher', 'tag');

      const result = await expireBindingAsync(db, 'user-mis');

      expect(result.success).toBe(false);
      expect(result.error).toBe('generation_mismatch');
    });

    it('ngăn chặn binding hết hạn bị hồi sinh (resuscitation) khi bot reboot sync từ Mongo (BUG-03)', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

      // Giả lập: User link tài khoản ban đầu
      upsertAccountBinding(db, 'user-reboot', 'openid-reb', 'nonce-reb', 'cipher', 'tag');
      expect(getActiveBinding(db, 'user-reboot')).toBeDefined();

      // Expire binding (cập nhật cả SQLite và MongoDB)
      expireBinding(db, 'user-reboot');
      expect(getActiveBinding(db, 'user-reboot')).toBeUndefined();
      expect(mongoModule.expireAccountBindingInMongo).toHaveBeenCalledWith('user-reboot', 'nonce-reb');

      // Giả lập bot reboot trên Railway: loadAllActiveBindingsFromMongo chỉ trả về binding active (MongoDB query { status: "active" })
      (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce([]);

      const syncedCount = await syncBindingsFromMongoToSqlite(db);
      expect(syncedCount).toBe(0);

      // Binding trong SQLite vẫn phải là expired, KHÔNG bị hồi sinh thành active
      expect(getActiveBinding(db, 'user-reboot')).toBeUndefined();
      const raw = db.prepare('SELECT status FROM df_account_bindings WHERE discord_user_id = ?').get('user-reboot') as { status: string };
      expect(raw.status).toBe('expired');
    });
  });

  describe('revokeBinding & revokeBindingAsync', () => {
    it('trigger revokeAccountBindingInMongo khi isMongoConnected() === true', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-revoke', 'openid-r', 'nonce-r', 'cipher', 'tag');

      revokeBinding(db, 'user-revoke');

      expect(mongoModule.revokeAccountBindingInMongo).toHaveBeenCalledWith('user-revoke', 'nonce-r');
      expect(getActiveBinding(db, 'user-revoke')).toBeUndefined();
    });

    it('revokeBindingAsync chờ Mongo update hoàn tất và cập nhật SQLite', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-rev-async', 'openid-ra', 'nonce-ra', 'cipher', 'tag');

      const result = await revokeBindingAsync(db, 'user-rev-async');

      expect(result.success).toBe(true);
      expect(mongoModule.revokeAccountBindingInMongo).toHaveBeenCalledWith('user-rev-async', 'nonce-ra');
      expect(getActiveBinding(db, 'user-rev-async')).toBeUndefined();
    });

    it('không xóa legacy token nếu generation đã bị thay đổi (changes === 0)', () => {
      saveDfToken(db, 'user-mismatch', 'openid-legacy', 'tok');
      upsertAccountBinding(db, 'user-mismatch', 'openid-new', 'nonce-current', 'cipher', 'tag');

      // Giả lập truyền expectedNonce cũ khác với generation hiện tại trong SQLite
      expireBinding(db, 'user-mismatch', 'nonce-STALE');

      // Vì nonce-STALE không khớp nonce-current -> SQLite UPDATE có changes === 0 -> KHÔNG được xóa legacy token
      expect(getDfToken(db, 'user-mismatch')).toBeDefined();
      expect(getActiveBinding(db, 'user-mismatch')?.status).toBe('active');
    });

    it('khi SQLite generation thay đổi giữa lúc đọc ban đầu và UPDATE (race condition): trả về generation_mismatch và bảo lưu legacy token', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

      // Ban đầu user có binding gen-1 và legacy token
      saveDfToken(db, 'user-race', 'openid-1', 'tok-1');
      upsertAccountBinding(db, 'user-race', 'openid-1', 'nonce-gen-1', 'cipher-1', 'tag-1');

      // Giả lập giữa lúc đọc ban đầu và conditional UPDATE, một tiến trình khác update sang gen-2
      (mongoModule.revokeAccountBindingInMongo as jest.Mock).mockImplementationOnce(async () => {
        // Cập nhật ngầm SQLite sang gen-2
        upsertAccountBinding(db, 'user-race', 'openid-2', 'nonce-gen-2', 'cipher-2', 'tag-2');
        return { success: true, status: 'updated', modifiedCount: 1 };
      });

      const result = await revokeBindingAsync(db, 'user-race');

      // Phải phát hiện changes === 0 và re-read thấy active gen-2 -> trả về generation_mismatch
      expect(result.success).toBe(false);
      expect(result.error).toBe('generation_mismatch');

      // Tuyệt đối không xóa legacy token của user vì có generation mới đang active
      expect(getDfToken(db, 'user-race')).toBeDefined();

      // Binding active thế hệ mới gen-2 vẫn được bảo toàn nguyên vẹn
      const activeBinding = getActiveBinding(db, 'user-race');
      expect(activeBinding).toBeDefined();
      expect(activeBinding?.cred_nonce).toBe('nonce-gen-2');
    });

    it('khi truyền expectedNonce không khớp generation active hiện tại: trả về generation_mismatch và không xóa legacy token', async () => {
      saveDfToken(db, 'user-stale', 'openid-stale', 'tok-stale');
      upsertAccountBinding(db, 'user-stale', 'openid-stale', 'nonce-current', 'cipher', 'tag');

      const result = await revokeBindingAsync(db, 'user-stale', 'nonce-OUTDATED');

      expect(result.success).toBe(false);
      expect(result.error).toBe('generation_mismatch');
      expect(getDfToken(db, 'user-stale')).toBeDefined();
      expect(getActiveBinding(db, 'user-stale')?.cred_nonce).toBe('nonce-current');
    });

    it('khi SQLite record đã ở trạng thái inactive (revoked): trả về success và xóa token legacy theo idempotent contract', async () => {
      saveDfToken(db, 'user-inactive', 'openid-inact', 'tok-old');
      upsertAccountBinding(db, 'user-inactive', 'openid-inact', 'nonce-inact', 'cipher', 'tag');
      revokeBinding(db, 'user-inactive'); // Đã chuyển sang revoked

      // Thêm lại token legacy để kiểm tra xem idempotent cleanup có xóa dọn không
      saveDfToken(db, 'user-inactive', 'openid-inact', 'tok-leftover');

      const result = await revokeBindingAsync(db, 'user-inactive');

      expect(result.success).toBe(true);
      expect(getDfToken(db, 'user-inactive')).toBeUndefined();
    });

    it('khi SQLite record hoàn toàn không tồn tại (chỉ có legacy token): trả về success và xóa token legacy', async () => {
      saveDfToken(db, 'user-legacy-only', 'openid-legacy', 'tok-only');

      const result = await revokeBindingAsync(db, 'user-legacy-only');

      expect(result.success).toBe(true);
      expect(getDfToken(db, 'user-legacy-only')).toBeUndefined();
    });
  });

  describe('touchLastOk', () => {
    it('cập nhật last_ok_at trong SQLite và trigger touchLastOkInMongo khi Mongo connected', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-ok', 'openid-ok', 'nonce', 'cipher', 'tag');

      const before = getActiveBinding(db, 'user-ok');
      expect(before?.last_ok_at).toBeNull();

      touchLastOk(db, 'user-ok');

      const after = getActiveBinding(db, 'user-ok');
      expect(after?.last_ok_at).not.toBeNull();
      expect(mongoModule.touchLastOkInMongo).toHaveBeenCalledWith('user-ok');
    });
  });

  describe('updateLastError', () => {
    it('cập nhật last_error và truncate tối đa 500 ký tự', () => {
      upsertAccountBinding(db, 'user-err', 'openid-err', 'nonce', 'cipher', 'tag');

      const longError = 'E'.repeat(600);
      updateLastError(db, 'user-err', longError);

      const row = getActiveBinding(db, 'user-err');
      expect(row?.last_error).toBeDefined();
      expect(row?.last_error?.length).toBe(500);
      expect(row?.last_error).toBe('E'.repeat(500));
    });
  });

  describe('syncBindingsFromMongoToSqlite (Startup & Reconciliation)', () => {
    it('trả về 0 khi isMongoConnected() trả về false', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(0);
      expect(mongoModule.loadAllActiveBindingsFromMongo).not.toHaveBeenCalled();
    });

    it('trả về 0 và KHÔNG reconcile SQLite khi loadAllActiveBindingsFromMongo trả về null (lỗi truy vấn)', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce(null);

      // Đã có binding active trong SQLite
      upsertAccountBinding(db, 'user-safe', 'openid-s', 'nonce-s', 'c', 't');

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(0);

      // Binding active trong SQLite KHÔNG bị xóa hay revoke nhầm
      expect(getActiveBinding(db, 'user-safe')).toBeDefined();
    });

    it('chạy reconciliation dọn phantom active bindings trong SQLite khi MongoDB trả về danh sách rỗng []', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce([]);

      // SQLite có 1 binding active cũ nhưng Mongo không còn active
      upsertAccountBinding(db, 'user-phantom', 'openid-p', 'nonce-p', 'c', 't');
      saveDfToken(db, 'user-phantom', 'openid-p', 'tok');
      expect(getActiveBinding(db, 'user-phantom')).toBeDefined();

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(0);

      // Reconciliation phải chuyển binding sang revoked và xóa token legacy
      expect(getActiveBinding(db, 'user-phantom')).toBeUndefined();
      expect(getDfToken(db, 'user-phantom')).toBeUndefined();
    });

    it('đồng bộ thành công và fallback new Date().toISOString() khi captured_at falsy', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce([
        {
          discord_user_id: 'user-sync-1',
          openid: 'openid-sync-1',
          cred_nonce: 'nonce-s1',
          cred_ciphertext: 'cipher-s1',
          cred_tag: 'tag-s1',
          key_version: 'v1',
          captured_at: new Date('2025-01-01T00:00:00Z'),
        },
        {
          discord_user_id: 'user-sync-2',
          openid: 'openid-sync-2',
          cred_nonce: 'nonce-s2',
          cred_ciphertext: 'cipher-s2',
          cred_tag: 'tag-s2',
          key_version: 'v1',
          captured_at: null,
        },
      ]);

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(2);

      const row1 = getActiveBinding(db, 'user-sync-1');
      expect(row1).toBeDefined();
      expect(row1?.captured_at).toBe('2025-01-01T00:00:00.000Z');

      const row2 = getActiveBinding(db, 'user-sync-2');
      expect(row2).toBeDefined();
      expect(row2?.captured_at).toBeTruthy();
    });
  });
});
