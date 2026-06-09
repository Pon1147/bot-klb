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

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS — browser từ HQ page sẽ POST đến đây
  app.use((_req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  });

  // Rate limiting cơ bản (5 req/ip/phút)
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
      return res
        .status(429)
        .json({ status: 'error', message: 'Quá nhiều yêu cầu. Thử lại sau 1 phút.' });
    }
    next();
  });

  // Routes
  app.use('/api/df', createWebhookRoutes(database, client));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  const server = app.listen(port, () => {
    console.log(`[Webhook] Server chạy trên cổng ${port}`);
  });

  return {
    port,
    stop: () => {
      return new Promise<void>((resolve) => {
        server.close(() => {
          app = null;
          resolve();
        });
      });
    },
  };
}
