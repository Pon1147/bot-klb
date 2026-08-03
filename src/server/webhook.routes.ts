/**
 * Routes cho webhook endpoint — xử lý POST /api/df/claim.
 *
 * Security boundary: validate → atomic consume → encrypt → persist → notify.
 * Không gọi DfTools business API.
 */

import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';
import Database from 'better-sqlite3';
import { handleClaim } from '../services/df-claim-handler.js';
import { createLogger } from '../utils/logger.js';

export { handleClaim };

const logger = createLogger('Webhook');

/**
 * Tạo router
 */
export function createWebhookRoutes(database: Database.Database, client: Client): Router {
  const router = Router();

  router.post('/claim', async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await handleClaim(req.body, database, client);
      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      logger.error(
        'Unexpected error on /claim: ' + (err instanceof Error ? err.message : String(err)),
      );
      res.status(500).json({
        ok: false,
        error: 'server_error',
      });
    }
  });

  return router;
}
