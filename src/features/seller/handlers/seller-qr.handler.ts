/**
 * Handler xử lý tương tác Dashboard cấu hình QR ngân hàng của Thợ Kéo.
 */

import {
  ActionRowBuilder,
  ButtonInteraction,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { getSellerDb } from '../../../database/seller.db.js';
import { getBankList, normalizeVietQrText } from '../services/vietqr.service.js';
import {
  buildBankSelectMenu,
  buildSellerQrActionRows,
  buildSellerQrDashboardEmbed,
  SELLER_QR_IDS,
} from '../ui/seller-qr.container.js';
import { createLogger } from '../../../utils/logger.js';
import { hasPolicy, Policy } from '../../../config/permissions.js';
import { getSettingsService } from '../../../services/settings.service.js';

const logger = createLogger('SellerQrHandler');

/**
 * Kiểm tra xem người tương tác có quyền chỉnh sửa QR của targetUserId hay không.
 * Phải là Admin HOẶC chính chủ sở hữu role Thợ Kéo (nếu server đã cấu hình).
 */
async function canManageQr(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  targetUserId: string,
): Promise<{ allowed: boolean; reason: string }> {
  const isAdmin = hasPolicy(interaction, Policy.MANAGE_CONFIG).allowed;
  if (isAdmin) return { allowed: true, reason: '' };

  if (interaction.user.id !== targetUserId) {
    return {
      allowed: false,
      reason: '❌ Bạn không có quyền chỉnh sửa cấu hình QR của người khác!',
    };
  }

  // Kiểm tra role Thợ Kéo nếu guild đã cấu hình
  if (interaction.guildId && interaction.guild) {
    try {
      const settingsService = getSettingsService();
      const sellerSettings = settingsService.getSeller(interaction.guildId);
      if (sellerSettings.roleId) {
        const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        const hasRole = Boolean(member?.roles.cache.has(sellerSettings.roleId));
        if (!hasRole) {
          return {
            allowed: false,
            reason: `🔒 Bạn cần có role Thợ Kéo (<@&${sellerSettings.roleId}>) của máy chủ để thiết lập tài khoản nhận tiền!`,
          };
        }
      }
    } catch {
      // Bỏ qua lỗi tra cứu settings nếu chưa khởi tạo
    }
  }

  return { allowed: true, reason: '' };
}

/**
 * Xử lý khi bấm nút "Chọn Ngân Hàng" hoặc "Đổi Ngân Hàng".
 */
export async function handleSelectBankButton(
  interaction: ButtonInteraction,
  targetUserId: string,
): Promise<void> {
  const check = await canManageQr(interaction, targetUserId);
  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const banks = await getBankList();
    const selectMenuRow = buildBankSelectMenu(banks, targetUserId);

    await interaction.reply({
      content: 'Vui lòng chọn ngân hàng thụ hưởng từ danh sách dưới đây:',
      components: [selectMenuRow],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(
      `Lỗi khi mở danh sách ngân hàng: ${error instanceof Error ? error.message : String(error)}`,
    );
    await interaction.reply({
      content: '❌ Không thể tải danh sách ngân hàng lúc này. Vui lòng thử lại sau!',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Xử lý khi chọn một ngân hàng từ Select Menu -> Mở Modal nhập STK và Tên chủ TK.
 */
export async function handleBankSelectMenu(
  interaction: StringSelectMenuInteraction,
  targetUserId: string,
): Promise<void> {
  const check = await canManageQr(interaction, targetUserId);
  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedValue = interaction.values[0];
  const [bankCode, bankName] = selectedValue.split('|');

  const modal = new ModalBuilder()
    .setCustomId(`${SELLER_QR_IDS.MODAL_INFO}:${targetUserId}:${bankCode}:${bankName}`)
    .setTitle(`Nhập STK — ${bankName}`);

  const accountInput = new TextInputBuilder()
    .setCustomId(SELLER_QR_IDS.MODAL_INPUT_ACCOUNT)
    .setLabel('Số Tài Khoản')
    .setPlaceholder('Nhập số tài khoản ngân hàng của bạn...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  const nameInput = new TextInputBuilder()
    .setCustomId(SELLER_QR_IDS.MODAL_INPUT_NAME)
    .setLabel('Tên Chủ Tài Khoản (In hoa không dấu)')
    .setPlaceholder('Ví dụ: NGUYEN VAN A')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(accountInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
  );

  await interaction.showModal(modal);
}

/**
 * Xử lý khi bấm nút "Sửa STK / Tên" trực tiếp mà không đổi ngân hàng.
 */
export async function handleEditInfoButton(
  interaction: ButtonInteraction,
  targetUserId: string,
): Promise<void> {
  const check = await canManageQr(interaction, targetUserId);
  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sellerDb = getSellerDb();
  const guildId = interaction.guildId || 'global';
  const profile = sellerDb.getProfile(targetUserId, guildId);

  if (!profile) {
    await interaction.reply({
      content: '❌ Chưa có thông tin ngân hàng để sửa. Vui lòng chọn ngân hàng trước!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(
      `${SELLER_QR_IDS.MODAL_INFO}:${targetUserId}:${profile.bankCode}:${profile.bankName}`,
    )
    .setTitle(`Sửa STK — ${profile.bankName}`);

  const accountInput = new TextInputBuilder()
    .setCustomId(SELLER_QR_IDS.MODAL_INPUT_ACCOUNT)
    .setLabel('Số Tài Khoản')
    .setValue(profile.accountNumber)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const nameInput = new TextInputBuilder()
    .setCustomId(SELLER_QR_IDS.MODAL_INPUT_NAME)
    .setLabel('Tên Chủ Tài Khoản (In hoa không dấu)')
    .setValue(profile.accountName)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(accountInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
  );

  await interaction.showModal(modal);
}

/**
 * Xử lý khi Submit Modal nhập STK & Tên chủ TK.
 */
export async function handleSellerInfoModalSubmit(
  interaction: ModalSubmitInteraction,
  targetUserId: string,
  bankCode: string,
  bankName: string,
): Promise<void> {
  const check = await canManageQr(interaction, targetUserId);
  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const accountNumber = interaction.fields
    .getTextInputValue(SELLER_QR_IDS.MODAL_INPUT_ACCOUNT)
    .trim();
  const rawAccountName = interaction.fields
    .getTextInputValue(SELLER_QR_IDS.MODAL_INPUT_NAME)
    .trim();
  const accountName = normalizeVietQrText(rawAccountName, true);

  if (!accountNumber || !accountName) {
    await interaction.reply({
      content: '❌ Số tài khoản và tên chủ tài khoản không được để trống!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!/^[0-9A-Za-z]{5,30}$/.test(accountNumber)) {
    await interaction.reply({
      content:
        '❌ Số tài khoản không hợp lệ (phải từ 5 đến 30 ký tự chữ/số, không chứa khoảng trắng hoặc ký tự đặc biệt)!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (accountName.length > 100) {
    await interaction.reply({
      content: '❌ Tên chủ tài khoản không được vượt quá 100 ký tự!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId || 'global';
  const sellerDb = getSellerDb();

  let resolvedBankName = bankName?.trim();
  if (!resolvedBankName) {
    try {
      const banks = await getBankList();
      const matched = banks.find((b) => b.bin === bankCode);
      resolvedBankName = matched ? matched.shortName : 'Ngân Hàng';
    } catch {
      resolvedBankName = 'Ngân Hàng';
    }
  }

  const updatedProfile = sellerDb.upsertProfile({
    userId: targetUserId,
    guildId,
    bankCode,
    bankName: resolvedBankName,
    accountNumber,
    accountName,
    isActive: true,
  });

  const { embed } = buildSellerQrDashboardEmbed(updatedProfile, targetUserId);
  const rows = buildSellerQrActionRows(updatedProfile, targetUserId);

  await interaction.reply({
    content: '✅ Đã lưu thông tin tài khoản ngân hàng VietQR thành công!',
    flags: MessageFlags.Ephemeral,
  });

  // Nếu tin nhắn gốc là Dashboard, cập nhật lại luôn
  if (interaction.message && interaction.message.editable) {
    await interaction.message
      .edit({
        embeds: [embed],
        components: rows,
      })
      .catch(() => {});
  }
}

/**
 * Xử lý khi bấm nút "Xóa QR".
 */
export async function handleDeleteQrButton(
  interaction: ButtonInteraction,
  targetUserId: string,
): Promise<void> {
  const check = await canManageQr(interaction, targetUserId);
  if (!check.allowed) {
    await interaction.reply({
      content: check.reason,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId || 'global';
  const sellerDb = getSellerDb();
  sellerDb.deleteProfile(targetUserId, guildId);

  const { embed } = buildSellerQrDashboardEmbed(null, targetUserId);
  const rows = buildSellerQrActionRows(null, targetUserId);

  await interaction.update({
    embeds: [embed],
    components: rows,
  });
}
