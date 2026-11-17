import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
  Guild,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, SettingsService } from '../../services/settings.service.js';
import {
  buildAdminConsoleContainer,
  buildAdminConsoleFooterRow,
  buildAdminEditorColorModal,
  buildAdminEditorHeaderModal,
  buildAdminEditorLinesModal,
  buildAdminEditorMediaModal,
  buildChannelConfigView,
  buildContainerEditorView,
  buildNoticesHubView,
  buildRolesConfigView,
  NoticeType,
} from './admin-console.builder.js';
import {
  deleteAdminEditorSession,
  getAdminEditorSession,
  setAdminEditorSession,
  touchAdminEditorSession,
} from './admin-console.session.js';
import { cloneDefaultSettings } from '../../config/default.settings.js';
import { cloneContainerSettings } from '../container/container-session.js';
import { resolveUserLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { buildContainer } from '../../utils/container.utils.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AdminConsoleHandler');

/**
 * Kiểm tra quyền thao tác trên bảng điều khiển:
 * Chỉ người gọi lệnh, chủ server hoặc thành viên có quyền Administrator mới được thao tác.
 */
function checkAdminConsoleAuthority(
  interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
  callerUserId?: string,
): { allowed: boolean; message?: string } {
  const guild = interaction.guild;
  if (!guild) {
    return { allowed: false, message: 'Bảng điều khiển chỉ hoạt động trong máy chủ.' };
  }
  const isCaller = Boolean(callerUserId && interaction.user.id === callerUserId);
  const isOwner = interaction.user.id === guild.ownerId;
  const isGuildAdmin =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  if (!isCaller && !isOwner && !isGuildAdmin) {
    return {
      allowed: false,
      message:
        '🔒 Chỉ người gọi lệnh hoặc quản trị viên mới có thể thao tác trên bảng điều khiển này.',
    };
  }
  return { allowed: true };
}

/**
 * Lấy SettingsService một cách an toàn.
 */
function resolveSettingsService(
  database?: Database.Database,
  clientDb?: Database.Database,
): SettingsService {
  try {
    return getSettingsService();
  } catch {
    const db = (database ?? clientDb) as Database.Database;
    return new SettingsService(db);
  }
}

/**
 * Helper gửi tin nhắn thông báo thử nghiệm (Welcome, Leave, Booster) vào kênh đã cấu hình.
 */
