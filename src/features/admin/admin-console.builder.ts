import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  Guild,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ContainerSettings, GuildSettings } from '../../types/settings.types.js';
import { BuildContainerResult, makeResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { buildLivePreviewContainer } from '../container/container-builders.js';
import { MAX_CONTAINER_TEXT_LENGTH, MEDIA_URL_PLACEHOLDER } from '../../config/app.constants.js';

export type NoticeType = 'welcome' | 'leave' | 'booster';

// ── Helper kiểm tra ID hợp lệ và tồn tại trong cache máy chủ (tránh @vai-trò-chưa-rõ) ──
export function resolveRoleTag(guild: Guild, roleId?: string | null, isEn = false): string {
  if (!roleId || !/^\d{17,20}$/.test(roleId)) return isEn ? '*Not assigned*' : '*Chưa gán*';
  if (guild.roles?.cache && guild.roles.cache.size > 0 && !guild.roles.cache.has(roleId)) {
    return isEn ? '*Not assigned*' : '*Chưa gán*';
  }
  return `<@&${roleId}>`;
}

export function resolveChannelTag(guild: Guild, channelId?: string | null): string | null {
  if (!channelId || !/^\d{17,20}$/.test(channelId)) return null;
  if (
    guild.channels?.cache &&
    guild.channels.cache.size > 0 &&
    !guild.channels.cache.has(channelId)
  ) {
    return null;
  }
  return `<#${channelId}>`;
}

/**
 * Xây dựng Container V2 cho Bảng Điều Khiển Server (Admin Console).
 * Áp dụng thiết kế Section 2 cột (Text bên trái, Button Accessory bên phải).
 */
export function buildAdminConsoleContainer(
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): BuildContainerResult {
  const isEn = locale === 'en';

  // Trạng thái tóm tắt của 3 loại thông báo tự động
  const welcomeChan = resolveChannelTag(guild, settings.welcome?.channelId);
  const welcomeText = welcomeChan
    ? `${welcomeChan} (${settings.welcome?.enabled ? (isEn ? '🟢 Enabled' : '🟢 Đang Bật') : isEn ? '🔴 Disabled' : '🔴 Đang Tắt'})`
    : isEn
      ? '*Not configured*'
      : '*Chưa đặt kênh*';

  const leaveChan = resolveChannelTag(guild, settings.leave?.channelId);
  const leaveText = leaveChan
    ? `${leaveChan} (${settings.leave?.enabled ? (isEn ? '🟢 Enabled' : '🟢 Đang Bật') : isEn ? '🔴 Disabled' : '🔴 Đang Tắt'})`
    : isEn
      ? '*Not configured*'
      : '*Chưa đặt kênh*';

  const boosterChan = resolveChannelTag(guild, settings.booster?.channelId);
  const boosterText = boosterChan
    ? `${boosterChan} (${settings.booster?.enabled ? (isEn ? '🟢 Enabled' : '🟢 Đang Bật') : isEn ? '🔴 Disabled' : '🔴 Đang Tắt'})`
    : isEn
      ? '*Not configured*'
      : '*Chưa đặt kênh*';

  const adminRole = resolveRoleTag(guild, settings.rbac?.botAdminRoleId, isEn);
  const modRole = resolveRoleTag(guild, settings.rbac?.moderatorRoleId, isEn);

  const codeChanTag = resolveChannelTag(guild, settings.dfCodes?.channelId);
  const codeStatus = codeChanTag
    ? `${codeChanTag} (${isEn ? '08:00 AM' : '08:00 sáng'})`
    : isEn
      ? '*Not configured*'
      : '*Chưa đặt kênh*';

  const vietqrInfo =
    settings.vietqr?.bankId && settings.vietqr?.accountNo
      ? `${settings.vietqr.bankId} • ${settings.vietqr.accountNo}`
      : isEn
        ? '*Not configured*'
        : '*Chưa cài đặt*';

  // Khối tóm tắt trạng thái hệ thống dạng Blockquote sạch sẽ
  const statusSummary = isEn
    ? `> **👑 Server Owner**: <@${guild.ownerId}>\n` +
      `> **🛡️ Admin**: ${adminRole} • **Mod**: ${modRole}\n` +
      `> **🔔 Notices**: 🎉 ${welcomeText} • 👋 ${leaveText} • 💎 ${boosterText}\n` +
      `> **🎁 Vault Codes**: ${codeStatus}\n` +
      `> **💳 VietQR**: ${vietqrInfo}`
    : `> **👑 Chủ Server**: <@${guild.ownerId}>\n` +
      `> **🛡️ Admin**: ${adminRole} • **Mod**: ${modRole}\n` +
      `> **🔔 Thông Báo**: 🎉 ${welcomeText} • 👋 ${leaveText} • 💎 ${boosterText}\n` +
      `> **🎁 Mật Mã DF**: ${codeStatus}\n` +
      `> **💳 Nhận Tiền VietQR**: ${vietqrInfo}`;

  const containerInner: unknown[] = [
    // 1. Header Section với nút Làm Mới góc trên bên phải
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn ? '# ⚙️ Server Control Center' : '# ⚙️ Bảng Điều Khiển Máy Chủ',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:refresh:${callerUserId}`,
        label: isEn ? 'Refresh' : 'Làm Mới',
        style: ButtonStyle.Secondary,
      },
    },

    // 2. Đường ngăn cách accent
    {
      type: ComponentType.Separator,
      accentColor: COLORS.DF,
    },

    // 3. Khối tóm tắt hiện trạng server
    {
      type: ComponentType.TextDisplay,
      content: statusSummary,
    },

    // 4. Đường ngăn cách phân vùng tính năng
    {
      type: ComponentType.Separator,
    },

    // 5. Section: Phân quyền Quản trị (RBAC)
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '🛡️ **Bot Management Permissions** — Grant bot setup & moderation access to roles'
            : '🛡️ **Phân Quyền Quản Trị Bot** — Chỉ định vai trò được toàn quyền cấu hình hoặc điều hành bot',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:roles:${callerUserId}`,
        label: isEn ? 'Assign Roles' : 'Gán Quyền',
        style: ButtonStyle.Secondary,
      },
    },

    // 6. Section: Kênh Mật mã két sắt Delta Force
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '🎁 **Daily Vault Codes** — Auto-post 6 maps at 08:00 AM'
            : '🎁 **Mật Mã Két Sắt DF** — Tự động cập nhật 6 map lúc 08:00 sáng',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:code_channel:${callerUserId}`,
        label: isEn ? 'Set Channel' : 'Đặt Kênh',
        style: ButtonStyle.Secondary,
      },
    },

    // 7. Section: Gộp toàn bộ Thông Báo Tự Động (Chào mừng, Tạm biệt, Booster)
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '🔔 **Automated Lifecycle Notices** — Welcome, Leave & Booster Cards V2'
            : '🔔 **Thông Báo Tự Động** — Cấu hình thiệp Chào Mừng, Tạm Biệt & Server Booster',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:notices_hub:${callerUserId}`,
        label: isEn ? 'Notices Hub' : 'Cấu Hình Hub',
        style: ButtonStyle.Secondary,
      },
    },

    // 8. Section: Cấu hình nhận tiền VietQR
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '💳 **VietQR Transfer** — Setup receiving bank account'
            : '💳 **Tài Khoản VietQR** — Cài số tài khoản ngân hàng nhận tiền',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:vietqr:${callerUserId}`,
        label: isEn ? 'Config VietQR' : 'Cài VietQR',
        style: ButtonStyle.Secondary,
      },
    },
  ];

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: containerInner,
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/**
 * Xây dựng ActionRow footer chứa các nút tiện ích dưới cùng của Console.
 */
export function buildAdminConsoleFooterRow(
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): ActionRowBuilder<ButtonBuilder> {
  const isEn = locale === 'en';

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:help:${callerUserId}`)
      .setLabel(isEn ? '📖 User Guide' : '📖 Hướng Dẫn /df help')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel(isEn ? '💬 Support Server' : '💬 Hỗ Trợ Server')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/vz6w6c3Xe3'),
  );
}

