/**
 * Handler xử lý đánh giá sao & phản hồi từ khách hàng cho thợ kéo.
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
import { SELLER_PAY_IDS } from '../ui/seller-pay.container.js';

/**
 * Xử lý khi khách hàng bấm chọn số sao (1-5 ⭐).
 */
export async function handleRateStarButton(
  interaction: ButtonInteraction,
  rating: number,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx) {
    await interaction.reply({
      content: '❌ Không tìm thấy thông tin đơn giao dịch!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (tx.status !== 'confirmed') {
    await interaction.reply({
      content: '❌ Chỉ có thể đánh giá những đơn giao dịch đã hoàn tất thành công!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== tx.buyerId) {
    await interaction.reply({
      content: '❌ Chỉ người mua (khách hàng) của đơn này mới có quyền gửi đánh giá!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existingReview = sellerDb.getReviewByTxId(txId);
  if (existingReview) {
    await interaction.reply({
      content: `❌ Bạn đã đánh giá đơn này **${existingReview.rating} ⭐** rồi!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${SELLER_PAY_IDS.RATE_MODAL}:${rating}:${txId}`)
    .setTitle(`Đánh Giá ${rating} Sao Cho Thợ Kéo`);

  const commentInput = new TextInputBuilder()
    .setCustomId('rate_comment')
    .setLabel('Nhận xét trải nghiệm của bạn (Tùy chọn)')
    .setPlaceholder('Ví dụ: Thợ kéo bắn rất hay, nhiệt tình, giao lưu vui vẻ...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(commentInput),
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi Submit Modal Nhận Xét Đánh Giá.
 */
export async function handleRateModalSubmit(
  interaction: ModalSubmitInteraction,
  rating: number,
  txId: string,
): Promise<void> {
  const sellerDb = getSellerDb();
  const tx = sellerDb.getTransaction(txId);

  if (!tx || tx.status !== 'confirmed') {
    await interaction.reply({
      content: '❌ Đơn giao dịch không hợp lệ để đánh giá!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== tx.buyerId) {
    await interaction.reply({
      content: '❌ Bạn không có quyền đánh giá đơn này!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parsedRating = Math.floor(Number(rating));
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    await interaction.reply({
      content: '❌ Số sao đánh giá không hợp lệ (1 - 5 ⭐)!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = sellerDb.getReviewByTxId(txId);
  if (existing) {
    await interaction.reply({
      content: '❌ Đơn này đã được đánh giá trước đó!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const comment = interaction.fields.getTextInputValue('rate_comment').trim() || null;

  try {
    sellerDb.createReview({
      txId,
      sellerId: tx.sellerId,
      buyerId: tx.buyerId,
      rating: parsedRating,
      comment,
    });
  } catch {
    await interaction.reply({
      content: '❌ Đơn này đã được đánh giá trước đó!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `💖 Cảm ơn bạn đã gửi đánh giá **${rating} ⭐** cho thợ kéo <@${tx.sellerId}>!`,
    flags: MessageFlags.Ephemeral,
  });

  // Disable dàn nút rating trên tin nhắn prompt
  if (interaction.message && interaction.message.editable) {
    await interaction.message
      .edit({
        content: `🎉 Đơn **\`${txId}\`** đã được <@${tx.buyerId}> đánh giá **${rating} ⭐**!`,
        components: [],
      })
      .catch(() => {});
  }
}
