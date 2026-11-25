/**
 * Reconciliation Service — Quản lý quy trình đối soát bù tự động và theo yêu cầu.
 * Tuân thủ Spec V1.2 Section 8: Exponential Backoff, Idempotency và Single Transaction Fulfillment.
 */

import Database from 'better-sqlite3';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getPayosPaymentInfo, parsePayosDateTime } from '../../services/payos.service.js';
import {
  fulfillPayment,
  getSubscriptionOrderByCode,
  FulfillmentResult,
} from './subscription.service.js';
import { SubscriptionOrderRecord } from '../../database/subscription.db.js';
import { getSettingsService } from '../../services/settings.service.js';
import { findAnnouncementChannel } from '../admin/subcommands/bot.subcommand.js';
import { createLogger } from '../../utils/logger.js';
import { BOT_BRANDING } from '../../config/branding.config.js';

const logger = createLogger('SubscriptionReconcile');

/**
 * Gửi thông báo & biên lai gia hạn bản quyền:
 * 1. Gửi tin nhắn riêng (DM) cho Admin/Owner đã tạo đơn.
 * 2. Gửi thông báo công khai vào Kênh thông báo Bot của Guild (nếu đã cấu hình).
 */
export async function sendSubscriptionReceiptNotification(
  client: Client,
  order: SubscriptionOrderRecord,
  result: FulfillmentResult,
): Promise<void> {
  if (!result.success) return;

  const expiryTimestamp = Math.floor(result.newExpiry / 1000);
  const guildName = client.guilds?.cache?.get(order.guild_id)?.name;
  const guildDisplay = guildName
    ? `**${guildName}** (\`${order.guild_id}\`)`
    : `\`${order.guild_id}\``;
  const receiptEmbed = new EmbedBuilder()
    .setTitle('💎 Kích Hoạt Bản Quyền Kéo Lão Bản Thành Công!')
    .setColor(0x2ecc71)
    .setDescription(
      `Cảm ơn bạn đã nâng cấp dịch vụ Kéo Lão Bản!\nHệ thống đã tự động gia hạn bản quyền cho máy chủ ${guildDisplay}.`,
    )
    .addFields(
      { name: 'Mã đơn hàng', value: `\`#${order.order_code}\``, inline: true },
      {
        name: 'Gói dịch vụ',
        value: `**${order.package_type}** (+${result.durationDays} ngày)`,
        inline: true,
      },
      {
        name: 'Số tiền thanh toán',
        value: `**${order.amount.toLocaleString('vi-VN')} VNĐ**`,
        inline: true,
      },
      {
        name: 'Hạn dùng mới',
        value: `<t:${expiryTimestamp}:f> (<t:${expiryTimestamp}:R>)`,
        inline: false,
      },
      {
        name: 'Ghi chú',
        value: result.isLate
          ? '⚠️ *Đơn hàng được thanh toán bù sau khi mã QR hết hạn nhưng đã được tự động phục hồi hợp lệ.*'
          : '✅ *Kích hoạt tự động qua cổng VietQR PayOS.*',
        inline: false,
      },
    )
    .setFooter({ text: BOT_BRANDING.watermarkText })
    .setTimestamp();

  // 1. Gửi DM cho người mua
  if (order.user_id && client.users?.send) {
    try {
      await client.users.send(order.user_id, { embeds: [receiptEmbed] });
      logger.info(
        `[Reconcile] Đã gửi DM biên lai đơn #${order.order_code} cho user ${order.user_id}`,
      );
    } catch (err) {
      logger.debug(
        `Không thể gửi DM biên lai cho user ${order.user_id}: ${(err as Error).message}`,
      );
    }
  }

  // 2. Gửi thông báo vào announcement channel của máy chủ nếu có
  try {
    const guild = client.guilds?.cache?.get(order.guild_id);
    if (guild) {
      const configuredChannelId = getSettingsService().get(guild.id).botAnnounce?.channelId;
      const { channel } = findAnnouncementChannel(guild, configuredChannelId);
      if (channel && typeof (channel as TextChannel).send === 'function') {
        await (channel as TextChannel).send({ embeds: [receiptEmbed] });
        logger.info(
          `[Reconcile] Đã gửi thông báo gia hạn bản quyền vào #${channel.name} (${guild.name})`,
        );
      }
    }
  } catch (guildErr) {
    logger.warn('Lỗi gửi thông báo vào announcement channel:', { error: String(guildErr) });
  }
}

export interface ReconcileOrderResult {
  success: boolean;
  reason?:
    | 'order_not_found'
    | 'already_fulfilled'
    | 'still_pending'
    | 'cancelled'
    | 'expired'
    | 'api_error'
    | 'fulfillment_failed';
  result?: FulfillmentResult;
  error?: string;
}

/**
 * Thực hiện đối soát 1 đơn hàng với PayOS.
 * Dùng chung cho cả Background Reconciliation Worker và Nút [🔄 Kiểm Tra Lại] trên Discord UI.
 */
