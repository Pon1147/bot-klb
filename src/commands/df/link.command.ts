/**
 * Slash command /df-link — link tài khoản Delta Force HQ.
 *
 * Subcommands:
 * - start: Tạo claim code, gửi script qua DM, hướng dẫn user
 * - status: Kiểm tra trạng thái link (mask identifier, last_ok_at)
 * - unlink: Hủy liên kết (revoked binding)
 * - manual: Fallback tech — user paste openid + token
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildErrorContainer,
  buildInfoContainer,
  buildSuccessContainer,
} from '../../utils/container.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { generateCode } from '../../services/df-claim-store.js';
import { getActiveBinding } from '../../database/df-binding.db.js';
import { getDfToken } from '../../database/df.token.db.js';
import { saveDfToken } from '../../database/df.token.db.js';
import { revokeBinding } from '../../database/df-binding.db.js';
import { TOKEN_REGEX, INVALID_TOKEN_MESSAGE } from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('DfLink');

export const data = new SlashCommandBuilder()
  .setName('df-link')
  .setDescription('Liên kết / kiểm tra / hủy tài khoản Delta Force HQ.')
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Tạo mã claim và gửi hướng dẫn qua DM.'),
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Kiểm tra trạng thái liên kết hiện tại.'),
  )
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Hủy liên kết tài khoản Delta Force.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('manual')
      .setDescription('Liên kết bằng cách nhập openid + token (fallback).')
      .addStringOption((opt) =>
        opt.setName('openid').setDescription('OpenID của tài khoản HQ').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('token').setDescription('Token authentication (hex)').setRequired(true),
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'start':
      return handleStart(interaction);
    case 'status':
      return handleStatus(interaction, database);
    case 'unlink':
      return handleUnlink(interaction, database);
    case 'manual':
      return handleManual(interaction, database);
  }
}

/** Subcommand `start` — tạo claim code, reply in-channel với button reveal webhook URL */
async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  if (await requireGuild(interaction)) return;

  const code = generateCode(interaction.user.id);

  // Build button để reveal webhook URL (ephemeral, 5s auto-delete)
  const revealButton = new ButtonBuilder()
    .setCustomId('df-link:reveal-webhook')
    .setLabel('🔓 Mở khóa Webhook URL')
    .setStyle(ButtonStyle.Primary);

  await interaction.reply({
    content:
      `**Liên kết tài khoản Delta Force**\n\n` +
      `**Mã claim: \`${code}\`** (hết hạn sau 10 phút)\n\n` +
      '1. Mở [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) → đăng nhập\n' +
      '2. Mở extension → popup → paste Webhook URL → Lưu\n' +
      '3. Tab **Link** → dán mã claim → bấm **Liên kết Discord**\n' +
      '4. Chờ DM "Linked OK" từ bot\n\n' +
      '> 🔒 Click button bên dưới để hiện Webhook URL (tự xóa sau 5s)\n' +
      '> ⚠️ Chưa cài extension: `chrome://extensions` → Developer mode → Load unpacked → `garena-redeem-code`',
    components: [revealButton.toJSON()],
    flags: MessageFlags.Ephemeral,
  });
}

/** Subcommand `status` — kiểm tra trạng thái liên kết */
async function handleStatus(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Kiểm tra binding mới (encrypted)
  const binding = getActiveBinding(database, interaction.user.id);
  if (binding) {
    const masked =
      binding.openid.length > 8
        ? `${binding.openid.slice(0, 4)}****${binding.openid.slice(-4)}`
        : '****';
    const lastOk = binding.last_ok_at
      ? `Last OK: ${binding.last_ok_at}`
      : 'Chưa có request thành công';
    const info = buildInfoContainer(
      `**Đã liên kết tài khoản Delta Force!**\n\n` +
        `OpenID: ${masked}\n` +
        `Trạng thái: ${binding.status}\n` +
        lastOk,
    );
    await interaction.reply({
      components: info.toJSON(),
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  // Fallback: kiểm tra legacy df_tokens
  const legacyToken = getDfToken(database, interaction.user.id);
  if (legacyToken) {
    const masked =
      legacyToken.openid.length > 8
        ? `${legacyToken.openid.slice(0, 4)}****${legacyToken.openid.slice(-4)}`
        : '****';
    const info = buildInfoContainer(
      `**Đã liên kết (legacy)**\n\n` +
        `OpenID: ${masked}\n` +
        `Liên kết lúc: ${legacyToken.linked_at}\n\n` +
        `> ⚠️ Bạn nên dùng \`/df-link start\` để cập nhật lên hệ thống mới.`,
    );
    await interaction.reply({
      components: info.toJSON(),
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  // Chưa link
  const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: info.toJSON(),
    flags: info.flags | MessageFlags.Ephemeral,
  });
}

/** Subcommand `unlink` — hủy liên kết */
async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Kiểm tra xem có binding nào không
  const binding = getActiveBinding(database, interaction.user.id);
  const legacyToken = getDfToken(database, interaction.user.id);

  if (!binding && !legacyToken) {
    const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force.');
    await interaction.reply({
      components: info.toJSON(),
      flags: info.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  // Revoke binding mới
  if (binding) {
    revokeBinding(database, interaction.user.id);
  }

  // Xóa legacy token
  if (legacyToken) {
    database.prepare('DELETE FROM df_tokens WHERE discord_id = ?').run(interaction.user.id);
  }

  const result = buildSuccessContainer('Đã hủy liên kết tài khoản Delta Force.');
  await interaction.reply({
    components: result.toJSON(),
    flags: result.flags | MessageFlags.Ephemeral,
  });
}

/** Subcommand `manual` — fallback user paste openid + token */
async function handleManual(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const openid = interaction.options.getString('openid')!;
  const token = interaction.options.getString('token')!;

  // Validate format token
  if (!TOKEN_REGEX.test(token)) {
    const err = buildErrorContainer(INVALID_TOKEN_MESSAGE);
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Lưu token vào legacy DB (mới sẽ dùng claim API)
    saveDfToken(database, interaction.user.id, openid, token);

    const successResult = buildSuccessContainer(
      `Đã lưu thông tin liên kết!\n\n` +
        `OpenID: ${openid}\n\n` +
        `> ⚠️ Đây là fallback manual. Nên dùng \`/df-link start\` để link tự động qua extension.`,
    );
    await interaction.editReply({
      components: successResult.toJSON(),
      flags: successResult.flags | MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    logger.error('Manual link failed: ' + (error instanceof Error ? error.message : String(error)));
    const err = buildErrorContainer('Không thể lưu thông tin liên kết. Kiểm tra openid và token.');
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
