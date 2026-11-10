/**
 * Subcommand Group: /config welcome
 * Quản lý cấu hình chào mừng thành viên mới (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getWelcomeConfig } from '../../utils/section-config.handlers.js';

export function buildWelcomeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('welcome')
    .setDescription('Cấu hình hệ thống chào mừng thành viên mới.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn chào mừng.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role tự động cấp khi vào server.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role cần cấp').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống chào mừng.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình chào mừng hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('Gửi tin nhắn chào mừng thử nghiệm để kiểm tra hiển thị.'),
    );
}

export async function executeWelcomeGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getWelcomeConfig());
}