async function sendTestNoticeCard(
  interaction: ButtonInteraction,
  guild: Guild,
  settingsService: SettingsService,
  type: NoticeType,
  isEn: boolean,
): Promise<void> {
  const settings = settingsService.get(guild.id);
  const tabData = settings[type];
  const channelId = tabData?.channelId;

  const typeNames: Record<NoticeType, { vi: string; en: string }> = {
    welcome: { vi: 'chào mừng', en: 'welcome' },
    leave: { vi: 'tạm biệt', en: 'leave' },
    booster: { vi: 'server booster', en: 'booster' },
  };

  if (!channelId) {
    await interaction.reply({
      content: isEn
        ? `⚠️ ${typeNames[type].en} announcement channel is not configured yet. Please select a channel first!`
        : `⚠️ Chưa cài đặt kênh gửi thông báo ${typeNames[type].vi}. Vui lòng chọn kênh văn bản ở dropdown phía trên trước!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetChannel = guild.channels.cache.get(channelId);
  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: isEn
        ? `⚠️ Cannot access channel <#${channelId}>. Check bot permissions.`
        : `⚠️ Bot không thể truy cập kênh <#${channelId}>. Vui lòng kiểm tra lại quyền của bot trong kênh.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const member =
      interaction.member && 'user' in interaction.member
        ? (interaction.member as Parameters<typeof buildContainer>[1]['member'])
        : await guild.members.fetch(interaction.user.id);

    const testContainer = buildContainer(tabData.container, {
      member,
      guild,
    });

    await targetChannel.send({
      components: testContainer.toJSON() as any,
      flags: MessageFlags.IsComponentsV2,
      files: testContainer.files,
    });

    await interaction.reply({
      content: isEn
        ? `✅ Successfully sent test ${typeNames[type].en} card to <#${channelId}>!`
        : `✅ Đã gửi thiệp ${typeNames[type].vi} thử nghiệm thành công vào kênh <#${channelId}>!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    logger.error(`[AdminConsole] Failed to send test ${type} message`, {
      error: err instanceof Error ? err.message : String(err),
    });
    await interaction.reply({
      content: isEn
        ? '❌ Failed to send test message. Check bot permissions in target channel.'
        : '❌ Gửi tin nhắn thử nghiệm thất bại. Vui lòng kiểm tra quyền gửi tin nhắn của Bot.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Xử lý tất cả các tương tác nút bấm từ Bảng Điều Khiển Server (admin_console:*).
 */
export async function handleAdminConsoleButton(
  interaction: ButtonInteraction,
  database?: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('admin_console:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const action = parts[1];
  const callerUserId = parts[parts.length - 1]; // Caller ID luôn ở cuối cùng

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Bảng điều khiển chỉ hoạt động trong máy chủ.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // ─── User Isolation & Admin Authority Guard ───
  const auth = checkAdminConsoleAuthority(interaction, callerUserId);
  if (!auth.allowed) {
    await interaction.reply({
      content: auth.message ?? 'Không có quyền thao tác.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const settingsService = resolveSettingsService(database, interaction.client?.database);
  const locale = resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';

  // 1. Nhóm Điều Hướng Chính và Làm Mới
  if (action === 'refresh') {
    const freshSettings = settingsService.get(guild.id);
    const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
    const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
    await interaction.update({
      components: [...container.toJSON(), footerRow.toJSON()],
    });
    return { handled: true };
  }

  if (action === 'back') {
    const freshSettings = settingsService.get(guild.id);
    const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
    const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
    await interaction.update({
      components: [...container.toJSON(), footerRow.toJSON()],
    });
    return { handled: true };
  }

  if (action === 'roles') {
    const currentSettings = settingsService.get(guild.id);
    const view = buildRolesConfigView(guild, currentSettings, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  if (action === 'code_channel') {
    const currentSettings = settingsService.get(guild.id);
    const view = buildChannelConfigView(
      'code_channel',
      guild,
      currentSettings,
      callerUserId,
      locale,
    );
    await interaction.update(view);
    return { handled: true };
  }

  // 2. Nhóm Hub Thông Báo Tự Động (Notices Hub)
  if (action === 'notices_hub' || action === 'welcome_channel') {
    const currentSettings = settingsService.get(guild.id);
    const view = buildNoticesHubView(guild, currentSettings, 'welcome', callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  if (action.startsWith('tab_')) {
    const tab = action.replace('tab_', '') as NoticeType;
    const currentSettings = settingsService.get(guild.id);
    const view = buildNoticesHubView(guild, currentSettings, tab, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  // Toggle công tắc bật/tắt thông báo
  if (action === 'welcome_toggle' || action.startsWith('toggle_notice_')) {
    const tab: NoticeType =
      action === 'welcome_toggle'
        ? 'welcome'
        : (action.replace('toggle_notice_', '') as NoticeType);

    const currentSettings = settingsService.get(guild.id);
    const newStatus = !Boolean(currentSettings[tab]?.enabled);

    settingsService.update(guild.id, {
      [tab]: { enabled: newStatus },
    });

    const freshSettings = settingsService.get(guild.id);
    const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  // Gỡ kênh thông báo trong Tab
  if (action.startsWith('reset_notice_chan_')) {
    const tab = action.replace('reset_notice_chan_', '') as NoticeType;
    settingsService.update(guild.id, {
      [tab]: { channelId: null },
    });
    const freshSettings = settingsService.get(guild.id);
    const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  // Gửi tin nhắn thử nghiệm
  if (action === 'test_welcome' || action.startsWith('test_notice_')) {
    const tab: NoticeType =
      action === 'test_welcome' ? 'welcome' : (action.replace('test_notice_', '') as NoticeType);
    await sendTestNoticeCard(interaction, guild, settingsService, tab, isEn);
    return { handled: true };
  }

  // 3. Nhóm Trình Soạn Thảo Live Preview Editor
  if (action.startsWith('edit_container_')) {
    const tab = action.replace('edit_container_', '') as NoticeType;
    const currentSettings = settingsService.get(guild.id);
    const initialContainer =
      currentSettings[tab]?.container ?? cloneDefaultSettings()[tab].container;
    const draft = cloneContainerSettings(initialContainer);

    setAdminEditorSession(interaction.user.id, {
      guildId: guild.id,
      type: tab,
      draft,
      lastInteractionAt: Date.now(),
    });

    const editorView = buildContainerEditorView(draft, tab, callerUserId, locale);
    await interaction.update(editorView);
    return { handled: true };
  }

  // Chỉnh sửa thuộc tính qua Modals
  if (action.startsWith('editor_')) {
    const subAction = parts[1]; // editor_lines, editor_header, editor_color, editor_media, editor_sep, editor_save, editor_reset, editor_cancel
    const tab = parts[2] as NoticeType;

    let session = getAdminEditorSession(interaction.user.id);
    if (!session || session.type !== tab) {
      const currentSettings = settingsService.get(guild.id);
      const initial = currentSettings[tab]?.container ?? cloneDefaultSettings()[tab].container;
      session = {
        guildId: guild.id,
        type: tab,
        draft: cloneContainerSettings(initial),
        lastInteractionAt: Date.now(),
      };
      setAdminEditorSession(interaction.user.id, session);
    }

    touchAdminEditorSession(interaction.user.id);

    if (subAction === 'editor_lines') {
      const modal = buildAdminEditorLinesModal(
        tab,
        callerUserId,
        session.draft.contentLines,
        locale,
      );
      await interaction.showModal(modal);
      return { handled: true };
    }

    if (subAction === 'editor_header') {
      const modal = buildAdminEditorHeaderModal(
        tab,
        callerUserId,
        session.draft.headerTemplate,
        locale,
      );
      await interaction.showModal(modal);
      return { handled: true };
    }

    if (subAction === 'editor_color') {
      const modal = buildAdminEditorColorModal(
        tab,
        callerUserId,
        session.draft.accentColor,
        locale,
      );
      await interaction.showModal(modal);
      return { handled: true };
    }

    if (subAction === 'editor_media') {
      const modal = buildAdminEditorMediaModal(
        tab,
        callerUserId,
        session.draft.mediaUrl,
        session.draft.mediaDescription,
        locale,
      );
      await interaction.showModal(modal);
      return { handled: true };
    }

    if (subAction === 'editor_sep') {
      session.draft.showSeparator = !session.draft.showSeparator;
      touchAdminEditorSession(interaction.user.id);
      const editorView = buildContainerEditorView(session.draft, tab, callerUserId, locale);
      await interaction.update(editorView);
      return { handled: true };
    }

    if (subAction === 'editor_reset') {
      const defaults = cloneDefaultSettings()[tab].container;
      session.draft = cloneContainerSettings(defaults);
      touchAdminEditorSession(interaction.user.id);
      const editorView = buildContainerEditorView(session.draft, tab, callerUserId, locale);
      await interaction.update(editorView);
      return { handled: true };
    }

    if (subAction === 'editor_save') {
      settingsService.update(guild.id, {
        [tab]: { container: session.draft },
      });
      deleteAdminEditorSession(interaction.user.id);
      const freshSettings = settingsService.get(guild.id);
      const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    if (subAction === 'editor_cancel') {
      deleteAdminEditorSession(interaction.user.id);
      const freshSettings = settingsService.get(guild.id);
      const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }
  }

  // 4. Nhóm Gỡ Cấu Hình Phụ Trợ (Reset Roles & Codes)
  if (action === 'reset_code_channel') {
    settingsService.update(guild.id, { dfCodes: { channelId: null } });
    const freshSettings = settingsService.get(guild.id);
    const view = buildChannelConfigView('code_channel', guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  if (action === 'reset_welcome_channel') {
    settingsService.update(guild.id, { welcome: { channelId: null } });
    const freshSettings = settingsService.get(guild.id);
    const view = buildChannelConfigView(
      'welcome_channel',
      guild,
      freshSettings,
      callerUserId,
      locale,
    );
    await interaction.update(view);
    return { handled: true };
  }

  if (action === 'reset_role_admin') {
    settingsService.update(guild.id, { rbac: { botAdminRoleId: null } });
    const freshSettings = settingsService.get(guild.id);
    const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  if (action === 'reset_role_mod') {
    settingsService.update(guild.id, { rbac: { moderatorRoleId: null } });
    const freshSettings = settingsService.get(guild.id);
    const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return { handled: true };
  }

  if (action === 'vietqr') {
    const currentSettings = settingsService.get(guild.id);
    const modal = new ModalBuilder()
      .setCustomId(`admin_console_modal:vietqr:${callerUserId}`)
      .setTitle(isEn ? 'Configure VietQR Banking' : 'Cài Đặt Nhận Tiền VietQR');

    const bankInput = new TextInputBuilder()
      .setCustomId('bank_id')
      .setLabel(isEn ? 'Bank Code (e.g. MB, VCB, ACB, TPB)' : 'Mã ngân hàng (MB, VCB, ACB, TPB...)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VCB, MB, ACB, TPB, BIDV...')
      .setValue(currentSettings.vietqr?.bankId ?? '')
      .setRequired(true);

    const accountNoInput = new TextInputBuilder()
      .setCustomId('account_no')
      .setLabel(isEn ? 'Bank Account Number' : 'Số tài khoản ngân hàng')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('0987654321')
      .setValue(currentSettings.vietqr?.accountNo ?? '')
      .setRequired(true);

    const accountNameInput = new TextInputBuilder()
      .setCustomId('account_name')
      .setLabel(isEn ? 'Account Holder Name (Optional)' : 'Tên chủ tài khoản (không bắt buộc)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('NGUYEN VAN A')
      .setValue(currentSettings.vietqr?.accountName ?? '')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(bankInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(accountNoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(accountNameInput),
    );

    await interaction.showModal(modal);
    return { handled: true };
  }

  if (action === 'help') {
    await interaction.reply({
      content: isEn
        ? '📖 **Comprehensive Bot Delta User Guide:**\n' +
          '• Run `/df help` to open the full 6-page interactive handbook.'
        : '📖 **Cẩm nang hướng dẫn Bot Delta toàn tập:**\n' +
          '• Gõ lệnh `/df help` để mở cẩm nang 6 trang hướng dẫn tra cứu game, thị trường và lệnh bot.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  return { handled: false };
}

/**
 * Xử lý tất cả tương tác Select Menu từ Bảng Điều Khiển (admin_console_select:*).
 */
export async function handleAdminConsoleSelect(
  interaction: AnySelectMenuInteraction,
  database?: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('admin_console_select:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const action = parts[1];
  const callerUserId = parts[parts.length - 1];

  const auth = checkAdminConsoleAuthority(interaction, callerUserId);
  if (!auth.allowed) {
    await interaction.reply({
      content: auth.message ?? 'Không có quyền thao tác.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const guild = interaction.guild!;
  const settingsService = resolveSettingsService(database, interaction.client?.database);
  const locale = resolveUserLocale({ locale: interaction.locale });
  const selectedValue = interaction.values[0];

  switch (action) {
    case 'role_admin': {
      settingsService.update(guild.id, {
        rbac: { botAdminRoleId: selectedValue },
      });
      const freshSettings = settingsService.get(guild.id);
      const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    case 'role_mod': {
      settingsService.update(guild.id, {
        rbac: { moderatorRoleId: selectedValue },
      });
      const freshSettings = settingsService.get(guild.id);
      const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    case 'code_channel': {
      settingsService.update(guild.id, {
        dfCodes: { channelId: selectedValue, enabled: true },
      });
      const freshSettings = settingsService.get(guild.id);
      const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
      const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });
      return { handled: true };
    }

    case 'welcome_channel': {
      settingsService.update(guild.id, {
        welcome: { channelId: selectedValue, enabled: true },
      });
      const freshSettings = settingsService.get(guild.id);
      const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
      const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });
      return { handled: true };
    }

    default: {
      // Xử lý chọn kênh cho các Tab thông báo: notice_chan_welcome, notice_chan_leave, notice_chan_booster
      if (action.startsWith('notice_chan_')) {
        const tab = action.replace('notice_chan_', '') as NoticeType;
        settingsService.update(guild.id, {
          [tab]: { channelId: selectedValue, enabled: true },
        });
        const freshSettings = settingsService.get(guild.id);
        const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
        await interaction.update(view);
        return { handled: true };
      }

      // Xử lý chọn vai trò tự động gán cho: notice_role_welcome, notice_role_booster
      if (action.startsWith('notice_role_')) {
        const tab = action.replace('notice_role_', '') as NoticeType;
        settingsService.update(guild.id, {
          [tab]: { roleId: selectedValue },
        });
        const freshSettings = settingsService.get(guild.id);
        const view = buildNoticesHubView(guild, freshSettings, tab, callerUserId, locale);
        await interaction.update(view);
        return { handled: true };
      }

      return { handled: false };
    }
  }
}

/**
 * Xử lý tất cả tương tác Modal Submit từ Bảng Điều Khiển (admin_console_modal:*).
 */
export async function handleAdminConsoleModal(
  interaction: ModalSubmitInteraction,
  database?: Database.Database,
): Promise<{ handled: boolean }> {
  const customId = interaction.customId;
  if (!customId.startsWith('admin_console_modal:')) {
    return { handled: false };
  }

  const parts = customId.split(':');
  const action = parts[1];
  const callerUserId = parts[parts.length - 1];

  const auth = checkAdminConsoleAuthority(interaction, callerUserId);
  if (!auth.allowed) {
    await interaction.reply({
      content: auth.message ?? 'Không có quyền thao tác.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const guild = interaction.guild!;
  const settingsService = resolveSettingsService(database, interaction.client?.database);
  const locale = resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';

  // 1. Modal cấu hình tài khoản VietQR
  if (action === 'vietqr') {
    const bankId = interaction.fields.getTextInputValue('bank_id').trim().toUpperCase();
    const accountNo = interaction.fields.getTextInputValue('account_no').trim();
    const accountNameRaw = interaction.fields.getTextInputValue('account_name')?.trim();
    const accountName = accountNameRaw ? accountNameRaw.toUpperCase() : null;

    if (!bankId || !accountNo) {
      await interaction.reply({
        content: isEn
          ? '❌ Bank code and account number cannot be empty.'
          : '❌ Mã ngân hàng và số tài khoản không được để trống.',
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    }

    const existingVietQr = settingsService.get(guild.id).vietqr;
    settingsService.update(guild.id, {
      vietqr: {
        ...existingVietQr,
        enabled: true,
        bankId,
        accountNo,
        accountName: accountName ?? existingVietQr?.accountName ?? null,
        prefix: existingVietQr?.prefix ?? 'NAP',
        template: existingVietQr?.template ?? 'compact2',
      },
    });

    await interaction.reply({
      content: isEn
        ? `✅ VietQR Banking updated: **${bankId} • ${accountNo}**${accountName ? ` (${accountName})` : ''}!\nClick **[ Refresh ]** on the Server Control Center to see updates.`
        : `✅ Đã lưu cấu hình nhận tiền VietQR: **${bankId} • ${accountNo}**${accountName ? ` (${accountName})` : ''}!\nBấm **[ Làm Mới ]** trên Bảng Điều Khiển để xem cập nhật.`,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // 2. Modals thuộc Trình Soạn Thảo Live Preview Editor
  if (action.startsWith('editor_')) {
    const subAction = action; // editor_lines, editor_header, editor_color, editor_media
    const tab = parts[2] as NoticeType;

    let session = getAdminEditorSession(interaction.user.id);
    if (!session || session.type !== tab) {
      const currentSettings = settingsService.get(guild.id);
      const initial = currentSettings[tab]?.container ?? cloneDefaultSettings()[tab].container;
      session = {
        guildId: guild.id,
        type: tab,
        draft: cloneContainerSettings(initial),
        lastInteractionAt: Date.now(),
      };
      setAdminEditorSession(interaction.user.id, session);
    }

    touchAdminEditorSession(interaction.user.id);

    if (subAction === 'editor_lines') {
      const rawValue = interaction.fields.getTextInputValue('lines_content');
      session.draft.contentLines = rawValue.split('\n');
    } else if (subAction === 'editor_header') {
      const rawValue = interaction.fields.getTextInputValue('header_value').trim();
      session.draft.headerTemplate = rawValue || null;
    } else if (subAction === 'editor_color') {
      const rawValue = interaction.fields.getTextInputValue('color_value').trim().replace('#', '');
      const parsed = parseInt(rawValue, 16);
      if (!isNaN(parsed)) {
        session.draft.accentColor = parsed;
      }
    } else if (subAction === 'editor_media') {
      const urlRaw = interaction.fields.getTextInputValue('media_url').trim();
      const descRaw = interaction.fields.getTextInputValue('media_description')?.trim();
      session.draft.mediaUrl = urlRaw || null;
      session.draft.mediaDescription = descRaw || null;
    }

    const editorView = buildContainerEditorView(session.draft, tab, callerUserId, locale);
    if (interaction.isFromMessage()) {
      await interaction.update(editorView);
    } else {
      await interaction.reply({
        components: editorView.components,
        flags: editorView.flags | MessageFlags.Ephemeral,
        files: editorView.files,
      });
    }
    return { handled: true };
  }

  return { handled: false };
}