/**
 * Helper lấy tên đại diện của Tab thông báo.
 */
function getNoticeTabLabel(type: NoticeType, isEn: boolean): string {
  switch (type) {
    case 'welcome':
      return isEn ? '🎉 Welcome' : '🎉 Chào Mừng';
    case 'leave':
      return isEn ? '👋 Leave' : '👋 Tạm Biệt';
    case 'booster':
      return isEn ? '💎 Server Booster' : '💎 Server Booster';
  }
}

/**
 * Xây dựng giao diện Trung Tâm Quản Lý Thông Báo Tự Động (Notices Hub View).
 * Chuyển đổi màn hình in-place trên cùng message với 3 Tab: Welcome, Leave, Booster.
 */
export function buildNoticesHubView(
  guild: Guild,
  settings: GuildSettings,
  currentTab: NoticeType = 'welcome',
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const isEn = locale === 'en';
  const tabData = settings[currentTab];
  const channelTag = resolveChannelTag(guild, tabData?.channelId);
  const isEnabled = Boolean(tabData?.enabled);
  const tabLabel = getNoticeTabLabel(currentTab, isEn);

  // Auto-role chỉ áp dụng cho Welcome và Booster
  const roleId = currentTab !== 'leave' ? (tabData as any)?.roleId : null;
  const roleTag = currentTab !== 'leave' ? resolveRoleTag(guild, roleId, isEn) : null;

  const currentStatusDesc = isEn
    ? `> **Active Tab**: ${tabLabel}\n` +
      `> **Announcement Channel**: ${channelTag ?? '*Not configured*'}\n` +
      `> **Auto Status**: ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
      (roleTag ? `> **Auto-Assigned Role**: ${roleTag}\n` : '') +
      `> **Card Template**: Discord Components V2 (Live Preview Editor available below)`
    : `> **Tab đang chọn**: ${tabLabel}\n` +
      `> **Kênh gửi thông báo**: ${channelTag ?? '*Chưa đặt kênh*'}\n` +
      `> **Trạng thái tự động**: ${isEnabled ? '🟢 Đang Bật' : '🔴 Đang Tắt'}\n` +
      (roleTag ? `> **Vai trò tự động gán**: ${roleTag}\n` : '') +
      `> **Giao diện thiệp**: Discord Components V2 (Có thể tùy biến trực quan bên dưới)`;

  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: isEn ? '# 🔔 Automated Lifecycle Notices Hub' : '# 🔔 Trung Tâm Thông Báo Tự Động',
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content: currentStatusDesc,
      },
    ],
  };

  // Row 1: 3 Tab chuyển đổi nhanh
  const tabsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:tab_welcome:${callerUserId}`)
      .setLabel(isEn ? '🎉 Welcome' : '🎉 Chào Mừng')
      .setStyle(currentTab === 'welcome' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:tab_leave:${callerUserId}`)
      .setLabel(isEn ? '👋 Leave' : '👋 Tạm Biệt')
      .setStyle(currentTab === 'leave' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:tab_booster:${callerUserId}`)
      .setLabel(isEn ? '💎 Booster' : '💎 Booster')
      .setStyle(currentTab === 'booster' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  // Row 2: Chọn kênh gửi
  const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`admin_console_select:notice_chan_${currentTab}:${callerUserId}`)
      .setPlaceholder(
        isEn ? `Select channel for ${tabLabel}...` : `Chọn kênh gửi thông báo cho ${tabLabel}...`,
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );

  // Row 3: Chọn vai trò tự động (chỉ cho welcome và booster)
  const roleSelectRow =
    currentTab !== 'leave'
      ? new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`admin_console_select:notice_role_${currentTab}:${callerUserId}`)
            .setPlaceholder(
              isEn
                ? `Select auto-role for ${tabLabel}...`
                : `Chọn vai trò tự động gán cho ${tabLabel}...`,
            )
            .setMinValues(1)
            .setMaxValues(1),
        )
      : null;

  // Row 4: Các nút thao tác (Toggle, Sửa thiệp, Gửi thử, Quay lại, Gỡ kênh)
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:toggle_notice_${currentTab}:${callerUserId}`)
      .setLabel(
        isEnabled ? (isEn ? '🟢 Enabled' : '🟢 Đang Bật') : isEn ? '🔴 Disabled' : '🔴 Đang Tắt',
      )
      .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:edit_container_${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '🎨 Edit Card' : '🎨 Sửa Giao Diện')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin_console:test_notice_${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '🚀 Test Send' : '🚀 Gửi Thử')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:back:${callerUserId}`)
      .setLabel(isEn ? '◀ Back' : '◀ Quay Lại')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_notice_chan_${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Unset Chan' : '🗑️ Gỡ Kênh')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!tabData?.channelId),
  );

  const components: any[] = [containerJson, tabsRow.toJSON(), channelSelectRow.toJSON()];
  if (roleSelectRow) {
    components.push(roleSelectRow.toJSON());
  }
  components.push(actionRow.toJSON());

  return {
    components,
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình Live Preview Editor in-place của Container V2.
 */
export function buildContainerEditorView(
  draft: ContainerSettings,
  currentTab: NoticeType,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number; files?: any[] } {
  const isEn = locale === 'en';
  const preview = buildLivePreviewContainer(draft);

  const hexColor = '#' + draft.accentColor.toString(16).padStart(6, '0').toUpperCase();
  const linesLabel = draft.contentLines.length > 0 ? `${draft.contentLines.length} dòng` : '0 dòng';

  // Hàng công cụ chỉnh sửa thuộc tính
  const propsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_lines:${currentTab}:${callerUserId}`)
      .setLabel(`📝 ${linesLabel}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_header:${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '📌 Header' : '📌 Tiêu Đề')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_color:${currentTab}:${callerUserId}`)
      .setLabel(`🎨 ${hexColor}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_media:${currentTab}:${callerUserId}`)
      .setLabel(
        draft.mediaUrl ? (isEn ? '🖼️ Media ✓' : '🖼️ Ảnh/GIF ✓') : isEn ? '🖼️ Media' : '🖼️ Ảnh/GIF',
      )
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_sep:${currentTab}:${callerUserId}`)
      .setLabel(
        draft.showSeparator
          ? isEn
            ? '➖ Hide Sep'
            : '➖ Tắt Kẻ'
          : isEn
            ? '➖ Show Sep'
            : '➖ Bật Kẻ',
      )
      .setStyle(ButtonStyle.Secondary),
  );

  // Hàng hành động (Lưu, Mặc định, Hủy)
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_save:${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '💾 Save Card' : '💾 Lưu Thiệp')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_reset:${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '🔄 Reset Default' : '🔄 Mặc Định')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`admin_console:editor_cancel:${currentTab}:${callerUserId}`)
      .setLabel(isEn ? '◀ Cancel' : '◀ Hủy Bỏ')
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    components: [...preview.toJSON(), propsRow.toJSON(), actionRow.toJSON()],
    flags: preview.flags,
    files: preview.files,
  };
}

