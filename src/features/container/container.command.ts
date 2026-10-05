import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { createLogger } from '../../utils/logger.js';
import { requireAdministrator } from '../../utils/df-guards.js';
import { sendReply } from '../../utils/reply.utils.js';

const logger = createLogger('Container');
import { startInteractiveEdit } from './container-edit.handler.js';
import { handleContainerReset } from './container-reset.handler.js';

// ─── Subcommand Builder Functions ─────────────────────────────

/**
 * Builder cho subcommand "edit" — chỉnh sửa container settings qua Interactive UI.
 */
export function buildEditSubcommand(
  sub: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
  return sub
    .setName('edit')
    .setDescription('Chỉnh sửa container settings (Interactive UI).')
    .addStringOption(buildEditTypeOptionCallback);
}

/**
 * Builder cho subcommand "reset" — reset container settings về mặc định.
 */
export function buildResetSubcommand(
  sub: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
  return sub
    .setName('reset')
    .setDescription('Reset container settings về mặc định.')
    .addStringOption(buildResetTypeOptionCallback);
}

// ─── Option Builder Callbacks ─────────────────────────────────

export function buildEditTypeOptionCallback(
  opt: SlashCommandStringOption,
): SlashCommandStringOption {
  return opt
    .setName('type')
    .setDescription('Loại container cần chỉnh sửa.')
    .setRequired(true)
    .addChoices(
      { name: 'Welcome', value: 'welcome' },
      { name: 'Leave', value: 'leave' },
      { name: 'Booster', value: 'booster' },
    );
}

export function buildResetTypeOptionCallback(
  opt: SlashCommandStringOption,
): SlashCommandStringOption {
  return opt
    .setName('type')
    .setDescription('Loại container cần reset.')
    .setRequired(true)
    .addChoices(
      { name: 'Welcome', value: 'welcome' },
      { name: 'Leave', value: 'leave' },
      { name: 'Booster', value: 'booster' },
    );
}

/**
 * Command structure: export `data` (SlashCommandBuilder) và `execute`.
 *
 * /container — quản lý container V2 settings (edit, reset).
 * Yêu cầu Administrator permission.
 */
export const data = new SlashCommandBuilder()
  .setName('container')
  .setDescription('Quản lý container V2 settings cho welcome/leave messages.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(buildEditSubcommand)
  .addSubcommand(buildResetSubcommand);

/**
 * Execute /container command: router phân phối subcommand.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  // Guard clause: chỉ dùng trong guild
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  // Guard clause: check Administrator permission
  if (await requireAdministrator(interaction)) return;

  const subcommandName = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    switch (subcommandName) {
      case 'edit': {
        const type = interaction.options.getString('type') as 'welcome' | 'leave' | 'booster';
        await startInteractiveEdit(interaction, type);
        break;
      }

      case 'reset': {
        await handleContainerReset(interaction, guildId);
        break;
      }

      default:
        await sendReply(interaction, {
          components: buildErrorContainer('Subcommand không hợp lệ').toJSON(),
        });
    }
  } catch (error) {
    logger.error(
      'Error in /container ' +
        subcommandName +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );
    // Guard: interaction có thể đã replied ở trong handler
    if (!interaction.replied) {
      await sendReply(interaction, {
        components: buildErrorContainer('Xảy ra lỗi. Kiểm tra console logs.').toJSON(),
      });
    }
  }
}
