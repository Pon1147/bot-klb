import { Client, Message } from 'discord.js';
import { botConfig } from '../config/bot.config.js';
import { handleClaim } from '../services/df-claim-handler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MessageCreate');

/**
 * Handle messageCreate event: lắng nghe Discord Webhook handoff messages.
 *
 * Extension POST payload vào Discord Webhook URL → message xuất hiện trong channel.
 * Bot validate → atomic claim → encrypt → persist → DM user.
 *
 * Arg đầu tiên luôn là `client` (được bind từ event handler).
 */
export async function execute(client: Client, message: Message): Promise<void> {
  // Guard: chỉ xử lý message từ channel cấu hình
  if (!botConfig.dfLinkChannelId || message.channelId !== botConfig.dfLinkChannelId) {
    return;
  }

  // Guard: chỉ xử lý message từ webhook
  if (!message.webhookId) {
    return;
  }

  // Parse JSON payload
  let data: unknown;
  try {
    data = JSON.parse(message.content);
  } catch {
    return; // không phải JSON → bỏ qua
  }

  // Validate type
  const obj = data as Record<string, unknown>;
  if (obj?.type !== 'df_claim') {
    return;
  }

  // Validate secret
  if (obj?.secret !== botConfig.dfWebhookSecret) {
    logger.warn('Webhook secret mismatch — dropping message from webhook ' + message.webhookId);
    return;
  }

  logger.info('Webhook claim message received from webhook ' + message.webhookId);

  // Delegate to claim handler (atomic consume + encrypt + persist + DM)
  try {
    const result = await handleClaim(data, client.database, client);
    logger.info('Webhook claim processed: status=' + result.status);
  } catch (error) {
    logger.error(
      'Webhook claim handler error: ' + (error instanceof Error ? error.message : String(error)),
    );
  } finally {
    // Xóa webhook message khỏi channel (không hiển thị raw JSON cho user)
    void message.delete().catch(() => {});
  }
}

export default {
  name: 'messageCreate',
  once: false,
  execute,
};
