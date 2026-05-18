import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  getWelcomeConfiguration,
  saveWelcomeConfiguration,
  toggleWelcomeEnabled,
} from '../../database/welcome.database.js';
import { buildSuccessEmbed, buildErrorEmbed } from '../../utils/embed.utils.js';

/**
 * Command structure: must export `data` (SlashCommandBuilder) and `execute`.
 */
export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Configure the welcome system for new members.')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the welcome message channel.')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('The channel to send welcome messages in.')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setrole')
      .setDescription('Set the role to assign on join.')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('The role to assign to new members.')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable the welcome system.')
      .addBooleanOption(option =>
        option
          .setName('enabled')
          .setDescription('Whether to enable or disable welcome messages.')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Show current welcome configuration.')
  );

/**
 * Execute the /welcome command based on the selected subcommand.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database
): Promise<void> {
  // Guard clause: only allow guild usage
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  // Guard clause: check administrator permission
  const commandingMember = interaction.member as GuildMember;
  if (!commandingMember || !commandingMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'You need Administrator permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  const subcommandName = interaction.options.getSubcommand();
  const guildIdentifier = interaction.guild.id;

  try {
    switch (subcommandName) {
      case 'setchannel':
        await handleSetChannel(interaction, database, guildIdentifier);
        break;
      case 'setrole':
        await handleSetRole(interaction, database, guildIdentifier);
        break;
      case 'toggle':
        await handleToggle(interaction, database, guildIdentifier);
        break;
      case 'status':
        await handleStatus(interaction, database, guildIdentifier);
        break;
      default:
        await replyWithError(interaction, 'Unknown subcommand.');
    }
  } catch (error) {
    console.error(`Error in /welcome ${subcommandName}:`, error);
    await replyWithError(interaction, 'An error occurred. Check console logs.');
  }
}

/**
 * Handle /welcome setchannel: save the configured welcome channel.
 */
async function handleSetChannel(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  guildIdentifier: string
): Promise<void> {
  const selectedChannel = interaction.options.getChannel('channel', true);
  const currentConfig = getWelcomeConfiguration(database, guildIdentifier);

  currentConfig.channelId = selectedChannel.id;
  saveWelcomeConfiguration(database, currentConfig);

  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome channel set to ${selectedChannel}.`)],
    ephemeral: true,
  });
}

/**
 * Handle /welcome setrole: save the configured welcome role.
 */
async function handleSetRole(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  guildIdentifier: string
): Promise<void> {
  const selectedRole = interaction.options.getRole('role', true);
  const currentConfig = getWelcomeConfiguration(database, guildIdentifier);

  currentConfig.roleId = selectedRole.id;
  saveWelcomeConfiguration(database, currentConfig);

  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome role set to ${selectedRole.name}.`)],
    ephemeral: true,
  });
}

/**
 * Handle /welcome toggle: enable or disable the welcome system.
 */
async function handleToggle(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  guildIdentifier: string
): Promise<void> {
  const shouldBeEnabled = interaction.options.getBoolean('enabled', true);
  const currentConfig = getWelcomeConfiguration(database, guildIdentifier);

  // Ensure config row exists before toggling
  if (!currentConfig.channelId) {
    saveWelcomeConfiguration(database, currentConfig);
  }

  toggleWelcomeEnabled(database, guildIdentifier, shouldBeEnabled);

  const statusText = shouldBeEnabled ? 'enabled' : 'disabled';
  await interaction.reply({
    embeds: [buildSuccessEmbed(`Welcome system ${statusText}.`)],
    ephemeral: true,
  });
}

/**
 * Handle /welcome status: display current welcome configuration.
 */
async function handleStatus(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
  guildIdentifier: string
): Promise<void> {
  const currentConfig = getWelcomeConfiguration(database, guildIdentifier);

  const channelName = currentConfig.channelId
    ? `<#${currentConfig.channelId}>`
    : 'Not set';
  const roleName = currentConfig.roleId
    ? `<@&${currentConfig.roleId}>`
    : 'Not set';

  const statusEmbed = buildSuccessEmbed('**Current Welcome Configuration:**')
    .addFields(
      { name: 'Status', value: currentConfig.isEnabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Channel', value: channelName, inline: true },
      { name: 'Role', value: roleName, inline: true }
    );

  await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
}

/**
 * Helper: reply with error embed.
 */
async function replyWithError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.reply({
    embeds: [buildErrorEmbed(message)],
    ephemeral: true,
  });
}