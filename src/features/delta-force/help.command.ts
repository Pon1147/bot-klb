/**
 * /help — Lệnh xem cẩm nang hướng dẫn sử dụng bot và danh mục tính năng.
 * Hỗ trợ giao diện Components V2, phân trang và đa ngữ (VI / EN).
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { execute as executeHelp } from './help.handler.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setNameLocalizations({
    vi: 'trợ-giúp',
  })
  .setDescription('Mở Trung tâm Trợ giúp, cẩm nang hướng dẫn sử dụng Bot Delta cho thành viên.')
  .setDescriptionLocalizations({
    'en-US': 'Open Help Center and user guide for Bot Delta members.',
  });

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const db = (database ?? interaction.client.database) as Database.Database;
  await executeHelp(interaction, db);
}
