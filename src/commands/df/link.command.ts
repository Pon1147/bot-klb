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
import { getMyData } from '../../services/deltaforce.api.js';
import { saveDfToken } from '../../database/df.token.db.js';
import { setupTunnel, isTunnelAlive, stopTunnel } from '../../services/webhook-tunnel.js';

/** Strip tsc module boilerplate từ script compiled để chạy được trong browser console */
function getBrowserScript(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.includes('Object.defineProperty') && line.trim() !== '"use strict";')
    .join('\n')
    .trim();
}

/** Integrity check: script phải chứa comment gốc để phát hiện inject */
function verifyScriptIntegrity(src: string): void {
  if (!src.includes('Delta Force HQ') || !src.includes('DfTools')) {
    console.error('[Link] ⚠️ Script integrity check failed — possible tampering');
    throw new Error('Webhook script integrity verification failed');
  }
}

const RAW_SCRIPT = readFileSync(join(process.cwd(), 'dist', 'scraper', 'df-webhook.js'), 'utf8');
// Skip integrity check in test environment
if (process.env.NODE_ENV !== 'test') {
  verifyScriptIntegrity(RAW_SCRIPT);
}
const WEBHOOK_SCRIPT = getBrowserScript(RAW_SCRIPT);

/** Lấy webhook URL hiện tại (đọc env tại thời điểm gọi) */
function getWebhookUrl(): string {
  return process.env.WEBHOOK_URL ?? 'http://localhost:3500';
}

/** Đảm bảo tunnel chạy trước khi sinh script */
async function ensureTunnel(): Promise<void> {
  if (isTunnelAlive()) return;
  if (process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.startsWith('http://localhost')) {
    return; // localhost — không cần tunnel
  }
  if (process.env.WEBHOOK_URL) {
    // URL đã set nhưng tunnel chết — restart
    stopTunnel();
    delete process.env.WEBHOOK_URL;
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
  .setDescription('Liên kết tài khoản Delta Force HQ.')
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('Nhận script liên kết tự động (khuyến nghị)'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('manual')
      .setDescription('Liên kết bằng cách nhập openid + token')
      .addStringOption((opt) =>
        opt.setName('openid').setDescription('OpenID của tài khoản HQ').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('token').setDescription('Token authentication (hex)').setRequired(true),
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'manual':
      return handleManualLink(interaction, _database);
    case 'start':
    default:
      return handleWebhookFlow(interaction);
  }
}

/** Xử lý subcommand `manual` — user nhập openid + token manual */
async function handleManualLink(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const openid = interaction.options.getString('openid')!;
  const token = interaction.options.getString('token')!;

  // Validate format token (hex string 40-64 ký tự)
  if (!/^[0-9a-f]{40,64}$/i.test(token)) {
    const err = buildErrorContainer(
      'Format token không hợp lệ. Token phải là chuỗi hex (40-64 ký tự).',
    );
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Gọi API để validate token
    await getMyData({ openid, token });

    // Lưu token vào database
    saveDfToken(database, interaction.user.id, openid, token);

    await interaction.editReply({
      content: `✅ Đã liên kết tài khoản Delta Force!\n\n` +
        `OpenID: ${openid}`,
    });
  } catch (error: any) {
    console.error('[df-link] Manual link failed:', error.message ?? error);
    const err = buildErrorContainer(
      'Không thể xác thực tài khoản. Kiểm tra openid và token, hoặc token đã hết hạn.',
    );
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}

/** Xử lý webhook flow — gửi script cho user chạy trong browser console */
async function handleWebhookFlow(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Đảm bảo tunnel chạy với URL hiện tại
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
