import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  Guild,
  MessageFlags,
  RoleSelectMenuBuilder,
} from 'discord.js';
import { GuildSettings } from '../../types/settings.types.js';
import { BuildContainerResult, makeResult } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';

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

  const welcomeEnabled = Boolean(settings.welcome?.enabled);
  const welcomeChanTag = resolveChannelTag(guild, settings.welcome?.channelId);
  const welcomeStatus = welcomeChanTag
    ? `${welcomeChanTag} (${welcomeEnabled ? (isEn ? '🟢 Enabled' : '🟢 Đang Bật') : isEn ? '🔴 Disabled' : '🔴 Đang Tắt'})`
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
      `> **📢 Welcome**: ${welcomeStatus}\n` +
      `> **🎁 Vault Codes**: ${codeStatus}\n` +
      `> **💳 VietQR**: ${vietqrInfo}`
    : `> **👑 Chủ Server**: <@${guild.ownerId}>\n` +
      `> **🛡️ Admin**: ${adminRole} • **Mod**: ${modRole}\n` +
      `> **📢 Chào Mừng**: ${welcomeStatus}\n` +
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

    // 7. Section: Kênh thông báo Chào mừng
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '📢 **Welcome Notice** — Member welcome card with custom avatar'
            : '📢 **Kênh Chào Mừng** — Gửi thiệp welcome khi có thành viên mới',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:welcome_channel:${callerUserId}`,
        label: isEn ? 'Set Channel' : 'Đặt Kênh',
        style: ButtonStyle.Secondary,
      },
    },

    // 8. Section: Bật / Tắt Chào Mừng (Toggle 1-chạm)
    {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content: isEn
            ? '⚡ **Welcome Switch** — Toggle announcements without losing settings'
            : '⚡ **Công Tắc Chào Mừng** — Bật/tắt thông báo mà không mất cài đặt',
        },
      ],
      accessory: {
        type: ComponentType.Button,
        custom_id: `admin_console:welcome_toggle:${callerUserId}`,
        label: welcomeEnabled
          ? isEn
            ? '🟢 Enabled'
            : '🟢 Đang Bật'
          : isEn
            ? '🔴 Disabled'
            : '🔴 Đang Tắt',
        style: welcomeEnabled ? ButtonStyle.Success : ButtonStyle.Secondary,
      },
    },

    // 9. Section: Cấu hình nhận tiền VietQR
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
      .setCustomId(`admin_console:test_welcome:${callerUserId}`)
      .setLabel(isEn ? '🧪 Test Welcome' : '🧪 Thử Nghiệm Chào Mừng')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel(isEn ? '💬 Support Server' : '💬 Hỗ Trợ Server')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/vz6w6c3Xe3'),
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
