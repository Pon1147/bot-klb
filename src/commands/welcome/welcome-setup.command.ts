import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { buildErrorEmbed } from '../../utils/embed.utils.js';
import { handleSetChannel } from './welcome-setchannel.handler.js';
import { handleSetRole } from './welcome-setrole.handler.js';
import { handleToggle } from './welcome-toggle.handler.js';
import { handleStatus } from './welcome-status.handler.js';

/**
 * Command structure: phải export `data` (SlashCommandBuilder) và `execute`.
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
 * Execute the /welcome command: router phân tích subcommand và gọi handler tương ứng.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  // Guard clause: check Administrator permission
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
      default:
        await interaction.reply({
          embeds: [buildErrorEmbed('Unknown subcommand.')],
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error(`Error in /welcome ${subcommandName}:`, error);
    await interaction.reply({
      embeds: [buildErrorEmbed('An error occurred. Check console logs.')],
      ephemeral: true,
    });
  }
}