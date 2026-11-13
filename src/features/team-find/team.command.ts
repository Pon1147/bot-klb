/**
 * /team — Lệnh tìm đội và quản lý party Delta Force.
 *
 * Cấu trúc:
 * /team find
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';

import { execute as executeTeamFind } from './team-find.handler.js';
import { EN_LOCALE } from '../../locales/en.js';

// ─── Slash Command Builder ────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('team')
  .setDescription(
    'Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động.',
  )
  .setDescriptionLocalizations({
    'en-US': EN_LOCALE.commands['team'].desc,
  });

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const db = (database ?? interaction.client.database) as Database.Database;
  await executeTeamFind(interaction, db);
}
