import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../../services/settings.service.js';
import { extractMemberRoleIds } from '../../config/permissions.js';
import { createLogger } from '../../utils/logger.js';
import { getPaymentById, updatePaymentStatus, saveFeedback } from './payment.service.js';
import { buildPaymentResultContainer } from '../../utils/vietqr.utils.js';
import { TTLStore, ExpiryEntry } from '../../utils/ttl-store.js';

const logger = createLogger('PaymentFlow');

const PAYMENT_SESSION_TTL_MS = 15 * 60 * 1000;
const FEEDBACK_RATE_LIMIT_MS = 1500;

interface PaymentSession extends ExpiryEntry {
  action: 'confirm' | 'cancel';
  txId: string;
  buyerId: string;
  sourceChannelId: string | null;
  sourceMessageId: string | null;
  userId: string;
}

interface FeedbackSession extends ExpiryEntry {
  rating: number;
  txId: string;
  buyerId: string;
  sourceChannelId: string | null;
  sourceMessageId: string | null;
}

/** Quản lý phiên tương tác duyệt/hủy hóa đơn với TTL 15 phút và tự động dọn dẹp nền */
export const paymentSessions = new TTLStore<string, PaymentSession>({
  ttlMs: PAYMENT_SESSION_TTL_MS,
  cleanupIntervalMs: 5 * 60 * 1000,
  name: 'PaymentSessions',
});

/** Quản lý phiên đánh giá dịch vụ với TTL 15 phút và tự động dọn dẹp nền */
export const feedbackSessions = new TTLStore<string, FeedbackSession>({
  ttlMs: PAYMENT_SESSION_TTL_MS,
  cleanupIntervalMs: 5 * 60 * 1000,
  name: 'FeedbackSessions',
});

interface FeedbackRateLimitEntry extends ExpiryEntry {
  timestamp: number;
}

const feedbackRateLimit = new TTLStore<string, FeedbackRateLimitEntry>({
  ttlMs: FEEDBACK_RATE_LIMIT_MS,
  cleanupIntervalMs: 60 * 1000,
  name: 'FeedbackRateLimit',
});

function createSessionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Kiểm tra interaction có phải nút thanh toán Confirm / Cancel không
 * Hỗ trợ cả snowflake ID và chuỗi UNASSIGNED
 */
export function isPaymentButton(customId: string): boolean {
  return /^pay_(confirm|cancel)_([A-Za-z0-9_-]+)_([A-Za-z0-9_-]+)$/.test(customId);
}

/**
 * Kiểm tra interaction có phải modal Confirm / Cancel không
 */
export function isPaymentModal(customId: string): boolean {
  return /^pay_modal_(confirm|cancel)_([A-Za-z0-9]+)$/.test(customId);
}

/**
 * Kiểm tra interaction có phải nút đánh giá sao không
 */
export function isFeedbackRateButton(customId: string): boolean {
  return /^feedback_rate_([1-5])_([A-Za-z0-9_-]+)_([A-Za-z0-9_-]+)$/.test(customId);
}

/**
 * Kiểm tra interaction có phải modal đánh giá feedback không
 */
export function isFeedbackModal(customId: string): boolean {
  return /^feedback_modal_([A-Za-z0-9]+)$/.test(customId);
}

/**
 * Tạo hàng nút Confirm / Cancel cho hóa đơn VietQR
 */
export function buildPaymentActionRow(
  txId: string,
  buyerId: string,
  options: { disabled?: boolean } = {},
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`pay_confirm_${txId}_${buyerId}`)
      .setLabel('Xác nhận (Confirm)')
      .setStyle(ButtonStyle.Success)
      .setDisabled(Boolean(options.disabled)),
    new ButtonBuilder()
      .setCustomId(`pay_cancel_${txId}_${buyerId}`)
      .setLabel('Hủy (Cancel)')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(Boolean(options.disabled)),
  );
}

/**
 * Tạo 5 nút đánh giá 1 đến 5 sao
 */
