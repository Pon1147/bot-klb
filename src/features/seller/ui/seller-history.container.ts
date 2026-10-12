/**
 * UI Builder cho Lịch Sử Giao Dịch & Bảng Xếp Hạng Thợ Kéo.
 */

import { EmbedBuilder } from 'discord.js';
import { SellerStats, SellerTransaction } from '../types/seller.types.js';

/**
 * Xây dựng Embed lịch sử giao dịch.
 */
export function buildSellerHistoryEmbed(
  transactions: SellerTransaction[],
  targetUserTag: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📜 Lịch Sử Giao Dịch — ${targetUserTag}`)
    .setColor(0x3498db)
    .setTimestamp();

  if (transactions.length === 0) {
    embed.setDescription('Chưa có giao dịch nào được ghi nhận.');
    return embed;
  }

  const statusIcons = {
    confirmed: '✅ Hoàn tất',
    pending: '⏳ Đang chờ',
    cancelled: '❌ Đã hủy',
  };

  const lines = transactions.map((tx, idx) => {
    const dateStr = new Date(tx.createdAt).toLocaleDateString('vi-VN');
    const amountStr = `${tx.amount.toLocaleString('vi-VN')}đ`;
    const statusText = statusIcons[tx.status] || tx.status;
    return (
      `**${idx + 1}. \`${tx.txId}\`** — ${amountStr} (${statusText})\n` +
      `   • Ngày: \`${dateStr}\` | Khách: <@${tx.buyerId}> | Thợ: <@${tx.sellerId}>\n` +
      `   • Nội dung: *${tx.description}*`
    );
  });

  embed.setDescription(lines.join('\n\n'));
  return embed;
}

/**
 * Xây dựng Embed Bảng Xếp Hạng Thợ Kéo.
 */
export function buildSellerTopEmbed(topSellers: SellerStats[], guildName: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 BẢNG XẾP HẠNG THỢ KÉO — ${guildName}`)
    .setColor(0xf1c40f)
    .setTimestamp()
    .setFooter({ text: 'Bảng xếp hạng dựa trên tổng doanh thu & số đơn hoàn thành hợp lệ' });

  if (topSellers.length === 0) {
    embed.setDescription('Hiện chưa có dữ liệu giao dịch hoàn tất nào trong server.');
    return embed;
  }

  const medals = ['🥇', '🥈', '🥉'];

  const lines = topSellers.map((seller, idx) => {
    const medal = idx < 3 ? medals[idx] : `\`#${idx + 1}\``;
    const revenueStr = `${seller.totalRevenue.toLocaleString('vi-VN')} VNĐ`;
    const starStr =
      seller.totalReviews > 0
        ? `⭐ ${seller.averageRating} (${seller.totalReviews} đánh giá)`
        : 'Chưa có đánh giá';

    return (
      `${medal} <@${seller.sellerId}>\n` +
      `   • Doanh thu: **${revenueStr}**\n` +
      `   • Đơn hoàn tất: **${seller.confirmedCount}** / ${seller.totalTransactions} đơn\n` +
      `   • Uy tín: ${starStr}`
    );
  });

  embed.setDescription(lines.join('\n\n'));
  return embed;
}
