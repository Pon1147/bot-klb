/**
 * Subcommand Group: /config qr-server
 * Quản lý cấp phép tính năng QR tự động cho máy chủ (Bot Owner only - BM-01).
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../../../services/settings.service.js';
import { botConfig } from '../../../config/bot.config.js';
import { buildErrorContainer, buildInfoContainer } from '../../../utils/container.utils.js';
import { sendReply } from '../../../utils/reply.utils.js';
import { createLogger } from '../../../utils/logger.js';
import { EN_LOCALE } from '../../../locales/en.js';

const logger = createLogger('QrServerSubcommand');

export function buildQrServerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('qr-server')
    .setDescription('Quản lý cấp quyền tính năng QR trả phí cho máy chủ (chỉ dành cho Bot Owner).')
    .setDescriptionLocalizations({
      'en-US': 'Manage premium VietQR licensing for servers (Bot Owner).',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt tính năng QR tự động cho máy chủ.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.qr-server.toggle'].desc,
        })
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Bật (true) hoặc Tắt (false)')
            .setDescriptionLocalizations({ 'en-US': 'Enable (true) or Disable (false)' })
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('ID máy chủ Discord (để trống sẽ áp dụng cho máy chủ hiện tại)')
            .setDescriptionLocalizations({ 'en-US': 'Target Discord server ID (optional)' })
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setDescription('Xem trạng thái tính năng QR của máy chủ.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.qr-server.status'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('ID máy chủ Discord (để trống sẽ xem máy chủ hiện tại)')
            .setDescriptionLocalizations({ 'en-US': 'Target Discord server ID (optional)' })
            .setRequired(false),
        ),
    );
}

export async function handleQrServerToggle(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  if (interaction.user.id !== botConfig.botOwnerId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền sử dụng lệnh này. Chỉ duy nhất Chủ sở hữu Bot (Bot Owner) mới có quyền quản lý cấp phép tính năng QR cho máy chủ.',
      ).toJSON(),
    });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled', true);
  const inputServerId = interaction.options.getString('server_id')?.trim();
  const targetGuildId = inputServerId || interaction.guildId || interaction.guild?.id;

  if (!targetGuildId) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không xác định được ID máy chủ cần cấu hình.').toJSON(),
    });
    return;
  }

  const settingsService = getSettingsService();
  const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
  const guildDisplayName = targetGuild ? targetGuild.name : `Máy chủ (${targetGuildId})`;

  const now = Date.now();
  settingsService.update(targetGuildId, {
    qrServer: {
      enabled,
      updatedAt: now,
      updatedBy: interaction.user.id,
    },
  });

  logger.info(
    `[QrServer] Bot Owner [${interaction.user.id}] đã ${enabled ? 'MỞ' : 'KHÓA'} tính năng QR cho máy chủ ${targetGuildId} (${guildDisplayName})`,
  );

  const statusBadge = enabled ? '🟢 ĐÃ KÍCH HOẠT (OPEN)' : '🔴 ĐÃ KHÓA (DISABLED)';
  const statusDesc = enabled
    ? 'Tính năng tạo mã QR tự động đã sẵn sàng hoạt động trên máy chủ này.'
    : 'Tính năng tạo mã QR tự động đã bị khóa trên máy chủ này.';

  const envTag = botConfig.isDev ? '\n• **Môi trường**: 🛠️ `DEV (Local VSCode)`' : '';

  const container = buildInfoContainer(
    `### 🛡️ Quản Lý Cấp Phép QR Server (Premium Feature)\n\n` +
      `• **Máy chủ**: **${guildDisplayName}** (\`${targetGuildId}\`)\n` +
      `• **Trạng thái**: ${statusBadge}\n` +
      `• **Thời gian cập nhật**: <t:${Math.floor(now / 1000)}:F> (<t:${Math.floor(now / 1000)}:R>)\n` +
      `• **Người thực hiện**: <@${interaction.user.id}>` +
      `${envTag}\n\n` +
      `> ℹ️ *${statusDesc}*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function handleQrServerStatus(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  if (interaction.user.id !== botConfig.botOwnerId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền sử dụng lệnh này. Chỉ duy nhất Chủ sở hữu Bot (Bot Owner) mới có quyền kiểm tra cấu hình QR của máy chủ.',
      ).toJSON(),
    });
    return;
  }

  const inputServerId = interaction.options.getString('server_id')?.trim();
  const targetGuildId = inputServerId || interaction.guildId || interaction.guild?.id;

  if (!targetGuildId) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không xác định được ID máy chủ cần kiểm tra.').toJSON(),
    });
    return;
  }

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(targetGuildId);
  const qrConfig = currentSettings.qrServer;
  const isEnabled = qrConfig?.enabled ?? false;

  const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
  const guildDisplayName = targetGuild ? targetGuild.name : `Máy chủ (${targetGuildId})`;

  const statusBadge = isEnabled ? '🟢 ĐÃ KÍCH HOẠT (OPEN)' : '🔴 ĐÃ KHÓA (DISABLED)';
  const updatedTime = qrConfig?.updatedAt
    ? `<t:${Math.floor(qrConfig.updatedAt / 1000)}:F> (<t:${Math.floor(qrConfig.updatedAt / 1000)}:R>)`
    : '*Chưa từng cập nhật*';
  const updatedByUser = qrConfig?.updatedBy ? `<@${qrConfig.updatedBy}>` : '*Hệ thống (mặc định)*';

  const envTag = botConfig.isDev ? '\n• **Môi trường**: 🛠️ `DEV (Local VSCode)`' : '';

  const container = buildInfoContainer(
    `### 🛡️ Trạng Thái Cấp Phép QR Server\n\n` +
      `• **Máy chủ**: **${guildDisplayName}** (\`${targetGuildId}\`)\n` +
      `• **Trạng thái**: ${statusBadge}\n` +
      `• **Cập nhật lần cuối**: ${updatedTime}\n` +
      `• **Người thực hiện**: ${updatedByUser}` +
      `${envTag}`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function executeQrServerGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'toggle') {
    await handleQrServerToggle(interaction, database);
  } else if (subcommand === 'status') {
    await handleQrServerStatus(interaction, database);
  }
}
