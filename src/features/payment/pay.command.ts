import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, isQrServerEnabled } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { buildVietQrContainer, fetchVietQrImageBuffer } from '../../utils/vietqr.utils.js';
import { sendReply } from '../../utils/reply.utils.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Tạo yêu cầu thanh toán chuyển khoản VietQR cho khách hàng.')
  .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
    sub
      .setName('create')
      .setDescription('Tạo hóa đơn thanh toán VietQR cho khách hàng trong kênh.')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Số tiền cần chuyển khoản (VNĐ, tối thiểu 1,000 đ)')
          .setMinValue(1000)
          .setMaxValue(500_000_000)
          .setRequired(true),
      )
      .addUserOption((opt) =>
        opt
          .setName('customer')
          .setDescription('Khách hàng / Thành viên cần thanh toán (tag người nhận)')
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('memo')
          .setDescription('Tên dịch vụ hoặc ghi chú đơn hàng (ví dụ: Book 2h, Mua role VIP)')
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

  // 1. Guards kiểm tra môi trường & quyền: Báo lỗi riêng tư (Ephemeral) cho người gõ lệnh
  if (!guildId || !guild) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  // Guard bảo mật cấp máy chủ: Máy chủ phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Máy chủ này chưa kích hoạt gói tính năng QR Thanh toán tự động.\nVui lòng liên hệ Quản trị viên máy chủ hoặc Chủ sở hữu Bot (Bot Owner) để đăng ký.',
      ).toJSON(),
    });
    return;
  }

  // Guard cấu hình ngân hàng: Máy chủ phải có thông tin tài khoản VietQR hợp lệ
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

  // 2. Lấy tham số lệnh
  const amount = interaction.options.getInteger('amount', true);
  const customer = interaction.options.getUser('customer');
  const memo = interaction.options.getString('memo')?.trim() || null;

  // 3. Phản hồi ban đầu công khai (deferReply) để chuẩn bị hóa đơn gửi vào kênh cho khách xem
  await interaction.deferReply();

  // 4. Sinh mã chuyển khoản chuẩn hóa:
  // Nếu có khách hàng được chỉ định, dùng đuôi ID khách để nhận diện đúng người chuyển tiền
  const targetUser = customer || interaction.user;
  const userShortId = targetUser.id.slice(-6);
  const salt = generateTxSalt();
  const prefix = vietqr.prefix ? vietqr.prefix.trim().toUpperCase() : 'NAP';
  const transferCode = `${prefix} ${userShortId} ${salt}`;

  // 5. Tải buffer ảnh PNG VietQR chuẩn (trích xuất từ API) để đính kèm trực tiếp vào message
  const qrBuffer = await fetchVietQrImageBuffer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount,
    addInfo: transferCode,
    template: vietqr.template || 'compact2',
  });

  const files: AttachmentBuilder[] = [];
  let attachmentName: string | null = null;

  if (qrBuffer) {
    attachmentName = 'vietqr.png';
    files.push(new AttachmentBuilder(qrBuffer, { name: attachmentName }));
  }

  const container = buildVietQrContainer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount,
    transferCode,
    memo,
    serverName: guild.name,
    creatorId: interaction.user.id,
    customerId: customer ? customer.id : null,
    attachmentName,
  });

  // 6. Gửi hóa đơn công khai vào kênh cho khách hàng quét mã
  const tagNotification = customer
    ? `💳 **Yêu cầu thanh toán** gửi tới <@${customer.id}> từ <@${interaction.user.id}>:`
    : undefined;

  await interaction.editReply({
    content: tagNotification,
    components: container.toJSON() as any,
    files,
  });
}
