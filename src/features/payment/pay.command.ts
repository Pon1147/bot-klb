import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, isQrServerEnabled } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { buildVietQrContainer } from '../../utils/vietqr.utils.js';
import { sendReply } from '../../utils/reply.utils.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Tạo mã QR chuyển khoản thanh toán hoặc nạp tiền qua VietQR.')
  .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
    sub
      .setName('create')
      .setDescription('Tạo mã QR VietQR chuyển khoản với số tiền và nội dung xác định.')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Số tiền cần chuyển khoản (VNĐ, tối thiểu 1,000 đ)')
          .setMinValue(1000)
          .setMaxValue(500_000_000)
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('memo')
          .setDescription('Ghi chú hoặc tên gói dịch vụ/role muốn mua')
          .setMaxLength(100)
          .setRequired(false),
      ),
  );

/** Sinh chuỗi ký tự ngẫu nhiên ngắn để đảm bảo mã giao dịch là duy nhất */
function generateTxSalt(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  const guild = interaction.guild;

  if (!guildId || !guild) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  // 1. Guard bảo mật cấp máy chủ: Máy chủ phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Máy chủ này chưa kích hoạt gói tính năng QR Thanh toán tự động.\nVui lòng liên hệ Quản trị viên máy chủ hoặc Chủ sở hữu Bot (Bot Owner) để đăng ký.',
      ).toJSON(),
    });
    return;
  }

  // 2. Guard cấu hình ngân hàng: Máy chủ phải có thông tin tài khoản VietQR hợp lệ
  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId);
  const vietqr = settings.vietqr;

  if (!vietqr || !vietqr.enabled || !vietqr.bankId || !vietqr.accountNo || !vietqr.accountName) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '⚠️ Máy chủ chưa thiết lập thông tin tài khoản ngân hàng nhận tiền.\nQuản trị viên vui lòng chạy lệnh `/config vietqr set` để hoàn tất cấu hình trước.',
      ).toJSON(),
    });
    return;
  }

  const amount = interaction.options.getInteger('amount', true);
  const memo = interaction.options.getString('memo')?.trim() || null;

  // 3. Sinh mã chuyển khoản chuẩn hóa: <PREFIX> <USER_SHORT_ID> <SALT>
  // Ví dụ: NAP 848592 7B4C
  const userShortId = interaction.user.id.slice(-6);
  const salt = generateTxSalt();
  const prefix = vietqr.prefix ? vietqr.prefix.trim().toUpperCase() : 'NAP';
  const transferCode = `${prefix} ${userShortId} ${salt}`;

  const container = buildVietQrContainer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount,
    transferCode,
    memo,
    serverName: guild.name,
    requestedBy: interaction.user.id,
  });

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}
