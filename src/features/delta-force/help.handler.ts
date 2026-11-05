/**
 * Handler hiển thị trợ giúp (help) và hướng dẫn sử dụng Bot Delta.
 * Tái cấu trúc 5 trang theo ý định người dùng kết hợp Select Menu và Action Row Buttons.
 * Tuân thủ Discord Components V2, User Isolation Guard và tải tiện ích mở rộng.
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
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import Database from 'better-sqlite3';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { requireGuild } from '../../utils/df-guards.js';
import { BOT_VERSION, EXTENSION_VERSION } from '../../config/version.js';
import { getExtensionZipPath } from './extension.utils.js';
import { isIgnorableInteractionError } from '../../utils/discord-error.utils.js';

export const TOTAL_HELP_PAGES = 5;

export const HELP_OPTIONS = [
  {
    label: '1. Tổng quan & Bắt đầu',
    value: 'overview',
    description: 'Giới thiệu Bot Delta, hướng dẫn dùng bot và tiện ích',
    page: 1,
  },
  {
    label: '2. Hồ sơ chiến đấu',
    value: 'stats',
    description: 'Chỉ số cá nhân, K/D, lịch sử, soi trận và kho đồ đỏ',
    page: 2,
  },
  {
    label: '3. Tác chiến & Vũ khí',
    value: 'tactics',
    description: 'Bản đồ 3D, build súng meta, mật mã két sắt và giá chợ',
    page: 3,
  },
  {
    label: '4. Tiện ích & Liên kết',
    value: 'link',
    description: 'Liên kết tài khoản HQ và đổi mã quà tặng Garena',
    page: 4,
  },
  {
    label: '5. Quản trị máy chủ',
    value: 'admin',
    description: 'Cấu hình RBAC, tự động đăng bài và thông báo server',
    page: 5,
  },
] as const;

export const VALUE_TO_PAGE_MAP: Record<string, number> = {
  overview: 1,
  stats: 2,
  tactics: 3,
  link: 4,
  admin: 5,
};

/**
 * Xây dựng nội dung Container V2 cho từng trang trợ giúp (1 - 5).
 */
