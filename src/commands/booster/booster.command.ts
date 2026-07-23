import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildSectionSubcommands,
  executeSectionCommand,
  getBoosterConfig,
} from '../../utils/section-config.handlers.js';

export const data = buildSectionSubcommands('booster', {
  main: 'Cấu hình hệ thống cảm ơn booster.',
  setChannel: 'Chọn kênh gửi tin nhắn cảm ơn booster.',
  setRole: 'Chọn role cấp khi boost.',
  toggle: 'Bật hoặc tắt hệ thống booster.',
  status: 'Xem cấu hình booster hiện tại.',
});

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, _database, getBoosterConfig());
}