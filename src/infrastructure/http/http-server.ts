/**
 * HTTP Server module — cung cấp REST API endpoint cho Extension liên kết tài khoản.
 *
 * Thay thế hoàn toàn cơ chế Discord Webhook:
 * - Extension gửi trực tiếp POST /api/v1/auth/claim lên Bot Server
 * - Hỗ trợ CORS cho Chrome Extension
 * - Cung cấp GET /health phục vụ Railway / Docker health check
 *
 * Sử dụng native node:http — nhẹ, an toàn, 0 dependencies bên ngoài.
 */

import http from 'node:http';
import { Client } from 'discord.js';
import { botConfig } from '../../config/bot.config.js';
import { handleClaim } from '../../services/df-claim-handler.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('HttpServer');

/** Giới hạn kích thước body tối đa (64KB) chống tấn công DoS */
const MAX_PAYLOAD_SIZE = 64 * 1024;

/**
 * Gán các header CORS cho response để Chrome Extension gọi API trơn tru.
 */
function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Đọc và phân tích JSON payload từ request stream một cách an toàn.
 */
function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_PAYLOAD_SIZE) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Tạo request handler xử lý các routes của bot.
 */
export function createRequestHandler(client: Client): http.RequestListener {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    setCorsHeaders(res);

    // Xử lý Preflight OPTIONS request từ trình duyệt
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // ─── Health Check Route ──────────────────────────────────────────
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          guildsCount: client.guilds?.cache?.size ?? 0,
        }),
      );
      return;
    }

    // ─── Endpoint Liên kết Tài khoản từ Extension ──────────────────────
    if (req.method === 'POST' && pathname === '/api/v1/auth/claim') {
      try {
        const body = await readJsonBody(req);
        const result = await handleClaim(body, client.database, client);

        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (error) {
        logger.error('Lỗi xử lý API claim:', {
          message: error instanceof Error ? error.message : String(error),
        });

        const status = error instanceof Error && error.message === 'Payload too large' ? 413 : 400;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : 'Invalid request',
          }),
        );
      }
      return;
    }

    // ─── Route Không tồn tại (404) ───────────────────────────────────
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  };
}

/**
 * Khởi động HTTP Server cho bot.
 */
export function startHttpServer(client: Client, port?: number): Promise<http.Server> {
  const listenPort = port ?? botConfig.port;

  return new Promise((resolve, reject) => {
    const server = http.createServer(createRequestHandler(client));

    server.listen(listenPort, () => {
      logger.info(`✓ HTTP Server đang lắng nghe tại cổng ${listenPort}`);
      logger.info(`✓ API Link Endpoint: ${botConfig.botPublicApiUrl}/api/v1/auth/claim`);
      resolve(server);
    });

    server.on('error', (err) => {
      logger.error('Lỗi khởi động HTTP Server: ' + err.message);
      reject(err);
    });
  });
}

/**
 * Dừng HTTP Server an toàn.
 */
export function stopHttpServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('HTTP Server đã đóng an toàn');
      resolve();
    });
  });
}
