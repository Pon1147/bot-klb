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
import { BOT_VERSION, EXTENSION_VERSION } from '../../config/version.js';
import { handleClaim } from '../../services/df-claim-handler.js';
import { verifyPayosWebhook, PayosWebhookPayload } from '../../services/payos.service.js';
import {
  getDonationByOrderCode,
  updateDonationStatus,
} from '../../features/payment/payment.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('HttpServer');

/** Giới hạn kích thước body tối đa (64KB) chống tấn công DoS */
const MAX_PAYLOAD_SIZE = 64 * 1024;

/**
 * Sliding window rate limiter in-memory nhẹ (KISS).
 * Chống brute-force và DoS attack theo IP trên endpoint nhạy cảm.
 */
export class SimpleRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number = 60_000,
    private readonly maxRequests: number = 10,
  ) {}

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.maxRequests) {
      this.hits.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    // Tự động dọn dẹp bộ nhớ nếu kích thước Map vượt quá 1,000 entries
    if (this.hits.size > 1000) {
      for (const [k, v] of this.hits.entries()) {
        const valid = v.filter((t) => now - t < this.windowMs);
        if (valid.length === 0) this.hits.delete(k);
        else this.hits.set(k, valid);
      }
    }

    return false;
  }

  public reset(): void {
    this.hits.clear();
  }
}

/** Rate limiter cho POST /api/v1/auth/claim: tối đa 10 requests / phút / IP */
export const claimRateLimiter = new SimpleRateLimiter(60_000, 10);

/**
 * Trích xuất IP của client an toàn (hỗ trợ reverse proxy như Railway / Cloudflare).
 */
function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Kiểm tra xem Origin gửi lên có nằm trong danh sách an toàn không.
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin || origin === 'null' || origin === 'none') return true;
  // Cho phép browser extensions (Chrome, Firefox, Edge...)
  if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
    return true;
  }
  // Cho phép web portal chính thức của Delta Force
  if (origin === 'https://www.playdeltaforce.com' || origin.endsWith('.playdeltaforce.com')) {
    return true;
  }
  // Cho phép localhost ở môi trường dev / test
  if (
    botConfig.env !== 'product' &&
    (origin.includes('localhost') || origin.includes('127.0.0.1'))
  ) {
    return true;
  }
  return false;
}

/**
 * Gán các header CORS an toàn cho response.
 * Từ chối hoặc không phản chiếu các Origin đáng ngờ từ web lạ.
 */
function setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = req.headers.origin;

  if (origin) {
    if (!isAllowedOrigin(origin)) {
      return false;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  return true;
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
    const isCorsAllowed = setCorsHeaders(req, res);

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const origin = req.headers.origin || 'none';

    // Xử lý Preflight OPTIONS request từ trình duyệt
    if (req.method === 'OPTIONS') {
      if (!isCorsAllowed) {
        logger.warn(`[HttpServer] Blocked unauthorized CORS preflight from Origin: ${origin}`);
        res.writeHead(403);
        res.end();
        return;
      }
      logger.info(`[HttpServer] OPTIONS ${pathname} preflight handled (Origin: ${origin})`);
      res.writeHead(204);
      res.end();
      return;
    }

    logger.info(`[HttpServer] Incoming ${req.method} ${pathname} (Origin: ${origin})`);

    // ─── Health Check Route ──────────────────────────────────────────
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Ở môi trường product: che giấu version và guildsCount để chống fingerprinting
      const isProd = botConfig.env === 'product';
      const healthPayload = isProd
        ? {
            status: 'ok',
            timestamp: new Date().toISOString(),
          }
        : {
            status: 'ok',
            botVersion: BOT_VERSION,
            extensionVersion: EXTENSION_VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            guildsCount: client.guilds?.cache?.size ?? 0,
          };
      res.end(JSON.stringify(healthPayload));
      return;
    }

    // ─── Endpoint Liên kết Tài khoản từ Extension ──────────────────────
    if (req.method === 'POST' && pathname === '/api/v1/auth/claim') {
      const clientIp = getClientIp(req);

      // Chống Brute-Force & DoS: Giới hạn 10 requests / phút cho mỗi IP
      if (claimRateLimiter.isRateLimited(clientIp)) {
        logger.warn(`[HttpServer] Rate limit exceeded for IP: ${clientIp}`);
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Too many requests. Please try again after 60 seconds.',
          }),
        );
        return;
      }

      try {
        const body = await readJsonBody(req);
        const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
        const maskedOpenid =
          typeof record.openid === 'string' ? `${record.openid.slice(0, 4)}***` : 'missing';
        logger.info(
          `[HttpServer] Processing claim: code=${record.code ?? 'missing'}, openid=${maskedOpenid}, hasToken=${Boolean(record.token)}`,
        );

        const result = await handleClaim(body, client.database, client);
        logger.info(
          `[HttpServer] Claim result: status=${result.status}, ok=${result.body.ok}${result.body.error ? `, error=${result.body.error}` : ''}`,
        );

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

    // ─── Trang Cảm ơn khi Browser được chuyển hướng từ PayOS (returnUrl) ──
    if (
      req.method === 'GET' &&
      (pathname === '/webhook/payment' || pathname === '/webhook/payos')
    ) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thanh Toán Thành Công</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 420px; }
    h2 { color: #38bdf8; margin-top: 0; }
    p { color: #94a3b8; line-height: 1.6; }
    a { display: inline-block; margin-top: 1.5rem; background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h2>☕ Cảm Ơn Bạn Đã Ủng Hộ!</h2>
    <p>Giao dịch qua PayOS của bạn đã hoàn tất và được ghi nhận.<br>Bạn có thể đóng tab này để quay lại Discord.</p>
    <a href="https://discord.com/app">Quay lại Discord</a>
  </div>
</body>
</html>`);
      return;
    }

    // ─── Webhook Thanh toán / Donate từ PayOS ────────────────────────
    if (
      req.method === 'POST' &&
      (pathname === '/webhook/payment' || pathname === '/webhook/payos')
    ) {
      try {
        const body = (await readJsonBody(req)) as Record<string, unknown>;

        // 1. PayOS Webhook URL Verification handshake (khi người dùng bấm 'Xác nhận Webhook' trên Dashboard PayOS)
        if (body && typeof body.webhookUrl === 'string') {
          logger.info(`[PayOS] Nhận handshake xác nhận webhookUrl: ${body.webhookUrl}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Webhook URL verified successfully' }));
          return;
        }

        // 2. Xác thực Webhook thanh toán chính thức
        const payload = body as unknown as PayosWebhookPayload;
        if (!payload || !payload.data || !payload.signature) {
          logger.warn('[PayOS] Webhook payload không đúng định dạng (thiếu data hoặc signature)');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Malformed webhook payload' }));
          return;
        }

        const isValid = verifyPayosWebhook(payload);
        if (!isValid) {
          logger.warn('[PayOS] Chữ ký Webhook không hợp lệ! (Invalid signature)');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid signature' }));
          return;
        }

        const webhookData = payload.data;
        const orderCode = Number(webhookData.orderCode);

        logger.info(
          `[PayOS] Nhận thông báo thanh toán hợp lệ: Mã #${orderCode}, Số tiền: ${webhookData.amount} đ`,
        );

        if (
          client.database &&
          Number.isInteger(orderCode) &&
          (payload.code === '00' || webhookData.code === '00')
        ) {
          const donation = getDonationByOrderCode(client.database, orderCode);
          if (donation) {
            updateDonationStatus(client.database, orderCode, 'paid');
            logger.info(
              `[PayOS] Đã xác nhận quyên góp thành công cho user: ${donation.user_tag} (${donation.user_id}) - ${donation.amount} VNĐ`,
            );
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, code: '00', desc: 'success' }));
      } catch (error) {
        logger.error('Lỗi khi xử lý PayOS webhook:', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
      return;
    }

    // ─── Route Không tồn tại (404) ───────────────────────────────────
    logger.warn(`[HttpServer] 404 Not Found: ${req.method} ${pathname}`);
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
      // Ở môi trường product: che domain Railway nội bộ, chỉ log route an toàn
      if (botConfig.env === 'product') {
        logger.info(`✓ API Link Route: /api/v1/auth/claim (Protected by IP RateLimit)`);
      } else {
        logger.info(`✓ API Link Endpoint: ${botConfig.botPublicApiUrl}/api/v1/auth/claim`);
      }
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
