import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import { MONGO_COLLECTIONS, AccountBindingDocument } from '../collections.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('DfBindingMongoRepo');

/**
 * Lý do cập nhật không khớp document trong MongoDB.
 */
export type MongoNotMatchedReason =
  | 'user_not_found'
  | 'generation_mismatch'
  | 'already_inactive'
  | 'skipped_disabled'
  | 'unavailable';

/**
 * Kết quả cập nhật trạng thái binding trên MongoDB.
 */
export type MongoBindingUpdateResult =
  | { success: true; status: 'updated' | 'skipped_disabled'; modifiedCount: number }
  | { success: false; status: 'not_matched'; reason: MongoNotMatchedReason; error?: unknown };

/**
 * Lấy binding đang active của user từ MongoDB.
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
    logger.error(`Lỗi khi lấy active binding cho user ${discordUserId} từ MongoDB:`, { error });
    return null;
  }
}

/**
 * Lấy binding active theo openid từ MongoDB.
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
    logger.error(`Lỗi khi lấy active binding theo openid ${openid} từ MongoDB:`, { error });
    return null;
  }
}

/**
 * Upsert account binding lên MongoDB.
 * Trả về true nếu thành công hoặc nếu MongoDB không kết nối (skipped), false nếu có lỗi.
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
}): Promise<boolean> {
  if (!isMongoConnected()) return true;
  const db = getMongoDb();
  if (!db) return false;

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
    return true;
  } catch (error) {
    logger.error(`Lỗi khi upsert binding cho user ${data.discord_user_id} lên MongoDB:`, { error });
    return false;
  }
}

/**
 * Cập nhật trạng thái binding thành expired trên MongoDB khi token hết hạn (conditional update).
 * Bắt buộc expectedNonce để ngăn race condition ghi đè binding generation mới.
 */
export async function expireAccountBindingInMongo(
  discordUserId: string,
  expectedNonce?: string,
): Promise<MongoBindingUpdateResult> {
  if (!isMongoConnected()) {
    return { success: true, status: 'skipped_disabled', modifiedCount: 0 };
  }
  const db = getMongoDb();
  if (!db) {
    return { success: false, status: 'not_matched', reason: 'unavailable' };
  }

  try {
    const filter: Record<string, unknown> = {
      discord_user_id: discordUserId,
      status: 'active',
    };
    if (expectedNonce) {
      filter.cred_nonce = expectedNonce;
    }

    const result = await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .updateOne(filter, {
        $set: {
          status: 'expired',
          updated_at: new Date(),
        },
      });

    if ((result.matchedCount ?? result.modifiedCount ?? 0) > 0 || (result.modifiedCount ?? 0) > 0) {
      return { success: true, status: 'updated', modifiedCount: result.modifiedCount ?? 1 };
    }

    // matchedCount === 0: Kiểm tra chi tiết nguyên nhân không match để caller xử lý chính xác
    const doc = await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .findOne({ discord_user_id: discordUserId });

    if (!doc) {
      return { success: false, status: 'not_matched', reason: 'user_not_found' };
    }
    if (doc.status !== 'active') {
      return { success: false, status: 'not_matched', reason: 'already_inactive' };
    }
    if (expectedNonce && doc.cred_nonce !== expectedNonce) {
      return { success: false, status: 'not_matched', reason: 'generation_mismatch' };
    }

    return { success: false, status: 'not_matched', reason: 'user_not_found' };
  } catch (error) {
    logger.error(`Lỗi khi expire binding cho user ${discordUserId} trên MongoDB:`, { error });
    return { success: false, status: 'not_matched', reason: 'unavailable', error };
  }
}

/**
 * Revoke binding của user trên MongoDB (conditional update).
 * Bắt buộc expectedNonce để ngăn race condition ghi đè binding generation mới.
 */
export async function revokeAccountBindingInMongo(
  discordUserId: string,
  expectedNonce?: string,
): Promise<MongoBindingUpdateResult> {
  if (!isMongoConnected()) {
    return { success: true, status: 'skipped_disabled', modifiedCount: 0 };
  }
  const db = getMongoDb();
  if (!db) {
    return { success: false, status: 'not_matched', reason: 'unavailable' };
  }

  try {
    const filter: Record<string, unknown> = {
      discord_user_id: discordUserId,
      status: 'active',
    };
    if (expectedNonce) {
      filter.cred_nonce = expectedNonce;
    }

    const result = await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .updateOne(filter, {
        $set: {
          status: 'revoked',
          updated_at: new Date(),
        },
      });

    if ((result.matchedCount ?? result.modifiedCount ?? 0) > 0 || (result.modifiedCount ?? 0) > 0) {
      return { success: true, status: 'updated', modifiedCount: result.modifiedCount ?? 1 };
    }

    // matchedCount === 0: Kiểm tra chi tiết nguyên nhân không match
    const doc = await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .findOne({ discord_user_id: discordUserId });

    if (!doc) {
      return { success: false, status: 'not_matched', reason: 'user_not_found' };
    }
    if (doc.status !== 'active') {
      return { success: false, status: 'not_matched', reason: 'already_inactive' };
    }
    if (expectedNonce && doc.cred_nonce !== expectedNonce) {
      return { success: false, status: 'not_matched', reason: 'generation_mismatch' };
    }

    return { success: false, status: 'not_matched', reason: 'user_not_found' };
  } catch (error) {
    logger.error(`Lỗi khi revoke binding cho user ${discordUserId} trên MongoDB:`, { error });
    return { success: false, status: 'not_matched', reason: 'unavailable', error };
  }
}

/**
 * Cập nhật last_ok_at trên MongoDB.
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
    logger.error(`Lỗi khi touch last_ok cho user ${discordUserId} trên MongoDB:`, { error });
  }
}

/**
 * Load toàn bộ active bindings từ MongoDB (dùng để sync với SQLite runtime cache khi khởi động).
 * Trả về null nếu MongoDB không kết nối hoặc truy vấn xảy ra lỗi (để caller không revoke nhầm dữ liệu).
 */
export async function loadAllActiveBindingsFromMongo(): Promise<AccountBindingDocument[] | null> {
  if (!isMongoConnected()) return null;
  const db = getMongoDb();
  if (!db) return null;

  try {
    return await db
      .collection<AccountBindingDocument>(MONGO_COLLECTIONS.ACCOUNT_BINDINGS)
      .find({ status: 'active' })
      .toArray();
  } catch (error) {
    logger.error('Lỗi khi load all active bindings từ MongoDB:', { error });
    return null;
  }
}
