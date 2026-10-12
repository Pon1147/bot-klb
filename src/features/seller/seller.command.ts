/**
 * /seller — Hệ thống Quản Lý Thợ Kéo (Seller Management) & Thanh Toán VietQR Tự Động.
 *
 * Cấu trúc lệnh:
 * /seller pay <buyer> <amount> <description> [seller]
 * /seller qr [user]
 * /seller history [user] [status]
 * /seller top [limit]
 * /seller config setrole <role>
 */

import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { getSellerDb } from '../../database/seller.db.js';
import { getSettingsService } from '../../services/settings.service.js';
import { generateVietQrBuffer } from './services/vietqr.service.js';
import { buildPendingPaymentEmbed, buildPaymentActionRow } from './ui/seller-pay.container.js';
import { buildSellerQrActionRows, buildSellerQrDashboardEmbed } from './ui/seller-qr.container.js';
import { buildSellerHistoryEmbed, buildSellerTopEmbed } from './ui/seller-history.container.js';
import { createLogger } from '../../utils/logger.js';
import { hasPolicy, Policy } from '../../config/permissions.js';

const logger = createLogger('SellerCommand');

/**
 * Sinh ID giao dịch ngẫu nhiên dạng TX + 8 ký tự (vd: TXA8F9K2L1)
 */
function generateTxId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'TX';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Subcommand Builders ──────────────────────────────────────────

function buildPaySubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('pay')
    .setDescription('Tạo đơn kéo game & sinh mã VietQR động nhận tiền tự động.')
    .addUserOption((opt) =>
      opt.setName('buyer').setDescription('Khách hàng thuê kéo').setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Số tiền thanh toán (VNĐ)')
        .setRequired(true)
        .setMinValue(1000),
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Nội dung kéo (vd: Kéo 3 trận Đập Nước)')
        .setRequired(true)
        .setMaxLength(200),
    )
    .addUserOption((opt) =>
      opt
        .setName('seller')
        .setDescription('Thợ kéo nhận tiền (Mặc định là bạn nếu không chọn)')
        .setRequired(false),
    );
}

function buildQrSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('qr')
    .setDescription('Dashboard quản lý tài khoản ngân hàng và mã QR của Thợ Kéo.')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Thợ kéo cần xem/cấu hình (Chỉ dành cho Admin)')
        .setRequired(false),
    );
}

function buildHistorySubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('history')
    .setDescription('Xem lịch sử giao dịch kéo game.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Người dùng cần xem lịch sử').setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Lọc theo trạng thái')
        .setRequired(false)
        .addChoices(
          { name: '⏳ Chờ thanh toán', value: 'pending' },
          { name: '✅ Đã hoàn tất', value: 'confirmed' },
          { name: '❌ Đã hủy', value: 'cancelled' },
        ),
    );
}

function buildTopSubcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return sub
    .setName('top')
    .setDescription('Bảng xếp hạng Thợ Kéo uy tín & doanh thu cao nhất server.')
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('Số lượng hiển thị (1 - 25, mặc định 10)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    );
}

function buildConfigGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('config')
    .setDescription('Cấu hình tính năng thợ kéo trong server (Chỉ Admin/Owner).')
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Gán role định danh Thợ Kéo của server.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Thợ Kéo').setRequired(true),
        ),
    );
}

export const data = new SlashCommandBuilder()
  .setName('seller')
  .setDescription('Hệ thống Quản lý Thợ Kéo & Thanh toán VietQR.')
  .addSubcommand(buildPaySubcommand)
  .addSubcommand(buildQrSubcommand)
  .addSubcommand(buildHistorySubcommand)
  .addSubcommand(buildTopSubcommand)
  .addSubcommandGroup(buildConfigGroup);

// ─── Subcommand Executors ──────────────────────────────────────────

/**
 * Thực thi lệnh /seller pay
 */
