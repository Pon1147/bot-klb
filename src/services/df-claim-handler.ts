/**
 * Claim API handler — atomic consume + encrypt + persist.
 *
 * Security boundary: validate code → atomic consume → encrypt credential → persist binding → notify Discord.
 * Không gọi DfTools business API.
 * Never log full credential. Never return credential trong response.
 */

import Database from 'better-sqlite3';
import { Client } from 'discord.js';
import { atomicConsumeClaim } from '../database/df-claim.db.js';
import { upsertAccountBinding, getActiveBinding } from '../database/df-binding.db.js';
import { encryptCredential } from './df-crypto.js';
import { createLogger } from '../utils/logger.js';
import { INVALID_CLAIM_MESSAGE } from '../config/app.constants.js';

const logger = createLogger('ClaimHandler');

/** Request body từ extension/SW */
export interface ClaimRequestBody {
  code: string;
  openid: string;
  token: string;
  ts?: string;
  s?: string;
  u?: string;
}

/** Response về cho extension/SW */
export interface ClaimResponseBody {
  ok: boolean;
  error?: string;
}

/** Kết quả xử lý claim */
export interface ClaimResult {
  status: number;
  body: ClaimResponseBody;
}

/**
 * Validate request body.
 */
function validateBody(body: unknown): ClaimRequestBody | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const obj = body as Record<string, unknown>;
  const code = obj.code;
  const openid = obj.openid;
  const token = obj.token;

  if (!code || !openid || !token) {
    return null;
  }

  return {
    code: String(code),
    openid: String(openid),
    token: String(token),
    ts: typeof obj.ts === 'string' ? obj.ts : undefined,
    s: typeof obj.s === 'string' ? obj.s : undefined,
    u: typeof obj.u === 'string' ? obj.u : undefined,
  };
}

/**
 * Gửi DM thông báo linked thành công.
 */
async function sendLinkedDm(client: Client, userId: string, _openid: string): Promise<void> {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const dm = await user.createDM().catch(() => null);
    if (!dm) return;

    await dm.send({
      content:
        `**Chúc mừng bạn đã liên kết thành công account đến Delta Force HQ!**\n\n` +
        `Bây giờ bạn có thể dùng các lệnh \`/df-daily\`, \`/df-stats\`, \`/df-history\` mà không cần mở HQ.`,
    });
  } catch (error) {
    logger.warn(
      'Không gửi được DM cho user ' +
        userId +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Handler chính cho POST /api/df/claim.
 *
 * Flow:
 * 1. Validate body
 * 2. Atomic consume claim code
 * 3. Encrypt credential (AES-256-GCM)
 * 4. Upsert AccountBinding
 * 5. Send DM notification
 * 6. Return { ok: true }
 */
export async function handleClaim(
  body: unknown,
  database: Database.Database,
  client: Client,
): Promise<ClaimResult> {
  // 1. Validate body
  const parsed = validateBody(body);
  if (!parsed) {
    logger.warn('Invalid claim body — missing code/openid/token');
    return {
      status: 400,
      body: { ok: false, error: 'invalid_body' },
    };
  }

  const { code, openid, token } = parsed;

  logger.info('Claim received: code=' + code + ', openid=' + openid);

  // 2. Atomic consume (lock + update trong 1 SQL)
  const claimRow = database
    .prepare('SELECT status, expires_at, discord_user_id FROM df_claim_sessions WHERE code = ?')
    .get(code) as { status: string; expires_at: string; discord_user_id: string } | undefined;

  if (!claimRow) {
    logger.warn('Claim code not found: code=' + code);
    return {
      status: 401,
      body: { ok: false, error: INVALID_CLAIM_MESSAGE },
    };
  }

  const discordId = atomicConsumeClaim(database, code);
  if (!discordId) {
    if (claimRow.status === 'consumed') {
      // Code đã dùng rồi → check xem binding đã tồn tại chưa
      const binding = getActiveBinding(database, claimRow.discord_user_id);
      if (binding) {
        logger.info('Claim already consumed but binding exists: code=' + code);
        return {
          status: 200,
          body: { ok: true },
        };
      }
      logger.warn('Claim already consumed, no binding found: code=' + code);
    } else if (claimRow.status === 'expired') {
      logger.warn('Claim expired: code=' + code + ' expires_at=' + claimRow.expires_at);
    } else {
      logger.warn('Claim consume failed: code=' + code + ' status=' + claimRow.status);
    }
    return {
      status: 401,
      body: { ok: false, error: INVALID_CLAIM_MESSAGE },
    };
  }

  // 3. Encrypt credential (AES-256-GCM)
  const credBlob = JSON.stringify({ token, ts: parsed.ts, s: parsed.s, u: parsed.u });
  let encrypted;
  try {
    encrypted = encryptCredential(credBlob, discordId, openid);
  } catch (error) {
    logger.error('Encrypt failed: ' + (error instanceof Error ? error.message : String(error)));
    return {
      status: 500,
      body: { ok: false, error: 'server_error' },
    };
  }

  // 4. Upsert AccountBinding
  try {
    upsertAccountBinding(
      database,
      discordId,
      openid,
      encrypted.nonce,
      encrypted.ciphertext,
      encrypted.tag,
    );
  } catch (error) {
    logger.error('DB write failed: ' + (error instanceof Error ? error.message : String(error)));
    return {
      status: 500,
      body: { ok: false, error: 'server_error' },
    };
  }

  // 5. Send DM
  void sendLinkedDm(client, discordId, openid);

  // 6. Return success
  logger.info('Claim success: user=' + discordId);
  return {
    status: 200,
    body: { ok: true },
  };
}
