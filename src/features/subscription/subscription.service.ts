/**
 * Core Service cho Subscription Billing & License Management
 * Tuân thủ Spec V1.2 — Single SQLite Transaction, Idempotency, Zero-Drift.
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  PackageType,
  SubscriptionOrderRecord,
  SubscriptionKeyRecord,
} from '../../database/subscription.db.js';

export const KEO_PACKAGES: Record<
  PackageType,
  { durationDays: number; amount: number; label: string }
> = {
  '1_MONTH': { durationDays: 30, amount: 149_000, label: '1 Tháng (30 ngày)' },
  '3_MONTHS': { durationDays: 90, amount: 399_000, label: '3 Tháng (90 ngày)' },
  '6_MONTHS': { durationDays: 180, amount: 699_000, label: '6 Tháng (180 ngày)' },
};

export interface VerifiedPaymentData {
  orderCode: number;
  actualAmount: number;
  paymentReference: string;
  transactionTime: number;
}

export type FulfillmentResult =
  | {
      success: true;
      status: 'paid' | 'paid_late';
      guildId: string;
      durationDays: number;
      newExpiry: number;
      isLate: boolean;
    }
  | {
      success: false;
      reason:
        | 'order_not_found'
        | 'already_fulfilled'
        | 'underpaid'
        | 'invalid_state'
        | 'database_conflict';
      orderCode: number;
      actualAmount?: number;
      expectedAmount?: number;
    };

/**
 * Xử lý hoàn tất đơn hàng thanh toán qua VietQR/PayOS trong 1 SQLite Transaction duy nhất.
 * Đảm bảo nguyên tắc Exactly-Once: không bao giờ cộng hạn lần 2 cho cùng 1 đơn hàng.
 */
export function fulfillPayment(
  db: Database.Database,
  payment: VerifiedPaymentData,
): FulfillmentResult {
  const runner = db.transaction((): FulfillmentResult => {
    // 1. Đọc thông tin đơn hàng
    const order = db
      .prepare('SELECT * FROM subscription_orders WHERE order_code = ?')
      .get(payment.orderCode) as SubscriptionOrderRecord | undefined;

    if (!order) {
      return { success: false, reason: 'order_not_found', orderCode: payment.orderCode };
    }

    // 2. Kiểm tra Idempotent: Nếu đã thành công trước đó thì bỏ qua an toàn
    if (order.status === 'paid' || order.status === 'paid_late') {
      return { success: false, reason: 'already_fulfilled', orderCode: payment.orderCode };
    }

    // 3. Chặn fulfill các đơn đang ở trạng thái không thể phục hồi
    if (order.status !== 'pending' && order.status !== 'expired') {
      return { success: false, reason: 'invalid_state', orderCode: payment.orderCode };
    }

    // 4. Kiểm tra thiếu tiền (Underpaid)
    if (payment.actualAmount < order.amount) {
      const underpaidRes = db
        .prepare(
          `
          UPDATE subscription_orders 
          SET status = 'underpaid', actual_paid_amount = ?, payment_reference = ?, paid_at = ?
          WHERE order_code = ? AND status IN ('pending', 'expired')
        `,
        )
        .run(
          payment.actualAmount,
          payment.paymentReference,
          payment.transactionTime,
          order.order_code,
        );

      if (underpaidRes.changes !== 1) {
        throw new Error(
          `[Fulfillment] Race condition khi cập nhật underpaid cho đơn #${order.order_code}`,
        );
      }

      return {
        success: false,
        reason: 'underpaid',
        orderCode: order.order_code,
        actualAmount: payment.actualAmount,
        expectedAmount: order.amount,
      };
    }

    // 5. Phân định thanh toán đúng hạn hay trễ hạn
    const isLate = payment.transactionTime > order.expires_at || order.status === 'expired';
    const nextStatus = isLate ? 'paid_late' : 'paid';

    // 6. Cập nhật trạng thái đơn hàng (Conditional Atomic Update)
    const orderUpdateRes = db
      .prepare(
        `
        UPDATE subscription_orders 
        SET status = ?, actual_paid_amount = ?, payment_reference = ?, paid_at = ?
        WHERE order_code = ? AND status IN ('pending', 'expired')
      `,
      )
      .run(
        nextStatus,
        payment.actualAmount,
        payment.paymentReference,
        payment.transactionTime,
        order.order_code,
      );

    if (orderUpdateRes.changes !== 1) {
      throw new Error(`[Fulfillment] Race condition khi chốt đơn #${order.order_code}`);
    }

    // 7. Bảo đảm bản ghi guild_subscriptions tồn tại trước khi cộng hạn
    const now = Date.now();
    db.prepare(
      `
      INSERT OR IGNORE INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
      VALUES (?, NULL, 0, ?, ?)
    `,
    ).run(order.guild_id, now, now);

    // 8. Cập nhật thời hạn bản quyền: max(now, current_expiry) + duration_ms
    const durationMs = order.duration_days * 86_400_000;
    const subUpdateRes = db
      .prepare(
        `
        UPDATE guild_subscriptions
        SET license_expires_at = CASE
          WHEN license_expires_at IS NULL OR license_expires_at < ? THEN ? + ?
          ELSE license_expires_at + ?
        END,
        updated_at = ?
        WHERE guild_id = ?
      `,
      )
      .run(now, now, durationMs, durationMs, now, order.guild_id);

    if (subUpdateRes.changes !== 1) {
      throw new Error(
        `[Fulfillment] Không thể cập nhật thời hạn bản quyền cho Guild ${order.guild_id}`,
      );
    }

    // 9. Lấy thời hạn mới trả về kết quả
    const updatedSub = db
      .prepare('SELECT license_expires_at FROM guild_subscriptions WHERE guild_id = ?')
      .get(order.guild_id) as { license_expires_at: number };

    return {
      success: true,
      status: nextStatus,
      guildId: order.guild_id,
      durationDays: order.duration_days,
      newExpiry: updatedSub.license_expires_at,
      isLate,
    };
  });
  return runner();
}