/**
 * Modal chỉnh sửa Text Lines của Container V2.
 */
export function buildAdminEditorLinesModal(
  currentTab: NoticeType,
  callerUserId: string,
  contentLines: string[],
  locale: SupportedLocale = 'vi',
): ModalBuilder {
  const isEn = locale === 'en';
  const preview = contentLines.join('\n');

  const textarea = new TextInputBuilder()
    .setCustomId('lines_content')
    .setLabel(isEn ? 'Text Lines (one entry per line)' : 'Lời Nhắn (mỗi dòng 1 câu)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Dòng 1\nDòng 2\nDòng 3')
    .setMaxLength(MAX_CONTAINER_TEXT_LENGTH)
    .setValue(preview)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`admin_console_modal:editor_lines:${currentTab}:${callerUserId}`)
    .setTitle(isEn ? `Edit Message Lines (${currentTab})` : `Sửa Lời Nhắn (${currentTab})`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textarea));
}

/**
 * Modal chỉnh sửa Header template của Container V2.
 */
export function buildAdminEditorHeaderModal(
  currentTab: NoticeType,
  callerUserId: string,
  currentHeader: string | null,
  locale: SupportedLocale = 'vi',
): ModalBuilder {
  const isEn = locale === 'en';

  const headerInput = new TextInputBuilder()
    .setCustomId('header_value')
    .setLabel(isEn ? 'Header Template' : 'Mẫu Tiêu Đề Header')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Chào mừng {user} đến với {guild}!')
    .setMaxLength(MAX_CONTAINER_TEXT_LENGTH)
    .setValue(currentHeader || '')
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`admin_console_modal:editor_header:${currentTab}:${callerUserId}`)
    .setTitle(isEn ? `Edit Header (${currentTab})` : `Sửa Tiêu Đề (${currentTab})`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(headerInput));
}

