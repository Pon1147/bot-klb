import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
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
  buildChannelConfigView,
  buildRolesConfigView,
} from './admin-console.builder.js';
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
  const callerUserId = parts[2];

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Bảng điều khiển chỉ hoạt động trong máy chủ.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // ─── User Isolation & Admin Authority Guard ───
  // Chỉ người gọi lệnh, chủ server hoặc thành viên có quyền Administrator mới được thao tác
  const isCaller = callerUserId && interaction.user.id === callerUserId;
  const isOwner = interaction.user.id === guild.ownerId;
  const isGuildAdmin =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  if (!isCaller && !isOwner && !isGuildAdmin) {
    await interaction.reply({
      content:
        '🔒 Chỉ người gọi lệnh hoặc quản trị viên mới có thể thao tác trên bảng điều khiển này.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const db = (database ?? interaction.client?.database) as Database.Database;
  let settingsService: SettingsService;
  try {
    settingsService = getSettingsService();
  } catch {
    settingsService = new SettingsService(db);
  }
  const locale = resolveUserLocale({ locale: interaction.locale });
  const isEn = locale === 'en';

  switch (action) {
    case 'refresh': {
      const freshSettings = settingsService.get(guild.id);
      const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
      const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);

      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });
      return { handled: true };
    }

    case 'welcome_toggle': {
      const currentSettings = settingsService.get(guild.id);
      const newStatus = !Boolean(currentSettings.welcome?.enabled);

      settingsService.update(guild.id, {
        welcome: { enabled: newStatus },
      });

      const updatedSettings = settingsService.get(guild.id);
      const container = buildAdminConsoleContainer(guild, updatedSettings, callerUserId, locale);
      const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);

      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });

      logger.info(
        `[AdminConsole] User ${interaction.user.id} toggled welcome to ${newStatus} in guild ${guild.id}`,
      );
      return { handled: true };
    }

    case 'test_welcome': {
      const settings = settingsService.get(guild.id);
      const channelId = settings.welcome?.channelId;

      if (!channelId) {
        await interaction.reply({
          content: isEn
            ? '⚠️ Welcome channel is not set yet. Click **Set Channel** first!'
            : '⚠️ Chưa cài đặt kênh chào mừng. Vui lòng bấm nút **[ Đặt Kênh Chào ]** trước!',
          flags: MessageFlags.Ephemeral,
        });
        return { handled: true };
      }

      const targetChannel = guild.channels.cache.get(channelId);
      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({
          content: isEn
            ? `⚠️ Cannot access channel <#${channelId}>. Check bot permissions.`
            : `⚠️ Bot không thể truy cập kênh <#${channelId}>. Vui lòng kiểm tra lại quyền của bot trong kênh.`,
          flags: MessageFlags.Ephemeral,
        });
        return { handled: true };
      }

      try {
        const member =
          interaction.member && 'user' in interaction.member
            ? (interaction.member as Parameters<typeof buildContainer>[1]['member'])
            : await guild.members.fetch(interaction.user.id);

        const testContainer = buildContainer(settings.welcome.container, {
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
            ? `✅ Successfully sent test welcome card to <#${channelId}>!`
            : `✅ Đã gửi thiệp chào mừng thử nghiệm thành công vào kênh <#${channelId}>!`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        logger.error('[AdminConsole] Failed to send test welcome message', {
          error: err instanceof Error ? err.message : String(err),
        });
        await interaction.reply({
          content: isEn
            ? '❌ Failed to send test message. Check bot permissions in target channel.'
            : '❌ Gửi tin nhắn thử nghiệm thất bại. Vui lòng kiểm tra quyền gửi tin nhắn của Bot.',
          flags: MessageFlags.Ephemeral,
        });
      }
      return { handled: true };
    }

    case 'roles': {
      const currentSettings = settingsService.get(guild.id);
      const view = buildRolesConfigView(guild, currentSettings, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    case 'code_channel': {
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

    case 'welcome_channel': {
      const currentSettings = settingsService.get(guild.id);
      const view = buildChannelConfigView(
        'welcome_channel',
        guild,
        currentSettings,
        callerUserId,
        locale,
      );
      await interaction.update(view);
      return { handled: true };
    }

    case 'back': {
      const freshSettings = settingsService.get(guild.id);
      const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
      const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });
      return { handled: true };
    }

    case 'reset_code_channel': {
      settingsService.update(guild.id, { dfCodes: { channelId: null } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildChannelConfigView(
        'code_channel',
        guild,
        freshSettings,
        callerUserId,
        locale,
      );
      await interaction.update(view);
      return { handled: true };
    }

    case 'reset_welcome_channel': {
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

    case 'reset_role_admin': {
      settingsService.update(guild.id, { rbac: { botAdminRoleId: null } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    case 'reset_role_mod': {
      settingsService.update(guild.id, { rbac: { moderatorRoleId: null } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildRolesConfigView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return { handled: true };
    }

    case 'vietqr': {
      const currentSettings = settingsService.get(guild.id);
      const modal = new ModalBuilder()
        .setCustomId(`admin_console_modal:vietqr:${callerUserId}`)
        .setTitle(isEn ? 'Configure VietQR Banking' : 'Cài Đặt Nhận Tiền VietQR');

      const bankInput = new TextInputBuilder()
        .setCustomId('bank_id')
        .setLabel(
          isEn ? 'Bank Code (e.g. MB, VCB, ACB, TPB)' : 'Mã ngân hàng (MB, VCB, ACB, TPB...)',
        )
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

    case 'help': {
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

    default:
      return { handled: false };
  }
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
  const callerUserId = parts[2];

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

    default:
      return { handled: false };
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
  const callerUserId = parts[2];

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

  switch (action) {
    case 'vietqr': {
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
          enabled: true,
          bankId,
          accountNo,
          accountName: accountName ?? null,
          prefix: existingVietQr?.prefix ?? 'NAP',
          template: existingVietQr?.template ?? 'compact',
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

    default:
      return { handled: false };
  }
}
