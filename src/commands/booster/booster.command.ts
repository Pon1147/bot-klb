import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  GuildMember,
} from 'discord.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { handleSetChannel } from './handlers/set-channel.handler.js';
import { handleSetRole } from './handlers/set-role.handler.js';
import { handleToggle } from './handlers/toggle.handler.js';
import { handleStatus } from './handlers/status.handler.js';

/**
 * Command structure: phải export `data` (SlashCommandBuilder) và `execute`.
 * Command /booster: cấu hình hệ thống cảm ơn khi member Server Boost.
 */
export const data = new SlashCommandBuilder()
  .setName('booster')
  .setDescription('Configure the booster thank-you system.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the booster thank-you message channel.')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The channel to send booster messages in.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setrole')
      .setDescription('Set the role to assign on boost.')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('The role to assign to boosters.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable the booster system.')
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('Whether to enable or disable booster messages.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('status').setDescription('Show current booster configuration.'),
  );

/**
 * Execute the /booster command: router phân tích subcommand và gọi handler tương ứng.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Guard clause: check Administrator permission
  const commandingMember = interaction.member as GuildMember;
  if (!commandingMember || !commandingMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'You need Administrator permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommandName = interaction.options.getSubcommand();
  const guildIdentifier = interaction.guild.id;

  try {
    // Router: phân phối subcommand về handler tương ứng
    switch (subcommandName) {
      case 'setchannel':
        await handleSetChannel(interaction, guildIdentifier);
        break;
      case 'setrole':
        await handleSetRole(interaction, guildIdentifier);
        break;
      case 'toggle':
        await handleToggle(interaction, guildIdentifier);
        break;
      case 'status':
        await handleStatus(interaction, guildIdentifier);
        break;
      default: {
        const errorContainer = buildErrorContainer('Unknown subcommand.');
        await interaction.reply({
          components: errorContainer.toJSON(),
          flags: errorContainer.flags | MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error(`Error in /booster ${subcommandName}:`, error);
    const errorContainer = buildErrorContainer('An error occurred. Check console logs.');
    await interaction.reply({
      components: errorContainer.toJSON(),
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}