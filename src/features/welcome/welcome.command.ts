import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildSectionSubcommands,
  executeSectionCommand,
  getWelcomeConfig,
} from '../../utils/section-config.handlers.js';

/**
 * Định nghĩa Slash Command /welcome với các subcommand cấu hình.
 */
export const data = buildSectionSubcommands('welcome', {
  main: 'Cấu hình hệ thống chào mừng thành viên mới.',
  setChannel: 'Chọn kênh gửi tin nhắn chào.',
  setRole: 'Chọn role cấp khi thành viên join.',
  toggle: 'Bật hoặc tắt hệ thống welcome.',
  status: 'Xem cấu hình welcome hiện tại.',
});

/**
 * Thực thi lệnh /welcome, phân phối vào các handler cấu hình tương ứng.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, _database, getWelcomeConfig());
}
