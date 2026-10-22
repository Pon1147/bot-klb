/**
 * Handler link tài khoản Delta Force HQ.
 *
 * Subcommands:
 * - start: Tạo claim code, gửi script qua DM, hướng dẫn user
 * - status: Kiểm tra trạng thái link (mask identifier, last_ok_at)
 * - manual: Fallback tech — user paste openid + token
 */

import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
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
import { getExtensionZipPath } from './extension.utils.js';

const logger = createLogger('DfLink');

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
      '## 🔗 Liên Kết Tài Khoản Delta Force (Garena)',
      '',
      `🔑 **Mã liên kết của bạn: \`${code}\`** *(Có hiệu lực trong 10 phút)*`,
      '',
      '### 📌 3 Bước Thực Hiện Nhanh (Dành cho người mới):',
      '**1. Cài tiện ích (Chỉ làm 1 lần trên máy tính):**',
      '• Tải tệp **`DF-Extension.zip`** (ở tin nhắn ngay bên dưới) và giải nén ra một thư mục.',
      '• Mở trình duyệt (Chrome/Cốc Cốc/Edge), truy cập `chrome://extensions/` (hoặc `edge://extensions/`).',
      '• Bật **Chế độ dành cho nhà phát triển** (**Developer mode**) ở góc phải -> Nhấn **Tải tiện ích đã giải nén** (**Load unpacked**) và chọn thư mục vừa giải nén.',
      '',
      '**2. Mở cổng sự kiện game chính thức:**',
      '• Bấm vào trang: [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) và đăng nhập nick Garena của bạn.',
      '',
      '**3. Nhập mã & Hoàn tất:**',
      `• Nhìn vào **góc dưới bên phải màn hình web**, bảng **"DF Toolbox"** sẽ tự động xuất hiện.`,
      `• Nhập mã **\`${code}\`** vào ô và bấm **"Liên kết Discord"**.`,
      '• Bot sẽ gửi tin nhắn xác nhận thành công ngay lập tức!',
      '',
      '---',
      '🛡️ **CAM KẾT AN TOÀN & BẢO MẬT 100%:**',
      '• **Không bao giờ hỏi mật khẩu:** Bạn chỉ đăng nhập trực tiếp trên cổng chính thức của Garena. Bot và tiện ích tuyệt đối **không xem, không hỏi và không lưu** mật khẩu hay mã OTP của bạn.',
      '• **Trang web chính chủ:** `playdeltaforce.com` là cổng sự kiện chính thức do Tencent Games & Garena quản lý.',
      '• **Mục đích:** Chỉ lấy mã định danh nhân vật (OpenID) để bot hiển thị K/D (`/df stats`), lịch sử đấu (`/df history`) và tự động nhận quà xưởng (`/df workshop`).',
      '',
      '> 💡 *Nếu bạn cần xem chi tiết từng bước bằng hình ảnh, hãy dùng lệnh `/df help` (chọn tab **🧩 Hướng Dẫn Liên Kết**).*',
    ].join('\n'),
  );
  await interaction.reply({
    components: info.toJSON(),
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);

  // Gửi file ZIP qua followUp vì Discord client không render generic file attachments trong Components V2
  if (files.length > 0) {
    await interaction.followUp({
      content:
        '📦 **Tệp cài đặt Tiện ích mở rộng Delta Force (Extension):**\n' +
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
          `> ⚠️ Đây là fallback manual. Nên dùng \`/df link start\` để link tự động qua extension.`,
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
        `> ⚠️ Encryption chưa khả dụng, lưu ở chế độ legacy. Nên dùng \`/df link start\` để link tự động qua extension.`,
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