export function buildRatingButtons(
  txId: string,
  buyerId: string,
  selectedRating?: number,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let rating = 1; rating <= 5; rating += 1) {
    const isSelected = selectedRating !== undefined && rating === selectedRating;
    const button = new ButtonBuilder()
      .setCustomId(
        selectedRating !== undefined
          ? `feedback_done_${rating}_${txId}_${buyerId}`
          : `feedback_rate_${rating}_${txId}_${buyerId}`,
      )
      .setLabel(`${rating} ⭐`)
      .setStyle(
        selectedRating !== undefined
          ? isSelected
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
          : ButtonStyle.Primary,
      )
      .setDisabled(selectedRating !== undefined);

    row.addComponents(button);
  }
  return row;
}

/**
 * Kiểm tra người dùng có quyền duyệt/hủy thanh toán không:
 * - Guild Owner
 * - Discord Administrator
 * - BOT_ADMIN hoặc MODERATOR role
 * - Staff Role (được cấu hình riêng cho từng Guild trong vietqr.staffRoleId)
 */
export function canManagePayment(
  interaction: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction,
  guildId: string,
): boolean {
  if (
    interaction.guild?.ownerId &&
    interaction.user?.id &&
    interaction.guild.ownerId === interaction.user.id
  ) {
    return true;
  }

  const member = interaction.member as GuildMember | null;
  if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;

  try {
    const settingsService = getSettingsService();
    const settings = settingsService.get(guildId);

    const userRoles = extractMemberRoleIds(interaction.member);

    // Kiểm tra Staff Role riêng của tính năng QR
    if (settings.vietqr?.staffRoleId && userRoles.includes(settings.vietqr.staffRoleId)) {
      return true;
    }

    // Kiểm tra Bot Admin & Moderator
    if (settings.rbac?.botAdminRoleId && userRoles.includes(settings.rbac.botAdminRoleId)) {
      return true;
    }
    if (settings.rbac?.moderatorRoleId && userRoles.includes(settings.rbac.moderatorRoleId)) {
      return true;
    }

    // Nếu là ChatInputCommandInteraction (lệnh /pay create) và server chưa cấu hình staffRoleId riêng
    const isCommand = !('customId' in interaction);
    if (isCommand && !settings.vietqr?.staffRoleId) {
      return true;
    }
  } catch {
    // SettingsService fallback
  }

  return false;
}

/**
 * Xử lý khi Admin hoặc Staff bấm nút Confirm hoặc Cancel trên hóa đơn
 */
