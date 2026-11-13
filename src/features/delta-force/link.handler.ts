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
  ButtonInteraction,
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
import { resolveUserLocale, SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { TTLStore } from '../../utils/ttl-store.js';

/** Cooldown store: giới hạn bấm làm mới mã tối thiểu 5s/lần để chống spam Discord API */
const refreshCooldownStore = new TTLStore<string, { expiresAt: number }>({
  ttlMs: 5_000,
  cleanupIntervalMs: 60_000,
  name: 'LinkRefreshCooldown',
});

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

/**
 * Tạo payload trực quan, ngắn gọn cho quy trình liên kết Delta Force.
 * Gồm 1 Container (3 bước siêu gọn) + 2 ActionRows (Thao tác chính & Trợ giúp/Bảo mật).
 */
export function buildLinkPayload(code: string, userId: string, locale: SupportedLocale) {
  const isEn = locale === 'en';

  const textContent = isEn
    ? [
        '## 🔗 Delta Force Account Linking',
        `🔑 Your code: **\`${code}\`** *(long-press code to copy • valid for 10 minutes)*`,
        '',
        '1️⃣ Open Garena event page, log in normally',
        '2️⃣ Install **DF Toolbox** extension',
        '3️⃣ Press F5, paste code into DF Toolbox, click **Link**',
        '',
        '> 🔒 *Bot never asks for password/OTP. Unlink anytime via `/df unlink`.*',
      ].join('\n')
    : [
        '## 🔗 Liên kết tài khoản Delta Force',
        `🔑 Mã của bạn: **\`${code}\`** *(nhấn giữ mã để sao chép • hiệu lực 10 phút)*`,
        '',
        '1️⃣ Mở cổng Garena, đăng nhập như bình thường',
        '2️⃣ Cài tiện ích **DF Toolbox**',
        '3️⃣ Bấm F5, dán mã vào hộp DF Toolbox, bấm **Liên kết**',
        '',
        '> 🔒 *Bot không bao giờ hỏi mật khẩu/OTP. Hủy liên kết bất kỳ lúc nào bằng `/df unlink`.*',
      ].join('\n');

  const info = buildInfoContainer(textContent);

  // Row 1: Thao tác chính
  const mainRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(isEn ? '🌐 1. Open Garena Page' : '🌐 1. Mở Cổng Garena')
      .setURL('https://www.playdeltaforce.com/events/hq/vi/index.html'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`df_help:dl:${userId}:${locale}`)
      .setLabel(isEn ? '📥 2. Download Extension' : '📥 2. Tải Tiện Ích'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`df_link:refresh:${userId}:${locale}`)
      .setLabel(isEn ? '🔄 Get New Code' : '🔄 Lấy Mã Mới'),
  );

  // Row 2: Hỗ trợ & Giải thích an toàn
  const subRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`df_link:mobile:${userId}:${locale}`)
      .setLabel(isEn ? '📱 Mobile Guide' : '📱 Hướng Dẫn Điện Thoại'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`df_link:safety:${userId}:${locale}`)
      .setLabel(isEn ? '🛡️ Is It Safe?' : '🛡️ Có An Toàn Không?'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(isEn ? '💬 Support' : '💬 Hỗ Trợ')
      .setURL('https://discord.gg/vz6w6c3Xe3'),
  );

  return [...info.toJSON(), mainRow.toJSON(), subRow.toJSON()];
}

