import { Client, Events } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { botConfig } from '../config/bot.config.js';
import { getSettingsService } from '../services/settings.service.js';

const logger = createLogger('Ready');

/**
 * Dọn dẹp các guild mồ côi (guilds trong database nhưng bot không còn tham gia).
 */
export function pruneOrphanGuilds(client: Client): number {
  if (!client.database || !client.guilds?.cache) return 0;
  const activeGuildIds = new Set(client.guilds.cache.keys());
  if (activeGuildIds.size === 0) return 0;

  try {
    const rows = client.database
      .prepare('SELECT DISTINCT guild_id FROM guild_settings')
      .all() as Array<{ guild_id: string }>;

    const orphans = rows.filter((r) => !activeGuildIds.has(r.guild_id)).map((r) => r.guild_id);
    if (orphans.length === 0) return 0;

    const settingsService = getSettingsService();
    for (const orphanId of orphans) {
      settingsService.delete(orphanId);
    }
    logger.info(
      `✓ [Cleanup] Đã dọn dẹp ${orphans.length} máy chủ mồ côi (bot không còn tham gia) khỏi database.`,
    );
    return orphans.length;
  } catch (err) {
    logger.warn('Không thể dọn dẹp guild mồ côi lúc khởi động:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Handle event ClientReady (`ready`):
 * Ghi log thông tin bot và danh sách toàn bộ server (guilds) bot đang tham gia.
 * Hỗ trợ kiểm tra nhanh khi chạy môi trường local hoặc production.
 */
export async function execute(client: Client): Promise<void> {
  const user = client.user;
  const isProd = botConfig.env === 'product';

  logger.divider();
  logger.info(`✓ Logged in as ${user?.tag ?? 'Unknown'} (ID: ${user?.id ?? 'N/A'})`);

  const mongoInfo = botConfig.mongoUri
    ? isProd
      ? ' | Mongo: [Connected]'
      : ` | Mongo: [${botConfig.mongoDbName}]`
    : '';
  const dbInfo = isProd ? 'DB: [SQLite Ready]' : `DB: [${botConfig.databasePath}]`;

  logger.info(
    `[ENV: ${botConfig.env.toUpperCase()}] Scope: [${botConfig.commandScope}] | ${dbInfo}${mongoInfo}`,
  );

  const guilds = client.guilds.cache;
  if (isProd) {
    logger.info(`Connected to ${guilds.size} guild(s)`);
  } else {
    const devGuild = guilds.get(botConfig.devGuildId);
    const productCount = Array.from(guilds.values()).filter(
      (g) => g.id !== botConfig.devGuildId,
    ).length;

    if (devGuild) {
      logger.info(
        `✓ [Dev Context] Active Dev Server: "${devGuild.name}" (${devGuild.id}) — ${devGuild.memberCount} members`,
      );
    } else {
      logger.warn(
        `⚠ [Dev Context] Dev Server (ID: ${botConfig.devGuildId}) not found in client guild cache!`,
      );
    }
    logger.info(
      `✓ [Isolation] ${productCount} Product server(s) safely isolated and ignored in this Dev session.`,
    );
  }

  // TUYỆT ĐỐI KHÔNG tự động xóa guild trên startup:
  // Discord gateway kết nối bất đồng bộ và guild cache có thể chưa tải xong hoặc shard đang delay.
  // Việc tự động xóa trên startup sẽ làm mất vĩnh viễn cấu hình máy chủ (đặc biệt khi dev/prod chạy song song hoặc restart container).
  // Việc dọn dẹp cấu hình chỉ kích hoạt khi bot nhận event rời máy chủ thực tế (guildDelete.event.ts).

  logger.divider();
}

export default {
  name: Events.ClientReady,
  once: true,
  execute,
};
