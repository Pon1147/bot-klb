import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, isQrServerEnabled } from '../../services/settings.service.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { buildVietQrContainer, fetchVietQrImageBuffer } from '../../utils/vietqr.utils.js';
import { sendReply } from '../../utils/reply.utils.js';
import { ExpiryEntry, TTLStore } from '../../utils/ttl-store.js';
import { createPayment, getUserPayments, getUserRank, getTopBuyers } from './payment.service.js';
import { buildPaymentActionRow, canManagePayment } from './payment-flow.js';

interface CooldownEntry extends ExpiryEntry {
  createdAt: number;
}

const payCreateCooldown = new TTLStore<string, CooldownEntry>({
  ttlMs: 10_000,
  cleanupIntervalMs: 60_000,
  name: 'PayCreateCooldown',
});

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Hệ thống hóa đơn thanh toán VietQR và lịch sử giao dịch.')
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
          .setDescription('Tên dịch vụ hoặc ghi chú đơn hàng (ví dụ: Mua code, Thuê buff, v.v.)')
          .setMaxLength(100)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
    sub
      .setName('history')
      .setDescription('Xem lịch sử giao dịch thanh toán thành công và thứ hạng cá nhân.')
      .addUserOption((opt) =>
        opt
          .setName('target')
          .setDescription('Xem lịch sử của thành viên khác (mặc định là chính bạn)')
          .setRequired(false),
      ),
  )
  .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
    sub
      .setName('top')
      .setDescription('Xem bảng xếp hạng Top khách hàng chi tiêu nhiều nhất máy chủ.'),
  );

