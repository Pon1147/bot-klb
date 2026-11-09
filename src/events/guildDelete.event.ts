import { Events, Guild } from 'discord.js';
import { stopGuildCronJob } from '../services/df-codes-scheduler.js';
import { getSettingsService } from '../services/settings.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GuildDeleteEvent');

/**
 * Handle event GuildDelete (`guildDelete`):
 * Kích hoạt khi bot bị kick, ban, hoặc tự rời khỏi một máy chủ.
 * Tự động dừng cron jobs và dọn dẹp cấu hình khỏi bộ nhớ & database.
 */
export async function execute(guild: Guild): Promise<void> {
  logger.info(`Bot đã rời hoặc bị kick khỏi máy chủ: "${guild.name}" (${guild.id})`);

  // 1. Dừng lịch cron df-code của guild này
  stopGuildCronJob(guild.id);

  // 2. Dọn dẹp cấu hình trong bộ nhớ cache, SQLite và MongoDB
  try {
    const settingsService = getSettingsService();
    settingsService.delete(guild.id);
    logger.info(`✓ Đã dọn dẹp cấu hình máy chủ (${guild.id}) sau khi rời.`);
  } catch (err) {
    logger.warn(`Không thể dọn dẹp cấu hình sau khi rời máy chủ (${guild.id}):`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export default {
  name: Events.GuildDelete,
  once: false,
  execute,
};
