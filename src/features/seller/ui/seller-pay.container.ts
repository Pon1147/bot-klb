/**
 * UI Builder cho Đơn Thanh Toán Dịch Vụ Kéo (Seller Pay Container).
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { SellerProfile, SellerTransaction } from '../types/seller.types.js';

export const SELLER_PAY_IDS = {
  CONFIRM: 'seller_pay_confirm',
  CANCEL: 'seller_pay_cancel',
  RATE_STAR: 'seller_rate_star',
  CONFIRM_MODAL: 'seller_pay_confirm_modal',
  CANCEL_MODAL: 'seller_pay_cancel_modal',
  RATE_MODAL: 'seller_rate_modal',
} as const;

/**
 * Xây dựng Embed phiếu yêu cầu thanh toán (Pending).
 */
export function buildPendingPaymentEmbed(
  tx: SellerTransaction,
  profile: SellerProfile,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('💳 YÊU CẦU THANH TOÁN DỊCH VỤ KÉO')
    .setColor(0x3498db)
    .setDescription(
      `Khách hàng <@${tx.buyerId}> vui lòng quét mã VietQR bên dưới để thanh toán cho thợ kéo <@${tx.sellerId}>!`,
    )
    .addFields(
      { name: '🏷️ Mã Đơn (TX)', value: `\`${tx.txId}\``, inline: true },
      { name: '💰 Số Tiền', value: `**${tx.amount.toLocaleString('vi-VN')} VNĐ**`, inline: true },
      { name: '🎮 Dịch Vụ / Nội Dung', value: tx.description, inline: false },
      {
        name: '🏦 Ngân Hàng',
        value: `${profile.bankName} (\`${profile.bankCode}\`)`,
        inline: true,
      },
      { name: '🔢 Số Tài Khoản', value: `\`${profile.accountNumber}\``, inline: true },
      { name: '👤 Chủ Tài Khoản', value: `**${profile.accountName}**`, inline: true },
      { name: '📌 Trạng Thái', value: '⏳ **Chờ Chuyển Khoản & Xác Nhận**', inline: false },
      {
        name: '⚠️ LƯU Ý QUAN TRỌNG',
        value:
          '• **Giữ nguyên nội dung chuyển khoản** đã tạo trong mã QR để đối soát tự động.\n' +
          '• Sau khi chuyển tiền thành công, thợ kéo sẽ bấm **Xác Nhận** để hoàn tất đơn.',
        inline: false,
      },
    )
    .setImage('attachment://vietqr.png')
    .setFooter({
      text: 'Mã QR được khởi tạo chuẩn NAPAS 24/7 • Quét bằng mọi app ngân hàng tại Việt Nam',
    })
    .setTimestamp(tx.createdAt);
}

/**
 * Xây dựng Embed khi đơn đã được xác nhận (Confirmed).
 */
export function buildConfirmedPaymentEmbed(
  tx: SellerTransaction,
  confirmerTag?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('✅ THANH TOÁN ĐÃ ĐƯỢC XÁC NHẬN')
    .setColor(0x2ecc71)
    .setDescription(`Đơn giao dịch kéo **\`${tx.txId}\`** đã hoàn tất thành công!`)
    .addFields(
      { name: '🏷️ Mã Đơn', value: `\`${tx.txId}\``, inline: true },
      { name: '💰 Số Tiền', value: `**${tx.amount.toLocaleString('vi-VN')} VNĐ**`, inline: true },
      { name: '👤 Khách Hàng', value: `<@${tx.buyerId}>`, inline: true },
      { name: '🎯 Thợ Kéo', value: `<@${tx.sellerId}>`, inline: true },
      { name: '🎮 Dịch Vụ', value: tx.description, inline: false },
      {
        name: '👮 Người Xác Nhận',
        value: confirmerTag ? confirmerTag : tx.processedBy ? `<@${tx.processedBy}>` : 'Hệ thống',
        inline: true,
      },
    )
    .setTimestamp(tx.processedAt || Date.now());

  if (tx.note) {
    embed.addFields({ name: '📝 Ghi Chú', value: tx.note, inline: false });
  }

  return embed;
}

/**
 * Xây dựng Embed khi đơn bị hủy (Cancelled).
 */
export function buildCancelledPaymentEmbed(
  tx: SellerTransaction,
  cancellerTag?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ ĐƠN GIAO DỊCH ĐÃ BỊ HỦY')
    .setColor(0xe74c3c)
    .setDescription(`Đơn giao dịch kéo **\`${tx.txId}\`** đã bị hủy bỏ.`)
    .addFields(
      { name: '🏷️ Mã Đơn', value: `\`${tx.txId}\``, inline: true },
      { name: '💰 Số Tiền', value: `${tx.amount.toLocaleString('vi-VN')} VNĐ`, inline: true },
      { name: '👤 Khách Hàng', value: `<@${tx.buyerId}>`, inline: true },
      { name: '🎯 Thợ Kéo', value: `<@${tx.sellerId}>`, inline: true },
      {
        name: '🚫 Người Hủy',
        value: cancellerTag ? cancellerTag : tx.processedBy ? `<@${tx.processedBy}>` : 'Hệ thống',
        inline: true,
      },
      { name: '📝 Lý Do Hủy', value: tx.note || 'Không có lý do cụ thể', inline: false },
    )
    .setTimestamp(tx.processedAt || Date.now());
}

/**
 * Xây dựng các nút Confirm & Cancel cho đơn thanh toán.
 */
export function buildPaymentActionRow(
  txId: string,
  disabled = false,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SELLER_PAY_IDS.CONFIRM}:${txId}`)
      .setLabel('✅ Xác Nhận Đã Nhận Tiền')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${SELLER_PAY_IDS.CANCEL}:${txId}`)
      .setLabel('❌ Hủy Đơn')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

/**
 * Xây dựng hàng nút 5 sao để khách hàng đánh giá thợ kéo.
 */
export function buildRatingButtonsRow(txId: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const stars = ['1 ⭐', '2 ⭐', '3 ⭐', '4 ⭐', '5 ⭐'];

  for (let rating = 1; rating <= 5; rating++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${SELLER_PAY_IDS.RATE_STAR}:${rating}:${txId}`)
        .setLabel(stars[rating - 1])
        .setStyle(rating === 5 ? ButtonStyle.Success : ButtonStyle.Primary),
    );
  }

  return row;
}

/**
 * Xây dựng Embed mời khách hàng đánh giá trải nghiệm dịch vụ.
 */
export function buildFeedbackPromptEmbed(tx: SellerTransaction): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⭐ Đánh Giá Trải Nghiệm Dịch Vụ Kéo')
    .setColor(0xf39c12)
    .setDescription(
      `Cảm ơn <@${tx.buyerId}> đã sử dụng dịch vụ của thợ kéo <@${tx.sellerId}>!\n\n` +
        `Bạn thấy dịch vụ của thợ kéo như thế nào? Hãy bấm chọn số sao bên dưới để gửi phản hồi nhé:`,
    )
    .addFields(
      { name: '🏷️ Mã Đơn', value: `\`${tx.txId}\``, inline: true },
      { name: '💰 Số Tiền', value: `${tx.amount.toLocaleString('vi-VN')} VNĐ`, inline: true },
      { name: '🎮 Dịch Vụ', value: tx.description, inline: false },
    )
    .setFooter({ text: 'Ý kiến của bạn giúp thợ kéo nâng cao chất lượng và uy tín!' });
}