export async function handlePaymentButton(
  interaction: ButtonInteraction,
  database?: Database.Database,
): Promise<void> {
  const match = interaction.customId.match(
    /^pay_(confirm|cancel)_([A-Za-z0-9_-]+)_([A-Za-z0-9_-]+)$/,
  );
  if (!match) return;

  const [, actionStr, txId, buyerId] = match;
  const action = actionStr as 'confirm' | 'cancel';
  const guildId = interaction.guildId;

  if (!guildId || !canManagePayment(interaction, guildId)) {
    await interaction.reply({
      content: '🔒 Bạn không có quyền xác nhận hoặc hủy hóa đơn thanh toán này.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const db = database || interaction.client.database;
  if (!db) {
    await interaction.reply({
      content: '⚠️ Lỗi kết nối cơ sở dữ liệu.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const tx = getPaymentById(db, txId);
  if (!tx || tx.status !== 'pending') {
    await interaction.reply({
      content: '⚠️ Hóa đơn này không còn ở trạng thái chờ xử lý.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Kiểm tra thời hạn hiệu lực của hóa đơn (Invoice Expiration)
  const now = Date.now();
  if (tx.expires_at && now > tx.expires_at) {
    updatePaymentStatus(db, tx.id, 'cancelled', 'Hóa đơn đã hết hạn (Expired)');
    await interaction.reply({
      content: '⚠️ Hóa đơn này đã hết hạn hiệu lực thanh toán.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (tx.buyer_id !== buyerId) {
    await interaction.reply({
      content: '⚠️ Thông tin khách hàng không khớp với hóa đơn.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = createSessionId();
  paymentSessions.set(sessionId, {
    action,
    txId: tx.id,
    buyerId: tx.buyer_id,
    sourceChannelId: interaction.channelId,
    sourceMessageId: interaction.message.id,
    userId: interaction.user.id,
    expiresAt: Date.now() + PAYMENT_SESSION_TTL_MS,
  });

  const title = action === 'confirm' ? 'Xác nhận thanh toán' : 'Hủy giao dịch';
  const modal = new ModalBuilder().setCustomId(`pay_modal_${action}_${sessionId}`).setTitle(title);

  const reasonInput = new TextInputBuilder()
    .setCustomId('pay_reason')
    .setLabel(action === 'confirm' ? 'Ghi chú xác nhận (tùy chọn)' : 'Lý do hủy giao dịch')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      action === 'confirm' ? 'Nhập ghi chú đơn hàng nếu cần...' : 'Nhập lý do hủy hóa đơn...',
    )
    .setRequired(action === 'cancel')
    .setMinLength(action === 'cancel' ? 3 : 0)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

  await interaction.showModal(modal);
}

/**
 * Xử lý khi modal Confirm / Cancel được submit
 */
export async function handlePaymentModal(
  interaction: ModalSubmitInteraction,
  database?: Database.Database,
): Promise<void> {
  const match = interaction.customId.match(/^pay_modal_(confirm|cancel)_([A-Za-z0-9]+)$/);
  if (!match) return;

  const [, actionStr, sessionId] = match;
  const action = actionStr as 'confirm' | 'cancel';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const session = paymentSessions.get(sessionId);
  if (!session || session.action !== action) {
    await interaction.editReply({
      content: '⚠️ Phiên xử lý đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
    });
    return;
  }

  if (session.userId !== interaction.user.id) {
    await interaction.editReply({
      content: '🔒 Bạn không được phép xử lý phiên của người khác.',
    });
    return;
  }

  const db = database || interaction.client.database;
  if (!db) {
    await interaction.editReply({ content: '⚠️ Lỗi kết nối cơ sở dữ liệu.' });
    return;
  }

  const tx = getPaymentById(db, session.txId);
  if (!tx || tx.status !== 'pending') {
    paymentSessions.delete(sessionId);
    await interaction.editReply({
      content:
        '⚠️ Giao dịch này không còn ở trạng thái chờ xử lý (có thể đã được xử lý bởi người khác).',
    });
    return;
  }

  // Kiểm tra thời hạn hiệu lực của hóa đơn khi submit modal
  const now = Date.now();
  if (tx.expires_at && now > tx.expires_at) {
    paymentSessions.delete(sessionId);
    updatePaymentStatus(db, tx.id, 'cancelled', 'Hóa đơn đã hết hạn (Expired)');
    await interaction.editReply({
      content: '⚠️ Hóa đơn thanh toán này đã hết hạn hiệu lực.',
    });
    return;
  }

  const reason = interaction.fields.getTextInputValue('pay_reason')?.trim() || null;
  const isConfirm = action === 'confirm';

  // Cập nhật Database
  const updated = updatePaymentStatus(db, tx.id, isConfirm ? 'confirmed' : 'cancelled', reason);

  if (!updated) {
    await interaction.editReply({
      content: '⚠️ Không thể cập nhật trạng thái hóa đơn. Vui lòng thử lại.',
    });
    return;
  }

  paymentSessions.delete(sessionId);

  // Lấy cấu hình máy chủ để tùy biến lời cảm ơn và đánh giá
  let enableRating = true;
  let thanksMessage: string | null = null;

  try {
    const settingsService = getSettingsService();
    const settings = settingsService.get(tx.guild_id);
    if (settings.vietqr) {
      enableRating = settings.vietqr.enableRating !== false;
      thanksMessage = settings.vietqr.thanksMessage || null;
    }
  } catch {
    // Defaults
  }

  // Cập nhật tin nhắn hóa đơn gốc trong kênh
  try {
    if (session.sourceChannelId && session.sourceMessageId) {
      const channel = await interaction.client.channels.fetch(session.sourceChannelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        const sendableChannel = channel as any;
        const sourceMessage = await channel.messages
          .fetch(session.sourceMessageId)
          .catch(() => null);
        if (sourceMessage) {
          // Xây dựng Container V2 hiển thị kết quả duyệt hoặc hủy (chuẩn Components V2 không dùng legacy content hay embeds)
          const resultContainer = buildPaymentResultContainer({
            isConfirm,
            txId: tx.id,
            amount: tx.amount,
            buyerId: tx.buyer_id,
            description: tx.description,
            operatorId: interaction.user.id,
            reason,
          });

          await sourceMessage.edit({
            components: isConfirm
              ? resultContainer.toJSON()
              : [
                  ...resultContainer.toJSON(),
                  buildPaymentActionRow(tx.id, tx.buyer_id, { disabled: true }).toJSON() as any,
                ],
            files: [],
            flags: MessageFlags.IsComponentsV2,
          });

          // Nếu là xác nhận thành công và bật đánh giá:
          if (isConfirm) {
            const finalThanks =
              thanksMessage ||
              'Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ! Chúc bạn có trải nghiệm tuyệt vời ❤️';

            const isAssignedBuyer = tx.buyer_id && tx.buyer_id !== 'UNASSIGNED';
            if (enableRating && isAssignedBuyer) {
              const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ Đánh giá trải nghiệm dịch vụ')
                .setDescription(
                  'Sự hài lòng của bạn là động lực lớn nhất của chúng tôi. Vui lòng chọn số sao để gửi đánh giá nhé!',
                )
                .setColor(0xf1c40f)
                .addFields(
                  { name: 'Mã đơn', value: `\`${tx.id}\``, inline: true },
                  { name: 'Dịch vụ', value: tx.description, inline: true },
                );

              await sendableChannel.send({
                content: `${finalThanks}\n\n<@${tx.buyer_id}> Vui lòng dành 5 giây đánh giá chất lượng phục vụ:`,
                embeds: [ratingEmbed],
                components: [buildRatingButtons(tx.id, tx.buyer_id).toJSON() as any],
              });
            } else {
              const mentionPart = isAssignedBuyer ? ` <@${tx.buyer_id}>` : '';
              await sendableChannel.send({
                content: `${finalThanks}${mentionPart}`,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    logger.warn('Lỗi khi cập nhật tin nhắn hóa đơn gốc:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await interaction.editReply({
    content: isConfirm
      ? `✅ Đã xác nhận thành công hóa đơn \`${tx.id}\`.`
      : `❌ Đã hủy hóa đơn \`${tx.id}\`.`,
  });
}

/**
 * Xử lý khi khách hàng bấm chọn số sao (1-5 ⭐)
 */
export async function handleFeedbackRateButton(
  interaction: ButtonInteraction,
  database?: Database.Database,
): Promise<void> {
  const match = interaction.customId.match(
    /^feedback_rate_([1-5])_([A-Za-z0-9_-]+)_([A-Za-z0-9_-]+)$/,
  );
  if (!match) return;

  const [, ratingStr, txId, buyerId] = match;
  const rating = Number.parseInt(ratingStr, 10);

  // Rate-limiting debounce qua TTLStore
  if (feedbackRateLimit.get(interaction.user.id)) {
    await interaction.reply({
      content: 'Vui lòng thao tác chậm lại một chút.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  feedbackRateLimit.set(interaction.user.id, {
    timestamp: Date.now(),
    expiresAt: Date.now() + FEEDBACK_RATE_LIMIT_MS,
  });

  if (buyerId === 'UNASSIGNED' || interaction.user.id !== buyerId) {
    await interaction.reply({
      content: '🔒 Chỉ người mua của đơn hàng này mới có thể gửi đánh giá.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const db = database || interaction.client.database;
  if (!db) {
    await interaction.reply({
      content: '⚠️ Lỗi kết nối cơ sở dữ liệu.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Chống đánh giá trùng lặp bằng dữ liệu persistent trong database
  const hasFeedback = db.prepare('SELECT 1 FROM payment_feedback WHERE tx_id = ?').get(txId);
  if (hasFeedback) {
    await interaction.reply({
      content: 'Bạn đã gửi đánh giá cho đơn hàng này rồi. Xin cảm ơn!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const tx = getPaymentById(db, txId);
  if (!tx || tx.status !== 'confirmed') {
    await interaction.reply({
      content: '⚠️ Đơn hàng không tồn tại hoặc chưa được xác nhận thanh toán.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = createSessionId();
  feedbackSessions.set(sessionId, {
    rating,
    txId,
    buyerId,
    sourceChannelId: interaction.channelId,
    sourceMessageId: interaction.message.id,
    expiresAt: Date.now() + PAYMENT_SESSION_TTL_MS,
  });

  const modal = new ModalBuilder()
    .setCustomId(`feedback_modal_${sessionId}`)
    .setTitle(`Đánh giá ${rating} sao ⭐`);

  const commentInput = new TextInputBuilder()
    .setCustomId('feedback_comment')
    .setLabel('Nhận xét của bạn về dịch vụ (tùy chọn)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Chia sẻ cảm nhận, trải nghiệm của bạn khi sử dụng dịch vụ...')
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput));

  await interaction.showModal(modal);
}

/**
 * Xử lý khi modal Feedback được submit
 */
export async function handleFeedbackModal(
  interaction: ModalSubmitInteraction,
  database?: Database.Database,
): Promise<void> {
  const match = interaction.customId.match(/^feedback_modal_([A-Za-z0-9]+)$/);
  if (!match) return;

  const sessionId = match[1];

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const session = feedbackSessions.get(sessionId);
  if (!session) {
    await interaction.editReply({
      content: '⚠️ Phiên gửi đánh giá đã hết hạn. Vui lòng bấm lại số sao.',
    });
    return;
  }

  if (session.buyerId !== interaction.user.id) {
    await interaction.editReply({
      content: '🔒 Bạn không được phép gửi đánh giá cho đơn này.',
    });
    return;
  }

  const comment = interaction.fields.getTextInputValue('feedback_comment')?.trim() || null;

  const db = database || interaction.client.database;
  if (!db) {
    await interaction.editReply({ content: '⚠️ Lỗi kết nối cơ sở dữ liệu.' });
    return;
  }

  const tx = getPaymentById(db, session.txId);
  if (!tx) {
    await interaction.editReply({ content: '⚠️ Không tìm thấy thông tin đơn hàng.' });
    return;
  }

  const saved = saveFeedback(db, {
    tx_id: tx.id,
    guild_id: tx.guild_id,
    buyer_id: session.buyerId,
    rating: session.rating,
    comment,
    created_at: Date.now(),
  });

  if (!saved) {
    await interaction.editReply({
      content: '⚠️ Bạn đã gửi đánh giá cho đơn hàng này trước đó rồi.',
    });
    return;
  }

  feedbackSessions.delete(sessionId);

  // Disable nút sao trên tin nhắn gốc
  try {
    if (session.sourceChannelId && session.sourceMessageId) {
      const channel = await interaction.client.channels.fetch(session.sourceChannelId);
      if (channel && channel.isTextBased()) {
        const sourceMessage = await channel.messages
          .fetch(session.sourceMessageId)
          .catch(() => null);
        if (sourceMessage) {
          await sourceMessage.edit({
            components: [
              buildRatingButtons(session.txId, session.buyerId, session.rating).toJSON() as any,
            ],
          });
        }
      }
    }
  } catch {
    // Ignore
  }

  // Gửi thông báo đến feedbackChannelId nếu có cấu hình
  try {
    const settingsService = getSettingsService();
    const settings = settingsService.get(tx.guild_id);
    const feedbackChannelId = settings.vietqr?.feedbackChannelId;

    if (feedbackChannelId) {
      const fbChannel = await interaction.client.channels
        .fetch(feedbackChannelId)
        .catch(() => null);
      if (fbChannel && fbChannel.isTextBased() && 'send' in fbChannel) {
        const sendableFbChannel = fbChannel as any;
        const starString = '⭐'.repeat(session.rating);
        const fbEmbed = new EmbedBuilder()
          .setTitle(`🌟 Đánh giá mới từ ${interaction.user.tag}`)
          .setColor(0xf1c40f)
          .addFields(
            { name: 'Mã đơn (TX)', value: `\`${tx.id}\``, inline: true },
            { name: 'Khách hàng', value: `<@${session.buyerId}>`, inline: true },
            {
              name: 'Đánh giá',
              value: `${starString} (**${session.rating}/5 sao**)`,
              inline: true,
            },
            { name: 'Dịch vụ đã mua', value: tx.description, inline: false },
            { name: 'Nhận xét', value: comment || '*Không có nhận xét*', inline: false },
          )
          .setTimestamp();

        await sendableFbChannel.send({
          content: `📢 **Đánh giá trải nghiệm dịch vụ mới** từ <@${session.buyerId}>:`,
          embeds: [fbEmbed],
        });
      }
    }
  } catch (error) {
    logger.warn('Lỗi khi gửi đánh giá tới feedbackChannel:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await interaction.editReply({
    content: '🎉 Cảm ơn bạn rất nhiều vì đã để lại đánh giá! Chúc bạn một ngày tuyệt vời ❤️',
  });
}
