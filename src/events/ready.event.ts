import { Client, Events } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { botConfig } from '../config/bot.config.js';

const logger = createLogger('Ready');

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
  logger.divider();
}

export default {
  name: Events.ClientReady,
  once: true,
  execute,
};
