import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { generateCode } from '../../services/df-claim-store.js';
import { setupTunnel, getTunnelUrl, stopTunnel } from '../../services/webhook-tunnel.js';

/**
 * Read compiled df-webhook.js and strip tsc-injected module boilerplate
 * (Object.defineProperty / "use strict") so the IIFE runs in a browser console.
 */
function getBrowserScript(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.includes('Object.defineProperty') && line.trim() !== '"use strict";')
    .join('\n')
    .trim();
}

const WEBHOOK_SCRIPT = getBrowserScript(
  readFileSync(join(process.cwd(), 'dist', 'scraper', 'df-webhook.js'), 'utf8'),
);

/** Get current webhook URL (reads from env at call time) */
function getWebhookUrl(): string {
  return process.env.WEBHOOK_URL ?? 'http://localhost:3500';
}

/** Ensure tunnel is running before generating script */
async function ensureTunnel(): Promise<void> {
  if (process.env.WEBHOOK_URL && !process.env.WEBHOOK_URL.startsWith('http://localhost')) {
    if (getTunnelUrl()) return; // Tunnel alive
    // Tunnel process died — stop old and restart with fresh URL
    stopTunnel();
    delete process.env.WEBHOOK_URL;
  } else if (!process.env.WEBHOOK_URL) {
    // No URL set at all — setup tunnel
  } else {
    return; // localhost — no tunnel needed
  }
  try {
    const webhookPort = parseInt(process.env.WEBHOOK_PORT ?? '3500', 10);
    await setupTunnel(webhookPort);
  } catch (e) {
    console.error('[Tunnel] Failed to restart:', e);
  }
}

export const data = new SlashCommandBuilder()
  .setName('df-link')
  .setDescription('Liên kết tài khoản Delta Force HQ.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Ensure tunnel is running with current URL
  await ensureTunnel();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const code = generateCode(interaction.user.id);

    const scriptContent = WEBHOOK_SCRIPT.replace(/@@WEBHOOK_URL@@/g, getWebhookUrl()).replace(
      /@@CLAIM_CODE@@/g,
      code,
    );

    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      content:
        '**Liên kết tài khoản Delta Force**\n\n' +
        `**Mã claim: \`${code}\`** (hết hạn sau 10 phút)\n\n` +
        '1. Truy cập [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html)\n' +
        '2. Đăng nhập tài khoản → chờ trang load xong\n' +
        '3. Copy toàn bộ nội dung file `df-link-script.js` bên dưới\n' +
        '4. Bấm **F12** → tab **Console** → paste → Enter\n' +
        '5. Script tự tìm token & gửi về bot — chờ DM xác nhận!\n' +
        '6. Nếu Console hiện "chưa tìm thấy" → nhấn vài nút trên trang → script sẽ capture khi có API call',
      files: [
        new AttachmentBuilder(Buffer.from(scriptContent, 'utf8'), {
          name: 'df-link-script.js',
        }),
      ],
    });

    await interaction.editReply({
      content: `Script đã gửi qua DM. Mã claim: \`${code}\` — hết hạn sau 10 phút.`,
    });
  } catch (error) {
    console.error('Error in /df-link:', error);
    if (!interaction.replied && !interaction.deferred) {
      const err = buildErrorContainer('Không thể gửi DM. Hãy mở tin nhắn trong Server Settings.');
      await interaction.reply({
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
      });
    } else {
      await interaction
        .editReply({ content: 'Lỗi khi gửi script. Xem console log.' })
        .catch(() => {});
    }
  }
}
