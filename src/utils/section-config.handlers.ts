import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  GuildMember,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../services/settings.service.js';
import {
  buildSuccessContainer,
  buildTextOnlyContainer,
  buildErrorContainer,
} from './container.utils.js';
import { COLORS } from '../config/container.variables.js';

export interface SectionConfig {
  sectionKey: 'welcome' | 'booster' | 'dfCodes';
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

export function getWelcomeConfig(): SectionConfig {
  return WELCOME_CONFIG;
}

export async function handleSectionSetChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    const selectedChannel = interaction.options.getChannel('channel', true);
    const settingsService = getSettingsService();
    settingsService.update(guildId, {
      [config.sectionKey]: { channelId: selectedChannel.id },
    });
    const container = buildSuccessContainer(
      `${config.displayName} channel đã đặt: ${selectedChannel}.`,
    );
    await interaction.editReply({
      components: container.toJSON(),
      flags: container.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedChannel = interaction.options.getChannel('channel', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { channelId: selectedChannel.id },
  });
  const container = buildSuccessContainer(
    `${config.displayName} channel đã đặt: ${selectedChannel}.`,
  );
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}

export async function handleSectionSetRole(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    const selectedRole = interaction.options.getRole('role', true);
    const settingsService = getSettingsService();
    settingsService.update(guildId, {
      [config.sectionKey]: { roleId: selectedRole.id },
    });
    const container = buildSuccessContainer(
      `${config.displayName} role đã đặt: ${selectedRole.name}.`,
    );
    await interaction.editReply({
      components: container.toJSON(),
      flags: container.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedRole = interaction.options.getRole('role', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { roleId: selectedRole.id },
  });
  const container = buildSuccessContainer(
    `${config.displayName} role đã đặt: ${selectedRole.name}.`,
  );
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}

export async function handleSectionToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    const shouldBeEnabled = interaction.options.getBoolean('enabled', true);
    const settingsService = getSettingsService();
    settingsService.update(guildId, {
      [config.sectionKey]: { enabled: shouldBeEnabled },
    });
    const statusText = shouldBeEnabled ? 'đã bật' : 'đã tắt';
    const container = buildSuccessContainer(`${config.displayName} hệ thống ${statusText}.`);
    await interaction.editReply({
      components: container.toJSON(),
      flags: container.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const shouldBeEnabled = interaction.options.getBoolean('enabled', true);
  const settingsService = getSettingsService();
  settingsService.update(guildId, {
    [config.sectionKey]: { enabled: shouldBeEnabled },
  });
  const statusText = shouldBeEnabled ? 'đã bật' : 'đã tắt';
  const container = buildSuccessContainer(`${config.displayName} hệ thống ${statusText}.`);
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}

export async function handleSectionStatus(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  config: SectionConfig,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    const settingsService = getSettingsService();
    const settings = settingsService.get(guildId)[config.sectionKey];
    const channelName = settings.channelId ? `<#${settings.channelId}>` : 'Chưa đặt';
    const roleId = 'roleId' in settings ? (settings as { roleId?: string }).roleId : undefined;
    const roleName = roleId ? `<@&${roleId}>` : 'Chưa đặt';
    const statusContent = [
      `**${config.statusEmoji} Cấu hình ${config.displayName} hiện tại:**`,
      '',
      `**Trạng thái:** ${settings.enabled ? 'Bật' : 'Tắt'}`,
      `**Kênh:** ${channelName}`,
      `**Role:** ${roleName}`,
    ].join('\n');
    const container = buildTextOnlyContainer(statusContent, config.statusColor);
    await interaction.editReply({
      components: container.toJSON(),
      flags: container.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId)[config.sectionKey];
  const channelName = settings.channelId ? `<#${settings.channelId}>` : 'Chưa đặt';
  const roleId = 'roleId' in settings ? (settings as { roleId?: string }).roleId : undefined;
  const roleName = roleId ? `<@&${roleId}>` : 'Chưa đặt';
  const statusContent = [
    `**${config.statusEmoji} Cấu hình ${config.displayName} hiện tại:**`,
    '',
    `**Trạng thái:** ${settings.enabled ? 'Bật' : 'Tắt'}`,
    `**Kênh:** ${channelName}`,
    `**Role:** ${roleName}`,
  ].join('\n');
  const container = buildTextOnlyContainer(statusContent, config.statusColor);
  await interaction.reply({
    components: container.toJSON(),
    flags: container.flags | MessageFlags.Ephemeral,
  });
}

export async function executeSectionCommand(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
  config: SectionConfig,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const member = interaction.member as GuildMember;
  if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
      flags: MessageFlags.Ephemeral,
    });
    return;
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
      case 'status':
        await handleSectionStatus(interaction, guildIdentifier, config);
        break;
      default: {
        const errorContainer = buildErrorContainer('Subcommand không hợp lệ.');
        await interaction.reply({
          components: errorContainer.toJSON(),
          flags: errorContainer.flags | MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error(`Error in /${config.sectionKey} ${subcommandName}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      const errorContainer = buildErrorContainer('An error occurred. Check console logs.');
      await interaction.reply({
        components: errorContainer.toJSON(),
        flags: errorContainer.flags | MessageFlags.Ephemeral,
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