/** Sinh chuỗi ký tự ngẫu nhiên ngắn để đảm bảo mã giao dịch là duy nhất */
function generateTxSalt(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Xử lý lệnh /pay create
 */
async function handlePayCreate(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

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

  const db = database || interaction.client?.database;
  if (!db) {
    await sendReply(interaction, {
      components: buildErrorContainer('⚠️ Không thể kết nối cơ sở dữ liệu.').toJSON(),
    });
    return;
  }

  const amount = interaction.options.getInteger('amount', true);
  const customer = interaction.options.getUser('customer');
  const memo = interaction.options.getString('memo')?.trim() || 'Thanh toán dịch vụ';

  const buyerId = customer ? customer.id : 'UNASSIGNED';
  const userShortId = customer ? customer.id.slice(-6) : 'PAY';
  const salt = generateTxSalt();
  const prefix = vietqr.prefix ? vietqr.prefix.trim().toUpperCase() : 'NAP';
  const transferCode = `${prefix} ${userShortId} ${salt}`;
  const txId = `TX${Date.now().toString(36).toUpperCase()}${salt}`;
  const expiresAt = Date.now() + 60 * 60 * 1000; // Hết hạn sau 60 phút

  // Lưu giao dịch vào SQLite database (snapshot thông tin thụ hưởng)
  createPayment(db, {
    id: txId,
    guild_id: guildId,
    buyer_id: buyerId,
    seller_id: interaction.user.id,
    amount,
    description: memo,
    status: 'pending',
    created_at: Date.now(),
    expires_at: expiresAt,
    bank_id: vietqr.bankId,
    account_no: vietqr.accountNo,
    account_name: vietqr.accountName,
  });

  // Tải buffer ảnh PNG VietQR chuẩn (kèm cơ chế fallback dự phòng)
  const qrBuffer = await fetchVietQrImageBuffer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount,
    addInfo: transferCode,
    template: vietqr.template || 'compact2',
  });

  if (!qrBuffer) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '⚠️ Không thể kết nối cổng VietQR để sinh mã thanh toán lúc này. Vui lòng kiểm tra lại cấu hình ngân hàng hoặc thử lại sau.',
      ).toJSON(),
    });
    return;
  }

  const attachmentName = 'vietqr.png';
  const files: AttachmentBuilder[] = [new AttachmentBuilder(qrBuffer, { name: attachmentName })];

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
    txId,
  });

  const actionRow = buildPaymentActionRow(txId, buyerId);

  await interaction.reply({
    components: [...container.toJSON(), actionRow.toJSON() as any],
    files,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Xử lý lệnh /pay history
 */
async function handlePayHistory(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId!;
  const target = interaction.options.getUser('target') || interaction.user;

  const db = database || interaction.client?.database;
  if (!db) {
    await sendReply(interaction, {
      components: buildErrorContainer('⚠️ Không thể kết nối cơ sở dữ liệu.').toJSON(),
    });
    return;
  }

  const payments = getUserPayments(db, guildId, target.id, 'confirmed');
  const userRankInfo = getUserRank(db, guildId, target.id);

  const totalSpent = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalTx = payments.length;

  const embed = new EmbedBuilder()
    .setTitle(`📜 Lịch sử thanh toán: ${target.displayName || target.username}`)
    .setColor(0x3498db)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      {
        name: 'Tổng chi tiêu',
        value: `**${totalSpent.toLocaleString('vi-VN')} VNĐ**`,
        inline: true,
      },
      {
        name: 'Đơn thành công',
        value: `**${totalTx}** đơn`,
        inline: true,
      },
      {
        name: 'Thứ hạng máy chủ',
        value: userRankInfo ? `Top **#${userRankInfo.rank}**` : 'Chưa xếp hạng',
        inline: true,
      },
    )
    .setTimestamp();

  if (payments.length === 0) {
    embed.setDescription('Chưa có giao dịch thanh toán thành công nào được ghi nhận.');
  } else {
    const recent = payments.slice(0, 5);
    const listStr = recent
      .map(
        (p, idx) =>
          `**${idx + 1}.** \`${p.id}\` — **${p.amount.toLocaleString('vi-VN')} đ** (${p.description}) — <t:${Math.floor(p.created_at / 1000)}:d>`,
      )
      .join('\n');

    embed.setDescription(`### 5 Giao dịch gần nhất:\n${listStr}`);
  }

  await interaction.reply({ embeds: [embed] });
}

/**
 * Xử lý lệnh /pay top
 */
async function handlePayTop(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId!;

  const db = database || interaction.client?.database;
  if (!db) {
    await sendReply(interaction, {
      components: buildErrorContainer('⚠️ Không thể kết nối cơ sở dữ liệu.').toJSON(),
    });
    return;
  }

  const topBuyers = getTopBuyers(db, guildId, 10);

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Bảng Xếp Hạng Chi Tiêu Máy Chủ`)
    .setColor(0xf1c40f)
    .setDescription(
      topBuyers.length === 0
        ? 'Chưa có dữ liệu thanh toán thành công trong máy chủ này.'
        : topBuyers
            .map((b, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const prefix = idx < 3 ? medals[idx] : `**#${idx + 1}**`;
              return `${prefix} <@${b.buyerId}>: **${b.totalAmount.toLocaleString('vi-VN')} VNĐ** (${b.txCount} đơn)`;
            })
            .join('\n\n'),
    )
    .setFooter({ text: interaction.guild?.name || 'Máy chủ' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  const guild = interaction.guild;

  // 1. Guards kiểm tra môi trường: Báo lỗi nếu ngoài máy chủ Discord
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

  const subcommand =
    typeof interaction.options?.getSubcommand === 'function'
      ? interaction.options.getSubcommand()
      : 'create';
  if (subcommand === 'create') {
    if (!canManagePayment(interaction, guildId)) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          '🔒 Bạn không có quyền tạo hóa đơn thanh toán trên máy chủ này.\nChỉ Quản trị viên và Nhân viên (Staff Role) mới được phép tạo hóa đơn.',
        ).toJSON(),
      });
      return;
    }

    const userId = interaction.user?.id;
    if (userId && process.env.NODE_ENV !== 'test' && payCreateCooldown.get(userId)) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          '⏳ Vui lòng đợi vài giây trước khi tạo hóa đơn tiếp theo.',
        ).toJSON(),
      });
      return;
    }
    if (userId) {
      payCreateCooldown.set(userId, {
        createdAt: Date.now(),
        expiresAt: Date.now() + 10_000,
      });
    }

    await handlePayCreate(interaction, db);
  } else if (subcommand === 'history') {
    await handlePayHistory(interaction, db);
  } else if (subcommand === 'top') {
    await handlePayTop(interaction, db);
  }
}
