import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../services/settings.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SectionConfig');
import {
  buildSuccessContainer,
  buildTextOnlyContainer,
  buildErrorContainer,
} from './container.utils.js';
import { COLORS } from '../config/container.variables.js';
import { requireAdministrator } from './df-guards.js';
import { sendReply } from './reply.utils.js';
import { getCommandPath } from './command-path.utils.js';
import { resolveCommandPolicy } from '../config/permissions.js';

export interface SectionConfig {
  sectionKey: 'welcome' | 'booster' | 'leave' | 'dfCodes';
  displayName: string;
  statusEmoji: string;
  statusColor: number;
}

const BOOSTER_CONFIG: SectionConfig = {
  sectionKey: 'booster',
  displayName: 'Booster',
  statusEmoji: '🚀',
  statusColor: COLORS.BOOSTER,
};

const WELCOME_CONFIG: SectionConfig = {
  sectionKey: 'welcome',
  displayName: 'Welcome',
  statusEmoji: '✅',
  statusColor: COLORS.WELCOME,
};

export function getConfig(config: SectionConfig): SectionConfig {
  return config;
}

export function getBoosterConfig(): SectionConfig {
  return BOOSTER_CONFIG;
}

const LEAVE_CONFIG: SectionConfig = {
  sectionKey: 'leave',
  displayName: 'Leave',
  statusEmoji: '👋',
  statusColor: COLORS.LEAVE,
};

export function getLeaveConfig(): SectionConfig {
  return LEAVE_CONFIG;
}

export function getWelcomeConfig(): SectionConfig {
  return WELCOME_CONFIG;
}

export async function handleSectionSetChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  const selectedChannel = interaction.options.getChannel('channel', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { channelId: selectedChannel.id },
  });
  const container = buildSuccessContainer(
    `${config.displayName} channel đã đặt: ${selectedChannel}.`,
  );
  await sendReply(interaction, { components: container.toJSON() });
}

export async function handleSectionSetRole(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  const selectedRole = interaction.options.getRole('role', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { roleId: selectedRole.id },
  });
  const container = buildSuccessContainer(
    `${config.displayName} role đã đặt: ${selectedRole.name}.`,
  );
  await sendReply(interaction, { components: container.toJSON() });
}

export async function handleSectionToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  const shouldBeEnabled = interaction.options.getBoolean('enabled', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { enabled: shouldBeEnabled },
  });
  const statusText = shouldBeEnabled ? 'đã bật' : 'đã tắt';
  const container = buildSuccessContainer(`${config.displayName} hệ thống ${statusText}.`);
  await sendReply(interaction, { components: container.toJSON() });
}

export async function handleSectionStatus(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId)[config.sectionKey];
  logger.info(`/${config.sectionKey} status for guild ${guildId}: ${JSON.stringify(settings)}`);
  const channelName = settings.channelId ? `<#${settings.channelId}>` : 'Chưa đặt';
  const roleId = 'roleId' in settings ? (settings as { roleId?: string }).roleId : undefined;
  const roleName = roleId ? `<@&${roleId}>` : 'Chưa đặt';

  // Thêm scheduleTime và adminChannelId cho dfCodes
  let scheduleTimeLine = '';
  if (config.sectionKey === 'dfCodes' && 'scheduleTime' in settings) {
    const st = (settings as { scheduleTime?: string }).scheduleTime;
    scheduleTimeLine = `\n**Giờ tự động:** ${st || 'Chưa đặt'} (UTC+7)`;
  }
  let adminChannelLine = '';
  if (config.sectionKey === 'dfCodes' && 'adminChannelId' in settings) {
    const ac = (settings as { adminChannelId?: string }).adminChannelId;
    adminChannelLine = ac ? `\n**Admin channel:** <#${ac}>` : '';
  }

  const statusContent = [
    `**${config.statusEmoji} Cấu hình ${config.displayName} hiện tại:**`,
    '',
    `**Trạng thái:** ${settings.enabled ? 'Bật' : 'Tắt'}`,
    `**${config.sectionKey === 'dfCodes' ? 'Kênh codes' : 'Kênh'}:** ${channelName}`,
    ...(config.sectionKey !== 'leave' ? [`**Role:** ${roleName}`] : []),
    scheduleTimeLine,
    adminChannelLine,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join('\n');
  const container = buildTextOnlyContainer(statusContent, config.statusColor);
  await sendReply(interaction, { components: container.toJSON() });
}

