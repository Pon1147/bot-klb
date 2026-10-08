import { Client, Events } from 'discord.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Ready');

/**
 * Handle event ClientReady (`ready`):
 * Ghi log thông tin bot và danh sách toàn bộ server (guilds) bot đang tham gia.
 * Hỗ trợ kiểm tra nhanh khi chạy môi trường local hoặc production.
 */
export async function execute(client: Client): Promise<void> {
  const user = client.user;
  logger.divider();
  logger.info(`✓ Logged in as ${user?.tag ?? 'Unknown'} (ID: ${user?.id ?? 'N/A'})`);

  const guilds = client.guilds.cache;
  logger.info(`Connected to ${guilds.size} guild(s):`);

  let index = 1;
  for (const [, guild] of guilds) {
    logger.info(`  ${index++}. "${guild.name}" (ID: ${guild.id}) — ${guild.memberCount} members`);
  }
  logger.divider();
}

export default {
  name: Events.ClientReady,
  once: true,
  execute,
};
