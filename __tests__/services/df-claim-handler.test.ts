/**
 * Unit tests cho df-claim-handler.ts — Persistent Store First & SQLite Cache.
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { handleClaim } from '../../src/services/df-claim-handler.js';
import { initializeClaimSessionsTable, createClaimSession } from '../../src/database/df-claim.db.js';
import {
  initializeAccountBindingsTable,
  getActiveBinding,
  syncBindingsFromMongoToSqlite,
} from '../../src/database/df-binding.db.js';
import { initCryptoKey } from '../../src/services/df-crypto.js';
import * as mongoModule from '../../src/database/mongo/index.js';

jest.mock('../../src/database/mongo/index.js', () => ({
  isMongoConnected: jest.fn(() => false),
  upsertAccountBindingToMongo: jest.fn().mockResolvedValue(true),
  loadAllActiveBindingsFromMongo: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/deltaforce.api.js', () => ({
  validateToken: jest.fn().mockResolvedValue(true),
}));

describe('df-claim-handler — Persistent Store First', () => {
  let db: Database.Database;
  const originalKey = process.env.DF_CRED_KEY_V1;
  const mockClient: any = {
    users: {
      fetch: jest.fn().mockResolvedValue({
        send: jest.fn().mockResolvedValue(undefined),
      }),
    },
  };

  beforeAll(() => {
    process.env.DF_CRED_KEY_V1 = crypto.randomBytes(32).toString('base64');
    initCryptoKey('v1');
  });

  afterAll(() => {
    process.env.DF_CRED_KEY_V1 = originalKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(false);
    (mongoModule.upsertAccountBindingToMongo as jest.Mock).mockResolvedValue(true);

    db = new Database(':memory:');
    initializeClaimSessionsTable(db);
    initializeAccountBindingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  it('trả về 400 khi body thiếu thông tin', async () => {
    const result = await handleClaim({}, db, mockClient);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('invalid_body');
  });

  it('trả về 401 khi claim code không tồn tại', async () => {
    const result = await handleClaim(
      { code: 'NONEXIST', openid: 'open123', token: 'token123' },
      db,
      mockClient,
    );
    expect(result.status).toBe(401);
  });

  it('thành công ở chế độ SQLite-only (isMongoConnected === false)', async () => {
    const code = 'VALID1';
    const userId = 'user-100';
    createClaimSession(db, code, userId, Date.now() + 600000);

    const result = await handleClaim(
      { code, openid: 'openid-100', token: 'token-100' },
      db,
      mockClient,
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);

    const binding = getActiveBinding(db, userId);
    expect(binding).toBeDefined();
    expect(binding?.openid).toBe('openid-100');
    expect(mongoModule.upsertAccountBindingToMongo).not.toHaveBeenCalled();
  });

  it('Persistent Store First: gọi MongoDB trước khi ghi SQLite khi isMongoConnected === true', async () => {
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

    const code = 'MONGO1';
    const userId = 'user-200';
    createClaimSession(db, code, userId, Date.now() + 600000);

    const result = await handleClaim(
      { code, openid: 'openid-200', token: 'token-200' },
      db,
      mockClient,
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(mongoModule.upsertAccountBindingToMongo).toHaveBeenCalledWith(
      expect.objectContaining({
        discord_user_id: userId,
        openid: 'openid-200',
        key_version: 'v1',
      }),
    );

    const binding = getActiveBinding(db, userId);
    expect(binding).toBeDefined();
    expect(binding?.openid).toBe('openid-200');
  });

  it('Persistent Store First: trả về 503 database_unavailable và KHÔNG ghi SQLite khi MongoDB lỗi', async () => {
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);
    (mongoModule.upsertAccountBindingToMongo as jest.Mock).mockResolvedValueOnce(false);

    const code = 'FAILMG';
    const userId = 'user-300';
    createClaimSession(db, code, userId, Date.now() + 600000);

    const result = await handleClaim(
      { code, openid: 'openid-300', token: 'token-300' },
      db,
      mockClient,
    );

    expect(result.status).toBe(503);
    expect(result.body.error).toBe('database_unavailable');

    // SQLite KHÔNG được ghi vì MongoDB persistent store đã thất bại
    const binding = getActiveBinding(db, userId);
    expect(binding).toBeUndefined();
  });

  it('khi MongoDB thành công nhưng SQLite ghi lỗi: trả về 500 server_error, không DM, và phục hồi qua startup sync', async () => {
    (mongoModule.isMongoConnected as jest.Mock).mockReturnValue(true);

    let savedMongoDoc: any = null;
    (mongoModule.upsertAccountBindingToMongo as jest.Mock).mockImplementationOnce(async (doc: any) => {
      savedMongoDoc = { ...doc, status: 'active', updated_at: new Date() };
      return true;
    });

    const code = 'SQLFAIL';
    const userId = 'user-sql-err';
    createClaimSession(db, code, userId, Date.now() + 600000);

    // Mock SQLite database.prepare để giả lập lỗi khi ghi SQLite df_account_bindings
    const originalPrepare = db.prepare.bind(db);
    jest.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO df_account_bindings')) {
        throw new Error('SQLite disk full / write error');
      }
      return originalPrepare(sql);
    });

    const result = await handleClaim(
      { code, openid: 'openid-sql-err', token: 'token-sql-err' },
      db,
      mockClient,
    );

    // 1. Phải trả lỗi 500 server_error, không được báo thành công
    expect(result.status).toBe(500);
    expect(result.body.error).toBe('server_error');

    // 2. Không được gửi DM cho user
    expect(mockClient.users.fetch).not.toHaveBeenCalled();

    // 3. Khôi phục lại DB prepare để kiểm tra startup sync
    (db.prepare as jest.Mock).mockRestore();

    // MongoDB đã lưu binding thành công
    expect(savedMongoDoc).not.toBeNull();
    (mongoModule.loadAllActiveBindingsFromMongo as jest.Mock).mockResolvedValueOnce([savedMongoDoc]);

    // Khi bot reboot hoặc chạy startup reconciliation: SQLite được phục hồi đầy đủ từ MongoDB
    const synced = await syncBindingsFromMongoToSqlite(db);
    expect(synced).toBe(1);

    const restoredBinding = getActiveBinding(db, userId);
    expect(restoredBinding).toBeDefined();
    expect(restoredBinding?.openid).toBe('openid-sql-err');
  });

  it('BUG-01: chặn nếu Garena account đã bị link bởi Discord ID khác và KHÔNG đốt cháy claim code', async () => {
    // 1. User A đã liên kết openid-shared
    const userA = 'discord-user-A';
    const sharedOpenid = 'openid-shared';
    createClaimSession(db, 'CODE-A', userA, Date.now() + 600000);
    await handleClaim(
      { code: 'CODE-A', openid: sharedOpenid, token: 'token-a' },
      db,
      mockClient,
    );
    expect(getActiveBinding(db, userA)?.openid).toBe(sharedOpenid);

    // 2. User B cố gắng claim dùng chung openid-shared đó
    const userB = 'discord-user-B';
    const codeB = 'CODE-B-SAFE';
    createClaimSession(db, codeB, userB, Date.now() + 600000);

    const result = await handleClaim(
      { code: codeB, openid: sharedOpenid, token: 'token-b' },
      db,
      mockClient,
    );

    // Phải trả về 409 account_linked_to_other_discord
    expect(result.status).toBe(409);
    expect(result.body.error).toBe('account_linked_to_other_discord');

    // Claim session của User B KHÔNG bị tiêu thụ (vẫn ở trạng thái pending)
    const sessionB = db
      .prepare('SELECT status FROM df_claim_sessions WHERE code = ?')
      .get(codeB) as { status: string };
    expect(sessionB.status).toBe('pending');
  });

  it('BUG-01: cho phép chính chủ re-link tài khoản Garena để làm mới token', async () => {
    const userA = 'discord-user-relink';
    const openid = 'openid-relink';

    // 1. Link lần đầu
    createClaimSession(db, 'CODE-INIT', userA, Date.now() + 600000);
    const firstResult = await handleClaim(
      { code: 'CODE-INIT', openid, token: 'token-v1' },
      db,
      mockClient,
    );
    expect(firstResult.status).toBe(200);

    // 2. Re-link chính chủ bằng mã mới
    const relinkCode = 'CODE-RELINK';
    createClaimSession(db, relinkCode, userA, Date.now() + 600000);
    const relinkResult = await handleClaim(
      { code: relinkCode, openid, token: 'token-v2' },
      db,
      mockClient,
    );

    // Phải thành công thay vì báo lỗi account_linked_to_other_discord
    expect(relinkResult.status).toBe(200);
    expect(relinkResult.body.ok).toBe(true);

    // Claim code đã được consume hợp lệ
    const sessionRelink = db
      .prepare('SELECT status FROM df_claim_sessions WHERE code = ?')
      .get(relinkCode) as { status: string };
    expect(sessionRelink.status).toBe('consumed');
  });
});
