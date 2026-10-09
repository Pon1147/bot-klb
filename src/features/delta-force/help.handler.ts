/**
 * Handler hiển thị trợ giúp (help) và hướng dẫn sử dụng bot Delta Force.
 * Hỗ trợ 2 view: Tổng quan lệnh và Hướng dẫn liên kết tài khoản 5 bước.
 * Tự động đính kèm file DF-Extension.zip để người dùng tải trực tiếp.
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireGuild } from '../../utils/df-guards.js';
import { getExtensionZipPath } from './extension.utils.js';

export type HelpTab = 'commands' | 'guide';

/**
 * Xây dựng Container V2 hiển thị nội dung trợ giúp theo tab đã chọn.
 */
export function buildHelpContainer(tab: HelpTab): BuildContainerResult {
  if (tab === 'commands') {
    const content = [
      '## 🎮 Trung Tâm Lệnh Bot KLB & Delta Force',
      '',
      '### ⚔️ Nhóm lệnh Delta Force (`/df`)',
      '- `/df stats`: Xem thống kê tổng quan (K/D, tỷ lệ rút quân, cấp bậc).',
      '- `/df daily`: Xem trạng thái chiến đấu hàng ngày.',
      '- `/df history [limit]`: Xem lịch sử các trận đấu gần đây (1-20 trận).',
      '- `/df workshop`: Xem tình trạng sản xuất tại Xưởng Căn Cứ Ngầm.',
      '- `/df code show`: Xem mật khẩu các khu vực & két sắt hôm nay.',
      '- `/df link start`: Nhận mã claim & tải tiện ích để liên kết tài khoản.',
      '- `/df link status`: Kiểm tra tình trạng liên kết tài khoản.',
      '- `/df unlink`: Hủy liên kết tài khoản hiện tại.',
      '- `/df help`: Xem hướng dẫn sử dụng và tải tiện ích mở rộng.',
      '',
      '### 👥 Nhóm lệnh Squad (`/team`)',
      '- `/team find`: Đăng tin tuyển đồng đội hoặc tìm squad tham gia.',
      '',
      '### ⚙️ Nhóm lệnh Quản trị (`/config`)',
      '- `/config bot guilds`: Xem danh sách server bot đang tham gia (Dành cho Quản trị viên).',
      '- `/config welcome ...` & `/config booster ...`: Cấu hình thông báo máy chủ.',
    ].join('\n');

    return makeResult(
      [
        {
          type: ComponentType.Container,
          components: [
            { type: ComponentType.TextDisplay, content },
            { type: ComponentType.Separator, accentColor: COLORS.INFO },
          ],
        },
      ],
      MessageFlags.IsComponentsV2,
      [],
    );
  }

  // tab === 'guide'
  const content = [
    '## 🧩 Hướng Dẫn Cài Đặt Tiện Ích & Liên Kết Tài Khoản (5 Bước)',
    '',
    '**1. Tải file & Giải nén:**',
    'Tải file **`DF-Extension.zip`** đính kèm bên dưới và giải nén ra một thư mục trên máy tính.',
    '',
    '**2. Cài vào Trình duyệt (Chrome / Edge / Cốc Cốc):**',
    '- Truy cập `chrome://extensions/` (hoặc `edge://extensions/`).',
    '- Bật **Chế độ dành cho nhà phát triển** (**Developer mode**) ở góc trên bên phải.',
    '- Nhấn **Tải tiện ích đã giải nén** (**Load unpacked**) và chọn thư mục vừa giải nén.',
    '',
    '**3. Lấy mã Claim và Webhook:**',
    'Dùng lệnh `/df link start` trong server. Nhấn nút **"Hiện Webhook URL"** để nhận webhook URL riêng của bot và mã claim (hết hạn sau 10 phút).',
    '',
    '**4. Cấu hình Tiện ích:**',
    'Nhấp vào biểu tượng Tiện ích Delta Force trên thanh trình duyệt, dán Webhook URL vào ô cấu hình và nhấn **Lưu**.',
    '',
    '**5. Xác nhận Liên kết:**',
    'Mở [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) và đăng nhập. Mở popup tiện ích qua tab **Link**, dán mã claim và bấm **Liên kết Discord**.',
    '',
    '> 💡 *Tiện ích hoạt động an toàn cục bộ trên máy tính của bạn và tự động đồng bộ mã điểm danh/thống kê.*',
  ].join('\n');

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.WELCOME },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/**
 * Xây dựng ActionRow chứa các nút chuyển tab chuyển đổi view trợ giúp.
 */
export function buildHelpActionRow(currentTab: HelpTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('df_help_tab_commands')
      .setLabel('📋 Danh Sách Lệnh')
      .setStyle(currentTab === 'commands' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('df_help_tab_guide')
      .setLabel('🧩 Hướng Dẫn Liên Kết')
      .setStyle(currentTab === 'guide' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

/**
 * Handler thực thi khi người dùng gõ /df help.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  _database?: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const container = buildHelpContainer('commands');
  const row = buildHelpActionRow('commands');

  const zipPath = getExtensionZipPath();
  const files = zipPath
    ? [
        new AttachmentBuilder(zipPath, {
          name: 'DF-Extension.zip',
          description: 'Tiện ích liên kết tài khoản Delta Force',
        }),
      ]
    : [];

  await interaction.reply({
    components: [...container.toJSON(), row.toJSON()],
    files,
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}

/**
 * Handler xử lý tương tác khi người dùng nhấp vào nút chuyển tab trợ giúp.
 */
export async function handleHelpButton(
  interaction: ButtonInteraction,
): Promise<{ handled: boolean }> {
  if (
    interaction.customId !== 'df_help_tab_commands' &&
    interaction.customId !== 'df_help_tab_guide'
  ) {
    return { handled: false };
  }

  const tab: HelpTab = interaction.customId === 'df_help_tab_commands' ? 'commands' : 'guide';
  const container = buildHelpContainer(tab);
  const row = buildHelpActionRow(tab);

  await interaction.update({
    components: [...container.toJSON(), row.toJSON()],
  });

  return { handled: true };
}
