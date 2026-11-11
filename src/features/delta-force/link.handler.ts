/**
 * Handler link tài khoản Delta Force HQ.
 *
 * Subcommands:
 * - start: Tạo claim code, reply ephemeral trực quan gọn gàng, hỗ trợ nút tải extension on-demand
 * - status: Kiểm tra trạng thái link (mask identifier, last_ok_at)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildInfoContainer } from '../../utils/container.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { generateCode } from '../../services/df-claim-store.js';
import { getActiveBinding } from '../../database/df-binding.db.js';
import { getDfToken } from '../../database/df.token.db.js';
import { sendReply } from '../../utils/reply.utils.js';
import { maskString } from '../../utils/string.utils.js';
import { resolveUserLocale } from '../../infrastructure/i18n/locale-resolver.js';

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
  }
}

/** Subcommand `start` — tạo claim code, reply ephemeral trực quan cho non-tech users */
async function handleStart(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const code = generateCode(database, interaction.user.id);
  const locale = resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';

  const textContent = isEn
    ? [
        '## 🔗 Delta Force Account Linking',
        '',
        `🔑 **Your Link Code:** **\`${code}\`** *(Tap to copy • Valid for 10 minutes)*`,
        '',
        '### 📌 2 Quick Steps (Takes 30 seconds):',
        '1️⃣ Click **"1. Open Garena Event Page"** below and log in to your game account.',
        `2️⃣ The **DF Toolbox** panel will pop up in the corner ➔ Paste code **\`${code}\`** ➔ Click **Link Discord**. Done!`,
        '',
        '> ⚠️ *Notice: This linking step requires a computer (PC/Laptop) with Chrome/Edge browser.*',
        '> 💡 *First time and don’t have the extension yet? Click **"Download Extension"** below or see the visual guide in `/df help`.*',
      ].join('\n')
    : [
        '## 🔗 Liên Kết Tài Khoản Delta Force',
        '',
        `🔑 **Mã liên kết của bạn:** **\`${code}\`** *(Chạm vào mã để sao chép • Hiệu lực 10 phút)*`,
        '',
        '### 📌 2 Bước Thực Hiện Nhanh (Chỉ mất 30 giây):',
        '1️⃣ Bấm nút **"1. Mở Cổng Sự Kiện Garena"** bên dưới và đăng nhập nick game.',
        `2️⃣ Bảng **DF Toolbox** sẽ hiện ở góc màn hình web ➔ Dán mã **\`${code}\`** ➔ Bấm **Liên kết Discord**. Xong!`,
        '',
        '> ⚠️ *Lưu ý: Thao tác liên kết này cần thực hiện trên máy tính (PC/Laptop) dùng trình duyệt Chrome/Edge.*',
        '> 💡 *Bạn mới dùng lần đầu và chưa có tiện ích? Bấm nút **"Tải Tiện Ích"** bên dưới (hoặc gõ `/df help` để xem hình ảnh hướng dẫn).*',
      ].join('\n');

  const info = buildInfoContainer(textContent);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(isEn ? '🌐 1. Open Garena Event Page' : '🌐 1. Mở Cổng Sự Kiện Garena')
      .setURL('https://www.playdeltaforce.com/events/hq/vi/index.html'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`df_help:dl:${interaction.user.id}:${locale}`)
      .setLabel(isEn ? '📥 2. Download Extension' : '📥 2. Tải Tiện Ích DF Toolbox'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(isEn ? '💬 3. 1-on-1 Support' : '💬 3. Kênh Hỗ Trợ 1-1')
      .setURL('https://discord.gg/vz6w6c3Xe3'),
  );

  await interaction.reply({
    components: [...info.toJSON(), actionRow.toJSON()],
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
        `> ⚠️ Bạn nên dùng \`/df link start\` để cập nhật lên hệ thống mới.`,
    );
    await sendReply(interaction, { components: info.toJSON() });
    return;
  }

  // Chưa link
  const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force.');
  await sendReply(interaction, { components: info.toJSON() });
}