/**
 * Kích hoạt dùng thử 3 ngày cho Guild (At-Most-Once per guild).
 */
export function activateTrial(
  db: Database.Database,
  guildId: string,
): { success: boolean; reason: 'activated' | 'already_used'; expiresAt?: number } {
  const runner = db.transaction(
    (): { success: boolean; reason: 'activated' | 'already_used'; expiresAt?: number } => {
      const now = Date.now();
      const trialDurationMs = 3 * 86_400_000;

      // 1. Bảo đảm bản ghi tồn tại
      db.prepare(
        `
      INSERT OR IGNORE INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
      VALUES (?, NULL, 0, ?, ?)
    `,
      ).run(guildId, now, now);

      // 2. Atomic Update có kiểm tra điều kiện trial_used = 0
      const updateRes = db
        .prepare(
          `
        UPDATE guild_subscriptions
        SET trial_used = 1,
            license_expires_at = CASE
              WHEN license_expires_at IS NULL OR license_expires_at < ? THEN ? + ?
              ELSE license_expires_at + ?
            END,
            updated_at = ?
        WHERE guild_id = ? AND trial_used = 0
      `,
        )
        .run(now, now, trialDurationMs, trialDurationMs, now, guildId);

      if (updateRes.changes === 1) {
        const sub = db
          .prepare('SELECT license_expires_at FROM guild_subscriptions WHERE guild_id = ?')
          .get(guildId) as { license_expires_at: number };

        return { success: true, reason: 'activated', expiresAt: sub.license_expires_at };
      }

      return { success: false, reason: 'already_used' };
    },
  );
  return runner();
}

/**
 * Tiêu thụ mã bản quyền dự phòng (License Key).
 * Mã Key định dạng KLB-XXXX-XXXX-XXXX-XXXX (128-bit entropy).
 */
export function consumeLicenseKey(
  db: Database.Database,
  rawKey: string,
  guildId: string,
  userId: string,
): {
  success: boolean;
  reason: 'success' | 'invalid_key' | 'already_used' | 'expired';
  durationDays?: number;
  newExpiry?: number;
} {
  const normalizedKey = rawKey.trim().toUpperCase();

  const runner = db.transaction(
    (): {
      success: boolean;
      reason: 'success' | 'invalid_key' | 'already_used' | 'expired';
      durationDays?: number;
      newExpiry?: number;
    } => {
      const keyRecord = db
        .prepare('SELECT * FROM subscription_keys WHERE key = ?')
        .get(normalizedKey) as SubscriptionKeyRecord | undefined;

      if (!keyRecord) return { success: false, reason: 'invalid_key' };
      if (keyRecord.status !== 'unused') return { success: false, reason: 'already_used' };
      if (keyRecord.expires_at && Date.now() > keyRecord.expires_at) {
        return { success: false, reason: 'expired' };
      }

      const now = Date.now();

      // 1. Đánh dấu tiêu thụ key (Atomic condition)
      const keyUpdateRes = db
        .prepare(
          `
        UPDATE subscription_keys
        SET status = 'used', used_by_guild = ?, used_by_user = ?, used_at = ?
        WHERE key = ? AND status = 'unused'
      `,
        )
        .run(guildId, userId, now, normalizedKey);

      if (keyUpdateRes.changes !== 1) {
        throw new Error(`[KeyRedemption] Race condition tiêu thụ key ${normalizedKey}`);
      }

      // 2. Bảo đảm guild_subscriptions tồn tại
      db.prepare(
        `
      INSERT OR IGNORE INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
      VALUES (?, NULL, 0, ?, ?)
    `,
      ).run(guildId, now, now);

      // 3. Gia hạn thời gian bản quyền cho Guild
      const durationMs = keyRecord.duration_days * 86_400_000;
      const subUpdateRes = db
        .prepare(
          `
        UPDATE guild_subscriptions
        SET license_expires_at = CASE
          WHEN license_expires_at IS NULL OR license_expires_at < ? THEN ? + ?
          ELSE license_expires_at + ?
        END,
        updated_at = ?
        WHERE guild_id = ?
      `,
        )
        .run(now, now, durationMs, durationMs, now, guildId);

      if (subUpdateRes.changes !== 1) {
        throw new Error(`[KeyRedemption] Lỗi cập nhật subscription cho Guild ${guildId}`);
      }

      const sub = db
        .prepare('SELECT license_expires_at FROM guild_subscriptions WHERE guild_id = ?')
        .get(guildId) as { license_expires_at: number };

      return {
        success: true,
        reason: 'success',
        durationDays: keyRecord.duration_days,
        newExpiry: sub.license_expires_at,
      };
    },
  );
  return runner();
}

