/**
 * Webhook Server E2E tests — real Express server + supertest.
 * Tests POST /api/df/claim with real df-claim-store and real SQLite DB.
 * Only mocks: discord.js (Discord client).
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

    const { createTestDb } = require('./setup');
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
    jest.restoreAllMocks();
  });

  function buildApp(mockClient: any) {
    const localExpress = express();

    localExpress.use(express.raw({ type: '*/*', limit: '10mb' }));

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

    localExpress.use(express.urlencoded({ extended: true }));

    localExpress.use((_req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (_req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });

    const { handleClaimRequest } = require('../../src/server/webhook.routes');

    localExpress.post('/api/df/claim', async (req: any, res: any) => {
      let body = req.body;
      if ((!body || typeof body !== 'object') && (typeof req.body === 'string' || Buffer.isBuffer(req.body))) {
        try {
          body = JSON.parse(req.body.toString());
        } catch {
          // ignore
        }
      }
      const result = await handleClaimRequest(body, db, mockClient);
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
    it('phải trả về 200 và lưu token vào DB', async () => {
      const mockClient = createMockDiscordClient();
      app = buildApp(mockClient);

      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-user-123');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'openid-1', token: 'token-abc', ts: '123', s: 'sig', u: 'usr' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('linked');

      const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-user-123');
      expect(row).toBeDefined();
      expect(row.openid).toBe('openid-1');
      expect(row.token).toBe('token-abc');
      expect(row.ts).toBe('123');
    });

    it('phải gửi DM khi liên kết thành công', async () => {
      const mockClient = createMockDiscordClient();
      app = buildApp(mockClient);

      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-user-123');

      await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-1', token: 'tok-1', ts: '1', s: 's', u: 'u' })
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
      expect(res.body.status).toBe('error');
    });

    it('phải trả về 400 khi thiếu fields', async () => {
      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'ABC123', openid: '123' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Thiếu thông tin');
    });

    it('phải trả về 400 khi mã claim không tồn tại', async () => {
      const { resetStore } = require('../../src/services/df-claim-store');
      resetStore();

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code: 'INVALID', openid: '123', token: 'abc' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('không hợp lệ');
    });

    it('phải trả về 400 khi mã đã dùng (single-use)', async () => {
      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-single-use');

      let res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);

      res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-2', token: 'tok-2' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
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

      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-dm-blocked');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);

      const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-dm-blocked');
      expect(row).toBeDefined();
    });

    it('phải thành công ngay cả khi user không tìm thấy', async () => {
      const mockClient = createMockDiscordClient({ userNotFound: true });
      app = buildApp(mockClient);

      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-user-not-found');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
    });

    it('phải xử lý khi dm.send ném exception (DM catch)', async () => {
      // dm.send throws → triggers line 84-85 catch block
      const mockClient = {
        users: {
          fetch: jest.fn().mockResolvedValue({
            createDM: jest.fn().mockResolvedValue({
              send: jest.fn().mockRejectedValue(new Error('DM send failed')),
            }),
          }),
        },
      };
      app = buildApp(mockClient);

      const { generateCode, resetStore } = require('../../src/services/df-claim-store');
      resetStore();
      const code = generateCode('discord-dm-send-fail');

      const res = await request(app)
        .post('/api/df/claim')
        .send({ code, openid: 'op-1', token: 'tok-1' })
        .set('Content-Type', 'application/json');

      // 200 status means DM failure was caught gracefully
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('linked');
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

    const { createTestDb } = require('./setup');
    testDb = createTestDb();
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
    localApp.use(express.json());
    localApp.use('/api/df', router);

    const { generateCode, resetStore } = require('../../src/services/df-claim-store');
    resetStore();
    const code = generateCode('discord-router-test');

    const res = await request(localApp)
      .post('/api/df/claim')
      .send({ code, openid: 'op-1', token: 'tok-1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('linked');
  });

  it('phải trả về 500 khi saveDfToken ném lỗi', async () => {
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
    localApp.use(express.json());
    localApp.use('/api/df', router);

    const { generateCode, resetStore } = require('../../src/services/df-claim-store');
    resetStore();
    const code = generateCode('discord-db-error');

    // Make saveDfToken throw by dropping the table
    testDb.exec('DROP TABLE df_tokens');

    const res = await request(localApp)
      .post('/api/df/claim')
      .send({ code, openid: 'op-1', token: 'tok-1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });

  it('phải xử lý raw JSON body (fallback parse)', async () => {
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
    // Mimic buildApp: raw body + fallback parse + urlencoded + json
    localApp.use(express.raw({ type: '*/*', limit: '10mb' }));
    localApp.use((req: any, _res: any, next: any) => {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try { req.body = JSON.parse(req.body.toString('utf-8')); } catch {}
      }
      next();
    });
    localApp.use(express.urlencoded({ extended: true }));
    localApp.use('/api/df', router);

    const { generateCode, resetStore } = require('../../src/services/df-claim-store');
    resetStore();
    const code = generateCode('discord-raw-body');

    const payload = JSON.stringify({ code, openid: 'op-1', token: 'tok-1' });
    const res = await request(localApp)
      .post('/api/df/claim')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('linked');
  });
});
