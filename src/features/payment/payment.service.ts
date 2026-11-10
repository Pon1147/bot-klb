import Database from 'better-sqlite3';

export type PaymentStatus = 'pending' | 'confirmed' | 'cancelled';
export type DonationStatus = 'pending' | 'paid' | 'cancelled';

export interface PaymentRecord {
  id: string;
  guild_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  description: string;
  status: PaymentStatus;
  note?: string | null;
  created_at: number;
  expires_at?: number | null;
  processed_at?: number | null;
  bank_id?: string | null;
  account_no?: string | null;
  account_name?: string | null;
}

export interface PaymentFeedbackRecord {
  id?: number;
  tx_id: string;
  guild_id: string;
  buyer_id: string;
  rating: number; // 1-5
  comment?: string | null;
  created_at: number;
}

export interface DonationRecord {
  order_code: number;
  user_id: string;
  user_tag: string;
  guild_id?: string | null;
  amount: number;
  message?: string | null;
  status: DonationStatus;
  payment_link_id?: string | null;
  created_at: number;
  paid_at?: number | null;
}

export interface TopBuyer {
  buyerId: string;
  totalAmount: number;
  txCount: number;
}

/**
 * Lưu một giao dịch thanh toán mới vào SQLite
 */
export function createPayment(database: Database.Database, payment: PaymentRecord): void {
  database
    .prepare(
      `
      INSERT INTO payments (
        id, guild_id, buyer_id, seller_id, amount,
        description, status, note, created_at, expires_at, processed_at,
        bank_id, account_no, account_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payment.id,
      payment.guild_id,
      payment.buyer_id,
      payment.seller_id,
      payment.amount,
      payment.description,
      payment.status,
      payment.note || null,
      payment.created_at,
      payment.expires_at || null,
      payment.processed_at || null,
      payment.bank_id || null,
      payment.account_no || null,
      payment.account_name || null,
    );
}

/**
 * Lấy chi tiết giao dịch theo mã TX
 */
export function getPaymentById(
  database: Database.Database,
  txId: string,
): PaymentRecord | undefined {
  return database.prepare(`SELECT * FROM payments WHERE id = ?`).get(txId) as
    PaymentRecord | undefined;
}

/**
 * Cập nhật trạng thái giao dịch (confirmed / cancelled)
 * Hỗ trợ cập nhật buyer_id nếu hóa đơn mở được staff chỉ định người mua khi duyệt.
 */
export function updatePaymentStatus(
  database: Database.Database,
  txId: string,
  guildId: string,
  status: PaymentStatus,
  note?: string | null,
  buyerId?: string,
): boolean {
  if (buyerId) {
    const result = database
      .prepare(
        `
        UPDATE payments
        SET status = ?, note = ?, processed_at = ?, buyer_id = ?
        WHERE id = ? AND guild_id = ? AND status = 'pending'
      `,
      )
      .run(status, note || null, Date.now(), buyerId, txId, guildId);

    return result.changes === 1;
  }

  const result = database
    .prepare(
      `
      UPDATE payments
      SET status = ?, note = ?, processed_at = ?
      WHERE id = ? AND guild_id = ? AND status = 'pending'
    `,
    )
    .run(status, note || null, Date.now(), txId, guildId);

  return result.changes === 1;
}

/**
 * Lấy danh sách giao dịch của 1 khách hàng trong Guild
 */
export function getUserPayments(
  database: Database.Database,
  guildId: string,
  buyerId: string,
  status: PaymentStatus = 'confirmed',
): PaymentRecord[] {
  return database
    .prepare(
      `
      SELECT * FROM payments
      WHERE guild_id = ? AND buyer_id = ? AND status = ?
      ORDER BY created_at DESC
    `,
    )
    .all(guildId, buyerId, status) as PaymentRecord[];
}

/**
 * Lấy bảng xếp hạng top khách hàng chi tiêu nhiều nhất trong Guild
 * Loại bỏ các hóa đơn chưa định danh (UNASSIGNED) để tránh thổi phồng thống kê.
 */
export function getTopBuyers(database: Database.Database, guildId: string, limit = 10): TopBuyer[] {
  return database
    .prepare(
      `
      SELECT 
        buyer_id AS buyerId,
        SUM(amount) AS totalAmount,
        COUNT(id) AS txCount
      FROM payments
      WHERE guild_id = ? AND status = 'confirmed' AND buyer_id NOT IN ('UNASSIGNED', '')
      GROUP BY buyer_id
      ORDER BY totalAmount DESC
      LIMIT ?
    `,
    )
    .all(guildId, limit) as TopBuyer[];
}

/**
 * Lấy thứ hạng chi tiêu của một user cụ thể trong Guild
 */
export function getUserRank(
  database: Database.Database,
  guildId: string,
  userId: string,
): { rank: number; totalAmount: number } | null {
  const rows = database
    .prepare(
      `
      SELECT buyer_id, SUM(amount) as total
      FROM payments
      WHERE guild_id = ? AND status = 'confirmed' AND buyer_id NOT IN ('UNASSIGNED', '')
      GROUP BY buyer_id
      ORDER BY total DESC
    `,
    )
    .all(guildId) as { buyer_id: string; total: number }[];

  const index = rows.findIndex((r) => r.buyer_id === userId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    totalAmount: rows[index].total,
  };
}

/**
 * Lưu đánh giá ⭐ và nhận xét từ khách hàng
 */
export function saveFeedback(
  database: Database.Database,
  feedback: PaymentFeedbackRecord,
): boolean {
  try {
    database
      .prepare(
        `
        INSERT INTO payment_feedback (tx_id, guild_id, buyer_id, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        feedback.tx_id,
        feedback.guild_id,
        feedback.buyer_id,
        feedback.rating,
        feedback.comment || null,
        feedback.created_at,
      );
    return true;
  } catch {
    return false;
  }
}

/**
 * Lưu bản ghi quyên góp (PayOS Donation)
 */
export function createDonation(database: Database.Database, donation: DonationRecord): void {
  database
    .prepare(
      `
      INSERT INTO donations (
        order_code, user_id, user_tag, guild_id, amount,
        message, status, payment_link_id, created_at, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      donation.order_code,
      donation.user_id,
      donation.user_tag,
      donation.guild_id || null,
      donation.amount,
      donation.message || null,
      donation.status,
      donation.payment_link_id || null,
      donation.created_at,
      donation.paid_at || null,
    );
}

/**
 * Cập nhật trạng thái quyên góp (paid / cancelled)
 */
export function updateDonationStatus(
  database: Database.Database,
  orderCode: number,
  status: DonationStatus,
): boolean {
  const result = database
    .prepare(
      `
      UPDATE donations
      SET status = ?, paid_at = ?
      WHERE order_code = ? AND status = 'pending'
    `,
    )
    .run(status, status === 'paid' ? Date.now() : null, orderCode);

  return result.changes === 1;
}

/**
 * Lấy thông tin quyên góp theo order_code
 */
export function getDonationByOrderCode(
  database: Database.Database,
  orderCode: number,
): DonationRecord | undefined {
  return database.prepare(`SELECT * FROM donations WHERE order_code = ?`).get(orderCode) as
    DonationRecord | undefined;
}
