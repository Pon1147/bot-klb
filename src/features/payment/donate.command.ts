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

let lastOrderTimestamp = 0;
let orderSequence = 0;

/**
 * Sinh mã orderCode số nguyên dương duy nhất cho PayOS.
 * Kết hợp timestamp mili-giây (13 chữ số) và số thứ tự tuần tự (3 chữ số: 000-999).
 * Đảm bảo 100% không trùng lặp khi có nhiều yêu cầu donate đồng thời trong cùng 1 mili-giây.
 * Giá trị sinh ra luôn nhỏ hơn Number.MAX_SAFE_INTEGER (9,007,199,254,740,991).
 */
export function generatePayosOrderCode(): number {
  const now = Date.now();
  if (now === lastOrderTimestamp) {
    orderSequence = (orderSequence + 1) % 1000;
  } else {
    lastOrderTimestamp = now;
    orderSequence = Math.floor(Math.random() * 10);
  }
  return now * 1000 + orderSequence;
}

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

  // Tạo orderCode duy nhất đảm bảo không xung đột concurrency
  const orderCode = generatePayosOrderCode();
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
      let qrBuffer = await fetchVietQrImageBuffer({
        bankId: paymentData.bin,
        accountNo: paymentData.accountNumber,
        accountName: paymentData.accountName,
        amount: paymentData.amount,
        addInfo: paymentData.description,
        template: 'compact2',
      });

      // Fallback: Nếu VietQR không tải được, sinh ảnh QR trực tiếp từ chuỗi EMVCo của PayOS
      if (!qrBuffer && paymentData.qrCode) {
        const qrRes = await fetch(
          `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(paymentData.qrCode)}`,
          { signal: AbortSignal.timeout(4000) },
        ).catch(() => null);
        if (qrRes && qrRes.ok) {
          const arrayBuf = await qrRes.arrayBuffer();
          qrBuffer = Buffer.from(arrayBuf);
        }
      }

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
