import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import {
  MONGO_COLLECTIONS,
  SellerProfileDocument,
  SellerTransactionDocument,
  SellerReviewDocument,
} from '../collections.js';
import { createLogger } from '../../../utils/logger.js';
import {
  SellerProfile,
  SellerTransaction,
  SellerReview,
} from '../../../features/seller/types/seller.types.js';

const logger = createLogger('SellerMongoRepo');

/**
 * Upsert thông tin hồ sơ ngân hàng thợ kéo lên MongoDB.
 */
export async function upsertSellerProfileToMongo(profile: SellerProfile): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<SellerProfileDocument>(MONGO_COLLECTIONS.SELLER_PROFILES).updateOne(
      { user_id: profile.userId, guild_id: profile.guildId },
      {
        $set: {
          user_id: profile.userId,
          guild_id: profile.guildId,
          bank_code: profile.bankCode,
          bank_name: profile.bankName,
          account_number: profile.accountNumber,
          account_name: profile.accountName,
          is_active: profile.isActive,
          created_at: new Date(profile.createdAt),
          updated_at: new Date(profile.updatedAt),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(
      `Lỗi khi upsert seller profile (${profile.userId}, ${profile.guildId}) lên MongoDB:`,
      { error },
    );
  }
}

/**
 * Xóa thông tin hồ sơ ngân hàng thợ kéo khỏi MongoDB.
 */
export async function deleteSellerProfileFromMongo(userId: string, guildId: string): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db
      .collection<SellerProfileDocument>(MONGO_COLLECTIONS.SELLER_PROFILES)
      .deleteOne({ user_id: userId, guild_id: guildId });
  } catch (error) {
    logger.error(`Lỗi khi xóa seller profile (${userId}, ${guildId}) khỏi MongoDB:`, { error });
  }
}

/**
 * Nạp toàn bộ hồ sơ thợ kéo từ MongoDB để đồng bộ vào SQLite khi bot khởi động.
 */
export async function loadAllSellerProfilesFromMongo(): Promise<SellerProfileDocument[]> {
  if (!isMongoConnected()) return [];
  const db = getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection<SellerProfileDocument>(MONGO_COLLECTIONS.SELLER_PROFILES)
      .find({})
      .toArray();
  } catch (error) {
    logger.error('Lỗi khi nạp tất cả seller profiles từ MongoDB:', { error });
    return [];
  }
}

/**
 * Upsert giao dịch kéo game lên MongoDB.
 */
export async function upsertSellerTransactionToMongo(tx: SellerTransaction): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<SellerTransactionDocument>(MONGO_COLLECTIONS.SELLER_TRANSACTIONS).updateOne(
      { tx_id: tx.txId },
      {
        $set: {
          tx_id: tx.txId,
          guild_id: tx.guildId,
          channel_id: tx.channelId,
          message_id: tx.messageId,
          buyer_id: tx.buyerId,
          seller_id: tx.sellerId,
          amount: tx.amount,
          description: tx.description,
          status: tx.status,
          note: tx.note,
          processed_by: tx.processedBy,
          created_at: new Date(tx.createdAt),
          processed_at: tx.processedAt ? new Date(tx.processedAt) : null,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Lỗi khi upsert seller transaction (${tx.txId}) lên MongoDB:`, { error });
  }
}

/**
 * Nạp toàn bộ giao dịch kéo từ MongoDB để đồng bộ vào SQLite khi bot khởi động.
 */
export async function loadAllSellerTransactionsFromMongo(): Promise<SellerTransactionDocument[]> {
  if (!isMongoConnected()) return [];
  const db = getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection<SellerTransactionDocument>(MONGO_COLLECTIONS.SELLER_TRANSACTIONS)
      .find({})
      .toArray();
  } catch (error) {
    logger.error('Lỗi khi nạp tất cả seller transactions từ MongoDB:', { error });
    return [];
  }
}

/**
 * Lưu đánh giá feedback của đơn giao dịch lên MongoDB.
 */
export async function insertSellerReviewToMongo(review: Omit<SellerReview, 'id'>): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<SellerReviewDocument>(MONGO_COLLECTIONS.SELLER_REVIEWS).updateOne(
      { tx_id: review.txId },
      {
        $set: {
          tx_id: review.txId,
          seller_id: review.sellerId,
          buyer_id: review.buyerId,
          rating: review.rating,
          comment: review.comment,
          created_at: new Date(review.createdAt),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Lỗi khi insert seller review (${review.txId}) lên MongoDB:`, { error });
  }
}

/**
 * Nạp toàn bộ đánh giá từ MongoDB để đồng bộ vào SQLite khi bot khởi động.
 */
export async function loadAllSellerReviewsFromMongo(): Promise<SellerReviewDocument[]> {
  if (!isMongoConnected()) return [];
  const db = getMongoDb();
  if (!db) return [];

  try {
    return await db
      .collection<SellerReviewDocument>(MONGO_COLLECTIONS.SELLER_REVIEWS)
      .find({})
      .toArray();
  } catch (error) {
    logger.error('Lỗi khi nạp tất cả seller reviews từ MongoDB:', { error });
    return [];
  }
}
