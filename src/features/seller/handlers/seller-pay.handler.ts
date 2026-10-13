/**
 * Handler xử lý tương tác đơn thanh toán kéo game (Confirm, Cancel).
 */

import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { getSellerDb } from '../../../database/seller.db.js';
import {
  buildCancelledPaymentEmbed,
  buildConfirmedPaymentEmbed,
  buildFeedbackPromptEmbed,
  buildPaymentActionRow,
  buildRatingButtonsRow,
  SELLER_PAY_IDS,
} from '../ui/seller-pay.container.js';
import { hasPolicy, Policy } from '../../../config/permissions.js';

/**
 * Kiểm tra xem user có quyền xác nhận đơn giao dịch (Phải là Seller hoặc Admin).
 */
function canConfirmTransaction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  sellerId: string,
): boolean {
  if (interaction.user.id === sellerId) return true;
  return hasPolicy(interaction, Policy.MANAGE_CONFIG).allowed;
}

/**
 * Kiểm tra xem user có quyền hủy đơn giao dịch (Seller, Buyer hoặc Admin).
 */
function canCancelTransaction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  sellerId: string,
  buyerId: string,
): boolean {
  if (interaction.user.id === sellerId || interaction.user.id === buyerId) return true;
  return hasPolicy(interaction, Policy.MANAGE_CONFIG).allowed;
}

/**
 * Xử lý khi bấm nút "Xác Nhận Đã Nhận Tiền" -> Mở Modal ghi chú.
 */
export async function handlePaymentConfirmButton(
  interaction: ButtonInteraction,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx) {
    await interaction.reply({
      content: '❌ Không tìm thấy đơn giao dịch này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (tx.status !== 'pending') {
    await interaction.reply({
      content: `❌ Đơn giao dịch này đã ở trạng thái **${tx.status}**, không thể xác nhận lại!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canConfirmTransaction(interaction, tx.sellerId)) {
    await interaction.reply({
      content: '❌ Chỉ có thợ kéo của đơn này hoặc Quản trị viên mới được xác nhận thanh toán!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${SELLER_PAY_IDS.CONFIRM_MODAL}:${txId}`)
    .setTitle(`Xác Nhận Đơn ${txId}`);

  const noteInput = new TextInputBuilder()
    .setCustomId('confirm_note')
    .setLabel('Ghi chú xác nhận (Không bắt buộc)')
    .setPlaceholder('Ví dụ: Đã nhận đủ tiền từ khách...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(noteInput),
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi Submit Modal Xác Nhận Đơn.
 */
export async function handlePaymentConfirmModalSubmit(
  interaction: ModalSubmitInteraction,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx || tx.status !== 'pending') {
    await interaction.reply({
      content: '❌ Đơn giao dịch không hợp lệ hoặc đã được xử lý trước đó!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canConfirmTransaction(interaction, tx.sellerId)) {
    await interaction.reply({
      content: '❌ Bạn không có quyền xác nhận đơn này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const note = interaction.fields.getTextInputValue('confirm_note').trim() || null;
  const processedBy = interaction.user.id;

  const success = sellerDb.updateTransactionStatus(txId, 'confirmed', note, processedBy);
  if (!success) {
    await interaction.reply({
      content: '❌ Đơn giao dịch này đã được xử lý trước đó hoặc không còn ở trạng thái chờ!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updatedTx = sellerDb.getTransaction(txId)!;

  // Cập nhật Embed giao dịch gốc
  const confirmedEmbed = buildConfirmedPaymentEmbed(updatedTx, interaction.user.tag);
  const disabledRow = buildPaymentActionRow(txId, true);

  if (interaction.message && interaction.message.editable) {
    await interaction.message
      .edit({
        embeds: [confirmedEmbed],
        components: [disabledRow],
      })
      .catch(() => {});
  }

  await interaction.reply({
    content: `✅ Đã xác nhận thành công đơn **\`${txId}\`**!`,
    flags: MessageFlags.Ephemeral,
  });

  // Gửi prompt đánh giá dịch vụ công khai trong kênh cho khách hàng
  if (interaction.channel && 'send' in interaction.channel) {
    const feedbackEmbed = buildFeedbackPromptEmbed(updatedTx);
    const ratingRow = buildRatingButtonsRow(txId);

    await (interaction.channel as any)
      .send({
        content: `<@${updatedTx.buyerId}> ơi, đơn kéo đã hoàn tất!`,
        embeds: [feedbackEmbed],
        components: [ratingRow],
      })
      .catch(() => {});
  }
}

/**
 * Xử lý khi bấm nút "Hủy Đơn" -> Mở Modal nhập lý do hủy.
 */
export async function handlePaymentCancelButton(
  interaction: ButtonInteraction,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx) {
    await interaction.reply({
      content: '❌ Không tìm thấy đơn giao dịch này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (tx.status !== 'pending') {
    await interaction.reply({
      content: `❌ Đơn giao dịch này đã ở trạng thái **${tx.status}**, không thể hủy!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canCancelTransaction(interaction, tx.sellerId, tx.buyerId)) {
    await interaction.reply({
      content: '❌ Chỉ có thợ kéo, khách hàng hoặc Quản trị viên mới được hủy đơn này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${SELLER_PAY_IDS.CANCEL_MODAL}:${txId}`)
    .setTitle(`Hủy Đơn Giao Dịch ${txId}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('cancel_reason')
    .setLabel('Lý do hủy đơn')
    .setPlaceholder('Nhập lý do hủy giao dịch...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput),
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi Submit Modal Hủy Đơn.
 */
export async function handlePaymentCancelModalSubmit(
  interaction: ModalSubmitInteraction,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx || tx.status !== 'pending') {
    await interaction.reply({
      content: '❌ Đơn giao dịch không hợp lệ hoặc đã được xử lý trước đó!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canCancelTransaction(interaction, tx.sellerId, tx.buyerId)) {
    await interaction.reply({
      content: '❌ Bạn không có quyền hủy đơn này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = interaction.fields.getTextInputValue('cancel_reason').trim();
  const processedBy = interaction.user.id;

  const success = sellerDb.updateTransactionStatus(txId, 'cancelled', reason, processedBy);
  if (!success) {
    await interaction.reply({
      content: '❌ Đơn giao dịch này đã được xử lý trước đó hoặc không còn ở trạng thái chờ!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updatedTx = sellerDb.getTransaction(txId)!;

  const cancelledEmbed = buildCancelledPaymentEmbed(updatedTx, interaction.user.tag);
  const disabledRow = buildPaymentActionRow(txId, true);

  if (interaction.message && interaction.message.editable) {
    await interaction.message
      .edit({
        embeds: [cancelledEmbed],
        components: [disabledRow],
      })
      .catch(() => {});
  }

  await interaction.reply({
    content: `❌ Đã hủy đơn giao dịch **\`${txId}\`**.`,
    flags: MessageFlags.Ephemeral,
  });
}
