/**
 * Database schema & migration cho Quản trị Bản quyền Kéo Lão Bản & Thanh toán VietQR (PayOS)
 * Tuân thủ Spec V1.2 — Single SQLite Transaction, Index tối ưu, Ràng buộc dữ liệu nghiêm ngặt.
 */

import Database from 'better-sqlite3';

export type PackageType = '1_MONTH' | '3_MONTHS' | '6_MONTHS';

export type SubscriptionOrderStatus =
  | 'pending'
  | 'paid'
  | 'paid_late'
  | 'underpaid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'manual_review'
  | 'expired';

export type SubscriptionKeyStatus = 'unused' | 'used' | 'revoked';

export interface GuildSubscriptionRecord {
  guild_id: string;
  license_expires_at: number | null;
  trial_used: number; // 0 hoặc 1
  created_at: number;
  updated_at: number;
}

export interface SubscriptionOrderRecord {
  order_code: number;
  guild_id: string;
  user_id: string;
  package_type: PackageType;
  duration_days: number;
  amount: number;
  actual_paid_amount: number | null;
  payment_reference: string | null;
  status: SubscriptionOrderStatus;
  checkout_url: string | null;
  qr_code: string | null;
  reconcile_attempts: number;
  next_reconcile_at: number | null;
  created_at: number;
  expires_at: number;
  paid_at: number | null;
}

export interface SubscriptionKeyRecord {
  key: string;
  duration_days: number;
  status: SubscriptionKeyStatus;
  created_by: string;
  note: string | null;
  used_by_guild: string | null;
  used_by_user: string | null;
  created_at: number;
  expires_at: number | null;
  used_at: number | null;
}

/**
 * Khởi tạo các bảng phục vụ Subscription Billing.
 */
export function initializeSubscriptionTables(database: Database.Database): void {
  // 1. Bảng quản trị bản quyền Guild
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_subscriptions (
      guild_id TEXT PRIMARY KEY,
      license_expires_at INTEGER,
      trial_used INTEGER NOT NULL DEFAULT 0 CHECK(trial_used IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_guild_sub_expiry 
    ON guild_subscriptions(license_expires_at)
  `);

  // 2. Bảng đơn hàng thanh toán qua VietQR / PayOS
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscription_orders (
      order_code INTEGER PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      package_type TEXT NOT NULL CHECK(package_type IN ('1_MONTH', '3_MONTHS', '6_MONTHS')),
      duration_days INTEGER NOT NULL CHECK(duration_days > 0),
      amount INTEGER NOT NULL CHECK(amount > 0),
      actual_paid_amount INTEGER CHECK(actual_paid_amount IS NULL OR actual_paid_amount > 0),
      payment_reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'paid', 'paid_late', 'underpaid', 'failed', 'cancelled', 'refunded', 'manual_review', 'expired'
      )),
      checkout_url TEXT,
      qr_code TEXT,
      reconcile_attempts INTEGER NOT NULL DEFAULT 0 CHECK(reconcile_attempts >= 0),
      next_reconcile_at INTEGER,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sub_orders_guild 
    ON subscription_orders(guild_id, status)
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sub_orders_reconcile 
    ON subscription_orders(status, expires_at, next_reconcile_at)
  `);

  // Partial Unique Index: 1 mã giao dịch ngân hàng chỉ được gán cho 1 đơn đã thành công
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_orders_payment_ref 
    ON subscription_orders(payment_reference) 
    WHERE payment_reference IS NOT NULL AND status IN ('paid', 'paid_late')
  `);

  // 3. Bảng mã bản quyền dự phòng (License Keys)
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscription_keys (
      key TEXT PRIMARY KEY,
      duration_days INTEGER NOT NULL CHECK(duration_days > 0),
      status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused', 'used', 'revoked')),
      created_by TEXT NOT NULL,
      note TEXT,
      used_by_guild TEXT,
      used_by_user TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      used_at INTEGER
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sub_keys_status 
    ON subscription_keys(status)
  `);
}