async function executePay(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId || 'global';
  const buyerUser = interaction.options.getUser('buyer', true);
  const amount = interaction.options.getInteger('amount', true);
  const description = interaction.options.getString('description', true);
  const targetSellerUser = interaction.options.getUser('seller') || interaction.user;

  // Không cho phép tự kéo chính mình
  if (buyerUser.id === targetSellerUser.id) {
    await interaction.reply({
      content: '❌ Khách hàng và thợ kéo không thể là cùng một người!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Nếu tạo đơn cho người khác, phải là Admin
  if (targetSellerUser.id !== interaction.user.id) {
    const isOwnerOrAdmin = hasPolicy(interaction, Policy.MANAGE_CONFIG).allowed;

    if (!isOwnerOrAdmin) {
      await interaction.reply({
        content: '❌ Bạn chỉ có thể tạo đơn thanh toán cho chính mình!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const sellerDb = getSellerDb();
  const profile = sellerDb.getProfile(targetSellerUser.id, guildId);

  if (!profile || !profile.isActive) {
    await interaction.reply({
      content:
        `❌ Thợ kéo <@${targetSellerUser.id}> chưa cài đặt tài khoản ngân hàng hoặc đang tạm ngưng.\n` +
        `👉 Hãy dùng lệnh \`/seller qr\` để thiết lập STK trước khi tạo đơn!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const txId = generateTxId();

    // Sinh ảnh QR VietQR động dạng Buffer
    const qrBuffer = await generateVietQrBuffer({
      bankCode: profile.bankCode,
      accountNumber: profile.accountNumber,
      accountName: profile.accountName,
      amount,
      addInfo: txId,
    });

    const attachment = new AttachmentBuilder(qrBuffer, { name: 'vietqr.png' });

    const newTx = {
      txId,
      guildId,
      channelId: interaction.channelId,
      messageId: null,
      buyerId: buyerUser.id,
      sellerId: targetSellerUser.id,
      amount,
      description,
      status: 'pending' as const,
      note: null,
      processedBy: null,
      createdAt: Date.now(),
      processedAt: null,
    };

    // Lưu vào SQLite
    sellerDb.createTransaction(newTx);

    const embed = buildPendingPaymentEmbed(newTx, profile);
    const actionRow = buildPaymentActionRow(txId);

    const message = await interaction.editReply({
      content: `<@${buyerUser.id}> <@${targetSellerUser.id}> Đơn thanh toán kéo game đã được tạo!`,
      embeds: [embed],
      components: [actionRow],
      files: [attachment],
    });

    // Cập nhật messageId
    sellerDb.updateTransactionMessageId(txId, message.id);
  } catch (error) {
    logger.error(`Lỗi khi tạo đơn kéo: ${error instanceof Error ? error.message : String(error)}`);
    await interaction.editReply({
      content: '❌ Đã xảy ra lỗi khi tạo mã VietQR thanh toán. Vui lòng thử lại sau!',
    });
  }
}

/**
 * Thực thi lệnh /seller qr
 */
async function executeQr(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId || 'global';
  const targetUser = interaction.options.getUser('user') || interaction.user;

  // Nếu xem của người khác, phải là Admin
  if (targetUser.id !== interaction.user.id) {
    const isOwnerOrAdmin = hasPolicy(interaction, Policy.MANAGE_CONFIG).allowed;

    if (!isOwnerOrAdmin) {
      await interaction.reply({
        content: '❌ Bạn chỉ có thể xem/cấu hình mã QR của chính mình!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const sellerDb = getSellerDb();
  const profile = sellerDb.getProfile(targetUser.id, guildId);

  const { embed } = buildSellerQrDashboardEmbed(profile, targetUser.id);
  const rows = buildSellerQrActionRows(profile, targetUser.id);

  await interaction.reply({
    embeds: [embed],
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Thực thi lệnh /seller history
 */
async function executeHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId || 'global';
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const statusFilter = interaction.options.getString('status') as any;

  const sellerDb = getSellerDb();
  const transactions = sellerDb.getTransactions({
    guildId,
    sellerId: targetUser.id,
    status: statusFilter,
    limit: 10,
  });

  const embed = buildSellerHistoryEmbed(transactions, targetUser.tag);

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Thực thi lệnh /seller top
 */
async function executeTop(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId || 'global';
  const guildName = interaction.guild?.name || 'Server';
  const limit = interaction.options.getInteger('limit') || 10;

  const sellerDb = getSellerDb();
  const topSellers = sellerDb.getTopSellers(guildId, limit);

  const embed = buildSellerTopEmbed(topSellers, guildName);

  await interaction.reply({
    embeds: [embed],
  });
}

/**
 * Thực thi lệnh /seller config setrole
 */
async function executeConfigSetRole(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      content: '❌ Lệnh này chỉ có thể sử dụng trong máy chủ Discord!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Yêu cầu quyền ADMINISTRATOR hoặc BOT_ADMIN
  if (!hasPolicy(interaction, Policy.MANAGE_RBAC).allowed) {
    await interaction.reply({
      content: '❌ Bạn cần có quyền Quản trị viên bot để cấu hình role Thợ Kéo!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const role = interaction.options.getRole('role', true);
  const settingsService = getSettingsService();

  settingsService.updateSeller(interaction.guildId!, {
    roleId: role.id,
  });

  await interaction.reply({
    content: `✅ Đã thiết lập role Thợ Kéo của server thành: **${role.name}** (<@&${role.id}>)!`,
  });
}

// ─── Main Dispatcher ──────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (group === 'config') {
    if (subcommand === 'setrole') {
      await executeConfigSetRole(interaction);
      return;
    }
  }

  switch (subcommand) {
    case 'pay':
      await executePay(interaction);
      break;
    case 'qr':
      await executeQr(interaction);
      break;
    case 'history':
      await executeHistory(interaction);
      break;
    case 'top':
      await executeTop(interaction);
      break;
    default:
      await interaction.reply({
        content: '❌ Lệnh không hợp lệ!',
        flags: MessageFlags.Ephemeral,
      });
  }
}