/** Subcommand `start` — tạo claim code, reply ephemeral trực quan cho non-tech users */
async function handleStart(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const code = generateCode(database, interaction.user.id);
  const locale = resolveUserLocale({ locale: interaction.locale });
  const components = buildLinkPayload(code, interaction.user.id, locale);

  await interaction.reply({
    components,
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as any);
}

/**
 * Xử lý các button interactions của hệ thống link tài khoản (`df_link:*`).
 */
export async function handleLinkButton(
  interaction: ButtonInteraction,
  database: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('df_link:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const action = parts[1];
  const callerUserId = parts[2];
  const locale = (parts[3] as SupportedLocale) || resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';

  // User Isolation Guard: Chỉ người gọi lệnh mới thao tác được
  if (callerUserId && interaction.user.id !== callerUserId) {
    await interaction.reply({
      content: isEn
        ? 'You cannot interact with another user’s linking session.'
        : 'Bạn không thể thao tác trên bảng liên kết của người khác.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 1. Nút lấy mã mới: kiểm tra cooldown 5s và cập nhật ngay trên message hiện tại
  if (action === 'refresh') {
    const cooldown = refreshCooldownStore.get(interaction.user.id);
    if (cooldown) {
      const remainingSec = Math.max(1, Math.ceil((cooldown.expiresAt - Date.now()) / 1000));
      await interaction.reply({
        content: isEn
          ? `⏳ Please wait ${remainingSec}s before generating a new code.`
          : `⏳ Vui lòng đợi ${remainingSec} giây trước khi lấy mã mới.`,
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    refreshCooldownStore.set(interaction.user.id, {
      expiresAt: Date.now() + 5_000,
    });

    const newCode = generateCode(database, interaction.user.id);
    const components = buildLinkPayload(newCode, interaction.user.id, locale);
    await interaction.update({
      components,
    } as any);
    return { handled: true };
  }

  // 2. Nút hướng dẫn điện thoại: giải thích ngắn gọn cách cài trên Orion / Kiwi
  if (action === 'mobile') {
    const mobileText = isEn
      ? [
          '### 📱 Mobile Setup Guide (Orion / Kiwi Browser)',
          '• **iPhone / iPad:** Use **Orion Browser** (supports Chrome extensions via App Store).',
          '• **Android:** Use **Kiwi Browser** (supports Chrome extensions via Google Play).',
          '',
          '1️⃣ Tap **"2. Download Extension"** on the menu to get `DF-Extension.zip`.',
          '2️⃣ Open Extension Manager (`chrome://extensions` or browser menu) ➔ Enable **Developer mode** ➔ Load the zip file.',
          '3️⃣ Open Garena event page in that browser, log in and link normally.',
        ].join('\n')
      : [
          '### 📱 Hướng Dẫn Cài Đặt Trên Điện Thoại (Orion / Kiwi Browser)',
          '• **iPhone / iPad:** Dùng trình duyệt **Orion Browser** (hỗ trợ tiện ích Chrome trên App Store).',
          '• **Android:** Dùng trình duyệt **Kiwi Browser** (hỗ trợ tiện ích Chrome trên Google Play).',
          '',
          '1️⃣ Bấm nút **"2. Tải Tiện Ích"** ở menu để tải tệp `DF-Extension.zip`.',
          '2️⃣ Mở trang quản lý Tiện ích (`chrome://extensions` hoặc menu trình duyệt) ➔ Bật **Developer mode** ➔ Nạp tệp zip.',
          '3️⃣ Vào cổng sự kiện Garena bằng trình duyệt đó, đăng nhập và liên kết như bình thường.',
        ].join('\n');

    await interaction.reply({
      content: mobileText,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 3. Nút giải thích bảo mật: trung thực, dễ hiểu, không thuật ngữ đe dọa
  if (action === 'safety') {
    const safetyText = isEn
      ? [
          '### 🛡️ Is DF Toolbox Safe?',
          '• **Limited Scope**: The extension only operates on Delta Force event pages (`playdeltaforce.com`) and redeem pages (`redeem.df.garena.sg`). It **does not run on Garena SSO login pages** and has **no access** to Discord or any other external websites.',
          '• **Zero Password Access**: You log in securely on Garena’s official auth portal. The bot & extension **never** touch, see, or store your password or OTP.',
          '• **Encrypted Storage**: Authentication session data is encrypted when stored on our server.',
          '• **Full Control**: You can revoke account link anytime via `/df unlink`.',
        ].join('\n')
      : [
          '### 🛡️ DF Toolbox Có An Toàn Không?',
          '• **Phạm vi hoạt động**: Tiện ích chỉ hoạt động trên trang sự kiện Delta Force (`playdeltaforce.com`) và trang đổi mã (`redeem.df.garena.sg`). **Hoàn toàn không chạy trên trang đăng nhập SSO Garena** và không có quyền truy cập Discord hay bất kỳ trang web nào khác.',
          '• **Tuyệt đối không đụng mật khẩu**: Bạn đăng nhập an toàn trực tiếp trên cổng Garena. Tiện ích và bot **tuyệt đối không bao giờ** thấy, hỏi hay lưu mật khẩu hoặc OTP.',
          '• **Mã hóa khi lưu**: Dữ liệu phiên đăng nhập được mã hóa an toàn khi lưu trữ trên máy chủ.',
          '• **Toàn quyền hủy**: Bạn có thể chủ động hủy liên kết bất kỳ lúc nào bằng lệnh `/df unlink`.',
        ].join('\n');

    await interaction.reply({
      content: safetyText,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  return { handled: false };
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