export function buildHelpPageContainer(page: number): BuildContainerResult {
  const safePage = Math.min(Math.max(page, 1), TOTAL_HELP_PAGES);
  let content = '';

  const footer = `> **Bot Delta v${BOT_VERSION}** • **DF Toolbox v${EXTENSION_VERSION}** • Tác giả: **Pon1147** • [Hỗ trợ](https://discord.gg/vz6w6c3Xe3)`;

  switch (safePage) {
    case 1:
      content = [
        '# Trung Tâm Trợ Giúp — Bot Delta',
        '',
        '**Bot Delta** là trợ lý Discord chuyên biệt cho game thủ **Delta Force (Server Garena)**.',
        '',
        '### 3 Bước khởi đầu cho tân binh:',
        '1. **`/df link start`**: Nhận mã định danh & cài đặt tiện ích mở rộng **DF Toolbox**.',
        '2. **`/df stats`**: Tra cứu thẻ căn cước chiến binh (K/D, tỉ lệ sống sót, rank, số trận).',
        '3. **`/df code show`**: Lấy ngay bảng mật mã két sắt 6 bản đồ hôm nay.',
        '',
        '### Hướng dẫn điều hướng:',
        '• Chọn nhóm chức năng qua **Menu thả xuống** bên dưới.',
        '• Dùng các nút **[ Trước ]** / **[ Sau ]** để chuyển từng trang.',
        '• Bấm **[ Tải tiện ích ]** để nhận trực tiếp file cài đặt DF Toolbox.',
        '',
        footer,
      ].join('\n');
      break;

    case 2:
      content = [
        '# Hồ Sơ Chiến Đấu & Thống Kê Cá Nhân',
        '',
        '• **`/df stats`**: Xuất thẻ căn cước chiến binh (K/D, tỉ lệ rút quân, cấp bậc, số trận) & menu đổi mùa giải.',
        '• **`/df daily`**: Báo cáo tổng hợp hiệu suất tác chiến trong ngày hôm nay.',
        '• **`/df history [limit]`**: Xem lịch sử 1–20 trận gần nhất (operator, map, kết quả rút quân).',
        '• **`/df match [match_id]`**: Soi chi tiết kết quả 1 trận cụ thể (kèm gợi ý tự động 5 trận gần nhất).',
        '• **`/df vault`**: Sảnh Triển Lãm Đồ Đỏ — Kho báu vật phẩm quý hiếm đã rút quân an toàn & tổng định giá.',
        '',
        '*Lưu ý: Bạn cần liên kết tài khoản qua `/df link start` để bot đọc dữ liệu cá nhân từ Delta Force HQ.*',
        '',
        footer,
      ].join('\n');
      break;

    case 3:
      content = [
        '# Tác Chiến, Bản Đồ & Vũ Khí Meta',
        '',
        '• **`/df map`**: Cẩm nang bản đồ, soi két sắt, lối rút quân & liên kết mô phỏng 3D tại `deltaforcetools.gg`.',
        '• **`/df build` (hoặc `/df gun [weapon] [mode]`)**: Thư viện build súng meta Garena, lọc theo chế độ/loại súng & copy mã 1-chạm.',
        '• **`/df code show [page]`**: Bảng mật mã két sắt 6 bản đồ hôm nay (tự động cập nhật mỗi sáng).',
        '• **`/df market [item]`**: Tra cứu giá nguyên liệu thị trường & biên lợi nhuận chế tác bàn xưởng từ HQ API.',
        '• **`/df workshop`**: Xem khuyến nghị sản xuất tối ưu tại Xưởng Căn Cứ Ngầm.',
        '• **`/team find`**: Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động.',
        '',
        footer,
      ].join('\n');
      break;

    case 4:
      content = [
        '# Tiện Ích DF Toolbox & Liên Kết Tài Khoản',
        '',
        '**Cam kết an toàn & bảo mật:**',
        '• Chỉ đăng nhập trên cổng Garena chính thức (`sso.garena.com`).',
        '• Bot và tiện ích **không bao giờ** hỏi hay lưu mật khẩu hay mã OTP của bạn.',
        '• Token xác thực được mã hóa quân sự AES-256-GCM bảo vệ danh tính.',
        '',
        '### 3 Bước cài đặt & liên kết:',
        '1. **Tải file:** Nhấn nút **[ Tải tiện ích ]** bên dưới để nhận `DF-Extension.zip` rồi giải nén.',
        '2. **Cài vào trình duyệt:** Mở `chrome://extensions/` -> Bật **Developer mode** -> Chọn **Load unpacked** thư mục vừa giải nén.',
        '3. **Liên kết:** Gõ `/df link start` lấy mã 6 ký tự -> Mở [Delta Force HQ](https://www.playdeltaforce.com/events/hq/vi/index.html) và nhập mã vào bảng nổi góc phải.',
        '',
        '**Tự động nhận 277+ Giftcode Garena:** Mở popup tiện ích -> Tab **Redeem Code** -> Bấm **Bắt đầu**.',
        '• **`/df link status`**: Kiểm tra trạng thái liên kết • **`/df unlink`**: Hủy liên kết tài khoản.',
        '',
        footer,
      ].join('\n');
      break;

    case 5:
    default:
      content = [
        '# Quản Trị Máy Chủ & Điều Hành Bot',
        '',
        '• **Phân quyền Quản trị (RBAC):**',
        '> `/config roles set role_type:<Admin|Mod|Member> role:<@Role>` • `/config roles view`',
        '',
        '• **Kênh mật mã két sắt tự động (Khuyên dùng):**',
        '> `/df code setchannel channel:<#Kênh>` • `/df code status`',
        '> Tự động gửi mật mã két sắt 6 bản đồ vào 08:00 mỗi sáng.',
        '',
        '• **Tự động đăng Cẩm nang Map & Gun Meta:**',
        '> `/df autopost set type:<map|gun> channel:<#Kênh> interval_hours:<giờ>` • `/df autopost toggle` • `/df autopost status`',
        '',
        '• **Thông báo Chào mừng / Tạm biệt / Booster:**',
        '> `/config welcome ...` • `/config leave ...` • `/config booster ...` (`setchannel`, `toggle`, `status`, `test`)',
        '',
        '• **Kênh thông báo bot:**',
        '> `/config bot setannouncechannel channel:<#Kênh>`',
        '',
        footer,
      ].join('\n');
      break;
  }

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.DF },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/**
 * Xây dựng ActionRow chứa Select Menu chuyển nhanh giữa 5 trang.
 */
