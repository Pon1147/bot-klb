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
 */
export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Configure the welcome system for new members.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the welcome message channel.')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The channel to send welcome messages in.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setrole')
      .setDescription('Set the role to assign on join.')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('The role to assign to new members.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable the welcome system.')
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('Whether to enable or disable welcome messages.')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('status').setDescription('Show current welcome configuration.'),
  );

/**
 * Execute the /welcome command: router phân tích subcommand và gọi handler tương ứng.
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
    console.error(`Error in /welcome ${subcommandName}:`, error);
    const errorContainer = buildErrorContainer('An error occurred. Check console logs.');
    await interaction.reply({
      components: errorContainer.toJSON(),
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}
