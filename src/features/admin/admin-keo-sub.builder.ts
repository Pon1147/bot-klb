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
import Database from 'better-sqlite3';
import { GuildSettings } from '../../types/settings.types.js';
import { COLORS } from '../../config/container.variables.js';
import { SupportedLocale } from '../../infrastructure/i18n/locale-resolver.js';
import { t } from '../../infrastructure/i18n/i18n.service.js';
import { BOT_BRANDING } from '../../config/branding.config.js';
import { checkSubscriptionEntitlement } from '../subscription/subscription.service.js';
import { SubscriptionOrderRecord } from '../../database/subscription.db.js';
import { resolveChannelTag, resolveRoleTag } from './admin-console.builder.js';
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
      ? `**Subscription**: ${entitlement.statusText}\n\n`
      : `**Bản Quyền Dịch Vụ**: ${entitlement.statusText}\n\n`;
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

  const readyCount = [hasVietQr, hasDispatch, hasWorker].filter(Boolean).length;
  const isReady = readyCount === 3;
  const progressText = isEn
    ? `**Status**: ${isReady ? '🟢 Ready for Service' : `🟠 Setup Incomplete (${readyCount}/3 Required Steps)`}\n\n`
    : `**Tiến Độ**: ${isReady ? '🟢 Sẵn Sàng Phục Vụ' : `🟠 Chưa Xong (${readyCount}/3 bước bắt buộc)`}\n\n`;

  const checklistText = isEn
    ? `### Setup Checklist\n\n` +
      progressText +
      `${hasVietQr ? '🟢' : '🔴'} **Step 1: VietQR Banking (Required)**: ${hasVietQr ? `${settings.vietqr?.bankId} • ${settings.vietqr?.accountNo}` : '*Missing (Needed for payments)*'}\n` +
      `${hasDispatch ? '🟢' : '🔴'} **Step 2: Dispatch Channel (Required)**: ${dispatchTag}\n` +
      `${hasWorker ? '🟢' : '🔴'} **Step 3: Worker Role (Required)**: ${workerRoleTag}\n` +
      `${hasCategory ? '🟢' : '🟡'} **Step 4: Ticket Category (Filter)**: ${categoryTag}\n\n` +
      `• **VIP Roles (Optional)**: Lv1: ${t1Tag} • Lv2: ${t2Tag} • Lv3: ${t3Tag}\n` +
      `• **Ticket Naming**: Set ticket bot format to \`ticket-%username%\``
    : `### Quy Trình Thiết Lập\n\n` +
      progressText +
      `${hasVietQr ? '🟢' : '🔴'} **Bước 1: Tài khoản VietQR (Bắt buộc)**: ${hasVietQr ? `${settings.vietqr?.bankId} • ${settings.vietqr?.accountNo}` : '*Chưa cài (Cần để xuất mã QR thanh toán)*'}\n` +
      `${hasDispatch ? '🟢' : '🔴'} **Bước 2: Kênh Bắn Kèo (Bắt buộc)**: ${dispatchTag}\n` +
      `${hasWorker ? '🟢' : '🔴'} **Bước 3: Vai Trò Thợ Kéo (Bắt buộc)**: ${workerRoleTag}\n` +
      `${hasCategory ? '🟢' : '🟡'} **Bước 4: Nhóm Category Ticket (Lọc)**: ${categoryTag}\n\n` +
      `• **Role Lão Bản VIP (Tùy chọn)**: Lv1: ${t1Tag} • Lv2: ${t2Tag} • Lv3: ${t3Tag}\n` +
      `• **Định Dạng Kênh Ticket**: Cấu hình ticket bot định dạng \`ticket-%username%\``;

  const title = isEn ? '## Delta Force Carry Service Setup' : '## Cấu Hình Dịch Vụ Kéo Lão Bản';
  const desc = `${subStatusText}${checklistText}`;

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
    ? '## VIP Customer Roles (Lão Bản Tiers)'
    : '## Phân Hạng Role Lão Bản (VIP Tùy Chọn)';

  const desc = isEn
    ? `• **Tier 1 (>= 500k)**: ${t1Tag}\n` +
      `• **Tier 2 (>= 3,000k)**: ${t2Tag}\n` +
      `• **Tier 3 (>= 10,000k)**: ${t3Tag}\n\n` +
      `*Automatic tier upgrade when spending thresholds are met.*`
    : `• **Hạng 1 (>= 500k)**: ${t1Tag}\n` +
      `• **Hạng 2 (>= 3.000k)**: ${t2Tag}\n` +
      `• **Hạng 3 (>= 10.000k)**: ${t3Tag}\n\n` +
      `*Tự động thăng hạng vai trò khi khách tích lũy đủ mốc chi tiêu.*`;

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
    ? '## VietQR Workflow & Feedback Setup'
    : '## Quy Trình Thanh Toán & Đánh Giá VietQR';

  const desc = isEn
    ? `**Feedback Channel**: ${feedbackChanTag}\n` +
      `*Where customer reviews and ratings are posted publicly.*\n\n` +
      `**Staff Approver**: ${staffRoleTag}\n` +
      `*Authorized staff to confirm or cancel payments.*\n\n` +
      `**Star Ratings**: ${ratingStatus}\n` +
      `*Allow customers to submit 1–5 star reviews after order completion.*`
    : `**Kênh Đánh Giá**: ${feedbackChanTag}\n` +
      `*Kênh hiển thị đánh giá và lời cảm ơn từ khách hàng.*\n\n` +
      `**Nhân Viên Duyệt Đơn**: ${staffRoleTag}\n` +
      `*Vai trò được quyền xác nhận hoặc hủy thanh toán.*\n\n` +
      `**Đánh Giá 1–5 Sao**: ${ratingStatus}\n` +
      `*Cho phép khách gửi đánh giá sao sau khi hoàn tất đơn.*`;

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
