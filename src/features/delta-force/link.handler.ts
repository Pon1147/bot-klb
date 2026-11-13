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

/**
 * Entry point thực thi /df link.
 * Tự động phân nhánh:
 * - Nếu đã liên kết: Hiển thị thông tin binding hiện tại + hướng dẫn gỡ bằng /df unlink.
 * - Nếu chưa liên kết: Tự động sinh claim code + hiển thị hướng dẫn 2 bước kèm 3 nút tiện ích.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Kiểm tra xem user đã có binding chưa
  const binding = getActiveBinding(database, interaction.user.id);
  const legacyToken = !binding ? getDfToken(database, interaction.user.id) : null;

  if (binding || legacyToken) {
    return handleStatus(interaction, database);
  }

  // Chưa liên kết -> Tự động sinh claim code và gửi hướng dẫn
  return handleStart(interaction, database);
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
        '### 📌 3 Simple Steps:',
        '1️⃣ Click **"1. Open Garena Event Page"** below and log in to your official game account.',
        '2️⃣ Click **"2. Download DF Toolbox"** below, extract and install the extension into your browser (Chrome/Edge on PC, or Orion Browser / Kiwi Browser on Mobile).',
        `3️⃣ Refresh (F5) the Garena page ➔ Paste code **\`${code}\`** into the DF Toolbox panel ➔ Click **Link Discord**. Done!`,
        '',
        '### 🛡️ Security & Privacy Notice:',
        '> • **Direct Official Login**: You log in directly on Garena (`sso.garena.com`). The bot & extension **never** touch or store your password/OTP.',
        '> • **Limited Scope**: Operates only on the Delta Force event page. No Discord tokens, passwords, or external browsing data are ever accessed.',
        '> • **Data Protection**: Authentication token is encrypted with AES-256-GCM on the server.',
        '> • **Your Data, Your Control**: You can unlink and wipe your token anytime via `/df unlink`.',
      ].join('\n')
    : [
        '## 🔗 Liên Kết Tài Khoản Delta Force',
        '',
        `🔑 **Mã liên kết của bạn:** **\`${code}\`** *(Chạm vào mã để sao chép • Hiệu lực 10 phút)*`,
        '',
        '### 📌 3 Bước Thực Hiện Nhanh:',
        '1️⃣ Bấm nút **"1. Mở Cổng Sự Kiện Garena"** bên dưới và đăng nhập nick game của bạn.',
        '2️⃣ Bấm nút **"2. Tải Tiện Ích DF Toolbox"** bên dưới, giải nén và cài đặt vào trình duyệt (Chrome/Edge trên PC, hoặc Orion Browser / Kiwi Browser trên điện thoại).',
        `3️⃣ F5 tải lại trang Garena ➔ Dán mã **\`${code}\`** vào bảng DF Toolbox ở góc màn hình ➔ Bấm **Liên kết Discord**. Xong!`,
        '',
        '### 🛡️ Cam Kết An Toàn & Bảo Mật:',
        '> • **Đăng nhập Garena chính thức**: Bạn đăng nhập trực tiếp tại `sso.garena.com`. Bot và Tiện ích **tuyệt đối không bao giờ** hỏi hay lưu mật khẩu/OTP.',
        '> • **Phạm vi an toàn & minh bạch**: Tiện ích chỉ chạy trên trang sự kiện Delta Force để đọc access token, **tuyệt đối không đọc token Discord** hay dữ liệu duyệt web khác.',
        '> • **Bảo vệ dữ liệu xác thực**: Access token được mã hóa chuẩn quân đội AES-256-GCM trên máy chủ.',
        '> • **Toàn quyền kiểm soát**: Bạn có thể chủ động hủy liên kết và xóa dữ liệu bất kỳ lúc nào qua lệnh `/df unlink`.',
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
        `> ⚠️ Bạn nên dùng \`/df link\` để cập nhật lên hệ thống mới.`,
    );
    await sendReply(interaction, { components: info.toJSON() });
    return;
  }

  // Chưa link
  const info = buildInfoContainer('Bạn chưa liên kết tài khoản Delta Force.');
  await sendReply(interaction, { components: info.toJSON() });
}
