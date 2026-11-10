/**
 * /team — Lệnh tìm đội và quản lý party Delta Force.
 *
 * Cấu trúc:
 * /team find
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';

import { execute as executeTeamFind } from './team-find.handler.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';

// ─── Slash Command Builder ────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('team')
  .setDescription('Các lệnh tìm đội và quản lý nhóm chơi game.')
  .addSubcommand((sub) =>
    sub.setName('find').setDescription('Tìm đồng đội chơi theo bản đồ và chế độ.'),
  );

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const db = (database ?? interaction.client.database) as Database.Database;

  switch (subcommand) {
    case 'find':
      await executeTeamFind(interaction, db);
      return;
    default:
      await sendReply(interaction, {
        components: buildErrorContainer('Lệnh team không hợp lệ.').toJSON(),
      });
  }
}
