/**
 * Handler hiển thị trợ giúp (help) và hướng dẫn sử dụng Bot Delta.
 * Hỗ trợ đa ngôn ngữ (i18n vi & en) với fallback an toàn.
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
import { resolveUserLocale, SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { getLocaleDictionary, t } from '../../infrastructure/i18n/i18n.service.js';

export const TOTAL_HELP_PAGES = 6;

export function getHelpOptions(locale: SupportedLocale = 'vi') {
  const dict = getLocaleDictionary(locale);
  return [
    {
      label: dict.help.options.overview_label,
      value: 'overview',
      description: dict.help.options.overview_desc,
      page: 1,
    },
    {
      label: dict.help.options.stats_label,
      value: 'stats',
      description: dict.help.options.stats_desc,
      page: 2,
    },
    {
      label: dict.help.options.tactics_label,
      value: 'tactics',
      description: dict.help.options.tactics_desc,
      page: 3,
    },
    {
      label: dict.help.options.link_label,
      value: 'link',
      description: dict.help.options.link_desc,
      page: 4,
    },
    {
      label: dict.help.options.payment_label,
      value: 'payment',
      description: dict.help.options.payment_desc,
      page: 5,
    },
    {
      label: dict.help.options.admin_label,
      value: 'admin',
      description: dict.help.options.admin_desc,
      page: 6,
    },
  ] as const;
}

export const HELP_OPTIONS = getHelpOptions('vi');

export const VALUE_TO_PAGE_MAP: Record<string, number> = {
  overview: 1,
  stats: 2,
  tactics: 3,
  link: 4,
  payment: 5,
  admin: 6,
};

/**
 * Xây dựng nội dung Container V2 cho từng trang trợ giúp (1 - 6) theo locale.
 */