export async function handleSectionTest(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  const guild = interaction.guild!;
  const settingsService = getSettingsService();
  const member = (
    interaction.member instanceof GuildMember
      ? interaction.member
      : (guild.members.cache.get(interaction.user.id) ?? interaction.member)
  ) as GuildMember;
  const context = { member, guild };

  let containerResult;
  switch (config.sectionKey) {
    case 'welcome':
      containerResult = settingsService.buildWelcomeContainer(guildId, context);
      break;
    case 'booster':
      containerResult = settingsService.buildBoosterContainer(guildId, context);
      break;
    case 'leave':
      containerResult = settingsService.buildLeaveContainer(guildId, context);
      break;
    default:
      await sendReply(interaction, {
        components: buildErrorContainer('Tính năng này không hỗ trợ test container.').toJSON(),
      });
      return;
  }

  const settings = settingsService.get(guildId)[config.sectionKey];
  const targetChannelId = settings.channelId;

  if (targetChannelId) {
    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (targetChannel && targetChannel.isTextBased()) {
      await (targetChannel as import('discord.js').TextChannel).send({
        components: containerResult.toJSON(),
        flags: containerResult.flags,
        files: containerResult.files,
      });
      const successContainer = buildSuccessContainer(
        `Đã gửi tin nhắn thử nghiệm ${config.displayName} đến kênh <#${targetChannelId}> thành công!`,
      );
      await sendReply(interaction, {
        components: successContainer.toJSON(),
      });
      return;
    }
  }

  await sendReply(interaction, {
    content: targetChannelId
      ? `⚠️ Kênh đã cấu hình (<#${targetChannelId}>) không khả dụng. Dưới đây là bản xem trước ${config.displayName}:`
      : `ℹ️ Kênh ${config.displayName} chưa được cấu hình. Dưới đây là bản xem trước:`,
    components: containerResult.toJSON(),
    files: containerResult.files,
  });
}

export async function executeSectionCommand(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
  config: SectionConfig,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }
  const commandPath = getCommandPath(interaction);
  if (!resolveCommandPolicy(commandPath)) {
    if (await requireAdministrator(interaction)) return;
  }
  const subcommandName = interaction.options.getSubcommand();
  const guildIdentifier = interaction.guild.id;
  try {
    switch (subcommandName) {
      case 'setchannel':
        await handleSectionSetChannel(interaction, guildIdentifier, config);
        break;
      case 'setrole':
        await handleSectionSetRole(interaction, guildIdentifier, config);
        break;
      case 'toggle':
        await handleSectionToggle(interaction, guildIdentifier, config);
        break;
      case 'test':
        await handleSectionTest(interaction, guildIdentifier, config);
        break;
      case 'status':
        await handleSectionStatus(interaction, guildIdentifier, config);
        break;
      default:
        await sendReply(interaction, {
          components: buildErrorContainer('Subcommand không hợp lệ').toJSON(),
        });
    }
  } catch (error) {
    logger.error(
      'Error in /' +
        config.sectionKey +
        ' ' +
        subcommandName +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );
    if (!interaction.replied && !interaction.deferred) {
      await sendReply(interaction, {
        components: buildErrorContainer('Đã xảy ra lỗi. Vui lòng kiểm tra log console.').toJSON(),
      });
    }
  }
}

export function buildSectionSubcommands(
  name: string,
  descriptions: {
    main: string;
    setChannel: string;
    setRole: string;
    toggle: string;
    status: string;
  },
): SlashCommandSubcommandsOnlyBuilder {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(descriptions.main)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription(descriptions.setChannel)
        .addChannelOption((option) =>
          option.setName('channel').setDescription('The channel for messages.').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setrole')
        .setDescription(descriptions.setRole)
        .addRoleOption((option) =>
          option.setName('role').setDescription('The role to assign.').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription(descriptions.toggle)
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable.').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription(descriptions.status),
    ) as SlashCommandSubcommandsOnlyBuilder;
}
