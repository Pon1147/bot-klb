/**
 * Subcommand Group: /config booster
 * Quản lý cấu hình tri ân Server Booster (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getBoosterConfig } from '../../utils/section-config.handlers.js';

export function buildBoosterGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('booster')
    .setDescription('Cấu hình hệ thống cảm ơn Server Booster.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn cảm ơn Booster.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role dành riêng cho Booster.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Booster').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống thông báo Booster.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình Booster hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Gửi tin nhắn cảm ơn Booster thử nghiệm để kiểm tra hiển thị.'),
    );
}

export async function executeBoosterGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getBoosterConfig());
}
