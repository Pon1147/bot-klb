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
import { t } from '../../infrastructure/i18n/i18n.service.js';
import { buildLivePreviewContainer } from '../container/container-builders.js';
import { MAX_CONTAINER_TEXT_LENGTH, MEDIA_URL_PLACEHOLDER } from '../../config/app.constants.js';
import { BOT_VERSION } from '../../config/version.js';
import { BOT_BRANDING, SUPPORT_DISCORD_INVITE } from '../../config/branding.config.js';
import Database from 'better-sqlite3';
import { checkSubscriptionEntitlement } from '../subscription/subscription.service.js';
import { SubscriptionOrderRecord } from '../../database/subscription.db.js';

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

  const keoConfig = settings.keo;
  const keoDispatchTag = resolveChannelTag(guild, keoConfig?.dispatchChannelId);
  const keoWorkerRoleTag = resolveRoleTag(guild, keoConfig?.workerRoleId, isEn);
  const keoStatus =
    keoConfig?.dispatchChannelId && keoConfig?.workerRoleId
      ? isEn
        ? `Dispatch: ${keoDispatchTag} • Worker: ${keoWorkerRoleTag}`
        : `Kèo: ${keoDispatchTag} • Thợ: ${keoWorkerRoleTag}`
      : isEn
        ? '*Not configured*'
        : '*Chưa thiết lập*';

  // Khối tóm tắt trạng thái hệ thống: Thu gọn 2 dòng, không lặp lại chi tiết các mục bên dưới
  const statusSummary = isEn
    ? `> 👑 **Server Owner:** <@${guild.ownerId}> • **Bot Version:** \`v${BOT_VERSION}\`\n` +
      `> ⚙️ **Quick Status:** Admin: ${adminRole} • Welcome: ${welcomeText} • VietQR: ${vietqrInfo}`
    : `> 👑 **Chủ Server:** <@${guild.ownerId}> • **Phiên Bản:** \`v${BOT_VERSION}\`\n` +
      `> ⚙️ **Tổng Quan:** Admin: ${adminRole} • Chào mừng: ${welcomeText} • VietQR: ${vietqrInfo}`;

  const containerInner: unknown[] = [
    // 1. Header Section với nút Làm Mới góc trên bên phải
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn ? '## ⚙️ Server Control Center' : '## ⚙️ Bảng Điều Khiển Máy Chủ',
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
            ? `🛡️ **Staff & Permissions**\nAdmin: ${adminRole} • Mod: ${modRole}`
            : `🛡️ **Phân Quyền Quản Trị**\nAdmin: ${adminRole} • Mod: ${modRole}`,
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:roles:${callerUserId}`,
        label: isEn ? 'Configure' : 'Cài Đặt',
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
            ? `🎁 **Daily Vault Codes**\n${codeStatus}`
            : `🎁 **Mật Mã Két Sắt DF**\n${codeStatus}`,
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:code_channel:${callerUserId}`,
        label: isEn ? 'Configure' : 'Cài Đặt',
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
            ? `🔔 **Automated Notices**\n• Welcome: ${welcomeText}\n• Leave: ${leaveText}\n• Booster: ${boosterText}`
            : `🔔 **Thông Báo Tự Động**\n• Chào mừng: ${welcomeText}\n• Tạm biệt: ${leaveText}\n• Booster: ${boosterText}`,
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:notices_hub:${callerUserId}`,
        label: isEn ? 'Configure' : 'Cài Đặt',
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
            ? `💳 **VietQR Transfer**\n${vietqrInfo}`
            : `💳 **Tài Khoản VietQR**\n${vietqrInfo}`,
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:vietqr:${callerUserId}`,
        label: isEn ? 'Configure' : 'Cài Đặt',
        style: ButtonStyle.Secondary,
      },
    },

    // 9. Section: Dịch vụ Kéo Lão Bản (Delta Force Carry Service)
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? `💎 **Carry Service (Lão Bản)**\n${keoStatus}`
            : `💎 **Dịch Vụ Kéo Lão Bản**\n${keoStatus}`,
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:keo:${callerUserId}`,
        label: isEn ? 'Configure' : 'Cài Đặt',
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
      .setURL(SUPPORT_DISCORD_INVITE),
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

/**
 * Xây dựng màn hình cài đặt Dịch Vụ Kéo Lão Bản (In-Place Transition trên cùng Message).
 */
export function buildKeoConfigView(
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
  db?: Database.Database,
): { components: any[]; flags: number } {
  const isEn = locale === 'en';
  const keo = settings.keo;

  let subStatusText = '';
  let trialUsed = false;
  if (db) {
    const entitlement = checkSubscriptionEntitlement(db, guild.id);
    subStatusText = isEn
      ? `> 💎 **Subscription Status**: ${entitlement.statusText}\n`
      : `> 💎 **Bản Quyền Dịch Vụ**: ${entitlement.statusText}\n`;
    try {
      const subRecord = db
        .prepare('SELECT trial_used FROM guild_subscriptions WHERE guild_id = ?')
        .get(guild.id) as { trial_used: number } | undefined;
      trialUsed = subRecord?.trial_used === 1;
    } catch {
      // Ignored if table not ready
    }
  }

  const dispatchTag =
    resolveChannelTag(guild, keo?.dispatchChannelId) ??
    (isEn ? '*Not configured*' : '*Chưa đặt kênh*');
  const categoryTag = keo?.ticketCategoryId
    ? guild.channels.cache.get(keo.ticketCategoryId)?.name
      ? `📁 ${guild.channels.cache.get(keo.ticketCategoryId)!.name}`
      : `<#${keo.ticketCategoryId}>`
    : isEn
      ? '*All categories / Not set*'
      : '*Tất cả hoặc chưa chọn*';
  const workerRoleTag = resolveRoleTag(guild, keo?.workerRoleId, isEn);

  const t1Tag = resolveRoleTag(guild, keo?.tier1RoleId, isEn);
  const t2Tag = resolveRoleTag(guild, keo?.tier2RoleId, isEn);
  const t3Tag = resolveRoleTag(guild, keo?.tier3RoleId, isEn);

  const hasVietQr = Boolean(settings.vietqr?.bankId && settings.vietqr?.accountNo);
  const hasDispatch = Boolean(keo?.dispatchChannelId);
  const hasWorker = Boolean(keo?.workerRoleId);
  const hasCategory = Boolean(keo?.ticketCategoryId);

  const checklistText = isEn
    ? `### 📋 Setup Workflow Checklist\n` +
      `> ${hasVietQr ? '🟢' : '🔴'} **Step 1: VietQR Banking**: ${hasVietQr ? 'Configured' : '*Missing (Needed for payments)*'}\n` +
      `> ${hasDispatch ? '🟢' : '🔴'} **Step 2: Dispatch Channel**: ${dispatchTag}\n` +
      `> ${hasWorker ? '🟢' : '🔴'} **Step 3: Worker Role**: ${workerRoleTag}\n` +
      `> ${hasCategory ? '🟢' : '🟡'} **Step 4: Ticket Category**: ${categoryTag}\n` +
      `> 💡 **Step 5: Ticket Naming**: Configure ticket bot naming as \`ticket-%username%\``
    : `### 📋 Quy Trình Thiết Lập (Workflow Checklist)\n` +
      `> ${hasVietQr ? '🟢' : '🔴'} **Bước 1: Tài khoản VietQR**: ${hasVietQr ? 'Đã cài đặt' : '*Chưa cài (Cần để xuất mã QR thanh toán)*'}\n` +
      `> ${hasDispatch ? '🟢' : '🔴'} **Bước 2: Kênh Bắn Kèo**: ${dispatchTag}\n` +
      `> ${hasWorker ? '🟢' : '🔴'} **Bước 3: Vai Trò Thợ Kéo**: ${workerRoleTag}\n` +
      `> ${hasCategory ? '🟢' : '🟡'} **Bước 4: Nhóm Category Ticket**: ${categoryTag}\n` +
      `> 💡 **Bước 5: Định Dạng Kênh Ticket**: Cấu hình ticket bot định dạng \`ticket-%username%\``;

  const title = isEn ? '# 💎 Delta Force Carry Service Setup' : '# 💎 Cấu Hình Dịch Vụ Kéo Lão Bản';

  const desc = isEn
    ? `${subStatusText}${checklistText}\n\n` +
      `> **🎯 Dispatch Channel (Required)**: ${dispatchTag}\n` +
      `> *Channel where available carry orders are posted for workers to claim.*\n` +
      `> **📁 Ticket Category (Filter)**: ${categoryTag}\n` +
      `> *Only tickets created under this category trigger carry dispatch cards.*\n` +
      `> **🛠️ Worker Role (Required)**: ${workerRoleTag}\n` +
      `> *Members with this role are authorized to claim orders.*\n` +
      `> **👑 VIP Roles (Optional)**: Lv1: ${t1Tag} • Lv2: ${t2Tag} • Lv3: ${t3Tag}`
    : `${subStatusText}${checklistText}\n\n` +
      `> **🎯 Kênh Bắn Kèo (Bắt buộc)**: ${dispatchTag}\n` +
      `> *Kênh bot hiển thị thẻ đơn kéo để thợ theo dõi và bấm nhận.*\n` +
      `> **📁 Nhóm Kênh Ticket (Lọc)**: ${categoryTag}\n` +
      `> *Chỉ ticket tạo trong nhóm này mới kích hoạt hiển thị đơn kéo.*\n` +
      `> **🛠️ Vai Trò Thợ Kéo (Bắt buộc)**: ${workerRoleTag}\n` +
      `> *Thành viên có vai trò này mới được quyền bấm nhận đơn.*\n` +
      `> **👑 Role Lão Bản VIP (Tùy chọn)**: Lv1: ${t1Tag} • Lv2: ${t2Tag} • Lv3: ${t3Tag}`;

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

  const dispatchSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_dispatch:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🎯 Select dispatch channel for carry orders...'
          : '🎯 Chọn kênh thông báo đơn kéo cho thợ nhận...',
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const categorySelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_category:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '📁 Select ticket category to listen for new orders...'
          : '📁 Chọn nhóm Category chứa ticket mở đơn...',
      )
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const workerSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_worker:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🛠️ Select Worker role authorized to claim orders...'
          : '🛠️ Chọn vai trò Thợ Kéo được phép nhận đơn...',
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
      .setCustomId(`admin_console:keo_vip:${callerUserId}`)
      .setLabel(isEn ? '👑 VIP Roles' : '👑 Role Lão Bản (VIP)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:vietqr_workflow:${callerUserId}`)
      .setLabel(isEn ? '⭐ Feedback Channel' : '⭐ Kênh Đánh Giá 5 Sao')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_keo:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Reset Carry Config' : '🗑️ Gỡ Cấu Hình')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!keo?.dispatchChannelId && !keo?.workerRoleId && !keo?.ticketCategoryId),
  );

  const subButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_buy:${callerUserId}`)
      .setLabel(t('sub.btn_buy', undefined, locale))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_trial:${callerUserId}`)
      .setLabel(t(trialUsed ? 'sub.btn_trial_used' : 'sub.btn_trial', undefined, locale))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(trialUsed),
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_key:${callerUserId}`)
      .setLabel(t('sub.btn_key', undefined, locale))
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    components: [
      containerJson,
      subButtonRow.toJSON(),
      dispatchSelectRow.toJSON(),
      categorySelectRow.toJSON(),
      workerSelectRow.toJSON(),
      buttonRow.toJSON(),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình cài đặt Role Lão Bản VIP (Tùy chọn - không bắt buộc).
 */
export function buildKeoVipRolesView(
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const isEn = locale === 'en';
  const keo = settings.keo;

  const t1Tag = resolveRoleTag(guild, keo?.tier1RoleId, isEn);
  const t2Tag = resolveRoleTag(guild, keo?.tier2RoleId, isEn);
  const t3Tag = resolveRoleTag(guild, keo?.tier3RoleId, isEn);

  const title = isEn
    ? '# 👑 VIP Customer Roles (Lão Bản Tiers)'
    : '# 👑 Phân Hạng Role Lão Bản (VIP Tùy Chọn)';

  const desc = isEn
    ? `> **🥉 Tier 1 (Lv1 >= 500k)**: ${t1Tag}\n` +
      `> **🥈 Tier 2 (Lv2 >= 3,000k)**: ${t2Tag}\n` +
      `> **🥇 Tier 3 (Lv3 >= 10,000k)**: ${t3Tag}\n` +
      `> 💡 *Automatic tier upgrade when spending thresholds are met. Optional: if not set, spending is still tracked with 0 errors.*`
    : `> **🥉 Hạng 1 (Lão Bản Lv1 >= 500k)**: ${t1Tag}\n` +
      `> **🥈 Hạng 2 (Lão Bản Lv2 >= 3.000k)**: ${t2Tag}\n` +
      `> **🥇 Hạng 3 (Lão Bản Lv3 >= 10.000k)**: ${t3Tag}\n` +
      `> 💡 *Hệ thống tự động thăng hạng vai trò khi khách tích lũy đủ chi tiêu. Tùy chọn: nếu không gán role, bot vẫn cộng dồn chi tiêu bình thường.*`;

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

  const t1SelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_tier1:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🥉 Select role for Tier 1 (>= 500k)...'
          : '🥉 Chọn vai trò cho Lão Bản Lv1 (>= 500k)...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const t2SelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_tier2:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🥈 Select role for Tier 2 (>= 3,000k)...'
          : '🥈 Chọn vai trò cho Lão Bản Lv2 (>= 3.000k)...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const t3SelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:keo_tier3:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🥇 Select role for Tier 3 (>= 10,000k)...'
          : '🥇 Chọn vai trò cho Lão Bản Lv3 (>= 10.000k)...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:keo:${callerUserId}`)
      .setLabel(isEn ? '◀ Back to Carry Setup' : '◀ Quay Lại Cài Đặt Kéo')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_keo_vip:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Clear VIP Roles' : '🗑️ Gỡ Hết Role VIP')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!keo?.tier1RoleId && !keo?.tier2RoleId && !keo?.tier3RoleId),
  );

  return {
    components: [
      containerJson,
      t1SelectRow.toJSON(),
      t2SelectRow.toJSON(),
      t3SelectRow.toJSON(),
      buttonRow.toJSON(),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình cài đặt VietQR Payment Workflow & Feedback 5 sao (In-Place Transition).
 */
export function buildVietQrWorkflowView(
  guild: Guild,
  settings: GuildSettings,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const isEn = locale === 'en';
  const vqr = settings.vietqr;

  const feedbackChanTag =
    resolveChannelTag(guild, vqr?.feedbackChannelId) ??
    (isEn ? '*Not configured (private reply only)*' : '*Chưa đặt kênh (chỉ gửi riêng cho khách)*');
  const staffRoleTag = resolveRoleTag(guild, vqr?.staffRoleId, isEn);
  const ratingStatus =
    vqr?.enableRating !== false
      ? isEn
        ? '🟢 Enabled'
        : '🟢 Đang Bật'
      : isEn
        ? '🔴 Disabled'
        : '🔴 Đang Tắt';

  const title = isEn
    ? '# ⚙️ VietQR Workflow & Feedback Setup'
    : '# ⚙️ Quy Trình Thanh Toán & Đánh Giá VietQR';

  const desc = isEn
    ? `> **⭐ Feedback Channel**: ${feedbackChanTag}\n` +
      `> *Channel where 1–5 star customer reviews and thank-you notes are posted publicly.*\n` +
      `> **🛡️ Staff Role (Approver)**: ${staffRoleTag}\n` +
      `> *Authorized staff role to confirm/cancel payments in addition to Server Owner.*\n` +
      `> **⭐ Star Ratings**: ${ratingStatus}\n` +
      `> *Show 1–5 star rating buttons after order completion.*`
    : `> **⭐ Kênh Nhận Đánh Giá 5 Sao**: ${feedbackChanTag}\n` +
      `> *Kênh bot tự động gửi thông báo cảm ơn và vinh danh đánh giá sao từ khách.*\n` +
      `> **🛡️ Vai Trò Nhân Viên Duyệt Đơn**: ${staffRoleTag}\n` +
      `> *Vai trò nhân viên/thợ được quyền duyệt tiền và hủy đơn ngoài Chủ Server.*\n` +
      `> **⭐ Đánh Giá 1–5 Sao**: ${ratingStatus}\n` +
      `> *Hiển thị 5 nút đánh giá sao cho khách sau khi hoàn tất đơn.*`;

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

  const feedbackSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`admin_console_select:vietqr_feedback:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '⭐ Select channel to receive 5-star customer feedback...'
          : '⭐ Chọn kênh nhận tin nhắn đánh giá 5 sao từ khách...',
      )
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const staffSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`admin_console_select:vietqr_staff:${callerUserId}`)
      .setPlaceholder(
        isEn
          ? '🛡️ Select Staff role authorized to approve/cancel orders...'
          : '🛡️ Chọn vai trò Nhân Viên được quyền duyệt tiền/hủy đơn...',
      )
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:keo:${callerUserId}`)
      .setLabel(isEn ? '◀ Back to Carry Setup' : '◀ Quay Lại Cài Đặt Kéo')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:vietqr_toggle_rating:${callerUserId}`)
      .setLabel(
        vqr?.enableRating !== false
          ? isEn
            ? '⭐ Disable Ratings'
            : '⭐ Tắt Đánh Giá'
          : isEn
            ? '⭐ Enable Ratings'
            : '⭐ Bật Đánh Giá',
      )
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`admin_console:reset_vietqr_workflow:${callerUserId}`)
      .setLabel(isEn ? '🗑️ Reset Workflow' : '🗑️ Gỡ Cấu Hình')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!vqr?.feedbackChannelId && !vqr?.staffRoleId),
  );

  return {
    components: [
      containerJson,
      feedbackSelectRow.toJSON(),
      staffSelectRow.toJSON(),
      buttonRow.toJSON(),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình chọn gói bản quyền Subscription (1 Tháng, 3 Tháng, 6 Tháng).
 */
export function buildSubscriptionPackagesView(
  _guild: Guild,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): { components: any[]; flags: number } {
  const containerJson = {
    type: ComponentType.Container,
    components: [
      {
        type: ComponentType.TextDisplay,
        content: t('sub.packages_title', undefined, locale),
      },
      {
        type: ComponentType.Separator,
        accentColor: COLORS.DF,
      },
      {
        type: ComponentType.TextDisplay,
        content: t('sub.packages_body', undefined, locale),
      },
      {
        type: ComponentType.Separator,
      },
      {
        type: ComponentType.TextDisplay,
        content: `*${BOT_BRANDING.watermarkText}*`,
      },
    ],
  };

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_create:1_MONTH:${callerUserId}`)
      .setLabel(t('sub.pkg_1m', undefined, locale))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_create:3_MONTHS:${callerUserId}`)
      .setLabel(t('sub.pkg_3m', undefined, locale))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`admin_console:sub_create:6_MONTHS:${callerUserId}`)
      .setLabel(t('sub.pkg_6m', undefined, locale))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`admin_console:keo:${callerUserId}`)
      .setLabel(t('sub.btn_back', undefined, locale))
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    components: [containerJson, actionRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng màn hình hóa đơn thanh toán kèm link PayOS và nút Kiểm Tra Lại.
 */
export function buildSubscriptionOrderView(
  order: SubscriptionOrderRecord,
  callerUserId: string,
  locale: SupportedLocale = 'vi',
  hasQrAttachment = false,
): { components: any[]; flags: number } {
  const expiryTimestamp = Math.floor(order.expires_at / 1000);
  const qrUrl = hasQrAttachment
    ? 'attachment://sub_qr.png'
    : order.qr_code
      ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(order.qr_code)}`
      : null;

  const containerComponents: any[] = [
    {
      type: ComponentType.TextDisplay,
      content:
        `${t('sub.qr_title', undefined, locale)}\n` +
        t(
          'sub.qr_meta',
          {
            amount: order.amount.toLocaleString('vi-VN'),
            days: order.duration_days,
            expiry: expiryTimestamp,
          },
          locale,
        ),
    },
  ];

  if (qrUrl) {
    containerComponents.push({
      type: ComponentType.MediaGallery,
      items: [
        {
          media: { url: qrUrl },
          description: 'VietQR',
        },
      ],
    });
  }

  containerComponents.push({
    type: ComponentType.TextDisplay,
    content: t('sub.qr_waiting', { orderCode: order.order_code }, locale),
  });

  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  if (!qrUrl && order.checkout_url) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setLabel(t('sub.btn_open_checkout', undefined, locale))
        .setStyle(ButtonStyle.Link)
        .setURL(order.checkout_url),
    );
  }

  buttonRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`keo:sub_recheck:${order.order_code}`)
      .setLabel(t('sub.btn_recheck', undefined, locale))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`admin_console:keo:${callerUserId}`)
      .setLabel(t('sub.btn_back', undefined, locale))
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    components: [
      { type: ComponentType.Container, components: containerComponents },
      buttonRow.toJSON(),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Xây dựng Modal nhập mã bản quyền (KLB-XXXX-XXXX-XXXX-XXXX).
 */
export function buildKeyRedemptionModal(
  callerUserId: string,
  locale: SupportedLocale = 'vi',
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`admin_console_modal:sub_key:${callerUserId}`)
    .setTitle(t('sub.key_modal_title', undefined, locale))
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('key_input')
          .setLabel(t('sub.key_modal_label', undefined, locale))
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('KLB-ABCD-1234-EF56-7890')
          .setMinLength(15)
          .setMaxLength(35)
          .setRequired(true),
      ),
    );
}
