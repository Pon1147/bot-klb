import {
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  claimKeoOrder,
  createKeoOrder,
  getKeoOrderById,
  KeoOrderRecord,
  updateKeoMessageIds,
  updateKeoOrderStatus,
} from '../../database/keo.db.js';
import { getSettingsService } from '../../services/settings.service.js';
import {
  buildDispatchCard,
  buildOpenOrderModal,
  buildRatingCard,
  buildTicketOrderCard,
} from './keo.builder.js';
import { buildVietQrImageUrl } from '../../utils/vietqr.utils.js';
import { createPayment, saveFeedback } from '../payment/payment.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('KeoHandler');

/**
 * Kiểm tra quyền quản trị / thợ / chủ server.
 */
function isOwnerOrAdmin(member: GuildMember, botAdminRoleId?: string | null): boolean {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (botAdminRoleId && member.roles.cache.has(botAdminRoleId)) return true;
  return false;
}

function isStaffOrMod(
  member: GuildMember,
  botAdminRoleId?: string | null,
  modRoleId?: string | null,
): boolean {
  if (isOwnerOrAdmin(member, botAdminRoleId)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  if (modRoleId && member.roles.cache.has(modRoleId)) return true;
  return false;
}

/**
 * Tự động kiểm tra và nâng cấp Role Lão Bản VIP theo mốc chi tiêu.
 */
async function checkAndApplyVipTier(
  member: GuildMember,
  database: Database.Database,
  keoConfig?: {
    tier1RoleId?: string | null;
    tier2RoleId?: string | null;
    tier3RoleId?: string | null;
  },
): Promise<void> {
  if (!keoConfig) return;

  try {
    const row = database
      .prepare(
        `SELECT SUM(amount) as total FROM payments WHERE guild_id = ? AND buyer_id = ? AND status = 'confirmed'`,
      )
      .get(member.guild.id, member.id) as { total: number } | undefined;

    const totalSpent = row?.total ?? 0;

    // Mốc: Tier 3 >= 10M, Tier 2 >= 3M, Tier 1 >= 500k
    let targetRoleId: string | null | undefined = null;
    if (totalSpent >= 10_000_000) {
      targetRoleId = keoConfig.tier3RoleId;
    } else if (totalSpent >= 3_000_000) {
      targetRoleId = keoConfig.tier2RoleId;
    } else if (totalSpent >= 500_000) {
      targetRoleId = keoConfig.tier1RoleId;
    }

    if (targetRoleId && member.guild.roles.cache.has(targetRoleId)) {
      if (!member.roles.cache.has(targetRoleId)) {
        await member.roles.add(targetRoleId);
        logger.info(`Đã thăng hạng role VIP cho Lão Bản ${member.user.tag} (Total: ${totalSpent})`);
      }
    }
  } catch (err) {
    logger.warn('Lỗi khi kiểm tra thăng hạng role VIP:', { error: String(err) });
  }
}

/**
 * Xử lý các Button tương tác thuộc dịch vụ Kéo Lão Bản (keo:*).
 */
export async function handleKeoButton(
  interaction: ButtonInteraction,
  database?: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('keo:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const action = parts[1];
  const targetId = parts[2];

  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  if (!guild || !member) {
    await interaction.reply({
      content: 'Chỉ hoạt động trong máy chủ.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const db = (database ?? interaction.client.database) as Database.Database;
  const settingsService = getSettingsService();
  const settings = settingsService.get(guild.id);
  const keoConfig = settings.keo;

  // 1. Mở Modal thiết lập đơn kéo
  if (action === 'open_modal') {
    const ticketChannelId = targetId;
    if (!isStaffOrMod(member, settings.rbac?.botAdminRoleId, settings.rbac?.moderatorRoleId)) {
      await interaction.reply({
        content: '🔒 Chỉ Quản Lý, Mod hoặc Thợ được phép mở đơn kéo.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    // Xác định khách hàng mở ticket
    const channel = guild.channels.cache.get(ticketChannelId) as TextChannel;
    let customerId = interaction.user.id;
    if (channel && channel.topic) {
      const match = channel.topic.match(/\d{17,20}/);
      if (match) customerId = match[0];
    }

    const modal = buildOpenOrderModal(ticketChannelId, customerId);
    await interaction.showModal(modal);
    return { handled: true };
  }

  // Lấy đơn kéo từ DB cho các action tiếp theo
  const order = getKeoOrderById(db, targetId);
  if (!order) {
    await interaction.reply({
      content: '❌ Không tìm thấy thông tin đơn kéo này.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 2. Thợ Kéo nhận đơn
  if (action === 'claim') {
    const workerRoleId = keoConfig?.workerRoleId;
    const isWorker = workerRoleId && member.roles.cache.has(workerRoleId);
    const isAdmin = isOwnerOrAdmin(member, settings.rbac?.botAdminRoleId);

    if (!isWorker && !isAdmin) {
      await interaction.reply({
        content: '🔒 Chỉ người sở hữu vai trò Thợ Kéo mới được nhận đơn.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    const claimed = claimKeoOrder(db, order.id, interaction.user.id);
    if (!claimed) {
      await interaction.reply({
        content: '⚠️ Đơn này đã có Thợ Kéo khác nhận trước hoặc không còn khả dụng.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    // Cập nhật lại đối tượng order
    order.status = 'CLAIMED';
    order.worker_id = interaction.user.id;

    // Sinh link mã VietQR
    let qrUrl: string | null = null;
    if (settings.vietqr?.bankId && settings.vietqr?.accountNo) {
      qrUrl = buildVietQrImageUrl({
        bankId: settings.vietqr.bankId,
        accountNo: settings.vietqr.accountNo,
        accountName: settings.vietqr.accountName ?? '',
        amount: order.amount,
        addInfo: `KEO ${order.id.slice(-6)}`,
        template: settings.vietqr.template ?? 'compact2',
      });
    }

    // Cập nhật thẻ ở Kênh Bắn Đơn
    await interaction.update(buildDispatchCard(order));

    // Cập nhật thẻ ở Kênh Ticket
    const ticketChannel = guild.channels.cache.get(order.ticket_channel_id) as TextChannel;
    if (ticketChannel && order.ticket_message_id) {
      try {
        const ticketMsg = await ticketChannel.messages.fetch(order.ticket_message_id);
        if (ticketMsg) {
          await ticketMsg.edit(buildTicketOrderCard(order, qrUrl));
        }
      } catch (err) {
        logger.warn('Không thể sửa message ticket khi thợ nhận:', { error: String(err) });
      }
    }

    await interaction.followUp({
      content: `🎯 Bạn đã nhận đơn kéo thành công! Vui lòng vào kênh <#${order.ticket_channel_id}> để phục vụ khách.`,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 3. Xác nhận tiền (DUY NHẤT OWNER hoặc Bot Admin)
  if (action === 'confirm_pay') {
    if (!isOwnerOrAdmin(member, settings.rbac?.botAdminRoleId)) {
      await interaction.reply({
        content: '🔒 Chỉ Chủ Server (hoặc Quản Trị Bot) mới có quyền bấm xác nhận nhận tiền.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    updateKeoOrderStatus(db, order.id, 'PAID');
    order.status = 'PAID';

    // Ghi nhận vào bảng payments để tính doanh thu & bảng xếp hạng Lão Bản
    createPayment(db, {
      id: `KEO_${order.id}`,
      guild_id: guild.id,
      buyer_id: order.customer_id,
      seller_id: interaction.user.id,
      amount: order.amount,
      description: `Dịch vụ kéo: ${order.package_name}`,
      status: 'confirmed',
      created_at: order.created_at,
      processed_at: Date.now(),
      bank_id: settings.vietqr?.bankId,
      account_no: settings.vietqr?.accountNo,
      account_name: settings.vietqr?.accountName,
    });

    // Cập nhật thẻ Ticket (ẩn QR và chuyển sang trạng thái đang kéo)
    await interaction.update(buildTicketOrderCard(order, null));

    // Cập nhật thẻ Kênh Bắn Đơn
    if (keoConfig?.dispatchChannelId && order.dispatch_message_id) {
      try {
        const dispatchChan = guild.channels.cache.get(keoConfig.dispatchChannelId) as TextChannel;
        if (dispatchChan) {
          const dispatchMsg = await dispatchChan.messages.fetch(order.dispatch_message_id);
          if (dispatchMsg) await dispatchMsg.edit(buildDispatchCard(order));
        }
      } catch (err) {
        logger.warn('Lỗi cập nhật tin nhắn dispatch khi duyệt tiền:', { error: String(err) });
      }
    }

    await interaction.followUp({
      content: `✅ Đã xác nhận nhận tiền **${order.amount.toLocaleString('vi-VN')} đ**! Thợ kéo <@${order.worker_id}> có thể bắt đầu.`,
    });
    return { handled: true };
  }

  // 4. Thợ Kéo báo cáo hoàn thành đơn
  if (action === 'worker_done') {
    const isAssignedWorker = order.worker_id === interaction.user.id;
    const isAdmin = isOwnerOrAdmin(member, settings.rbac?.botAdminRoleId);

    if (!isAssignedWorker && !isAdmin) {
      await interaction.reply({
        content: '🔒 Chỉ thợ kéo đảm nhận đơn này mới được bấm báo cáo xong.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    updateKeoOrderStatus(db, order.id, 'WORKER_DONE');
    order.status = 'WORKER_DONE';

    // Cập nhật thẻ ở Kênh Bắn Đơn
    await interaction.update(buildDispatchCard(order));

    // Cập nhật thẻ ở Kênh Ticket
    const ticketChannel = guild.channels.cache.get(order.ticket_channel_id) as TextChannel;
    if (ticketChannel && order.ticket_message_id) {
      try {
        const ticketMsg = await ticketChannel.messages.fetch(order.ticket_message_id);
        if (ticketMsg) {
          await ticketMsg.edit(buildTicketOrderCard(order));
          await ticketChannel.send({
            content: `📢 Thợ kéo <@${order.worker_id}> đã báo cáo hoàn tất đơn! Quản lý/Chủ Server vui lòng nghiệm thu và đóng đơn.`,
          });
        }
      } catch (err) {
        logger.warn('Lỗi cập nhật ticket khi thợ báo xong:', { error: String(err) });
      }
    }
    return { handled: true };
  }

  // 5. Nghiệm thu & Hoàn tất đơn
  if (action === 'complete') {
    if (!isStaffOrMod(member, settings.rbac?.botAdminRoleId, settings.rbac?.moderatorRoleId)) {
      await interaction.reply({
        content: '🔒 Chỉ Quản lý, Mod hoặc Chủ Server mới có quyền nghiệm thu hoàn tất đơn.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    updateKeoOrderStatus(db, order.id, 'COMPLETED');
    order.status = 'COMPLETED';

    // Kiểm tra và thăng hạng role Lão Bản VIP (nếu server có cài đặt)
    try {
      const customerMember = await guild.members.fetch(order.customer_id);
      if (customerMember) {
        await checkAndApplyVipTier(customerMember, db, keoConfig);
      }
    } catch {
      // Bỏ qua nếu khách đã rời server
    }

    // Cập nhật thẻ Ticket
    await interaction.update(buildTicketOrderCard(order));

    // Gửi thiệp cảm ơn kèm 5 nút đánh giá sao cho khách
    const ratingCard = buildRatingCard(order);
    await interaction.followUp(ratingCard);

    // Cập nhật thẻ ở Kênh Bắn Đơn
    if (keoConfig?.dispatchChannelId && order.dispatch_message_id) {
      try {
        const dispatchChan = guild.channels.cache.get(keoConfig.dispatchChannelId) as TextChannel;
        if (dispatchChan) {
          const dispatchMsg = await dispatchChan.messages.fetch(order.dispatch_message_id);
          if (dispatchMsg) await dispatchMsg.edit(buildDispatchCard(order));
        }
      } catch (err) {
        logger.warn('Lỗi cập nhật dispatch khi hoàn tất:', { error: String(err) });
      }
    }
    return { handled: true };
  }

  // 6. Đánh giá ⭐ từ khách hàng
  if (action === 'rate') {
    const stars = parseInt(parts[3] ?? '5', 10);
    saveFeedback(db, {
      tx_id: `KEO_${order.id}`,
      guild_id: guild.id,
      buyer_id: interaction.user.id,
      rating: stars,
      created_at: Date.now(),
    });

    await interaction.reply({
      content: `⭐ Cảm ơn bạn đã đánh giá **${stars} sao** cho dịch vụ! Chúc bạn chơi game vui vẻ.`,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 7. Hủy đơn
  if (action === 'cancel') {
    if (!isStaffOrMod(member, settings.rbac?.botAdminRoleId, settings.rbac?.moderatorRoleId)) {
      await interaction.reply({
        content: '🔒 Không có quyền hủy đơn.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    updateKeoOrderStatus(db, order.id, 'CANCELLED');
    order.status = 'CANCELLED';

    await interaction.update(buildTicketOrderCard(order));
    if (keoConfig?.dispatchChannelId && order.dispatch_message_id) {
      try {
        const dispatchChan = guild.channels.cache.get(keoConfig.dispatchChannelId) as TextChannel;
        if (dispatchChan) {
          const dispatchMsg = await dispatchChan.messages.fetch(order.dispatch_message_id);
          if (dispatchMsg) await dispatchMsg.edit(buildDispatchCard(order));
        }
      } catch (err) {
        logger.warn('Lỗi cập nhật dispatch khi hủy đơn:', { error: String(err) });
      }
    }
    return { handled: true };
  }

  return { handled: false };
}

/**
 * Xử lý Submit Modal tạo đơn kéo (keo_modal:create:*).
 */
export async function handleKeoModal(
  interaction: ModalSubmitInteraction,
  database?: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('keo_modal:create:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const ticketChannelId = parts[2];
  const customerId = parts[3];

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Chỉ hoạt động trong máy chủ.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const db = (database ?? interaction.client.database) as Database.Database;
  const settingsService = getSettingsService();
  const settings = settingsService.get(guild.id);
  const keoConfig = settings.keo;

  if (!keoConfig?.dispatchChannelId) {
    await interaction.reply({
      content:
        '❌ Máy chủ chưa thiết lập **Kênh Bắn Kèo**. Vui lòng vào `/admin` để cài đặt trước.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const packageName = interaction.fields.getTextInputValue('package_name').trim();
  const rawAmount = interaction.fields.getTextInputValue('amount').replace(/[^\d]/g, '');
  const note = interaction.fields.getTextInputValue('note')?.trim() || null;

  const amount = parseInt(rawAmount, 10);
  if (!amount || isNaN(amount) || amount <= 0) {
    await interaction.reply({
      content: '❌ Số tiền không hợp lệ. Vui lòng nhập số tiền nguyên dương (VD: 300000).',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const orderId =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const now = Date.now();

  const newOrder: KeoOrderRecord = {
    id: orderId,
    guild_id: guild.id,
    ticket_channel_id: ticketChannelId,
    customer_id: customerId,
    package_name: packageName,
    amount,
    note,
    worker_id: null,
    status: 'OPEN',
    dispatch_message_id: null,
    ticket_message_id: null,
    created_at: now,
    updated_at: now,
  };

  createKeoOrder(db, newOrder);

  // 1. Bắn đơn sang Kênh Bắn Đơn
  let dispatchMsgId: string | null = null;
  const dispatchChannel = guild.channels.cache.get(keoConfig.dispatchChannelId) as TextChannel;
  if (dispatchChannel) {
    try {
      const pingText = keoConfig.workerRoleId ? `<@&${keoConfig.workerRoleId}> ` : '';
      const dispatchMsg = await dispatchChannel.send({
        content: `${pingText}🎯 **Có đơn kéo mới cần thợ nhận ngay!**`,
        ...buildDispatchCard(newOrder),
      });
      dispatchMsgId = dispatchMsg.id;
    } catch (err) {
      logger.error('Không thể gửi thẻ vào Kênh Bắn Đơn:', { error: String(err) });
    }
  }

  // 2. Phản hồi vào Kênh Ticket tạo Living Order Card
  const ticketCard = buildTicketOrderCard(newOrder);
  const ticketMsg = await interaction.reply({
    ...ticketCard,
    fetchReply: true,
  });

  // Lưu message IDs vào DB
  updateKeoMessageIds(db, orderId, dispatchMsgId, ticketMsg.id);

  return { handled: true };
}