/**
 * Kiểm tra trạng thái bản quyền của Guild (Centralized Entitlement Checker).
 */
export function checkSubscriptionEntitlement(
  db: Database.Database,
  guildId: string,
): { isEntitled: boolean; expiresAt: number | null; statusText: string } {
  try {
    const sub = db
      .prepare('SELECT license_expires_at FROM guild_subscriptions WHERE guild_id = ?')
      .get(guildId) as { license_expires_at: number | null } | undefined;

    const expiresAt = sub?.license_expires_at ?? null;
    const isEntitled = expiresAt !== null && expiresAt > Date.now();

    return {
      isEntitled,
      expiresAt,
      statusText: isEntitled
        ? `🟢 Còn hạn (Hết hạn lúc: <t:${Math.floor(expiresAt! / 1000)}:R>)`
        : '🔴 Đã hết hạn / Chưa kích hoạt',
    };
  } catch (err: unknown) {
    // Fallback an toàn nếu database chưa chạy migration tạo bảng guild_subscriptions
    if (err instanceof Error && err.message.includes('no such table')) {
      return {
        isEntitled: true,
        expiresAt: null,
        statusText: '🟢 Không giới hạn (Legacy)',
      };
    }
    throw err;
  }
}

/**
 * Tìm đơn pending còn hạn (< 15p) cùng loại gói để tái sử dụng, chống spam order trong DB.
 */
export function getPendingOrderForGuild(
  db: Database.Database,
  guildId: string,
  packageType: PackageType,
): SubscriptionOrderRecord | undefined {
  const now = Date.now();
  return db
    .prepare(
      `
      SELECT * FROM subscription_orders
      WHERE guild_id = ? AND package_type = ? AND status = 'pending' AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    )
    .get(guildId, packageType, now) as SubscriptionOrderRecord | undefined;
}

/**
 * Tạo một đơn hàng thanh toán mới trong SQLite.
 */
export function createSubscriptionOrder(
  db: Database.Database,
  order: {
    orderCode: number;
    guildId: string;
    userId: string;
    packageType: PackageType;
    durationDays: number;
    amount: number;
    checkoutUrl?: string | null;
    qrCode?: string | null;
    expiresAt: number;
  },
): SubscriptionOrderRecord {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO subscription_orders (
      order_code, guild_id, user_id, package_type, duration_days, amount,
      status, checkout_url, qr_code, reconcile_attempts, next_reconcile_at,
      created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, NULL, ?, ?)
  `,
  ).run(
    order.orderCode,
    order.guildId,
    order.userId,
    order.packageType,
    order.durationDays,
    order.amount,
    order.checkoutUrl || null,
    order.qrCode || null,
    now,
    order.expiresAt,
  );

  return db
    .prepare('SELECT * FROM subscription_orders WHERE order_code = ?')
    .get(order.orderCode) as SubscriptionOrderRecord;
}

/**
 * Sinh mã bản quyền dự phòng cho Bot Owner tặng/bán thủ công (128-bit entropy).
 */
export function generateSubscriptionKey(
  db: Database.Database,
  params: {
    durationDays: number;
    createdBy: string;
    note?: string | null;
    expiresAt?: number | null;
  },
): SubscriptionKeyRecord {
  // Sinh 16 bytes ngẫu nhiên = 128-bit entropy
  const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
  const formattedKey = `KLB-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}-${randomHex.slice(12, 16)}`;
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO subscription_keys (
      key, duration_days, status, created_by, note, created_at, expires_at
    ) VALUES (?, ?, 'unused', ?, ?, ?, ?)
  `,
  ).run(
    formattedKey,
    params.durationDays,
    params.createdBy,
    params.note || null,
    now,
    params.expiresAt || null,
  );

  return db
    .prepare('SELECT * FROM subscription_keys WHERE key = ?')
    .get(formattedKey) as SubscriptionKeyRecord;
}

/**
 * Đọc thông tin đơn hàng theo orderCode.
 */
export function getSubscriptionOrderByCode(
  db: Database.Database,
  orderCode: number,
): SubscriptionOrderRecord | undefined {
  try {
    return db.prepare('SELECT * FROM subscription_orders WHERE order_code = ?').get(orderCode) as
      SubscriptionOrderRecord | undefined;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('no such table')) {
      return undefined;
    }
    throw err;
  }
}