export async function reconcileSubscriptionOrder(
  db: Database.Database,
  orderCode: number,
  client?: Client,
): Promise<ReconcileOrderResult> {
  const order = getSubscriptionOrderByCode(db, orderCode);
  if (!order) {
    return { success: false, reason: 'order_not_found' };
  }

  if (order.status === 'paid' || order.status === 'paid_late') {
    return { success: true, reason: 'already_fulfilled' };
  }

  const payosRes = await getPayosPaymentInfo(orderCode);
  const now = Date.now();

  // 1. Nếu PayOS báo lỗi kết nối hoặc API error -> Exponential backoff, KHÔNG đổi status sang failed
  if (!payosRes.success || !payosRes.data) {
    const attempts = order.reconcile_attempts + 1;
    const nextAt = now + Math.pow(2, attempts) * 60_000;
    db.prepare(
      'UPDATE subscription_orders SET reconcile_attempts = ?, next_reconcile_at = ? WHERE order_code = ?',
    ).run(attempts, nextAt, orderCode);

    return {
      success: false,
      reason: 'api_error',
      error: payosRes.error || 'Lỗi kết nối PayOS',
    };
  }

  const data = payosRes.data;

  // 2. Nếu PayOS xác nhận đã thanh toán (PAID)
  if (data.status === 'PAID') {
    const tx = data.transactions?.[0];
    const actualAmount = data.amountPaid || data.amount;
    const paymentReference = tx?.reference || data.id || `PAYOS-${orderCode}`;
    const transactionTime = tx ? parsePayosDateTime(tx.transactionDateTime) : now;

    const fulfillRes = fulfillPayment(db, {
      orderCode,
      actualAmount,
      paymentReference,
      transactionTime,
    });

    if (fulfillRes.success && client) {
      await sendSubscriptionReceiptNotification(client, order, fulfillRes);
    }

    return {
      success: fulfillRes.success,
      reason: fulfillRes.success ? undefined : 'fulfillment_failed',
      result: fulfillRes,
    };
  }

  // 3. Nếu PayOS báo đơn bị hủy (CANCELLED)
  if (data.status === 'CANCELLED') {
    db.prepare(
      "UPDATE subscription_orders SET status = 'cancelled' WHERE order_code = ? AND status = 'pending'",
    ).run(orderCode);
    return { success: false, reason: 'cancelled' };
  }

  // 4. Nếu đơn vẫn đang ở trạng thái chờ (PENDING)
  // Kiểm tra điều kiện hết hạn (> 1 giờ kể từ expires_at và attempts >= 3)
  if (order.expires_at < now - 3_600_000 && order.reconcile_attempts >= 3) {
    db.prepare(
      "UPDATE subscription_orders SET status = 'expired' WHERE order_code = ? AND status = 'pending'",
    ).run(orderCode);
    return { success: false, reason: 'expired' };
  }

  // Cập nhật backoff cho lần đối soát kế tiếp
  const attempts = order.reconcile_attempts + 1;
  const nextAt = now + Math.pow(2, attempts) * 60_000;
  db.prepare(
    'UPDATE subscription_orders SET reconcile_attempts = ?, next_reconcile_at = ? WHERE order_code = ?',
  ).run(attempts, nextAt, orderCode);

  return { success: false, reason: 'still_pending' };
}

/**
 * Quét tối đa 5 đơn pending đủ điều kiện đối soát định kỳ.
 */
export async function runSubscriptionReconciler(
  db: Database.Database,
  client?: Client,
): Promise<number> {
  const now = Date.now();
  const oneHourAgo = now - 3_600_000;

  const orders = db
    .prepare(
      `
      SELECT order_code FROM subscription_orders
      WHERE status = 'pending'
        AND expires_at > ?
        AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?)
        AND reconcile_attempts < 3
      ORDER BY next_reconcile_at ASC
      LIMIT 5
    `,
    )
    .all(oneHourAgo, now) as Array<{ order_code: number }>;

  if (orders.length === 0) return 0;

  logger.info(`[Reconciler] Tìm thấy ${orders.length} đơn pending cần đối soát`);
  let reconciledCount = 0;

  for (const { order_code } of orders) {
    try {
      const res = await reconcileSubscriptionOrder(db, order_code, client);
      if (res.success) reconciledCount++;
    } catch (err) {
      logger.error(`[Reconciler] Lỗi đối soát đơn #${order_code}:`, { error: String(err) });
    }
  }

  return reconciledCount;
}

/**
 * Khởi động scheduler đối soát chạy ngầm mỗi 5 phút.
 */
export function startSubscriptionReconcileScheduler(
  db: Database.Database,
  client?: Client,
): () => void {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 phút

  logger.info('[Reconciler] Khởi động scheduler đối soát ngầm (chu kỳ 5 phút)');
  const timer = setInterval(() => {
    runSubscriptionReconciler(db, client).catch((err) => {
      logger.error('[Reconciler] Lỗi trong chu kỳ quét đối soát:', { error: String(err) });
    });
  }, INTERVAL_MS);

  // Cho phép Node.js exit tự nhiên trong test
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return () => clearInterval(timer);
}
