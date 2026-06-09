/**
 * Express server cho webhook endpoint — nhận credentials từ browser userscript.
 */

import express, { Request, Response } from 'express';
import { Client } from 'discord.js';
import Database from 'better-sqlite3';
import { createWebhookRoutes } from './webhook.routes.js';

const DEFAULT_PORT = 3500;

let app: ReturnType<typeof express> | null = null;

interface ServerInfo {
  port: number;
  stop: () => Promise<void>;
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

  // ==================== BODY PARSER ====================
  app.use(express.raw({ type: '*/*', limit: '10mb' }));

  app.use((req: Request, _res: Response, next) => {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString('utf-8'));
      } catch (e) {
        // ignore
      }
    }
    next();
  });

  app.use(express.urlencoded({ extended: true }));

  // CORS
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Rate limiting
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  app.use((req: Request, res: Response, next) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }

    entry.count++;
    if (entry.count > 5) {
      res.status(429).json({
        status: 'error',
        message: 'Quá nhiều yêu cầu. Thử lại sau 1 phút.',
      });
      return;
    }
    next();
  });

  // Routes
  app.use('/api/df', createWebhookRoutes(database, client));

  // Health check - Dùng _req, _res để bỏ warning
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      port: port,
    });
  });

  const server = app.listen(port, () => {
    console.log(`[Webhook] ✅ Server đang chạy tại http://localhost:${port}`);
    console.log(`[Webhook] Endpoint: http://localhost:${port}/api/df/claim`);
  });

  return {
    port,
    stop: () => {
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