/**
 * Modal chỉnh sửa Accent Color của Container V2.
 */
export function buildAdminEditorColorModal(
  currentTab: NoticeType,
  callerUserId: string,
  currentColor: number,
  locale: SupportedLocale = 'vi',
): ModalBuilder {
  const isEn = locale === 'en';
  const currentHex = '#' + currentColor.toString(16).padStart(6, '0');

  const colorInput = new TextInputBuilder()
    .setCustomId('color_value')
    .setLabel(isEn ? 'Accent Hex Color (e.g. #5865F2)' : 'Mã màu viền Hex (ví dụ: #5865F2)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(currentHex)
    .setValue(currentHex)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`admin_console_modal:editor_color:${currentTab}:${callerUserId}`)
    .setTitle(isEn ? `Edit Accent Color (${currentTab})` : `Chọn Màu Viền (${currentTab})`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput));
}

/**
 * Modal chỉnh sửa Media/GIF URL của Container V2.
 */
export function buildAdminEditorMediaModal(
  currentTab: NoticeType,
  callerUserId: string,
  currentUrl: string | null,
  currentDesc: string | null,
  locale: SupportedLocale = 'vi',
): ModalBuilder {
  const isEn = locale === 'en';

  const urlInput = new TextInputBuilder()
    .setCustomId('media_url')
    .setLabel(isEn ? 'Image / GIF URL' : 'Đường dẫn ảnh / GIF')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(MEDIA_URL_PLACEHOLDER)
    .setValue(currentUrl || '')
    .setRequired(false);

  const descInput = new TextInputBuilder()
    .setCustomId('media_description')
    .setLabel(isEn ? 'Media Alt Description' : 'Mô tả hình ảnh (tùy chọn)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Hình ảnh minh họa')
    .setValue(currentDesc || '')
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`admin_console_modal:editor_media:${currentTab}:${callerUserId}`)
    .setTitle(isEn ? `Edit Media / GIF (${currentTab})` : `Chỉnh Sửa Ảnh/GIF (${currentTab})`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    );
}