export function buildHelpPageContainer(
  page: number,
  locale: SupportedLocale = 'vi',
): BuildContainerResult {
  const safePage = Math.min(Math.max(page, 1), TOTAL_HELP_PAGES);
  const dict = getLocaleDictionary(locale);
  let content = '';

  const footer = t(
    'help.footer',
    { botVersion: BOT_VERSION, extVersion: EXTENSION_VERSION },
    locale,
  );

  switch (safePage) {
    case 1: {
      const p = dict.help.pages[1];
      content = [
        p.heading,
        '',
        p.intro,
        '',
        p.step_title,
        p.step_1,
        p.step_2,
        p.step_3,
        '',
        p.nav_title,
        p.nav_1,
        p.nav_2,
        p.nav_3,
        '',
        footer,
      ].join('\n');
      break;
    }

    case 2: {
      const p = dict.help.pages[2];
      const stats = dict.commands['df.stats'];
      const daily = dict.commands['df.daily'];
      const history = dict.commands['df.history'];
      const match = dict.commands['df.match'];
      const vault = dict.commands['df.vault'];

      content = [
        p.heading,
        '',
        `• **\`/df stats\`**: ${stats.desc}`,
        `• **\`/df daily\`**: ${daily.desc}`,
        `• **\`/df history [limit]\`**: ${history.desc}`,
        `• **\`/df match [match_id]\`**: ${match.desc}`,
        `• **\`/df vault\`**: ${vault.desc}`,
        '',
        p.note,
        '',
        footer,
      ].join('\n');
      break;
    }

    case 3: {
      const p = dict.help.pages[3];
      const map = dict.commands['df.map'];
      const build = dict.commands['df.build'];
      const code = dict.commands['df.code.show'];
      const market = dict.commands['df.market'];
      const workshop = dict.commands['df.workshop'];
      const team = dict.commands['team'];

      content = [
        p.heading,
        '',
        `• **\`/df map\`**: ${map.desc}`,
        `• **\`/df build [weapon] [mode]\`**: ${build.desc}`,
        `• **\`/df code show [page]\`**: ${code.desc}`,
        `• **\`/df market [item]\`**: ${market.desc}`,
        `• **\`/df workshop\`**: ${workshop.desc}`,
        `• **\`/team\`**: ${team.desc}`,
        '',
        footer,
      ].join('\n');
      break;
    }

    case 4: {
      const p = dict.help.pages[4];
      content = [
        p.heading,
        '',
        locale === 'en'
          ? '**Security & Privacy Commitment:**\n• Official Garena login only (`sso.garena.com`).\n• Zero password or OTP storage.\n• Tokens encrypted with military-grade AES-256-GCM.'
          : '**Cam kết an toàn & bảo mật:**\n• Chỉ đăng nhập trên cổng Garena chính thức (`sso.garena.com`).\n• Bot và tiện ích **không bao giờ** hỏi hay lưu mật khẩu hay mã OTP của bạn.\n• Token xác thực được mã hóa quân sự AES-256-GCM bảo vệ danh tính.',
        '',
        p.features_title,
        p.feature_1,
        p.feature_2,
        p.feature_3,
        '',
        p.install_title,
        p.install_1,
        p.install_2,
        p.install_3,
        p.install_4,
        '',
        locale === 'en'
          ? '• **`/df link`**: Check or start account linking • **`/df unlink`**: Unlink account.'
          : '• **`/df link`**: Kiểm tra hoặc bắt đầu liên kết tài khoản • **`/df unlink`**: Hủy liên kết tài khoản.',
        '',
        footer,
      ].join('\n');
      break;
    }

    case 5: {
      const p = dict.help.pages[5];
      content = [
        p.heading,
        '',
        locale === 'en'
          ? '• **VietQR Invoices (Members & Customers):**\n> `/pay create amount:<number> [customer:<@User>] [memo:<text>]`\n> Generate dynamic VietQR codes with automatic banking verification.\n> Supports Confirm, Cancel buttons & 1–5 ⭐ customer feedback ratings.\n\n• **Transaction History & Supporter Leaderboard:**\n> `/pay history [target:<@User>]` • `/pay top` (Server top supporters)\n\n• **Support Bot Developers (Donate):**\n> `/donate amount:<number> [message:<text>]` (PayOS Gateway)\n\n### ⚙️ For Server Administrators:\n• **Configure Receiving Bank Account:**\n> `/config vietqr set bank:<bank> account_no:<acc_no> account_name:<name> [prefix:<NAP>]`\n• **Workflow & ⭐ Ratings:** `/config vietqr workflow`\n• **Check Status:** `/config vietqr status`'
          : '• **Tạo mã thanh toán VietQR (Thành viên / Khách):**\n> `/pay create amount:<số tiền> [customer:<@User>] [memo:<ghi chú>]`\n> Tạo mã QR ngân hàng động kèm thông tin chuyển khoản.\n> Hỗ trợ nút xác nhận, hủy giao dịch & chấm điểm dịch vụ (1–5 ⭐).\n\n• **Lịch sử giao dịch cá nhân & Bảng xếp hạng:**\n> `/pay history [target:<@User>]` • `/pay top` (Top chi tiêu server)\n\n• **Ủng hộ nhà phát triển (Donate / Buy me a coffee):**\n> `/donate amount:<số tiền> [message:<lời nhắn>]` (PayOS Gateway)\n\n### ⚙️ Dành cho Quản trị viên máy chủ:\n• **Cài đặt tài khoản nhận tiền:**\n> `/config vietqr set bank:<ngân hàng> account_no:<số TK> account_name:<chủ TK> [prefix:<NAP>]`\n• **Cấu hình quy trình duyệt đơn & Đánh giá ⭐:**\n> `/config vietqr workflow [staff_role:<@Role>] [feedback_channel:<#Kênh>] [enable_rating:<True|False>] [thanks_message:<lời cảm ơn>]`\n• **Kiểm tra cấu hình VietQR máy chủ:** `/config vietqr status`',
        '',
        footer,
      ].join('\n');
      break;
    }

    case 6:
    default: {
      const p = dict.help.pages[6];
      content = [
        p.heading,
        '',
        locale === 'en'
          ? '• **Role-Based Access Control (RBAC):**\n> `/config roles set role_type:<Admin|Mod|Member> role:<@Role>` • `/config roles view`\n\n• **VietQR Banking & Invoicing Workflow:**\n> `/config vietqr set bank:<bank> account_no:<acc> account_name:<name>`\n> `/config vietqr workflow` • `/config vietqr status`\n\n• **Automated Daily Safe Vault Codes Channel (Recommended):**\n> `/df code setchannel channel:<#Channel>` • `/df code status`\n> Automatically dispatches 6-map combination codes at 08:00 AM daily.\n\n• **Auto-post Tactical Guides & Weapon Meta (Bot Owner):**\n> `/df autopost set type:<map|gun> interval_hours:<hours>` • `/df autopost status`\n\n• **Server Engagement Notices (Welcome / Leave / Booster):**\n> `/config welcome ...` • `/config leave ...` • `/config booster ...`\n\n• **Bot Announcements Channel:**\n> `/config bot setannouncechannel channel:<#Channel>`'
          : '• **Phân quyền Quản trị (RBAC):**\n> `/config roles set role_type:<Admin|Mod|Member> role:<@Role>` • `/config roles view`\n\n• **Cấu hình VietQR & Quy trình thanh toán:**\n> `/config vietqr set bank:<ngân hàng> account_no:<số TK> account_name:<chủ TK>`\n> `/config vietqr workflow [staff_role:<@Role>] [feedback_channel:<#Kênh>]`\n> `/config vietqr status`\n\n• **Kênh mật mã két sắt tự động (Khuyên dùng):**\n> `/df code setchannel channel:<#Kênh>` • `/df code status`\n> Tự động gửi mật mã két sắt 6 bản đồ vào 08:00 mỗi sáng.\n\n• **Tự động đăng Cẩm nang Map & Gun Meta (Bot Owner):**\n> `/df autopost set type:<map|gun> interval_hours:<giờ>` • `/df autopost toggle` • `/df autopost status`\n\n• **Thông báo Chào mừng / Tạm biệt / Booster:**\n> `/config welcome ...` • `/config leave ...` • `/config booster ...` (`setchannel`, `toggle`, `status`, `test`)\n\n• **Kênh thông báo bot:**\n> `/config bot setannouncechannel channel:<#Kênh>`',
        '',
        footer,
      ].join('\n');
      break;
    }
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
 * Xây dựng ActionRow chứa Select Menu chuyển nhanh giữa 6 trang.
 */
export function buildHelpSelectRow(
  currentPage: number,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = getHelpOptions(locale);
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(
      locale === 'vi'
        ? `df_help:select:${callerUserId}`
        : `df_help:select:${callerUserId}:${locale}`,
    )
    .setPlaceholder(locale === 'en' ? 'Select a guide category...' : 'Chọn danh mục hướng dẫn...')
    .addOptions(
      options.map((opt) => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: opt.page === currentPage,
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
}

/**
 * Xây dựng ActionRow chứa 5 Buttons điều hướng.
 */
export function buildHelpButtonsRow(
  currentPage: number,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): ActionRowBuilder<ButtonBuilder> {
  const safePage = Math.min(Math.max(currentPage, 1), TOTAL_HELP_PAGES);

  const prevCustomId =
    locale === 'vi'
      ? `df_help:page:${safePage - 1}:${callerUserId}`
      : `df_help:page:${safePage - 1}:${callerUserId}:${locale}`;

  const nextCustomId =
    locale === 'vi'
      ? `df_help:page:${safePage + 1}:${callerUserId}`
      : `df_help:page:${safePage + 1}:${callerUserId}:${locale}`;

  const dlCustomId =
    locale === 'vi' ? `df_help:dl:${callerUserId}` : `df_help:dl:${callerUserId}:${locale}`;

  const prevBtn = new ButtonBuilder()
    .setCustomId(prevCustomId)
    .setLabel(locale === 'en' ? 'Previous' : 'Trước')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage <= 1);

  const indicatorBtn = new ButtonBuilder()
    .setCustomId('df_help:indicator')
    .setLabel(
      locale === 'en'
        ? `Page ${safePage}/${TOTAL_HELP_PAGES}`
        : `Trang ${safePage}/${TOTAL_HELP_PAGES}`,
    )
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextBtn = new ButtonBuilder()
    .setCustomId(nextCustomId)
    .setLabel(locale === 'en' ? 'Next' : 'Sau')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage >= TOTAL_HELP_PAGES);

  const downloadBtn = new ButtonBuilder()
    .setCustomId(dlCustomId)
    .setLabel(locale === 'en' ? 'Download Extension' : 'Tải tiện ích')
    .setStyle(ButtonStyle.Success);

  const supportBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(locale === 'en' ? 'Support' : 'Hỗ trợ')
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

  const locale = resolveUserLocale({
    locale: interaction.locale,
    guildLocale: interaction.guildLocale,
  });

  const container = buildHelpPageContainer(1, locale);
  const selectRow = buildHelpSelectRow(1, interaction.user.id, locale);
  const buttonsRow = buildHelpButtonsRow(1, interaction.user.id, locale);

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
  const locale = (parts[3] as SupportedLocale) || resolveUserLocale({ locale: interaction.locale });

  // User Isolation Guard
  if (callerUserId && interaction.user.id !== callerUserId) {
    await interaction.reply({
      content: t('help.user_isolation_error', undefined, locale),
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const selectedValue = interaction.values[0];
  const targetPage = VALUE_TO_PAGE_MAP[selectedValue] ?? 1;

  const container = buildHelpPageContainer(targetPage, locale);
  const selectRow = buildHelpSelectRow(targetPage, callerUserId || interaction.user.id, locale);
  const buttonsRow = buildHelpButtonsRow(targetPage, callerUserId || interaction.user.id, locale);

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

  // 1. Phân trang: df_help:page:<targetPage>:<callerUserId>:<locale>
  if (customId.startsWith('df_help:page:')) {
    const parts = customId.split(':');
    const targetPage = parseInt(parts[2], 10) || 1;
    const callerUserId = parts[3];
    const locale =
      (parts[4] as SupportedLocale) || resolveUserLocale({ locale: interaction.locale });

    // User Isolation Guard
    if (callerUserId && interaction.user.id !== callerUserId) {
      await interaction.reply({
        content: t('help.user_isolation_error', undefined, locale),
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    const container = buildHelpPageContainer(targetPage, locale);
    const selectRow = buildHelpSelectRow(targetPage, callerUserId || interaction.user.id, locale);
    const buttonsRow = buildHelpButtonsRow(targetPage, callerUserId || interaction.user.id, locale);

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

  // 2. Nút tải tiện ích: df_help:dl:<callerUserId>:<locale>
  if (customId.startsWith('df_help:dl:')) {
    const parts = customId.split(':');
    const callerUserId = parts[2];
    const locale =
      (parts[3] as SupportedLocale) || resolveUserLocale({ locale: interaction.locale });

    // User Isolation Guard
    if (callerUserId && interaction.user.id !== callerUserId) {
      await interaction.reply({
        content:
          locale === 'en'
            ? 'You cannot interact with another user’s help session.'
            : 'Bạn không thể thao tác trên bảng trợ giúp của người khác.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    const zipPath = getExtensionZipPath();
    const files = zipPath
      ? [
          new AttachmentBuilder(zipPath, {
            name: 'DF-Extension.zip',
            description:
              locale === 'en'
                ? 'Delta Force Toolbox Chrome Extension'
                : 'Tiện ích liên kết tài khoản Delta Force',
          }),
        ]
      : [];

    await interaction.reply({
      content:
        files.length > 0
          ? locale === 'en'
            ? `**Delta Force Toolbox Installation Package (Extension v${EXTENSION_VERSION}):**\n` +
              '> 1. Download the attached **`DF-Extension.zip`** file below to your PC.\n' +
              '> 2. Right-click the downloaded file -> Select **Extract All...**.\n' +
              '> 3. Open `chrome://extensions/` -> Turn on **Developer mode** -> Click **Load unpacked**.\n' +
              '> *100% clean, runs locally on your browser and never accesses or stores your passwords.*'
            : `**Tệp cài đặt Tiện ích mở rộng Delta Force (Extension v${EXTENSION_VERSION}):**\n` +
              '> 1. Tải tệp **`DF-Extension.zip`** đính kèm bên dưới về máy tính.\n' +
              '> 2. Nhấp chuột phải vào file đã tải -> Chọn **Extract All... (Giải nén)**.\n' +
              '> 3. Mở `chrome://extensions/` -> Bật **Developer mode** -> Chọn **Load unpacked** thư mục vừa giải nén.\n' +
              '> *Tệp cài đặt sạch 100%, chạy cục bộ trên máy và không can thiệp vào tài khoản hay mật khẩu của bạn.*'
          : locale === 'en'
            ? 'Extension package `DF-Extension.zip` is not available on the server.'
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
