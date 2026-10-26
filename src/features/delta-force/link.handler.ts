/**
 * Handler link tài khoản Delta Force HQ.
 *
 * Subcommands:
 * - start: Tạo claim code, gửi script qua DM, hướng dẫn user
 * - status: Kiểm tra trạng thái link (mask identifier, last_ok_at)
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
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
import { getExtensionZipPath } from './extension.utils.js';

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

/** Subcommand `start` — tạo claim code, reply ephemeral với button reveal webhook URL */
async function handleStart(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const code = generateCode(database, interaction.user.id);

  const zipPath = getExtensionZipPath();
  const files = zipPath
    ? [
        new AttachmentBuilder(zipPath, {
          name: 'DF-Extension.zip',
          description: 'Tiện ích liên kết tài khoản Delta Force',
        }),
      ]
    : [];

  const info = buildInfoContainer(
    [
      '## 🔗 Hướng Dẫn Liên Kết Tài Khoản Delta Force (Garena)',
      '',
      '🛡️ **CAM KẾT AN TOÀN TUYỆT ĐỐI (100% Yên Tâm):**',
      '• **Không bao giờ hỏi mật khẩu:** Bạn chỉ đăng nhập tài khoản trực tiếp trên cổng Garena chính thức (`sso.garena.com`). Bot và tiện ích **tuyệt đối không xem, không hỏi và không lưu** mật khẩu hay mã OTP của bạn.',
      '• **Trang web chính chủ:** Cổng sự kiện `playdeltaforce.com` do Tencent Games & Garena trực tiếp quản lý.',
      '• **Mục đích duy nhất:** Chỉ kết nối mã nhân vật (OpenID) để bot hiển thị K/D (`/df stats`), lịch sử đấu (`/df history`) và tự động nhận quà xưởng (`/df workshop`).',
      '',
      '---',
      '',
      `🔑 **MÃ LIÊN KẾT CỦA BẠN:** **\`${code}\`** *(Bấm vào mã để sao chép • Hiệu lực 10 phút)*`,
      '',
      '---',
      '',
      '### 📌 3 Bước Thực Hiện Nhanh (Chỉ mất 1 phút):',
      '**1. Cài tiện ích vào trình duyệt (Chỉ cần làm 1 lần duy nhất trên máy tính):**',
      '• Tải tệp **`DF-Extension.zip`** ở tin nhắn bên dưới -> Nhấp chuột phải chọn **Extract All... (Giải nén)**.',
      '• Trên trình duyệt (Chrome, Cốc Cốc, Edge), vào địa chỉ: `chrome://extensions/`',
      '• Bật công tắc **Chế độ cho nhà phát triển** (**Developer mode**) ở góc trên bên phải.',
      '• Bấm nút **Tải tiện ích đã giải nén** (**Load unpacked**) ở góc trên bên trái -> Chọn thư mục bạn vừa giải nén.',
      '',
      '**2. Mở cổng sự kiện chính thức:**',
      '• Bấm nút **"🌐 1. Mở Cổng Sự Kiện Garena"** ở bên dưới và đăng nhập nick game của bạn.',
      '',
      '**3. Nhập mã & Hoàn tất:**',
      `• Bảng màu đen **"DF Toolbox"** sẽ tự động xuất hiện ở **góc dưới bên phải màn hình web**.`,
      `• Nhập mã **\`${code}\`** vào ô và bấm **"Liên kết Discord"**.`,
      '• ✨ Bot sẽ gửi tin nhắn chúc mừng thành công ngay lập tức!',
      '',
      '> 💡 *Nếu bạn cần xem chi tiết từng bước bằng hình ảnh, hãy dùng lệnh `/df help` (chọn tab **🧩 Hướng Dẫn Liên Kết**).*',
    ].join('\n'),
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🌐 1. Mở Cổng Sự Kiện Garena')
      .setURL('https://www.playdeltaforce.com/events/hq/vi/index.html'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('💬 2. Kênh Hỗ Trợ 1-1 (KLB Community)')
      .setURL('https://discord.gg/vz6w6c3Xe3'),
  );

  await interaction.reply({
    components: [...info.toJSON(), actionRow.toJSON()],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);

  // Gửi file ZIP qua followUp vì Discord client không render generic file attachments trong Components V2
  if (files.length > 0) {
    await interaction.followUp({
      content:
        '📦 **Tệp Cài Đặt Tiện Ích Mở Rộng (DF-Extension.zip):**\n' +
        '> 1. Tải tệp **`DF-Extension.zip`** đính kèm bên dưới về máy tính.\n' +
        '> 2. Nhấp chuột phải vào file đã tải -> Chọn **Extract All... (Giải nén)**.\n' +
        '> 3. Mở `chrome://extensions/` -> Bật **Developer mode** -> Chọn **Load unpacked** và chọn thư mục vừa giải nén.\n' +
        '> 🛡️ *Tệp cài đặt sạch 100%, chạy cục bộ trên máy và hoàn toàn không can thiệp vào tài khoản hay mật khẩu của bạn.*',
      files,
      flags: MessageFlags.Ephemeral,
    });
  }
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