/**
 * Xây dựng màn hình cài đặt kênh văn bản (In-Place Transition trên cùng Message).
 */
export function buildChannelConfigView(
  type: 'code_channel' | 'welcome_channel',
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const isEn = locale === 'en';
  const isCode = type === 'code_channel';

  const currentChannelId = isCode ? settings.dfCodes?.channelId : settings.welcome?.channelId;
  const channelTag = resolveChannelTag(guild, currentChannelId);
  const currentStatus = channelTag ?? (isEn ? '*Not configured*' : '*Chưa đặt kênh*');

  const title = isCode
    ? isEn
      ? '# 🎁 Daily Safe Vault Codes Channel'
      : '# 🎁 Kênh Mật Mã Két Sắt Delta Force'
    : isEn
      ? '# 📢 Member Welcome Notice Channel'
      : '# 📢 Kênh Thông Báo Chào Mừng Thành Viên';

  const desc = isCode
    ? isEn
      ? `> **Current Channel**: ${currentStatus}\n> Auto-posts daily safe codes for 6 maps at 08:00 AM.`
      : `> **Kênh hiện tại**: ${currentStatus}\n> Tự động gửi mật mã 6 bản đồ vào kênh mỗi sáng lúc 08:00.`
    : isEn
      ? `> **Current Channel**: ${currentStatus}\n> Sends a welcome card with member avatar when joining.`
      : `> **Kênh hiện tại**: ${currentStatus}\n> Gửi thiệp chào mừng kèm avatar thành viên mới khi vào server.`;

  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: title,
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content: desc,
      },
    ],
  };

  const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`admin_console_select:${type}:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? `Select a text channel for ${isCode ? 'vault codes' : 'welcome notices'}...`
          : `Chọn kênh văn bản cho ${isCode ? 'mật mã két sắt' : 'thông báo chào mừng'}...`,
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:back:${callerUserId}`)
      .setLabel(isEn ? '◀ Back to Console' : '◀ Quay Lại Bảng Điều Khiển')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_${type}:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Unset Channel' : '🗑️ Gỡ Kênh Hiện Tại')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!currentChannelId),
  );

  return {
    components: [containerJson, selectRow.toJSON(), buttonRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình gán quyền RBAC (In-Place Transition trên cùng Message).
 */
export function buildRolesConfigView(
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const isEn = locale === 'en';

  const adminRoleTag = resolveRoleTag(guild, settings.rbac?.botAdminRoleId, isEn);
  const modRoleTag = resolveRoleTag(guild, settings.rbac?.moderatorRoleId, isEn);

  const title = isEn
    ? '# 🛡️ Bot Management Permissions (RBAC)'
    : '# 🛡️ Phân Quyền Quản Trị Bot (RBAC)';
  const desc = isEn
    ? `> **👑 Bot Admin Role**: ${adminRoleTag}\n` +
      `> *Members with this role have full authority to configure and manage the bot.*\n` +
      `> **🛡️ Moderator Role**: ${modRoleTag}\n` +
      `> *Members with this role can manage vault codes and verify VietQR payments.*`
    : `> **👑 Vai Trò Quản Trị Bot**: ${adminRoleTag}\n` +
      `> *Thành viên có vai trò này có toàn quyền cài đặt & cấu hình bot.*\n` +
      `> **🛡️ Vai Trò Điều Hành (Mod)**: ${modRoleTag}\n` +
      `> *Thành viên có vai trò này được quản lý mã két sắt & duyệt thanh toán VietQR.*`;

  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: title,
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content: desc,
      },
    ],
  };

  const adminSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:role_admin:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '👑 Select server role to grant Bot Admin access...'
          : '👑 Chọn vai trò máy chủ được cấp quyền Quản Trị Bot...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const modSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:role_mod:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🛡️ Select server role to grant Moderator access...'
          : '🛡️ Chọn vai trò máy chủ được cấp quyền Điều Hành (Mod)...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:back:${callerUserId}`)
      .setLabel(isEn ? '◀ Back to Console' : '◀ Quay Lại Bảng Điều Khiển')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_role_admin:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Remove Admin' : '🗑️ Gỡ Quyền Admin')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!settings.rbac?.botAdminRoleId),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_role_mod:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Remove Mod' : '🗑️ Gỡ Quyền Mod')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!settings.rbac?.moderatorRoleId),
  );

  return {
    components: [containerJson, adminSelectRow.toJSON(), modSelectRow.toJSON(), buttonRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}
