/**
 * Routes cho webhook endpoint — xử lý POST /api/df/claim.
 */

import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';
import Database from 'better-sqlite3';
import { consumeCode } from '../services/df-claim-store.js';
import { getMyData } from '../services/deltaforce.api.js';
import { saveDfToken } from '../database/df.token.db.js';

/**
 * Handler business logic — tách riêng để test được dễ dàng.
 */
export async function handleClaimRequest(
  body: { code: string; openid: string; token: string },
  database: Database.Database,
  client: Client,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { code, openid, token } = body;

  if (!code || !openid || !token) {
    return {
      status: 400,
      body: { status: 'error', message: 'Thiếu thông tin: cần code, openid, và token.' },
    };
  }

  const discordId = consumeCode(code);
  if (!discordId) {
    return {
      status: 400,
      body: {
        status: 'error',
        message: 'Mã claim không hợp lệ hoặc đã hết hạn. Hãy dùng /df-link start để nhận mã mới.',
      },
    };
  }

  try {
    const data = await getMyData({ openid, token });
    saveDfToken(database, discordId, openid, token);

    // DM thông báo thành công
    try {
      const user = await client.users.fetch(discordId).catch(() => null);
      if (user) {
        const dm = await user.createDM().catch(() => null);
        if (dm) {
          await dm
            .send({
              content:
                '**Đã liên kết tài khoản thành công!**\n\n' +
                `Nickname: ${data.player_info.nickname}\nLevel: ${data.player_info.level}`,
            })
            .catch(() => {
              /* DM failed, ignore */
            });
        }
      }
    } catch {
      // DM fail không ảnh hưởng kết quả
    }

    return {
      status: 200,
      body: {
        status: 'linked',
        nickname: data.player_info.nickname,
        level: data.player_info.level,
      },
    };
  } catch (error) {
    return {
      status: 400,
      body: {
        status: 'error',
        message: `Token không hợp lệ hoặc đã hết hạn: ${(error as Error).message}`,
      },
    };
  }
}

/**
 * Tạo router với database và discord client được inject.
 */
export function createWebhookRoutes(database: Database.Database, client: Client): Router {
  const router = Router();

  router.post('/claim', async (req: Request, res: Response) => {
    const result = await handleClaimRequest(req.body as any, database, client);
    if (result.status !== 200) {
      res.status(result.status).json(result.body);
    } else {
      res.json(result.body);
    }
  });

  return router;
}
