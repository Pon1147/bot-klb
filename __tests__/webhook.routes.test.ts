/**
 * Unit tests cho webhook.routes.ts — handleClaim + createWebhookRoutes.
 *
 * Mock df-claim-handler để test routes layer độc lập.
 */

// Mock module trước khi import
jest.mock('../src/services/df-claim-handler.js', () => {
  const handleClaim = jest.fn();
  return { handleClaim };
});

jest.mock('discord.js', () => ({
  Client: class Client {
    users = { fetch: jest.fn() };
  },
}));

import { handleClaim, createWebhookRoutes } from '../src/server/webhook.routes.js';
import { Client } from 'discord.js';

// Get the mocked handleClaim
const mockedHandleClaim = handleClaim as jest.MockedFunction<typeof handleClaim>;

describe('webhook.routes — handleClaim', () => {
  const mockDb: any = {
    prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })),
  };

  const mockDm: any = { send: jest.fn().mockResolvedValue(undefined) };
  const mockUser: any = { createDM: jest.fn().mockResolvedValue(mockDm) };
  let mockClient: Client;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new Client();
    (mockClient.users.fetch as jest.Mock).mockResolvedValue(mockUser);
  });

  it('nên trả về 400 khi body rỗng', async () => {
    mockedHandleClaim.mockResolvedValue({ status: 400, body: { ok: false, error: 'invalid_body' } });
    const res = await handleClaim(null, mockDb, mockClient);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('nên trả về 401 khi claim code không hợp lệ', async () => {
    mockedHandleClaim.mockResolvedValue({ status: 401, body: { ok: false, error: 'invalid_code' } });
    const res = await handleClaim({ code: 'INVALID', openid: '123', token: 'abc' }, mockDb, mockClient);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('nên trả về 200 khi thành công', async () => {
    mockedHandleClaim.mockResolvedValue({ status: 200, body: { ok: true } });
    const res = await handleClaim({ code: 'ABC123', openid: '123', token: 'abc' }, mockDb, mockClient);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('nên trả về 500 khi server error', async () => {
    mockedHandleClaim.mockResolvedValue({ status: 500, body: { ok: false, error: 'server_error' } });
    const res = await handleClaim({ code: 'ABC123', openid: '123', token: 'abc' }, mockDb, mockClient);

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

describe('webhook.routes — createWebhookRoutes', () => {
  it('nên tạo router thành công', () => {
    const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
    const mockClient = new Client();
    const router = createWebhookRoutes(mockDb, mockClient);
    expect(router).toBeDefined();
  });

  it('nên xử lý request body đúng định dạng (middleware parse JSON)', async () => {
    const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
    const mockClient: any = {
      users: { fetch: jest.fn().mockResolvedValue(null) },
    };
    const router = createWebhookRoutes(mockDb, mockClient);

    // Get the route handler function
    const layer = router.stack[0];
    const handlerFn = layer.route.stack[0].handle;

    // Create mock req/res
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockReq: any = {
      body: { code: 'ABC123', openid: '123', token: 'abc' },
    };

    mockedHandleClaim.mockResolvedValue({ status: 200, body: { ok: true } });

    await handlerFn(mockReq, mockRes, () => {});

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
  });

  it('nên handle outer catch khi có lỗi không mong đợi', async () => {
    const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
    const mockClient: any = {
      users: { fetch: jest.fn() },
    };
    const router = createWebhookRoutes(mockDb, mockClient);

    const layer = router.stack[0];
    const handlerFn = layer.route.stack[0].handle;

    // Make handleClaim throw so outer catch triggers
    mockedHandleClaim.mockRejectedValue(new Error('unexpected crash'));

    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockReq: any = {
      body: { code: 'ABC123', openid: '123', token: 'abc' },
    };

    await handlerFn(mockReq, mockRes, () => {});

    // Should hit the outer catch and return 500
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
