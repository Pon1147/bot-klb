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
import { SUPPORT_DISCORD_INVITE } from '../../config/branding.config.js';

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
        `## ${count} Starter Delta Force Giftcodes`,
        '',
        `Complete pack of **${count} Garena giftcodes** (weapons, skins, EXP & resources).`,
        '',
        `### 2 Quick Steps (Auto Redeem All ${count} Codes)`,
        '1. Install the **DF Toolbox** extension (button below). All codes are preloaded.',
        `2. Click **"1. Open Redeem Page"** so the extension inputs and redeems all ${count} codes automatically.`,
        '',
        `*To view or copy the raw codes manually, download \`DF-Giftcodes-${count}.txt\` below.*`,
        `*If you have an older list in the extension, open popup → Editor → paste from the attached file → Save Codes.*`,
      ].join('\n')
    : [
        `## Danh Sách ${count} Mã Giftcode Tân Thủ Delta Force`,
        '',
        `Gói tổng hợp **${count} mã quà tặng Garena** (vũ khí, skin, EXP & nguyên liệu).`,
        '',
        '### 2 Bước Nhận Quà Tự Động',
        `1. Cài tiện ích **DF Toolbox** (nút bên dưới), đã nạp sẵn toàn bộ ${count} mã.`,
        `2. Bấm **"1. Mở Trang Nhập Code Garena"** để tiện ích tự động điền và nhận toàn bộ mã.`,
        '',
        `*Nếu muốn tự nhập, tải tệp \`DF-Giftcodes-${count}.txt\` đính kèm bên dưới.*`,
        `*Nếu đã cài tiện ích từ trước mà danh sách cũ chưa cập nhật, mở popup → Soạn thảo → dán từ tệp đính kèm → Save Codes.*`,
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
      .setURL(SUPPORT_DISCORD_INVITE)
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
