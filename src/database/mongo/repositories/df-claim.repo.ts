import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import { MONGO_COLLECTIONS, ClaimSessionDocument } from '../collections.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('DfClaimMongoRepo');

/**
 * Tao claim session tren MongoDB.
 */
export async function createClaimSessionInMongo(
  code: string,
  discordUserId: string,
  expiresAt: Date,
): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<ClaimSessionDocument>(MONGO_COLLECTIONS.CLAIM_SESSIONS).insertOne({
      code,
      discord_user_id: discordUserId,
      status: 'pending',
      created_at: new Date(),
      expires_at: expiresAt,
      consumed_at: null,
      fail_count: 0,
    });
  } catch (error) {
    logger.error(`Loi khi tao claim session ${code} tren MongoDB:`, { error });
  }
}

/**
 * Atomic consume claim session tren MongoDB bang findOneAndUpdate.
 */
export async function consumeClaimSessionAtomicInMongo(
  code: string,
): Promise<{ ok: boolean; discordUserId?: string; reason?: string }> {
  if (!isMongoConnected()) {
    return { ok: false, reason: 'mongo_not_connected' };
  }
  const db = getMongoDb();
  if (!db) {
    return { ok: false, reason: 'db_unavailable' };
  }

  try {
    const now = new Date();
    // Atomic update chi thanh cong neu code dang 'pending' va chua het han
    const result = await db
      .collection<ClaimSessionDocument>(MONGO_COLLECTIONS.CLAIM_SESSIONS)
      .findOneAndUpdate(
        {
          code,
          status: 'pending',
          expires_at: { $gt: now },
        },
        {
          $set: {
            status: 'consumed',
            consumed_at: now,
          },
        },
        { returnDocument: 'after' },
      );

    if (result) {
      return { ok: true, discordUserId: result.discord_user_id };
    }

    // Neu khong update duoc, kiem tra ly do (da consumed hoac da expire)
    const existing = await db
      .collection<ClaimSessionDocument>(MONGO_COLLECTIONS.CLAIM_SESSIONS)
      .findOne({ code });

    if (!existing) {
      return { ok: false, reason: 'code_not_found' };
    }
    if (existing.status === 'consumed') {
      return { ok: false, reason: 'code_already_consumed' };
    }
    if (existing.expires_at <= now) {
      return { ok: false, reason: 'code_expired' };
    }

    return { ok: false, reason: 'consume_failed' };
  } catch (error) {
    logger.error(`Loi khi atomic consume claim session ${code} tren MongoDB:`, { error });
    return { ok: false, reason: 'server_error' };
  }
}
