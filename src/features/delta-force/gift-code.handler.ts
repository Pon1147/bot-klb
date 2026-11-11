/**
 * Handler slash command: /df gift-code
 * Cung cấp gói 280 mã giftcode Garena tân thủ và công cụ tự động nhận quà cho thành viên mới.
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
import { sendReply } from '../../utils/reply.utils.js';
import { resolveUserLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { STARTER_GIFT_CODES } from './giftcodes.data.js';

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  // RBAC Guard: Lệnh dành cho mọi thành viên trong server (chỉ yêu cầu guild context)
  if (await requireGuild(interaction)) return;

  const locale = resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';
  const count = STARTER_GIFT_CODES.length;

  const textContent = isEn
    ? [
        `## 🎁 ${count} Starter Delta Force Giftcodes`,
        '',
        `Welcome to the server! Here is the complete pack of **${count} Garena giftcodes** (weapons, skins, EXP & resources).`,
        '',
        `### ⚡ 2 Quick Steps (Auto Redeem All ${count} Codes):`,
        '1️⃣ Install the **DF Toolbox** extension (button below). All codes are preloaded.',
        `2️⃣ Click **"1. Open Redeem Page"** ➔ The extension will automatically input and redeem all ${count} codes with a single click!`,
        '',
        `📄 *To view or copy the raw codes manually, download the attached \`DF-Giftcodes-${count}.txt\` below.*`,
        '> 💡 *Tip: If you previously installed the extension and have an older custom list, open popup ➔ **Editor** ➔ paste from the attached file ➔ **Save Codes**.*',
      ].join('\n')
    : [
        `## 🎁 Danh Sách ${count} Mã Giftcode Tân Thủ Delta Force`,
        '',
        `Chào mừng bạn đến với server! Dưới đây là gói tổng hợp **${count} mã quà tặng Garena** (vũ khí, skin, EXP & nguyên liệu).`,
        '',
        '### ⚡ 2 Bước Nhận Quà Tự Động (Không cần nhập thủ công):',
        `1️⃣ Cài tiện ích **DF Toolbox** (bấm nút bên dưới). Tiện ích đã nạp sẵn toàn bộ ${count} mã này.`,
        `2️⃣ Bấm **"1. Mở Trang Nhập Code Garena"** ➔ Tiện ích sẽ tự động điền và nhận toàn bộ ${count} mã chỉ với 1 click!`,
        '',
        `📄 *Nếu bạn muốn tự nhập hoặc dùng tool riêng, toàn bộ danh sách ${count} mã đã được đính kèm trong tệp \`DF-Giftcodes-${count}.txt\` bên dưới.*`,
        '> 💡 *Mẹo: Nếu bạn đã cài tiện ích từ trước mà danh sách cũ chưa cập nhật, mở popup ➔ mục **Soạn thảo** ➔ dán các mã từ tệp đính kèm ➔ bấm **Save Codes**.*',
      ].join('\n');

  const container = buildInfoContainer(textContent);

  // ActionRow tiện ích: 1 link Redeem + 1 nút tải extension on-demand + 1 link hỗ trợ
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(isEn ? '1. Open Redeem Page' : '1. Mở Trang Nhập Code Garena')
      .setURL('https://redeem.df.garena.sg/en/cdkgarena.html')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🎁'),
    new ButtonBuilder()
      .setCustomId(`df_help:dl:${interaction.user.id}:${locale}`)
      .setLabel(isEn ? '2. Download DF Toolbox' : '2. Tải Tiện Ích DF Toolbox')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📦'),
    new ButtonBuilder()
      .setLabel(isEn ? '1-on-1 Support' : 'Hỗ Trợ 1:1 (Discord)')
      .setURL('https://discord.gg/vz6w6c3Xe3')
      .setStyle(ButtonStyle.Link)
      .setEmoji('💬'),
  );

  const rawText = STARTER_GIFT_CODES.join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(rawText, 'utf-8'), {
    name: `DF-Giftcodes-${count}.txt`,
    description: isEn
      ? `${count} Garena Delta Force starter giftcodes`
      : `Danh sách ${count} mã giftcode Garena Delta Force tân thủ`,
  });

  await sendReply(interaction, {
    components: [...container.toJSON(), actionRow],
    files: [attachment, ...container.files],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}
