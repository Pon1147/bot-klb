/**
 * /setup — Lệnh mở nhanh Bảng Điều Khiển Cài Đặt Server (Admin Console V2).
 * Dành cho Server Owner và Admin/Mod được phân quyền RBAC (Policy: MANAGE_CONFIG).
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { execute as executeAdmin } from './admin.command.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setNameLocalizations({
    vi: 'cài-đặt',
  })
  .setDescription('Bảng điều khiển cài đặt nhanh server dành cho Admin/Mod (Components V2).')
  .setDescriptionLocalizations({
    'en-US': 'Interactive server setup console for Server Owners & Admins (Components V2).',
  });

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  await executeAdmin(interaction, database);
}
