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
  ActionRowBuilder,
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
import { upsertAccountBinding } from '../../database/df-binding.db.js';
import { getDfToken } from '../../database/df.token.db.js';
import { saveDfToken } from '../../database/df.token.db.js';
import { TOKEN_REGEX, INVALID_TOKEN_MESSAGE } from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';
import { sendReply } from '../../utils/reply.utils.js';
import { maskString } from '../../utils/string.utils.js';
import { encryptCredential } from '../../services/df-crypto.js';

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
      return handleStart(interaction, database);
    case 'status':
      return handleStatus(interaction, database);
    case 'unlink':
      return handleUnlink(interaction, database);
    case 'manual':
      return handleManual(interaction, database);
  }
}

/** Subcommand `start` — tạo claim code, reply ephemeral với button reveal webhook URL */
async function handleStart(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const code = generateCode(database, interaction.user.id);

  // Xây button để hiển thị webhook URL (ephemeral reply, button disable sau click)
  const revealButton = new ButtonBuilder()
    .setCustomId('df_link_show_webhook')
    .setLabel('Hiện Webhook URL')
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(revealButton);

  const info = buildInfoContainer(
    `**Liên kết tài khoản Delta Force**\n\n` +
      `**Mã claim: \`${code}\`** (hết hạn sau 10 phút)\n\n` +
      '1. Mở [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) → đăng nhập\n' +
      '2. Mở extension → popup → paste Webhook URL → Lưu\n' +
      '3. Tab **Link** → dán mã claim → bấm **Liên kết Discord**\n' +
      '4. Chờ DM "Linked OK" từ bot\n\n' +
      '> Nhấn button bên dưới để hiện Webhook URL (chỉ hiện 1 lần)',
  );
  await interaction.reply({
    components: [...info.toJSON(), row.toJSON()],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
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
    const masked = maskString(binding.openid);
    const lastOk = binding.last_ok_at
      ? `Last OK: ${binding.last_ok_at}`
      : 'Chưa có request thành công';
    const info = buildInfoContainer(
      `**Đã liên kết tài khoản Delta Force!**\n\n` +
        `OpenID: ${masked}\n` +
        `Trạng thái: ${binding.status}\n` +
        lastOk,
    );
    await sendReply(interaction, { components: info.toJSON() });
    return;
  }

  // Fallback: kiểm tra legacy df_tokens
  const legacyToken = getDfToken(database, interaction.user.id);
  if (legacyToken) {
    const masked = maskString(legacyToken.openid);
    const info = buildInfoContainer(
      `**Đã liên kết (legacy)**\n\n` +
        `OpenID: ${masked}\n` +
        `Liên kết lúc: ${legacyToken.linked_at}\n\n` +
        `> ⚠️ Bạn nên dùng \`/df-link start\` để cập nhật lên hệ thống mới.`,
    );
    await sendReply(interaction, { components: info.toJSON() });
    return;
  }

  // Chưa link
  const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force.');
  await sendReply(interaction, { components: info.toJSON() });
}

/** Subcommand `unlink` — deprecate, redirect sang /df-unlink */
async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  const info = buildInfoContainer(
    'Subcommand này đã được deprecated. Vui lòng dùng `/df-unlink` để hủy liên kết.',
  );
  await sendReply(interaction, { components: info.toJSON() });
}

/** Subcommand `manual` — fallback user paste openid + token */
async function handleManual(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const openid = interaction.options.getString('openid')!;
  const token = interaction.options.getString('token')!;

  // Kiểm tra định dạng token
  if (!TOKEN_REGEX.test(token)) {
    await sendReply(interaction, {
      components: buildErrorContainer(INVALID_TOKEN_MESSAGE).toJSON(),
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Thử lưu vào encrypted binding (canonical store)
    try {
      const encrypted = encryptCredential(
        JSON.stringify({ token, ts: null, s: null, u: null }),
        interaction.user.id,
        openid,
      );
      upsertAccountBinding(
        database,
        interaction.user.id,
        openid,
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.tag,
      );
      const successResult = buildSuccessContainer(
        `Đã lưu thông tin liên kết!\n\n` +
          `OpenID: ${openid}\n\n` +
          `> ⚠️ Đây là fallback manual. Nên dùng \`/df-link start\` để link tự động qua extension.`,
      );
      await interaction.editReply({
        components: successResult.toJSON(),
      });
      return;
    } catch (encryptError: unknown) {
      // Crypto key chưa được init → fallback legacy
      logger.warn(
        'Manual link: encryption unavailable, fallback to legacy: ' +
          (encryptError instanceof Error ? encryptError.message : String(encryptError)),
      );
    }

    // Fallback: lưu vào legacy DB
    saveDfToken(database, interaction.user.id, openid, token);

    const successResult = buildSuccessContainer(
      `Đã lưu thông tin liên kết!\n\n` +
        `OpenID: ${openid}\n\n` +
        `> ⚠️ Encryption chưa khả dụng, lưu ở chế độ legacy. Nên dùng \`/df-link start\` để link tự động qua extension.`,
    );
    await interaction.editReply({
      components: successResult.toJSON(),
    });
  } catch (error: unknown) {
    logger.error('Manual link failed: ' + (error instanceof Error ? error.message : String(error)));
    const err = buildErrorContainer('Không thể lưu thông tin liên kết. Kiểm tra openid và token.');
    await interaction.editReply({ components: err.toJSON() });
  }
}
