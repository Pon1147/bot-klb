import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import { MONGO_COLLECTIONS, AccountBindingDocument } from '../collections.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('DfBindingMongoRepo');

/**
 * Lay binding dang active cua user tu MongoDB.
 */
export async function getAccountBindingFromMongo(
  discordUserId: string,
): Promise<AccountBindingDocument | null> {
  if (!isMongoConnected()) return null;
  const db = getMongoDb();
  if (!db) return null;

  try {
    return await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .findOne({ discord_user_id: discordUserId, status: 'active' });
  } catch (error) {
    logger.error(`Loi khi lay active binding cho user ${discordUserId} tu MongoDB:`, { error });
    return null;
  }
}

/**
 * Lay binding active theo openid tu MongoDB.
 */
export async function getAccountBindingByOpenidFromMongo(
  openid: string,
): Promise<AccountBindingDocument | null> {
  if (!isMongoConnected()) return null;
  const db = getMongoDb();
  if (!db) return null;

  try {
    return await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .findOne({ openid, status: 'active' });
  } catch (error) {
    logger.error(`Loi khi lay active binding theo openid ${openid} tu MongoDB:`, { error });
    return null;
  }
}

/**
 * Upsert account binding len MongoDB.
 */
export async function upsertAccountBindingToMongo(data: {
  discord_user_id: string;
  provider?: string;
  platform?: string;
  openid: string;
  cred_nonce: string;
  cred_ciphertext: string;
  cred_tag: string;
  key_version?: string;
  captured_at?: string | null;
}): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    const now = new Date();
    await db.collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS).updateOne(
      { discord_user_id: data.discord_user_id },
      {
        $set: {
          discord_user_id: data.discord_user_id,
          provider: data.provider || 'garena',
          platform: data.platform || 'df_hq',
          openid: data.openid,
          cred_nonce: data.cred_nonce,
          cred_ciphertext: data.cred_ciphertext,
          cred_tag: data.cred_tag,
          key_version: data.key_version || 'v1',
          status: 'active',
          captured_at: data.captured_at ? new Date(data.captured_at) : now,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
          last_ok_at: null,
          last_error: null,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Loi khi upsert binding cho user ${data.discord_user_id} len MongoDB:`, { error });
  }
}

/**
 * Revoke binding cua user tren MongoDB.
 */
export async function revokeAccountBindingInMongo(discordUserId: string): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS).updateOne(
      { discord_user_id: discordUserId },
      {
        $set: {
          status: 'revoked',
          updated_at: new Date(),
        },
      },
    );
  } catch (error) {
    logger.error(`Loi khi revoke binding cho user ${discordUserId} tren MongoDB:`, { error });
  }
}

/**
 * Cap nhat last_ok_at tren MongoDB.
 */
export async function touchLastOkInMongo(discordUserId: string): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS).updateOne(
      { discord_user_id: discordUserId },
      {
        $set: {
          last_ok_at: new Date(),
          updated_at: new Date(),
        },
      },
    );
  } catch (error) {
    logger.error(`Loi khi touch last_ok cho user ${discordUserId} tren MongoDB:`, { error });
  }
}

/**
 * Load toan bo active bindings tu MongoDB (dung de sync voi local sqlite/cache khi khoi dong).
 */
export async function loadAllActiveBindingsFromMongo(): Promise<AccountBindingDocument[]> {
  if (!isMongoConnected()) return [];
  const db = getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .find({ status: 'active' })
      .toArray();
  } catch (error) {
    logger.error('Loi khi load all active bindings tu MongoDB:', { error });
    return [];
  }
}
