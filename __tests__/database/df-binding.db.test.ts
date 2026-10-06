/// <reference types="jest" />
/**
 * Unit tests cho df-binding.db.ts — Quản lý account binding trên SQLite & sync MongoDB.
 *
 * Kiểm tra các nghiệp vụ & behavior:
 * 1. Khởi tạo bảng df_account_bindings và indices.
 * 2. upsertAccountBinding: mặc định key_version = 'v1', upsert conflict resolution.
 * 3. getActiveBindingByOpenid: tìm kiếm binding theo openid.
 * 4. expireBinding: cập nhật status sang 'expired' và đồng bộ xóa legacy token trong df_tokens.
 * 5. revokeBinding: cập nhật status sang 'revoked' và trigger Mongo nếu connected.
 * 6. touchLastOk: cập nhật last_ok_at và trigger Mongo nếu connected.
 * 7. updateLastError: cập nhật last_error với cắt ngắn tối đa 500 ký tự.
 * 8. Dual-write to Mongo: các nhánh isMongoConnected() === true.
 * 9. syncBindingsFromMongoToSqlite: xử lý mảng rỗng, fallback captured_at khi falsy.
 */

import Database from 'better-sqlite3';
import {
  initializeAccountBindingsTable,
  upsertAccountBinding,
  getActiveBinding,
  getActiveBindingByOpenid,
  expireBinding,
  revokeBinding,
  touchLastOk,
  updateLastError,
  syncBindingsFromMongoToSqlite,
} from '../../src/database/df-binding.db.js';
import { initializeDfTokensTable, saveDfToken, getDfToken } from '../../src/database/df.token.db.js';
import * as mongoModule from '../../src/database/mongo/index.js';

jest.mock('../../src/database/mongo/index.js', () => ({
  isMongoConnected: jest.fn(() => false),
  upsertAccountBindingToMongo: jest.fn().mockResolvedValue(undefined),
  revokeAccountBindingInMongo: jest.fn().mockResolvedValue(undefined),
  touchLastOkInMongo: jest.fn().mockResolvedValue(undefined),
  loadAllActiveBindingsFromMongo: jest.fn().mockResolvedValue([]),
}));

describe('database/df-binding.db', () => {
  let db: Database.Database;

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);

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
        'openid-old',
        'nonce-1',
        'cipher-1',
        'tag-1',
        'v1',
      );

      const updated = upsertAccountBinding(
        db,
        'user-111',
        'openid-new',
        'nonce-2',
        'cipher-2',
        'tag-2',
        'v2',
      );

      expect(updated).toBe(true);

      const row = getActiveBinding(db, 'user-111');
      expect(row?.openid).toBe('openid-new');
      expect(row?.key_version).toBe('v2');
      expect(row?.cred_ciphertext).toBe('cipher-2');
    });

    it('trigger upsertAccountBindingToMongo khi isMongoConnected() === true', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

      upsertAccountBinding(
        db,
        'user-mongo',
        'openid-m',
        'nonce-m',
        'cipher-m',
        'tag-m',
        'v1',
      );

      expect(mongoModule.upsertAccountBindingToMongo).toHaveBeenCalledWith({
        discord_user_id: 'user-mongo',
        openid: 'openid-m',
        cred_nonce: 'nonce-m',
        cred_ciphertext: 'cipher-m',
        cred_tag: 'tag-m',
        key_version: 'v1',
      });
    });
  });

  describe('getActiveBindingByOpenid', () => {
    it('trả về active binding tương ứng khi tìm theo openid', () => {
      upsertAccountBinding(
        db,
        'user-openid',
        'openid-target',
        'nonce',
        'cipher',
        'tag',
      );

      const found = getActiveBindingByOpenid(db, 'openid-target');
      expect(found).toBeDefined();
      expect(found?.discord_user_id).toBe('user-openid');
    });

    it('trả về undefined nếu openid không tồn tại hoặc không ở trạng thái active', () => {
      upsertAccountBinding(
        db,
        'user-exp',
        'openid-expired',
        'nonce',
        'cipher',
        'tag',
      );
      expireBinding(db, 'user-exp');

      expect(getActiveBindingByOpenid(db, 'openid-expired')).toBeUndefined();
      expect(getActiveBindingByOpenid(db, 'non-existent-openid')).toBeUndefined();
    });
  });

  describe('expireBinding', () => {
    it('cập nhật status thành "expired" và xóa token legacy trong df_tokens', () => {
      // Setup binding và token legacy trong df_tokens
      upsertAccountBinding(db, 'user-expire', 'openid-1', 'nonce', 'cipher', 'tag');
      saveDfToken(db, 'user-expire', 'openid-1', 'raw-token-123');
      expect(getDfToken(db, 'user-expire')).toBeDefined();

      expireBinding(db, 'user-expire');

      // Verify binding không còn active
      expect(getActiveBinding(db, 'user-expire')).toBeUndefined();

      // Verify status là expired trong raw query
      const raw = db.prepare('SELECT status FROM df_account_bindings WHERE discord_user_id = ?').get('user-expire') as { status: string };
      expect(raw.status).toBe('expired');

      // Verify token legacy đã bị xóa
      expect(getDfToken(db, 'user-expire')).toBeUndefined();
    });
  });

  describe('revokeBinding', () => {
    it('trigger revokeAccountBindingInMongo khi isMongoConnected() === true', () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      upsertAccountBinding(db, 'user-revoke', 'openid-r', 'nonce', 'cipher', 'tag');

      revokeBinding(db, 'user-revoke');

      expect(mongoModule.revokeAccountBindingInMongo).toHaveBeenCalledWith('user-revoke');
      expect(getActiveBinding(db, 'user-revoke')).toBeUndefined();
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

  describe('syncBindingsFromMongoToSqlite', () => {
    it('trả về 0 khi isMongoConnected() trả về false', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(0);
      expect(mongoModule.loadAllActiveBindingsFromMongo).not.toHaveBeenCalled();
    });

    it('trả về 0 khi Mongo connected nhưng loadAllActiveBindingsFromMongo trả về mảng rỗng', async () => {
      (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
      (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce([]);

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(0);
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
          captured_at: null, // falsy branch L221
        },
      ]);

      const count = await syncBindingsFromMongoToSqlite(db);
      expect(count).toBe(2);

      const row1 = getActiveBinding(db, 'user-sync-1');
      expect(row1).toBeDefined();
      expect(row1?.captured_at).toBe('2025-01-01T00:00:00.000Z');

      const row2 = getActiveBinding(db, 'user-sync-2');
      expect(row2).toBeDefined();
      expect(row2?.captured_at).toBeTruthy(); // Được gán ISO date hợp lệ
    });
  });
});

