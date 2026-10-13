import { Client, Events } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { isIgnorableInteractionError } from '../utils/discord-error.utils.js';

const logger = createLogger('DiscordClient');

/**
 * Xử lý lỗi toàn cục từ Discord Client (Events.Error).
 * Ngăn Node.js EventEmitter kích hoạt unhandled 'error' event làm crash process.
 */
export async function execute(_client: Client, error: Error): Promise<void> {
  if (isIgnorableInteractionError(error)) {
    logger.debug(`[ClientError] Bỏ qua lỗi interaction hết hạn: ${error.message}`);
    return;
  }

  logger.error('[ClientError] Lỗi phát sinh từ Discord client:', {
    message: error?.message ?? String(error),
    stack: error?.stack,
  });
}

export default {
  name: Events.Error,
  once: false,
  execute,
};
