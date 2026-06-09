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
 * Handler business logic
 */
export async function handleClaimRequest(
  body: any,
  database: Database.Database,
  client: Client,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      body: { status: 'error', message: 'Body rỗng hoặc không parse được.' },
    };
  }

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
    // Luôn lưu token — browser đã dùng thành công, không cần validate lại
    saveDfToken(database, discordId, openid, token);

    // Best-effort: thử validate để lấy nickname
    let nickname = '';
    let level = '';
    try {
      const data = await getMyData({ openid, token });
      nickname = data.player_info.nickname;
      level = String(data.player_info.level);
    } catch (validateError: any) {
      console.warn(
        '[Webhook] Validate skip (token ngắn hạn, vẫn lưu):',
        validateError.message,
      );
    }

    // Gửi DM thông báo
    try {
      const user = await client.users.fetch(discordId).catch(() => null);
      if (user) {
        const dm = await user.createDM().catch(() => null);
        if (dm) {
          let dmContent: string;
          if (nickname) {
            dmContent =
              '**Đã liên kết tài khoản Delta Force thành công!**\n\n' +
              `**Nickname:** ${nickname}\n` +
              `**Level:** ${level}`;
          } else {
            dmContent =
              '**Đã liên kết tài khoản Delta Force!**\n\n' +
              `OpenID: ${openid}\n\n` +
              '> Token đã hết hạn khi validate — bot vẫn đã lưu. ' +
              'Lần dùng /df-daily nếu lỗi → dùng /df-link start lại.';
          }
          await dm.send({ content: dmContent }).catch(() => {});
        }
      }
    } catch (dmError) {
      console.warn('[Webhook] Không gửi được DM:', dmError);
    }

    return {
      status: 200,
      body: { status: 'linked' },
    };
  } catch (error: any) {
    console.error('[Webhook] Claim error:', error);
    return {
      status: 500,
      body: { status: 'error', message: 'Lỗi server. Vui lòng thử lại.' },
    };
  }
}

/**
 * Tạo router
 */
export function createWebhookRoutes(database: Database.Database, client: Client): Router {
  const router = Router();

  router.post('/claim', async (req: Request, res: Response): Promise<void> => {
    try {
      let body = req.body;

      // Fallback parse body mạnh
      if (
        (!body || typeof body !== 'object') &&
        (typeof req.body === 'string' || Buffer.isBuffer(req.body))
      ) {
        try {
          body = JSON.parse(req.body.toString());
        } catch (e) {
          console.warn('[Webhook] Không parse được JSON body');
        }
      }

      const result = await handleClaimRequest(body, database, client);

      // Sử dụng res rõ ràng
      res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[Webhook] Unexpected error:', err);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi server nội bộ. Vui lòng thử lại.',
      });
    }
  });

  return router;
}
