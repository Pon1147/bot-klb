/**
 * Subcommand Group: /config leave
 * Quản lý cấu hình thông báo khi thành viên rời server (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getLeaveConfig } from '../../utils/section-config.handlers.js';

export function buildLeaveGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('leave')
    .setDescription('Cấu hình hệ thống tạm biệt khi thành viên rời server.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn tạm biệt.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống tạm biệt.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình tạm biệt hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('Gửi tin nhắn tạm biệt thử nghiệm để kiểm tra hiển thị.'),
    );
}

export async function executeLeaveGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getLeaveConfig());
}
