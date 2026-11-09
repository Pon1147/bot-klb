import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  createPayosPaymentLink,
  isPayosConfigured,
  sanitizePayosDescription,
} from '../../services/payos.service.js';
import { createDonation } from './payment.service.js';
import { fetchVietQrImageBuffer } from '../../utils/vietqr.utils.js';

export const data = new SlashCommandBuilder()
  .setName('donate')
  .setDescription('Ủng hộ Bot Owner / Buy Me a Coffee qua cổng thanh toán PayOS.')
  .addIntegerOption((opt) =>
    opt
      .setName('amount')
      .setDescription('Số tiền ủng hộ (VNĐ, tối thiểu 2,000 đ)')
      .setMinValue(2000)
      .setMaxValue(50_000_000)
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('message')
      .setDescription('Lời nhắn gửi đến Bot Owner (tối đa 100 ký tự)')
      .setMaxLength(100)
      .setRequired(false),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!isPayosConfigured()) {
    await interaction.reply({
      content:
        '⚠️ Cổng thanh toán PayOS chưa được kích hoạt hoặc chưa cấu hình API Key. Vui lòng liên hệ Bot Owner.',
      ephemeral: true,
    });
    return;
  }

  const amount = interaction.options.getInteger('amount', true);
  const message = interaction.options.getString('message')?.trim() || null;

  await interaction.deferReply();

  // Tạo orderCode là số nguyên dương duy nhất (timestamp mili-giây)
  const orderCode = Date.now();
  const userName = interaction.user.globalName || interaction.user.username || 'Friend';
  // PayOS mô tả tối đa 25 ký tự không dấu
  const description = sanitizePayosDescription(`Donate ${userName}`);

  const db = database || interaction.client?.database;
  if (db) {
    createDonation(db, {
      order_code: orderCode,
      user_id: interaction.user.id,
      user_tag: interaction.user.tag,
      guild_id: interaction.guildId || null,
      amount,
      message,
      status: 'pending',
      created_at: Date.now(),
    });
  }

  const result = await createPayosPaymentLink({
    orderCode,
    amount,
    description,
  });

  if (!result.success || !result.data) {
    await interaction.editReply({
      content: `❌ Không thể tạo liên kết ủng hộ qua PayOS: ${result.error || 'Lỗi không xác định'}.`,
    });
    return;
  }

  const paymentData = result.data;

  const embed = new EmbedBuilder()
    .setTitle('☕ Buy Me A Coffee — Cảm Ơn Sự Ủng Hộ Của Bạn!')
    .setDescription(
      `Cảm ơn <@${interaction.user.id}> đã đồng hành và ủng hộ dự án bot phát triển!\nBạn có thể quét mã VietQR bên dưới bằng app ngân hàng hoặc bấm nút để mở cổng thanh toán PayOS.`,
    )
    .setColor(0xe67e22)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      {
        name: 'Số tiền ủng hộ',
        value: `**${amount.toLocaleString('vi-VN')} VNĐ**`,
        inline: true,
      },
      {
        name: 'Mã đơn quyên góp',
        value: `\`#${orderCode}\``,
        inline: true,
      },
      {
        name: 'Lời nhắn',
        value: message ? `*"${message}"*` : 'Không có lời nhắn',
        inline: false,
      },
      {
        name: 'Thông tin nhận tiền',
        value: `• Ngân hàng: **${paymentData.bin}**\n• Số tài khoản: \`${paymentData.accountNumber}\`\n• Tên tài khoản: **${paymentData.accountName}**`,
        inline: false,
      },
    )
    .setFooter({
      text: 'Thanh toán tự động được bảo đảm & xác nhận qua cổng PayOS',
    })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  // Tải ảnh QR nếu có bin và account number
  if (paymentData.bin && paymentData.accountNumber) {
    try {
      const qrBuffer = await fetchVietQrImageBuffer({
        bankId: paymentData.bin,
        accountNo: paymentData.accountNumber,
        accountName: paymentData.accountName,
        amount: paymentData.amount,
        addInfo: paymentData.description,
        template: 'compact2',
      });
      if (qrBuffer) {
        files.push(new AttachmentBuilder(qrBuffer, { name: 'donate_qr.png' }));
        embed.setImage('attachment://donate_qr.png');
      }
    } catch {
      // Fallback
    }
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('☕ Mở Trang Thanh Toán PayOS')
      .setStyle(ButtonStyle.Link)
      .setURL(paymentData.checkoutUrl),
  );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow],
    files,
  });
}
