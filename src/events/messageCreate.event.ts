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

  // Kiểm tra type
  const obj = data as Record<string, unknown>;
  if (obj?.type !== 'df_claim') {
    return;
  }

  // Kiểm tra secret
  if (obj?.secret !== botConfig.dfWebhookSecret) {
    logger.warn('Webhook secret mismatch — dropping message from webhook ' + message.webhookId);
    return;
  }

  logger.info('Webhook claim message received from webhook ' + message.webhookId);

  // Delegate to claim handler (atomic consume + encrypt + persist + DM)
  let result: { status: number; body: { ok: boolean; error?: string } };
  try {
    result = await handleClaim(data, client.database, client);
    logger.info('Webhook claim processed: status=' + result.status);
  } catch (error) {
    logger.error(
      'Webhook claim handler error: ' + (error instanceof Error ? error.message : String(error)),
    );
    result = { status: 500, body: { ok: false, error: 'server_error' } };
  }

  // Map lỗi chung — DM và public reply dùng chung 1 nguồn
  const claimErrorMap: Record<string, string> = {
    account_linked_to_other_discord: 'Account Garena này đã được link với Discord khác.',
    already_linked: 'Account này đã được link.',
  };

  // Nếu fail → gửi DM thông báo cho Discord user (extension không nhận được 409 từ webhook)
  if (!result.body.ok) {
    const claimRow = client.database
      .prepare('SELECT discord_user_id FROM df_claim_sessions WHERE code = ?')
      .get((data as { code: string }).code) as { discord_user_id: string } | undefined;
    if (claimRow) {
      const user = await client.users.fetch(claimRow.discord_user_id).catch(() => null);
      if (user) {
        const dm = await user.createDM().catch(() => null);
        if (dm) {
          const baseText =
            claimErrorMap[result.body.error || ''] || 'Lỗi không xác định. Thử lại sau.';
          const needsUnlinkAdvice =
            result.body.error === 'account_linked_to_other_discord' ||
            result.body.error === 'already_linked';
          await dm
            .send({
              content:
                '❌ **Liên kết thất bại:** ' +
                baseText +
                (needsUnlinkAdvice ? ' Vui lòng dùng `/df-unlink` trước.' : ''),
            })
            .catch(() => {});
        }
      }
    }
  }

  // Chỉ gửi khi fail — success message không cần hiển thị trong channel
  if (!result.body.ok) {
    const resultText =
      'Claim failed: ' +
      (claimErrorMap[result.body.error || ''] || 'Lỗi không xác định. Thử lại sau.');
    try {
      // Fetch webhook để lấy token (Message object không expose webhookToken)
      const webhookData = (await client.rest.get(`/webhooks/${message.webhookId}`)) as {
        token: string;
      };
      const webhookUrl = `https://discord.com/api/webhooks/${message.webhookId}/${webhookData.token}`;

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: resultText }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      logger.warn(
        'Failed to send webhook follow-up: ' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // Xóa webhook message gốc (không hiển thị raw JSON cho user)
  void message.delete().catch(() => {});
}

export default {
  name: 'messageCreate',
  once: false,
  execute,
};
