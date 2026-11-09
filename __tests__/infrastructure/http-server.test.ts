/// <reference types="jest" />
import http from 'node:http';
import { createRequestHandler, claimRateLimiter } from '../../src/infrastructure/http/http-server.js';
import * as claimHandlerModule from '../../src/services/df-claim-handler.js';

jest.mock('../../src/services/df-claim-handler.js', () => ({
  handleClaim: jest.fn(),
}));

describe('http-server (Extension Relay & Health Check)', () => {
  let mockClient: any;
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    mockClient = {
      guilds: { cache: { size: 5 } },
      database: {},
    };

    server = http.createServer(createRequestHandler(mockClient));
    // Listen trên port 0 để OS tự cấp phát port ngẫu nhiên không bị trùng
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        port = addr.port;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    claimRateLimiter.reset();
  });

  it('GET /health trả về 200 và thông tin trạng thái bot', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.guildsCount).toBe(5);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('OPTIONS /api/v1/auth/claim trả về 204 cho Preflight CORS', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'OPTIONS',
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('POST /api/v1/auth/claim xử lý thành công khi handleClaim trả về 200', async () => {
    (claimHandlerModule.handleClaim as jest.Mock).mockResolvedValue({
      status: 200,
      body: { ok: true },
    });

    const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '123456',
        openid: 'test-openid',
        token: 'test-token',
      }),
    });

    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(claimHandlerModule.handleClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '123456',
        openid: 'test-openid',
        token: 'test-token',
      }),
      mockClient.database,
      mockClient,
    );
  });

  it('POST /api/v1/auth/claim trả về lỗi 400 nếu dữ liệu JSON sai định dạng', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid_json ',
    });

    const data = (await res.json()) as any;
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('OPTIONS /api/v1/auth/claim chấp nhận Origin từ Chrome Extension', async () => {
    const extOrigin = 'chrome-extension://abcdefghijklmnop';
    const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'OPTIONS',
      headers: { Origin: extOrigin },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(extOrigin);
  });

  it('OPTIONS /api/v1/auth/claim chặn 403 Forbidden nếu Origin từ website độc hại', async () => {
    const maliciousOrigin = 'https://malicious-scam-site.com';
    const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'OPTIONS',
      headers: { Origin: maliciousOrigin },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('POST /api/v1/auth/claim kích hoạt Rate Limit 429 khi gửi vượt ngưỡng 10 req/phút từ cùng IP', async () => {
    (claimHandlerModule.handleClaim as jest.Mock).mockResolvedValue({
      status: 200,
      body: { ok: true },
    });

    // Gửi 10 request hợp lệ
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.1',
        },
        body: JSON.stringify({ code: `C${i}`, openid: 'id', token: 'tok' }),
      });
      expect(res.status).toBe(200);
    }

    // Request thứ 11 phải bị chặn 429
    const blockedRes = await fetch(`http://localhost:${port}/api/v1/auth/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.1',
      },
      body: JSON.stringify({ code: 'BLOCKED', openid: 'id', token: 'tok' }),
    });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('retry-after')).toBe('60');
    const blockedData = (await blockedRes.json()) as any;
    expect(blockedData.ok).toBe(false);
    expect(blockedData.error).toContain('Too many requests');
  });

  it('GET đường dẫn không xác định trả về 404', async () => {
    const res = await fetch(`http://localhost:${port}/api/unknown`);
    expect(res.status).toBe(404);
  });
});
