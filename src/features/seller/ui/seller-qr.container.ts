/**
 * UI Builder cho Seller QR Dashboard: hiển thị và quản lý cấu hình ngân hàng của Thợ Kéo.
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { SellerProfile, VietQrBank } from '../types/seller.types.js';
import { buildVietQrImageUrl } from '../services/vietqr.service.js';

export const SELLER_QR_IDS = {
  SELECT_BANK: 'seller_qr_select_bank',
  EDIT_INFO: 'seller_qr_edit_info',
  DELETE: 'seller_qr_delete',
  REFRESH: 'seller_qr_refresh',
  MODAL_INFO: 'seller_qr_modal_info',
  MODAL_INPUT_ACCOUNT: 'seller_qr_input_account',
  MODAL_INPUT_NAME: 'seller_qr_input_name',
} as const;

/**
 * Tạo Embed hiển thị Dashboard QR của thợ kéo.
 */
export function buildSellerQrDashboardEmbed(
  profile: SellerProfile | null,
  targetUserId: string,
): { embed: EmbedBuilder; attachment?: AttachmentBuilder } {
  const embed = new EmbedBuilder().setTimestamp();

  if (!profile) {
    embed
      .setTitle('💳 Cấu Hình VietQR — Thợ Kéo')
      .setDescription(
        `Thợ kéo <@${targetUserId}> chưa thiết lập tài khoản ngân hàng.\n\n` +
          `👉 Hãy bấm nút **Chọn Ngân Hàng** bên dưới để kích hoạt mã QR nhận tiền tự động!`,
      )
      .setColor(0x5865f2);

    return { embed };
  }

  const qrImageUrl = buildVietQrImageUrl({
    bankCode: profile.bankCode,
    accountNumber: profile.accountNumber,
    accountName: profile.accountName,
    amount: 0,
    addInfo: 'TEST_QR',
  });

  embed
    .setTitle('💳 Quản Lý VietQR — Thợ Kéo')
    .setColor(profile.isActive ? 0x2ecc71 : 0xe74c3c)
    .setDescription(`Thông tin nhận thanh toán tự động của <@${targetUserId}>:`)
    .addFields(
      {
        name: '🏦 Ngân Hàng',
        value: `**${profile.bankName}** (${profile.bankCode})`,
        inline: true,
      },
      { name: '🔢 Số Tài Khoản', value: `\`${profile.accountNumber}\``, inline: true },
      { name: '👤 Chủ Tài Khoản', value: `**${profile.accountName}**`, inline: true },
      {
        name: '📌 Trạng Thái',
        value: profile.isActive ? '🟢 Đang hoạt động' : '🔴 Tạm ngưng',
        inline: true,
      },
    )
    .setImage(qrImageUrl)
    .setFooter({
      text: 'Mã QR trên là bản xem trước. Khi tạo đơn kéo sẽ tự sinh QR động có sẵn số tiền & mã đơn.',
    });

  return { embed };
}

/**
 * Xây dựng các nút thao tác trên Dashboard QR.
 */
export function buildSellerQrActionRows(
  profile: SellerProfile | null,
  targetUserId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (!profile) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${SELLER_QR_IDS.SELECT_BANK}:${targetUserId}`)
        .setLabel('🏦 Chọn Ngân Hàng')
        .setStyle(ButtonStyle.Primary),
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${SELLER_QR_IDS.SELECT_BANK}:${targetUserId}`)
        .setLabel('🏦 Đổi Ngân Hàng')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${SELLER_QR_IDS.EDIT_INFO}:${targetUserId}`)
        .setLabel('✏️ Sửa STK / Tên')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SELLER_QR_IDS.DELETE}:${targetUserId}`)
        .setLabel('🗑️ Xóa QR')
        .setStyle(ButtonStyle.Danger),
    );
  }

  return [row];
}

/**
 * Xây dựng Select Menu chọn ngân hàng phổ biến (Top 25 ngân hàng Napas 24/7).
 */
export function buildBankSelectMenu(
  banks: VietQrBank[],
  targetUserId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  // Lấy top 25 ngân hàng hỗ trợ chuyển khoản nhanh
  const topBanks = banks.slice(0, 25);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${SELLER_QR_IDS.SELECT_BANK}_menu:${targetUserId}`)
    .setPlaceholder('Chọn ngân hàng của bạn...')
    .addOptions(
      topBanks.map((b) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${b.shortName} - ${b.name}`.slice(0, 100))
          .setValue(`${b.bin}|${b.shortName}`)
          .setDescription(`Mã BIN: ${b.bin}`),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}
