import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildSectionSubcommands,
  executeSectionCommand,
  getWelcomeConfig,
} from '../../utils/section-config.handlers.js';

export const data = buildSectionSubcommands('welcome', {
  main: 'Cấu hình hệ thống chào thành viên mới.',
  setChannel: 'Chọn kênh gửi tin nhắn chào.',
  setRole: 'Chọn role cấp khi thành viên join.',
  toggle: 'Bật hoặc tắt hệ thống welcome.',
  status: 'Xem cấu hình welcome hiện tại.',
});

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, _database, getWelcomeConfig());
}
