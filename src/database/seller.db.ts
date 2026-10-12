/**
 * Database schema and operations cho Feature Seller (Quản lý Thợ Kéo & Thanh toán VietQR).
 * Lưu trữ hồ sơ thợ kéo, giao dịch và đánh giá bằng SQLite.
 */

import Database from 'better-sqlite3';
import {
  SellerProfile,
  SellerReview,
  SellerStats,
  SellerTransaction,
  TransactionStatus,
} from '../features/seller/types/seller.types.js';

/**
 * Khởi tạo các bảng SQLite cho tính năng Thợ Kéo:
 * - seller_profiles: Lưu thông tin tài khoản ngân hàng của thợ kéo
 * - seller_transactions: Lưu lịch sử đơn thanh toán / giao dịch kéo
 * - seller_reviews: Lưu đánh giá & phản hồi từ khách hàng
 */
export function initializeSellerTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_profiles (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      bank_code TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_seller_profiles_guild ON seller_profiles(guild_id);

    CREATE TABLE IF NOT EXISTS seller_transactions (
      tx_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'cancelled')),
      note TEXT,
      processed_by TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_seller_tx_guild ON seller_transactions(guild_id);
    CREATE INDEX IF NOT EXISTS idx_seller_tx_seller ON seller_transactions(seller_id);
    CREATE INDEX IF NOT EXISTS idx_seller_tx_buyer ON seller_transactions(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_seller_tx_status ON seller_transactions(status);

    CREATE TABLE IF NOT EXISTS seller_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_id TEXT UNIQUE NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (tx_id) REFERENCES seller_transactions(tx_id)
    );

    CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller ON seller_reviews(seller_id);
  `);
}

/** Lớp quản lý cơ sở dữ liệu cho Seller */
export class SellerDatabase {
  constructor(private readonly db: Database.Database) {}

  /** Lấy thông tin cấu hình QR ngân hàng của thợ kéo */
  getProfile(userId: string, guildId: string): SellerProfile | null {
    const row = this.db
      .prepare(
        `SELECT user_id, guild_id, bank_code, bank_name, account_number, account_name, is_active, created_at, updated_at
         FROM seller_profiles
         WHERE user_id = ? AND guild_id = ?`,
      )
      .get(userId, guildId) as
      | {
          user_id: string;
          guild_id: string;
          bank_code: string;
          bank_name: string;
          account_number: string;
          account_name: string;
          is_active: number;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    return {
      userId: row.user_id,
      guildId: row.guild_id,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      accountNumber: row.account_number,
      accountName: row.account_name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Tạo mới hoặc cập nhật thông tin QR của thợ kéo */
  upsertProfile(profile: Omit<SellerProfile, 'createdAt' | 'updatedAt'>): SellerProfile {
    const now = Date.now();
    const existing = this.getProfile(profile.userId, profile.guildId);
    const createdAt = existing ? existing.createdAt : now;
    const updatedAt = now;

    this.db
      .prepare(
        `INSERT INTO seller_profiles (user_id, guild_id, bank_code, bank_name, account_number, account_name, is_active, created_at, updated_at)
         VALUES (@userId, @guildId, @bankCode, @bankName, @accountNumber, @accountName, @isActive, @createdAt, @updatedAt)
         ON CONFLICT(user_id, guild_id) DO UPDATE SET
           bank_code = excluded.bank_code,
           bank_name = excluded.bank_name,
           account_number = excluded.account_number,
           account_name = excluded.account_name,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
      )
      .run({
        userId: profile.userId,
        guildId: profile.guildId,
        bankCode: profile.bankCode,
        bankName: profile.bankName,
        accountNumber: profile.accountNumber,
        accountName: profile.accountName,
        isActive: profile.isActive ? 1 : 0,
        createdAt,
        updatedAt,
      });

    return {
      ...profile,
      createdAt,
      updatedAt,
    };
  }

  /** Xóa thông tin cấu hình QR của thợ kéo */
  deleteProfile(userId: string, guildId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM seller_profiles WHERE user_id = ? AND guild_id = ?')
      .run(userId, guildId);
    return result.changes > 0;
  }

  /** Tạo đơn giao dịch thanh toán mới */
  createTransaction(tx: SellerTransaction): void {
    this.db
      .prepare(
        `INSERT INTO seller_transactions (tx_id, guild_id, channel_id, message_id, buyer_id, seller_id, amount, description, status, note, processed_by, created_at, processed_at)
         VALUES (@txId, @guildId, @channelId, @messageId, @buyerId, @sellerId, @amount, @description, @status, @note, @processedBy, @createdAt, @processedAt)`,
      )
      .run({
        txId: tx.txId,
        guildId: tx.guildId,
        channelId: tx.channelId,
        messageId: tx.messageId,
        buyerId: tx.buyerId,
        sellerId: tx.sellerId,
        amount: tx.amount,
        description: tx.description,
        status: tx.status,
        note: tx.note,
        processedBy: tx.processedBy,
        createdAt: tx.createdAt,
        processedAt: tx.processedAt,
      });
  }

  /** Lấy thông tin đơn giao dịch theo mã txId */
  getTransaction(txId: string): SellerTransaction | null {
    const row = this.db.prepare('SELECT * FROM seller_transactions WHERE tx_id = ?').get(txId) as
      | {
          tx_id: string;
          guild_id: string;
          channel_id: string;
          message_id: string | null;
          buyer_id: string;
          seller_id: string;
          amount: number;
          description: string;
          status: TransactionStatus;
          note: string | null;
          processed_by: string | null;
          created_at: number;
          processed_at: number | null;
        }
      | undefined;

    if (!row) return null;

    return {
      txId: row.tx_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      amount: row.amount,
      description: row.description,
      status: row.status,
      note: row.note,
      processedBy: row.processed_by,
      createdAt: row.created_at,
      processedAt: row.processed_at,
    };
  }

  /** Cập nhật messageId của đơn giao dịch sau khi gửi tin nhắn */
  updateTransactionMessageId(txId: string, messageId: string): void {
    this.db
      .prepare('UPDATE seller_transactions SET message_id = ? WHERE tx_id = ?')
      .run(messageId, txId);
  }

  /** Cập nhật trạng thái đơn giao dịch (confirm hoặc cancel) */
  updateTransactionStatus(
    txId: string,
    status: TransactionStatus,
    note: string | null = null,
    processedBy: string | null = null,
  ): boolean {
    const now = Date.now();
    const result = this.db
      .prepare(
        `UPDATE seller_transactions
         SET status = ?, note = ?, processed_by = ?, processed_at = ?
         WHERE tx_id = ?`,
      )
      .run(status, note, processedBy, now, txId);
    return result.changes > 0;
  }

  /** Lấy danh sách giao dịch theo điều kiện lọc */
  getTransactions(options: {
    guildId?: string;
    sellerId?: string;
    buyerId?: string;
    status?: TransactionStatus;
    limit?: number;
    offset?: number;
  }): SellerTransaction[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.guildId) {
      conditions.push('guild_id = ?');
      params.push(options.guildId);
    }
    if (options.sellerId) {
      conditions.push('seller_id = ?');
      params.push(options.sellerId);
    }
    if (options.buyerId) {
      conditions.push('buyer_id = ?');
      params.push(options.buyerId);
    }
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
    const offset = Math.max(options.offset ?? 0, 0);

    params.push(limit, offset);

    const rows = this.db
      .prepare(
        `SELECT * FROM seller_transactions
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params) as Array<{
      tx_id: string;
      guild_id: string;
      channel_id: string;
      message_id: string | null;
      buyer_id: string;
      seller_id: string;
      amount: number;
      description: string;
      status: TransactionStatus;
      note: string | null;
      processed_by: string | null;
      created_at: number;
      processed_at: number | null;
    }>;

    return rows.map((row) => ({
      txId: row.tx_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      amount: row.amount,
      description: row.description,
      status: row.status,
      note: row.note,
      processedBy: row.processed_by,
      createdAt: row.created_at,
      processedAt: row.processed_at,
    }));
  }

  /** Thêm đánh giá feedback cho đơn giao dịch */
  createReview(review: Omit<SellerReview, 'id' | 'createdAt'>): SellerReview {
    const createdAt = Date.now();
    const result = this.db
      .prepare(
        `INSERT INTO seller_reviews (tx_id, seller_id, buyer_id, rating, comment, created_at)
         VALUES (@txId, @sellerId, @buyerId, @rating, @comment, @createdAt)`,
      )
      .run({
        txId: review.txId,
        sellerId: review.sellerId,
        buyerId: review.buyerId,
        rating: review.rating,
        comment: review.comment,
        createdAt,
      });

    return {
      id: Number(result.lastInsertRowid),
      ...review,
      createdAt,
    };
  }

  /** Lấy đánh giá của một đơn giao dịch */
  getReviewByTxId(txId: string): SellerReview | null {
    const row = this.db.prepare('SELECT * FROM seller_reviews WHERE tx_id = ?').get(txId) as
      | {
          id: number;
          tx_id: string;
          seller_id: string;
          buyer_id: string;
          rating: number;
          comment: string | null;
          created_at: number;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      txId: row.tx_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
    };
  }

  /** Lấy thống kê hoạt động của một Thợ Kéo */
  getSellerStats(sellerId: string, guildId?: string): SellerStats {
    const guildFilter = guildId ? 'AND guild_id = ?' : '';
    const txParams = guildId ? [sellerId, guildId] : [sellerId];

    const txStats = this.db
      .prepare(
        `SELECT
           COUNT(*) as total_transactions,
           SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
           SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_revenue
         FROM seller_transactions
         WHERE seller_id = ? ${guildFilter}`,
      )
      .get(...txParams) as {
      total_transactions: number;
      confirmed_count: number;
      cancelled_count: number;
      total_revenue: number | null;
    };

    const reviewStats = this.db
      .prepare(
        `SELECT
           COUNT(*) as total_reviews,
           AVG(rating) as average_rating
         FROM seller_reviews
         WHERE seller_id = ?`,
      )
      .get(sellerId) as {
      total_reviews: number;
      average_rating: number | null;
    };

    return {
      sellerId,
      totalTransactions: txStats.total_transactions || 0,
      confirmedCount: txStats.confirmed_count || 0,
      cancelledCount: txStats.cancelled_count || 0,
      totalRevenue: txStats.total_revenue || 0,
      averageRating: reviewStats.average_rating ? Number(reviewStats.average_rating.toFixed(2)) : 0,
      totalReviews: reviewStats.total_reviews || 0,
    };
  }

  /** Lấy danh sách Top Thợ Kéo theo doanh thu hoặc số đơn hoàn thành */
  getTopSellers(guildId: string, limit: number = 10): SellerStats[] {
    const rows = this.db
      .prepare(
        `SELECT
           t.seller_id,
           COUNT(*) as total_transactions,
           SUM(CASE WHEN t.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
           SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
           SUM(CASE WHEN t.status = 'confirmed' THEN t.amount ELSE 0 END) as total_revenue
         FROM seller_transactions t
         WHERE t.guild_id = ?
         GROUP BY t.seller_id
         HAVING confirmed_count > 0
         ORDER BY total_revenue DESC, confirmed_count DESC
         LIMIT ?`,
      )
      .all(guildId, limit) as Array<{
      seller_id: string;
      total_transactions: number;
      confirmed_count: number;
      cancelled_count: number;
      total_revenue: number;
    }>;

    return rows.map((row) => {
      const reviewStats = this.db
        .prepare(
          `SELECT COUNT(*) as total_reviews, AVG(rating) as average_rating
           FROM seller_reviews WHERE seller_id = ?`,
        )
        .get(row.seller_id) as { total_reviews: number; average_rating: number | null };

      return {
        sellerId: row.seller_id,
        totalTransactions: row.total_transactions,
        confirmedCount: row.confirmed_count,
        cancelledCount: row.cancelled_count,
        totalRevenue: row.total_revenue || 0,
        averageRating: reviewStats?.average_rating
          ? Number(reviewStats.average_rating.toFixed(2))
          : 0,
        totalReviews: reviewStats?.total_reviews || 0,
      };
    });
  }
}

let sellerDbInstance: SellerDatabase | null = null;

/** Lấy singleton instance của SellerDatabase */
export function getSellerDb(db?: Database.Database): SellerDatabase {
  if (db) {
    initializeSellerTables(db);
    sellerDbInstance = new SellerDatabase(db);
  }
  if (!sellerDbInstance) {
    throw new Error('SellerDatabase has not been initialized with a SQLite database instance.');
  }
  return sellerDbInstance;
}

/** Đặt singleton instance (dùng cho testing/mocking) */
export function setSellerDb(instance: SellerDatabase | null): void {
  sellerDbInstance = instance;
}
