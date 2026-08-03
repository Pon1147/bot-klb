/**
 * Webhook Server E2E tests — real Express server + supertest.
 * Tests POST /api/df/claim với real DB (SQLite in-memory) + real claim handler.
 * Mocks: discord.js, df-crypto (crypto key).
 */

const request = require('supertest');
const express = require('express');

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('Webhook Server E2E — POST /api/df/claim', () => {
  let db: any;
  let app: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('discord.js', () => ({
      Client: class Client {},
    }));

    // Mock crypto to avoid needing real key in tests
    jest.mock('../../src/services/df-crypto', () => ({
      encryptCredential: jest.fn().mockReturnValue({
        nonce: 'mocknonce123',
        ciphertext: 'mockciphertext',
        tag: 'mocktag123',
      }),
    }));

    const { createTestDb } = require('./setup');
    db = createTestDb();

    // Initialize new DF Link tables
    const { initializeClaimSessionsTable } = require('../../src/database/df-claim.db');
    const { initializeAccountBindingsTable } = require('../../src/database/df-binding.db');
    initializeClaimSessionsTable(db);
    initializeAccountBindingsTable(db);
  });

  afterEach(() => {
    db.close();
    jest.restoreAllMocks();
  });

  function buildApp(mockClient: any) {
    const localExpress = express();

    localExpress.use(express.raw({ type: '*/*', limit: '4kb' }));

    localExpress.use((req: any, _res: any, next: any) => {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try {
          req.body = JSON.parse(req.body.toString('utf-8'));
        } catch {
          // ignore
        }
      }
      next();
    });

    const { handleClaim } = require('../../src/services/df-claim-handler');

    localExpress.post('/api/df/claim', async (req: any, res: any) => {
      let body = req.body;
      if ((!body || typeof body !== 'object') && (typeof req.body === 'string' || Buffer.isBuffer(req.body))) {
        try {
          body = JSON.parse(req.body.toString());
        } catch {
          // ignore
        }
      }
      const result = await handleClaim(body, db, mockClient);
      res.status(result.status).json(result.body);
    });

    localExpress.get('/health', (_req: any, res: any) => {
      res.json({ ok: true });
    });

    return localExpress;
  }

  function createMockDiscordClient(options: { dmBlocked?: boolean; userNotFound?: boolean } = {}) {
    const dm = {
      send: options.dmBlocked
        ? jest.fn().mockRejectedValue(new Error('Cannot send messages to this user'))
        : jest.fn().mockResolvedValue({}),
    };
    const user = {
      createDM: options.dmBlocked
        ? jest.fn().mockRejectedValue(new Error('DM blocked'))
        : jest.fn().mockResolvedValue(dm),
    };
    return {
      users: {
        fetch: options.userNotFound
          ? jest.fn().mockRejectedValue(new Error('User not found'))
          : jest.fn().mockResolvedValue(user),
      },
    };
  }

  describe('Happy path', () => {
    it('phải trả về 200 và lưu encrypted binding vào DB', async () => {
      const mockClient = createMockDiscordClient();
      app = buildApp(mockClient);

      // Create claim session in DB
      db.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                  VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('TESTCODE', 'discord-user-123');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'TESTCODE', openid: 'openid-1', token: 'token-abc', ts: '123', s: 'sig', u: 'usr' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const row = db.prepare('SELECT * FROM df_account_bindings WHERE discord_user_id = ?').get('discord-user-123');
      expect(row).toBeDefined();
      expect(row.openid).toBe('openid-1');
      expect(row.cred_ciphertext).toBeDefined();
      expect(row.cred_nonce).toBeDefined();
      expect(row.cred_tag).toBeDefined();
    });

    it('phải gửi DM khi liên kết thành công', async () => {
      const mockClient = createMockDiscordClient();
      app = buildApp(mockClient);

      db.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                  VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('DMTEST', 'discord-user-123');

      await request(app)
        .post('/api/df/claim')
        .send({ code: 'DMTEST', openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      expect(mockClient.users.fetch).toHaveBeenCalledWith('discord-user-123');
    });
  });

  describe('Validation errors', () => {
    beforeEach(() => {
      app = buildApp(createMockDiscordClient());
    });

    it('phải trả về 400 khi body rỗng', async () => {
      const res = await request(app)
        .post('/api/df/claim')
        .send()
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('phải trả về 400 khi thiếu fields', async () => {
      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'ABC123', openid: '123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('phải trả về 401 khi claim code không tồn tại', async () => {
      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'INVALID', openid: '123', token: 'abc' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });

    it('phải trả về 401 khi mã đã dùng (single-use)', async () => {
      db.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                  VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('SINGLECODE', 'discord-single');

      let res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'SINGLECODE', openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);

      res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'SINGLECODE', openid: 'op-2', token: 'tok-2' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(401);
    });
  });

  describe('Health check', () => {
    beforeEach(() => {
      app = buildApp(createMockDiscordClient());
    });

    it('phải trả về 200 tại /health', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('DM failure handling', () => {
    it('phải thành công ngay cả khi DM bị block', async () => {
      const mockClient = createMockDiscordClient({ dmBlocked: true });
      app = buildApp(mockClient);

      db.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                  VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('DMBLOCK', 'discord-dm-blocked');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'DMBLOCK', openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);

      const row = db.prepare('SELECT * FROM df_account_bindings WHERE discord_user_id = ?').get('discord-dm-blocked');
      expect(row).toBeDefined();
    });

    it('phải thành công ngay cả khi user không tìm thấy', async () => {
      const mockClient = createMockDiscordClient({ userNotFound: true });
      app = buildApp(mockClient);

      db.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                  VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('NUSER', 'discord-user-not-found');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'NUSER', openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });
  });
});

// ── createWebhookRoutes (full router) ──────────────────────────────

describe('Webhook Server E2E — createWebhookRoutes', () => {
  let testDb: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('discord.js', () => ({
      Client: class Client {},
    }));

    // Mock crypto to avoid needing real key in tests
    jest.mock('../../src/services/df-crypto', () => ({
      encryptCredential: jest.fn().mockReturnValue({
        nonce: 'mocknonce123',
        ciphertext: 'mockciphertext',
        tag: 'mocktag123',
      }),
    }));

    const { createTestDb } = require('./setup');
    testDb = createTestDb();

    const { initializeClaimSessionsTable } = require('../../src/database/df-claim.db');
    const { initializeAccountBindingsTable } = require('../../src/database/df-binding.db');
    initializeClaimSessionsTable(testDb);
    initializeAccountBindingsTable(testDb);
  });

  afterEach(() => {
    testDb.close();
    jest.restoreAllMocks();
  });

  it('phải trả về router xử lý POST /claim', async () => {
    const mockClient = {
      users: {
        fetch: jest.fn().mockResolvedValue({
          createDM: jest.fn().mockResolvedValue({
            send: jest.fn().mockResolvedValue({}),
          }),
        }),
      },
    };

    const { createWebhookRoutes } = require('../../src/server/webhook.routes');
    const router = createWebhookRoutes(testDb, mockClient);

    const localApp = express();
    localApp.use(express.raw({ type: '*/*', limit: '4kb' }));
    localApp.use((req: any, _res: any, next: any) => {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try { req.body = JSON.parse(req.body.toString('utf-8')); } catch {}
      }
      next();
    });
    localApp.use('/api/df', router);

    testDb.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                    VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('ROUTERTEST', 'discord-router');

    const res = await request(localApp)
      .post('/api/df/claim')
      .send({ code: 'ROUTERTEST', openid: 'op-1', token: 'tok-1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('phải trả về 500 khi upsertAccountBinding ném lỗi', async () => {
    const mockClient = {
      users: {
        fetch: jest.fn().mockResolvedValue({
          createDM: jest.fn().mockResolvedValue({
            send: jest.fn().mockResolvedValue({}),
          }),
        }),
      },
    };

    const { createWebhookRoutes } = require('../../src/server/webhook.routes');
    const router = createWebhookRoutes(testDb, mockClient);

    const localApp = express();
    localApp.use(express.raw({ type: '*/*', limit: '4kb' }));
    localApp.use((req: any, _res: any, next: any) => {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try { req.body = JSON.parse(req.body.toString('utf-8')); } catch {}
      }
      next();
    });
    localApp.use('/api/df', router);

    // Drop the binding table to trigger DB error
    testDb.exec('DROP TABLE df_account_bindings');

    testDb.prepare(`INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
                    VALUES (?, ?, 'pending', datetime('now', '+10 minutes'))`).run('DBERR', 'discord-db-error');

    const res = await request(localApp)
      .post('/api/df/claim')
      .send({ code: 'DBERR', openid: 'op-1', token: 'tok-1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});