export function buildHelpSelectRow(
  currentPage: number,
  callerUserId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`df_help:select:${callerUserId}`)
    .setPlaceholder('Chọn danh mục hướng dẫn...')
    .addOptions(
      HELP_OPTIONS.map((opt) => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: opt.page === currentPage,
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
}

/**
 * Xây dựng ActionRow chứa 5 Buttons điều hướng (Trước, Chỉ số trang, Sau, Tải tiện ích, Hỗ trợ).
 */
export function buildHelpButtonsRow(
  currentPage: number,
  callerUserId: string,
): ActionRowBuilder<ButtonBuilder> {
  const safePage = Math.min(Math.max(currentPage, 1), TOTAL_HELP_PAGES);

  const prevBtn = new ButtonBuilder()
    .setCustomId(`df_help:page:${safePage - 1}:${callerUserId}`)
    .setLabel('Trước')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage <= 1);

  const indicatorBtn = new ButtonBuilder()
    .setCustomId('df_help:indicator')
    .setLabel(`Trang ${safePage}/${TOTAL_HELP_PAGES}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`df_help:page:${safePage + 1}:${callerUserId}`)
    .setLabel('Sau')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage >= TOTAL_HELP_PAGES);

  const downloadBtn = new ButtonBuilder()
    .setCustomId(`df_help:dl:${callerUserId}`)
    .setLabel('Tải tiện ích')
    .setStyle(ButtonStyle.Success);

  const supportBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel('Hỗ trợ')
    .setURL('https://discord.gg/vz6w6c3Xe3');

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevBtn,
    indicatorBtn,
    nextBtn,
    downloadBtn,
    supportBtn,
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

  const container = buildHelpPageContainer(1);
  const selectRow = buildHelpSelectRow(1, interaction.user.id);
  const buttonsRow = buildHelpButtonsRow(1, interaction.user.id);

  await interaction.reply({
    components: [...container.toJSON(), selectRow.toJSON(), buttonsRow.toJSON()],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  } as Parameters<typeof interaction.reply>[0]);
}

/**
 * Handler xử lý khi người dùng tương tác với Select Menu của /df help.
 */
export async function handleHelpSelect(
  interaction: StringSelectMenuInteraction,
): Promise<{ handled: boolean }> {
  if (!interaction.customId.startsWith('df_help:select:')) {
    return { handled: false };
  }

  const parts = interaction.customId.split(':');
  const callerUserId = parts[2];

  // User Isolation Guard
  if (callerUserId && interaction.user.id !== callerUserId) {
    await interaction.reply({
      content: 'Bạn không thể điều khiển menu trợ giúp của người khác.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const selectedValue = interaction.values[0];
  const targetPage = VALUE_TO_PAGE_MAP[selectedValue] ?? 1;

  const container = buildHelpPageContainer(targetPage);
  const selectRow = buildHelpSelectRow(targetPage, callerUserId || interaction.user.id);
  const buttonsRow = buildHelpButtonsRow(targetPage, callerUserId || interaction.user.id);

  try {
    await interaction.update({
      components: [...container.toJSON(), selectRow.toJSON(), buttonsRow.toJSON()],
    });
  } catch (error) {
    if (!isIgnorableInteractionError(error)) {
      throw error;
    }
  }

  return { handled: true };
}

/**
 * Handler xử lý khi người dùng nhấn nút bấm của /df help.
 */
export async function handleHelpButton(
  interaction: ButtonInteraction,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;

  // 1. Phân trang: df_help:page:<targetPage>:<callerUserId>
  if (customId.startsWith('df_help:page:')) {
    const parts = customId.split(':');
    const targetPage = parseInt(parts[2], 10) || 1;
    const callerUserId = parts[3];

    // User Isolation Guard
    if (callerUserId && interaction.user.id !== callerUserId) {
      await interaction.reply({
        content: 'Bạn không thể điều khiển bảng trợ giúp của người khác.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    const container = buildHelpPageContainer(targetPage);
    const selectRow = buildHelpSelectRow(targetPage, callerUserId || interaction.user.id);
    const buttonsRow = buildHelpButtonsRow(targetPage, callerUserId || interaction.user.id);

    try {
      await interaction.update({
        components: [...container.toJSON(), selectRow.toJSON(), buttonsRow.toJSON()],
      });
    } catch (error) {
      if (!isIgnorableInteractionError(error)) {
        throw error;
      }
    }
    return { handled: true };
  }

  // 2. Nút tải tiện ích: df_help:dl:<callerUserId>
  if (customId.startsWith('df_help:dl:')) {
    const parts = customId.split(':');
    const callerUserId = parts[2];

    // User Isolation Guard
    if (callerUserId && interaction.user.id !== callerUserId) {
      await interaction.reply({
        content: 'Bạn không thể thao tác trên bảng trợ giúp của người khác.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

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
      content:
        files.length > 0
          ? `**Tệp cài đặt Tiện ích mở rộng Delta Force (Extension v${EXTENSION_VERSION}):**\n` +
            '> 1. Tải tệp **`DF-Extension.zip`** đính kèm bên dưới về máy tính.\n' +
            '> 2. Nhấp chuột phải vào file đã tải -> Chọn **Extract All... (Giải nén)**.\n' +
            '> 3. Mở `chrome://extensions/` -> Bật **Developer mode** -> Chọn **Load unpacked** thư mục vừa giải nén.\n' +
            '> *Tệp cài đặt sạch 100%, chạy cục bộ trên máy và không can thiệp vào tài khoản hay mật khẩu của bạn.*'
          : 'Không tìm thấy tệp cài đặt `DF-Extension.zip` trên máy chủ.',
      files,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 3. Nút hiển thị chỉ số trang (indicator): không làm gì
  if (customId === 'df_help:indicator') {
    return { handled: true };
  }

  return { handled: false };
}
