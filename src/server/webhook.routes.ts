/**
 * Routes cho webhook endpoint — xử lý POST /api/df/claim.
 */

import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';
import Database from 'better-sqlite3';
import { consumeCode } from '../services/df-claim-store.js';
import { saveDfToken } from '../database/df.token.db.js';

/**
 * Handler business logic
 */
export async function handleClaimRequest(
  body: unknown,
  database: Database.Database,
  client: Client,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      body: { status: 'error', message: 'Body rỗng hoặc không parse được.' },
    };
  }

  const obj = body as Record<string, unknown>;
  const { code, openid, token, ts, s, u } = obj;

  if (!code || !openid || !token) {
    console.log(
      '[Webhook] ❌ Thiếu fields — code=' +
        (code ?? '<empty>') +
        ', openid=' +
        (openid ?? '<empty>') +
        ', token=' +
        (token ?? '<empty>'),
    );
    return {
      status: 400,
      body: { status: 'error', message: 'Thiếu thông tin: cần code, openid, và token.' },
    };
  }

  const codeStr = String(code);
  const openidStr = String(openid);
  const tokenStr = String(token);
  const tsStr = ts ? String(ts) : undefined;
  const sStr = s ? String(s) : undefined;
  const uStr = u ? String(u) : undefined;

  console.log(
    '[Webhook] Nhận claim: code=' +
      codeStr +
      ', openid=' +
      openidStr +
      ', token_len=' +
      tokenStr.length,
  );

  const discordId = consumeCode(codeStr);
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
    // Lưu token cùng params (ts, s, u) từ browser
    const isNew = saveDfToken(database, discordId, openidStr, tokenStr, tsStr, sStr, uStr);
    console.log('[Webhook] ✅ Lưu token: openid=' + openidStr + ', new=' + isNew);

    // Gửi DM thông báo
    try {
      const user = await client.users.fetch(discordId).catch(() => null);
      if (user) {
        const dm = await user.createDM().catch(() => null);
        if (dm) {
          const dmContent =
            '**Đã liên kết tài khoản Delta Force!**\n\n' +
            `OpenID: ${openidStr}` +
            (tsStr && tsStr !== '0' ? '\n\n> ✅ Params đầy đủ — `/df-daily` sẽ hoạt động.' : '');
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
    console.error('[Webhook] Claim error:', error.message ?? error);
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
      const result = await handleClaimRequest(req.body, database, client);
      res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[Webhook] Unexpected error:', err.message ?? err);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi server nội bộ. Vui lòng thử lại.',
      });
    }
  });

  return router;
}
