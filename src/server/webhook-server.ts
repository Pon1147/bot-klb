/**
 * Express server cho webhook endpoint — nhận credentials từ browser userscript.
 */

import express, { Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';
import Database from 'better-sqlite3';
import { createWebhookRoutes } from './webhook.routes.js';

const DEFAULT_PORT = 3500;
const ALLOWED_ORIGINS = [
  'https://www.playdeltaforce.com',
  'https://playdeltaforce.com',
  'https://www.deltaforce.com',
  'https://deltaforce.com',
];

let app: ReturnType<typeof express> | null = null;

interface ServerInfo {
  port: number;
  stop: () => Promise<void>;
}

/**
 * Sliding window rate limiter — 5 req/min per IP, with cleanup.
 */
function createRateLimiter() {
  const windows = new Map<string, number[]>();

  const limiter = (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = windows.get(ip) ?? [];

    // Prune stale entries
    const cutoff = now - 60_000;
    const valid = bucket.filter((ts) => ts > cutoff);

    if (valid.length >= 5) {
      windows.delete(ip);
      res.status(429).json({
        status: 'error',
        message: 'Quá nhiều yêu cầu. Thử lại sau 1 phút.',
      });
      return;
    }

    valid.push(now);
    windows.set(ip, valid);
    next();
  };

  return {
    limiter,
    cleanup: () => {
      const now = Date.now();
      for (const [ip, bucket] of windows) {
        const valid = bucket.filter((ts) => ts > now - 60_000);
        if (valid.length === 0) {
          windows.delete(ip);
        } else {
          windows.set(ip, valid);
        }
      }
    },
  };
}

/**
 * Khởi tạo và bắt đầu webhook server.
 */
export function startWebhookServer(
  database: Database.Database,
  client: Client,
  port: number = DEFAULT_PORT,
): ServerInfo {
  app = express();

  // Body parser — catch all content types as raw buffer, then parse JSON.
  // Why: no-cors fetch from browser sends application/json but Express's json()
  // middleware may skip depending on CORS preflight state. Raw parser always captures.
  app.use(express.raw({ type: '*/*', limit: '10mb' }));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString('utf-8'));
      } catch {
        // leave as-is — route handler will reject non-object body
      }
    }
    next();
  });

  // CORS — restrict to known origins
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const { limiter: rateLimiter, cleanup: rateCleanup } = createRateLimiter();
  const cleanupInterval = setInterval(rateCleanup, 5 * 60_000);
  cleanupInterval.unref();

  app.use(rateLimiter);

  // Routes
  app.use('/api/df', createWebhookRoutes(database, client));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      port: port,
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Webhook] Unhandled error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi server nội bộ.',
    });
  });

  const server = app.listen(port, () => {
    console.log(`[Webhook] ✅ Server đang chạy tại http://localhost:${port}`);
    console.log(`[Webhook] Endpoint: http://localhost:${port}/api/df/claim`);
  });

  return {
    port,
    stop: () => {
      clearInterval(cleanupInterval);
      return new Promise<void>((resolve) => {
        server.close(() => {
          app = null;
          console.log('[Webhook] Server đã dừng.');
          resolve();
        });
      });
    },
  };
}
