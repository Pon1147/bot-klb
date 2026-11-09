import Database from 'better-sqlite3';

/**
 * Khởi tạo các bảng SQLite phục vụ hệ thống Payment VietQR & Quyên góp PayOS:
 * 1. payments: Lưu các giao dịch hóa đơn theo từng guild (mô hình botqr)
 * 2. payment_feedback: Lưu đánh giá ⭐ (1-5 sao) và nhận xét của khách hàng
 * 3. donations: Lưu lịch sử quyên góp / Buy Me a Coffee cho Bot Owner qua PayOS
 */
export function initializePaymentTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
      note TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_payments_guild_buyer ON payments(guild_id, buyer_id, status);
    CREATE INDEX IF NOT EXISTS idx_payments_guild_status ON payments(guild_id, status);

    CREATE TABLE IF NOT EXISTS payment_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_id TEXT NOT NULL UNIQUE,
      guild_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (tx_id) REFERENCES payments(id)
    );

    CREATE TABLE IF NOT EXISTS donations (
      order_code INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      guild_id TEXT,
      amount INTEGER NOT NULL CHECK(amount > 0),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled')),
      payment_link_id TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
  `);
}
