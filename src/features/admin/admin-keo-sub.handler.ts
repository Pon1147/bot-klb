/**
 * Handler chuyên trách mảng Kéo Lão Bản, Bản quyền (Subscription/PayOS/Key) & VietQR trong Admin Console.
 */

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonInteraction,
  Guild,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Database from 'better-sqlite3';
import { SettingsService } from '../../services/settings.service.js';
import { SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { t } from '../../infrastructure/i18n/i18n.service.js';
import { createPayosPaymentLink } from '../../services/payos.service.js';
import { normalizeBankCode } from '../../utils/vietqr.utils.js';
import {
  KEO_PACKAGES,
  getPendingOrderForGuild,
  createSubscriptionOrder,
  activateTrial,
  consumeLicenseKey,
  checkSubscriptionEntitlement,
} from '../subscription/subscription.service.js';
import { buildAdminConsoleContainer, buildAdminConsoleFooterRow } from './admin-console.builder.js';
import {
  buildKeoConfigView,
  buildKeoVipRolesView,
  buildVietQrWorkflowView,
  buildSubscriptionPackagesView,
  buildSubscriptionOrderView,
  buildKeyRedemptionModal,
} from './admin-keo-sub.builder.js';

// Bộ đếm chống brute-force mã bản quyền: tối đa 5 lần nhập sai / 15 phút / Guild
const KEY_FAIL_WINDOW_MS = 15 * 60_000;
const MAX_KEY_FAILURES = 5;
const keyFailuresByGuild = new Map<string, number[]>();

/**
 * Xử lý các nút bấm thuộc mảng Kéo Lão Bản, Subscription và VietQR.
 */
export async function handleAdminKeoSubButton(
  interaction: ButtonInteraction,
  action: string,
  parts: string[],
  guild: Guild,
  callerUserId: string,
  locale: SupportedLocale,
  settingsService: SettingsService,
  database?: Database.Database,
): Promise<boolean> {
  const isEn = locale === 'en';

  if (action === 'keo') {
    const currentSettings = settingsService.get(guild.id);
    const db = (database ?? interaction.client?.database) as Database.Database;
    const view = buildKeoConfigView(guild, currentSettings, callerUserId, locale, db);
    await interaction.update(view);
    return true;
  }

  if (action === 'keo_vip') {
    const currentSettings = settingsService.get(guild.id);
    const view = buildKeoVipRolesView(guild, currentSettings, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'reset_keo') {
    settingsService.update(guild.id, {
      keo: {
        ticketCategoryId: null,
        dispatchChannelId: null,
        workerRoleId: null,
      },
    });
    const freshSettings = settingsService.get(guild.id);
    const db = (database ?? interaction.client?.database) as Database.Database;
    const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);
    await interaction.update(view);
    return true;
  }

  if (action === 'reset_keo_vip') {
    settingsService.update(guild.id, {
      keo: {
        tier1RoleId: null,
        tier2RoleId: null,
        tier3RoleId: null,
      },
    });
    const freshSettings = settingsService.get(guild.id);
    const view = buildKeoVipRolesView(guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'sub_buy') {
    const view = buildSubscriptionPackagesView(guild, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'sub_create') {
    const packageType = parts[2] as '1_MONTH' | '3_MONTHS' | '6_MONTHS';
    const pkg = KEO_PACKAGES[packageType];
    if (!pkg) {
      await interaction.reply({
        content: t('sub.invalid_pkg', undefined, locale),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.deferUpdate();
    const db = (database ?? interaction.client?.database) as Database.Database;

    let order = getPendingOrderForGuild(db, guild.id, packageType);
    if (!order) {
      const orderCode = Number(
        `${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`,
      );
      const expiresAt = Date.now() + 15 * 60 * 1000;

      const payosRes = await createPayosPaymentLink({
        orderCode,
        amount: pkg.amount,
        description: `Sub ${pkg.durationDays}d`,
      });

      if (!payosRes.success) {
        await interaction.followUp({
          content: t('sub.payos_create_failed', { error: payosRes.error || 'network' }, locale),
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      order = createSubscriptionOrder(db, {
        orderCode,
        guildId: guild.id,
        userId: interaction.user.id,
        packageType,
        durationDays: pkg.durationDays,
        amount: pkg.amount,
        checkoutUrl: payosRes.data?.checkoutUrl ?? null,
        qrCode: payosRes.data?.qrCode ?? null,
        expiresAt,
      });
    }

    const files: AttachmentBuilder[] = [];
    if (order.qr_code) {
      try {
        const qrRes = await fetch(
          `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(order.qr_code)}`,
          { signal: AbortSignal.timeout(4000) },
        ).catch(() => null);
        if (qrRes && qrRes.ok) {
          const qrBuffer = Buffer.from(await qrRes.arrayBuffer());
          files.push(new AttachmentBuilder(qrBuffer, { name: 'sub_qr.png' }));
        }
      } catch {
        // Fallback sang URL trực tiếp nếu fetch buffer thất bại
      }
    }

    const view = buildSubscriptionOrderView(order, callerUserId, locale, files.length > 0);
    await interaction.editReply({
      ...view,
      files,
    });
    return true;
  }

  if (action === 'sub_trial') {
    const db = (database ?? interaction.client?.database) as Database.Database;
    const res = activateTrial(db, guild.id);
    if (res.success) {
      const expiry = Math.floor(res.expiresAt! / 1000);
      const freshSettings = settingsService.get(guild.id);
      const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);
      await interaction.update(view);
      await interaction.followUp({
        content: t('sub.trial_activated', { expiry }, locale),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: t('sub.trial_already_used', undefined, locale),
        flags: MessageFlags.Ephemeral,
      });
    }
    return true;
  }

  if (action === 'sub_key') {
    const modal = buildKeyRedemptionModal(callerUserId, locale);
    await interaction.showModal(modal);
    return true;
  }

  if (action === 'vietqr_workflow') {
    const resolvedDb =
      database ?? (interaction.client as { database?: Database.Database })?.database;
    const entitlement = checkSubscriptionEntitlement(resolvedDb, guild.id);
    if (!entitlement.isEntitled) {
      await interaction.reply({
        content: isEn
          ? '🔒 VietQR features require an active subscription (3-day Trial, License Key, or PayOS plan). Open **Carry Service (Lão Bản)** to activate.'
          : '🔒 Tính năng VietQR yêu cầu bản quyền dịch vụ (Dùng thử 3 ngày, Nhập Key hoặc Gia hạn). Vui lòng vào mục **Dịch Vụ Kéo Lão Bản** để kích hoạt!',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const currentSettings = settingsService.get(guild.id);
    const view = buildVietQrWorkflowView(guild, currentSettings, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'vietqr_toggle_rating') {
    const currentSettings = settingsService.get(guild.id);
    const currentVal = currentSettings.vietqr?.enableRating !== false;
    settingsService.update(guild.id, {
      vietqr: { enableRating: !currentVal },
    });
    const freshSettings = settingsService.get(guild.id);
    const view = buildVietQrWorkflowView(guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'reset_vietqr_workflow') {
    settingsService.update(guild.id, {
      vietqr: { feedbackChannelId: null, staffRoleId: null },
    });
    const freshSettings = settingsService.get(guild.id);
    const view = buildVietQrWorkflowView(guild, freshSettings, callerUserId, locale);
    await interaction.update(view);
    return true;
  }

  if (action === 'vietqr') {
    if (guild.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: isEn
          ? '🔒 Only the Server Owner can configure the VietQR receiving bank account.'
          : '🔒 Chỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền cài đặt tài khoản ngân hàng nhận tiền.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const resolvedDb =
      database ?? (interaction.client as { database?: Database.Database })?.database;
    const entitlement = checkSubscriptionEntitlement(resolvedDb, guild.id);
    if (!entitlement.isEntitled) {
      await interaction.reply({
        content: isEn
          ? '🔒 VietQR features require an active subscription (3-day Trial, License Key, or PayOS plan). Open **Carry Service (Lão Bản)** to activate.'
          : '🔒 Tính năng VietQR yêu cầu bản quyền dịch vụ (Dùng thử 3 ngày, Nhập Key hoặc Gia hạn). Vui lòng vào mục **Dịch Vụ Kéo Lão Bản** để kích hoạt!',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const currentSettings = settingsService.get(guild.id);
    const modal = new ModalBuilder()
      .setCustomId(`admin_console_modal:vietqr:${guild.id}:${callerUserId}`)
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
    return true;
  }

  return false;
}

/**
 * Xử lý Select Menu thuộc mảng Kéo Lão Bản và VietQR Workflow.
 */
export async function handleAdminKeoSubSelect(
  interaction: { update: (v: any) => Promise<any>; client?: any },
  action: string,
  selectedValue: string,
  guild: Guild,
  callerUserId: string,
  locale: SupportedLocale,
  settingsService: SettingsService,
  database?: Database.Database,
): Promise<boolean> {
  switch (action) {
    case 'keo_dispatch': {
      settingsService.update(guild.id, {
        keo: { dispatchChannelId: selectedValue, enabled: true },
      });
      const freshSettings = settingsService.get(guild.id);
      const db = (database ?? interaction.client?.database) as Database.Database;
      const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);
      await interaction.update(view);
      return true;
    }
    case 'keo_category': {
      settingsService.update(guild.id, {
        keo: { ticketCategoryId: selectedValue, enabled: true },
      });
      const freshSettings = settingsService.get(guild.id);
      const db = (database ?? interaction.client?.database) as Database.Database;
      const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);
      await interaction.update(view);
      return true;
    }
    case 'keo_worker': {
      settingsService.update(guild.id, {
        keo: { workerRoleId: selectedValue, enabled: true },
      });
      const freshSettings = settingsService.get(guild.id);
      const db = (database ?? interaction.client?.database) as Database.Database;
      const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);
      await interaction.update(view);
      return true;
    }
    case 'keo_tier1':
    case 'keo_tier2':
    case 'keo_tier3': {
      const tierField =
        action === 'keo_tier1'
          ? 'tier1RoleId'
          : action === 'keo_tier2'
            ? 'tier2RoleId'
            : 'tier3RoleId';
      settingsService.update(guild.id, { keo: { [tierField]: selectedValue } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildKeoVipRolesView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return true;
    }
    case 'vietqr_feedback': {
      settingsService.update(guild.id, { vietqr: { feedbackChannelId: selectedValue } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildVietQrWorkflowView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return true;
    }
    case 'vietqr_staff': {
      settingsService.update(guild.id, { vietqr: { staffRoleId: selectedValue } });
      const freshSettings = settingsService.get(guild.id);
      const view = buildVietQrWorkflowView(guild, freshSettings, callerUserId, locale);
      await interaction.update(view);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Xử lý Modal Submit cho VietQR và Key Redemption.
 */
export async function handleAdminKeoSubModal(
  interaction: ModalSubmitInteraction,
  action: string,
  guild: Guild,
  callerUserId: string,
  locale: SupportedLocale,
  settingsService: SettingsService,
  database?: Database.Database,
): Promise<boolean> {
  const isEn = locale === 'en';

  if (action === 'vietqr') {
    if (guild.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: isEn
          ? '🔒 Only the Server Owner can configure the VietQR receiving bank account.'
          : '🔒 Chỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền cài đặt tài khoản ngân hàng nhận tiền.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const resolvedDb =
      database ?? (interaction.client as { database?: Database.Database })?.database;
    const entitlement = checkSubscriptionEntitlement(resolvedDb, guild.id);
    if (!entitlement.isEntitled) {
      await interaction.reply({
        content: isEn
          ? '🔒 VietQR features require an active subscription (3-day Trial, License Key, or PayOS plan).'
          : '🔒 Tính năng VietQR yêu cầu bản quyền dịch vụ (Dùng thử 3 ngày, Nhập Key hoặc Gia hạn).',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const rawBank = interaction.fields.getTextInputValue('bank_id').trim().toUpperCase();
    const rawAccountNo = interaction.fields.getTextInputValue('account_no').trim();
    const accountNameRaw = interaction.fields.getTextInputValue('account_name')?.trim();

    const normalizedBank = normalizeBankCode(rawBank);
    if (!normalizedBank) {
      await interaction.reply({
        content: isEn
          ? `❌ Invalid or unsupported bank code: \`${rawBank}\`.`
          : `❌ Mã ngân hàng \`${rawBank}\` không hợp lệ hoặc chưa được hỗ trợ.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (!/^[A-Za-z0-9]{6,25}$/.test(rawAccountNo)) {
      await interaction.reply({
        content: isEn
          ? '❌ Account number must be 6–25 alphanumeric characters without spaces.'
          : '❌ Số tài khoản phải gồm 6–25 ký tự chữ/số (không khoảng trắng hoặc ký tự đặc biệt).',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    let accountName: string | null = null;
    if (accountNameRaw) {
      const cleanName = accountNameRaw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase();
      if (!/^[A-Z0-9 ]{2,50}$/.test(cleanName)) {
        await interaction.reply({
          content: isEn
            ? '❌ Account holder name must be 2–50 alphanumeric characters.'
            : '❌ Tên chủ tài khoản không hợp lệ (chỉ gồm 2–50 ký tự chữ/số).',
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }
      accountName = cleanName;
    }

    const bankId = normalizedBank.bankCode;
    const accountNo = rawAccountNo;

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

    const freshSettings = settingsService.get(guild.id);
    const container = buildAdminConsoleContainer(guild, freshSettings, callerUserId, locale);
    const footerRow = buildAdminConsoleFooterRow(callerUserId, locale);
    const toastMessage = isEn
      ? `✅ VietQR Banking updated: **${bankId} • ${accountNo}**${accountName ? ` (${accountName})` : ''}!`
      : `✅ Đã lưu cấu hình nhận tiền VietQR: **${bankId} • ${accountNo}**${accountName ? ` (${accountName})` : ''}!`;

    if (interaction.isFromMessage()) {
      await interaction.update({
        components: [...container.toJSON(), footerRow.toJSON()],
      });
      await interaction.followUp({
        content: toastMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: toastMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
    return true;
  }

  if (action === 'sub_key') {
    const now = Date.now();
    const recentFailures = (keyFailuresByGuild.get(guild.id) || []).filter(
      (ts) => now - ts < KEY_FAIL_WINDOW_MS,
    );
    if (recentFailures.length >= MAX_KEY_FAILURES) {
      keyFailuresByGuild.set(guild.id, recentFailures);
      await interaction.reply({
        content: t('sub.key_rate_limited', undefined, locale),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const key = interaction.fields.getTextInputValue('key_input');
    const db = (database ?? interaction.client?.database) as Database.Database;
    const res = consumeLicenseKey(db, key, guild.id, interaction.user.id);

    if (res.success) {
      keyFailuresByGuild.delete(guild.id);
      const expiry = Math.floor(res.newExpiry! / 1000);
      const freshSettings = settingsService.get(guild.id);
      const view = buildKeoConfigView(guild, freshSettings, callerUserId, locale, db);

      if (interaction.isFromMessage()) {
        await interaction.update(view);
        await interaction.followUp({
          content: t('sub.key_redeemed', { days: res.durationDays!, expiry }, locale),
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: t('sub.key_redeemed', { days: res.durationDays!, expiry }, locale),
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      recentFailures.push(now);
      keyFailuresByGuild.set(guild.id, recentFailures);
      const errKey =
        res.reason === 'already_used'
          ? 'sub.key_used'
          : res.reason === 'expired'
            ? 'sub.key_expired'
            : 'sub.key_invalid';

      await interaction.reply({
        content: t(errKey, undefined, locale),
        flags: MessageFlags.Ephemeral,
      });
    }
    return true;
  }

  return false;
}
