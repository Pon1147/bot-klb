/**
 * Subcommand Group: /config vietqr
 * Cấu hình tài khoản nhận tiền chuyển khoản và workflow thanh toán VietQR (BM-01).
 */

import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService, isQrServerEnabled } from '../../../services/settings.service.js';
import {
  SUPPORTED_BANKS,
  normalizeBankCode,
  fetchVietQrImageBuffer,
  buildVietQrContainer,
  buildQrPremiumLockedResponse,
} from '../../../utils/vietqr.utils.js';
import { buildErrorContainer, buildInfoContainer } from '../../../utils/container.utils.js';
import { sendReply } from '../../../utils/reply.utils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('VietQrSubcommand');

export function buildVietQrGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('vietqr')
    .setDescription('Cấu hình tài khoản ngân hàng nhận tiền chuyển khoản VietQR.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Cài đặt thông tin tài khoản ngân hàng nhận tiền.')
        .addStringOption((opt) =>
          opt
            .setName('bank')
            .setDescription('Mã ngân hàng (ví dụ: MB, VCB, TCB, ACB, VPB, TPB, BIDV...)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('account_no')
            .setDescription('Số tài khoản ngân hàng nhận tiền')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('account_name')
            .setDescription('Tên chủ tài khoản (viết hoa không dấu, ví dụ: NGUYEN VAN A)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('prefix')
            .setDescription('Cú pháp tiền tố nội dung chuyển khoản (mặc định: NAP)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('workflow')
        .setDescription('Cấu hình quy trình duyệt bill, nhận feedback 5 sao và lời cảm ơn.')
        .addRoleOption((opt) =>
          opt
            .setName('staff_role')
            .setDescription('Role nhân viên/thợ được quyền duyệt/hủy hóa đơn (ngoài Admin)')
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName('feedback_channel')
            .setDescription('Kênh nhận thông báo review đánh giá 5 sao từ khách')
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enable_rating')
            .setDescription('Bật hoặc tắt nút bấm đánh giá 1-5 sao sau khi thanh toán')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('thanks_message')
            .setDescription('Lời cảm ơn tùy chỉnh của máy chủ sau khi duyệt đơn')
            .setMaxLength(250)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setDescription('Xem thông tin tài khoản nhận tiền hiện tại của máy chủ.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('preview')
        .setDescription('Xem trước và quét thử mã QR thanh toán mẫu của máy chủ.')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Số tiền thử nghiệm (mặc định 10,000 đ)')
            .setMinValue(1000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('reset')
        .setDescription('Gỡ bỏ và xóa toàn bộ thông tin tài khoản ngân hàng VietQR của máy chủ.'),
    );
}

export async function handleVietQrWorkflow(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, buildQrPremiumLockedResponse());
    return;
  }

  // Kiểm tra quyền: Chỉ Server Owner hoặc Discord Administrator mới được cấu hình workflow thanh toán
  const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
  const member = interaction.member as GuildMember | null;
  const isDiscordAdmin = Boolean(member?.permissions?.has?.(PermissionFlagsBits.Administrator));

  if (!isGuildOwner && !isDiscordAdmin) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền cấu hình quy trình thanh toán VietQR.\nChỉ Chủ sở hữu máy chủ (Server Owner) hoặc Quản trị viên (Administrator) mới có quyền thực hiện.',
      ).toJSON(),
    });
    return;
  }

  const staffRole = interaction.options.getRole('staff_role');
  const feedbackChannel = interaction.options.getChannel('feedback_channel');
  const enableRating = interaction.options.getBoolean('enable_rating');
  const thanksMessage = interaction.options.getString('thanks_message');

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(guildId);
  const currentVietQr = currentSettings.vietqr || {
    enabled: true,
    bankId: null,
    accountNo: null,
    accountName: null,
    prefix: 'NAP',
    template: 'compact2' as const,
  };

  const updatedVietQr = {
    ...currentVietQr,
    ...(staffRole ? { staffRoleId: staffRole.id } : {}),
    ...(feedbackChannel ? { feedbackChannelId: feedbackChannel.id } : {}),
    ...(enableRating !== null ? { enableRating } : {}),
    ...(thanksMessage ? { thanksMessage } : {}),
  };

  settingsService.update(guildId, { vietqr: updatedVietQr });

  const container = buildInfoContainer(
    `### ⚙️ Quy Trình Workflow VietQR Đã Được Cập Nhật\n\n` +
      `• **Role nhân viên (Staff)**: ${updatedVietQr.staffRoleId ? `<@&${updatedVietQr.staffRoleId}>` : '*Chưa thiết lập (Chỉ Admin)*'}\n` +
      `• **Kênh nhận Feedback**: ${updatedVietQr.feedbackChannelId ? `<#${updatedVietQr.feedbackChannelId}>` : '*Chưa thiết lập*'}\n` +
      `• **Đánh giá 1-5 sao**: ${updatedVietQr.enableRating !== false ? '🟢 Bật (Hiện nút sao)' : '🔴 Tắt'}\n` +
      `• **Lời cảm ơn**: *"${updatedVietQr.thanksMessage ?? 'Mặc định'}"*\n\n` +
      `> *Mọi nhân viên có role trên sẽ được phép bấm nút Confirm/Cancel để duyệt đơn hàng cho khách.*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function handleVietQrSet(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, buildQrPremiumLockedResponse());
    return;
  }

  // Kiểm tra quyền: Chỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền đổi STK ngân hàng
  const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

  if (!isGuildOwner) {
    logger.warn('[Audit][Security] Từ chối truy cập cấu hình VietQR (không phải Server Owner)', {
      actorId: interaction.user.id,
      guildId,
      action: 'vietqr.set',
      timestamp: Date.now(),
      result: 'denied_not_owner',
    });
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền thay đổi thông tin ngân hàng của máy chủ.\nChỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền thiết lập tài khoản nhận tiền.',
      ).toJSON(),
    });
    return;
  }

  const rawBank = interaction.options.getString('bank', true).trim().toUpperCase();
  const normalized = normalizeBankCode(rawBank);
  if (!normalized) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        `⚠️ Ngân hàng \`${rawBank}\` không hợp lệ hoặc chưa được hỗ trợ.\n` +
          `Các mã hỗ trợ: ${Object.keys(SUPPORTED_BANKS).join(', ')} (hoặc tên đầy đủ: VIETCOMBANK, TECHCOMBANK, AGRIBANK...).`,
      ).toJSON(),
    });
    return;
  }

  const bank = normalized.bankCode;
  const accountNo = interaction.options.getString('account_no', true).trim();
  const accountName = interaction.options.getString('account_name', true).trim().toUpperCase();
  const prefix = interaction.options.getString('prefix')?.trim().toUpperCase() || 'NAP';

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(guildId);
  const currentVietQr = currentSettings.vietqr;

  try {
    settingsService.update(guildId, {
      vietqr: {
        ...currentVietQr,
        enabled: true,
        bankId: bank,
        accountNo,
        accountName,
        prefix,
        template: 'compact2',
      },
    });

    logger.info('[Audit] Server Owner cập nhật cấu hình VietQR thành công', {
      actorId: interaction.user.id,
      guildId,
      action: 'vietqr.set',
      timestamp: Date.now(),
      result: 'success',
    });
  } catch (err) {
    logger.error('[Audit] Server Owner cập nhật cấu hình VietQR thất bại', {
      actorId: interaction.user.id,
      guildId,
      action: 'vietqr.set',
      timestamp: Date.now(),
      result: 'failed',
    });
    throw err;
  }

  const bankDisplayName = SUPPORTED_BANKS[bank] ?? bank;
  const container = buildInfoContainer(
    `### 💳 Cấu Hình VietQR Thanh Toán Đã Được Cập Nhật\n\n` +
      `• **Ngân hàng**: **${bankDisplayName}** (\`${bank}\`)\n` +
      `• **Số tài khoản**: \`${accountNo}\`\n` +
      `• **Chủ tài khoản**: **${accountName}**\n` +
      `• **Tiền tố nội dung**: \`${prefix}\`\n` +
      `• **Trạng thái**: 🟢 Sẵn sàng nhận chuyển khoản\n\n` +
      `> ℹ️ *Thành viên máy chủ hiện có thể sử dụng lệnh \`/pay create\` để tạo mã QR thanh toán tự động.*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function handleVietQrStatus(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, buildQrPremiumLockedResponse());
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId);
  const vietqr = settings.vietqr;

  if (!vietqr || !vietqr.bankId || !vietqr.accountNo) {
    await sendReply(interaction, {
      components: buildInfoContainer(
        `### 💳 Cấu Hình VietQR Máy Chủ\n\n` +
          `• **Trạng thái**: ⚠️ Chưa thiết lập tài khoản nhận tiền\n\n` +
          `> *Quản trị viên vui lòng sử dụng lệnh \`/config vietqr set\` để cài đặt thông tin số tài khoản.*`,
      ).toJSON(),
    });
    return;
  }

  const bankDisplayName =
    SUPPORTED_BANKS[vietqr.bankId.toUpperCase()] ?? vietqr.bankId.toUpperCase();

  const container = buildInfoContainer(
    `### 💳 Cấu Hình VietQR Máy Chủ\n\n` +
      `• **Ngân hàng**: **${bankDisplayName}** (\`${vietqr.bankId.toUpperCase()}\`)\n` +
      `• **Số tài khoản**: \`${vietqr.accountNo}\`\n` +
      `• **Chủ tài khoản**: **${vietqr.accountName ?? 'Chưa đặt'}**\n` +
      `• **Tiền tố nội dung**: \`${vietqr.prefix ?? 'NAP'}\`\n` +
      `• **Trạng thái**: ${vietqr.enabled ? '🟢 Đang hoạt động' : '🔴 Tạm dừng'}\n\n` +
      `**⚙️ Workflow & Quy trình:**\n` +
      `• **Role nhân viên (Staff)**: ${vietqr.staffRoleId ? `<@&${vietqr.staffRoleId}>` : '*Chưa thiết lập (Chỉ Admin)*'}\n` +
      `• **Kênh nhận Feedback**: ${vietqr.feedbackChannelId ? `<#${vietqr.feedbackChannelId}>` : '*Chưa thiết lập*'}\n` +
      `• **Đánh giá 1-5 sao**: ${vietqr.enableRating !== false ? '🟢 Bật' : '🔴 Tắt'}\n` +
      `• **Lời cảm ơn**: *"${vietqr.thanksMessage ?? 'Mặc định'}"*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function handleVietQrPreview(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  const guild = interaction.guild;
  if (!guildId || !guild) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, buildQrPremiumLockedResponse());
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.get(guildId);
  const vietqr = settings.vietqr;

  if (!vietqr || !vietqr.bankId || !vietqr.accountNo || !vietqr.accountName) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '⚠️ Máy chủ chưa thiết lập thông tin tài khoản ngân hàng nhận tiền.\nQuản trị viên vui lòng chạy lệnh `/config vietqr set` trước.',
      ).toJSON(),
    });
    return;
  }

  const testAmount = interaction.options.getInteger('amount') || 10_000;
  const testTransferCode = `${vietqr.prefix || 'NAP'} TEST ${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (typeof interaction.deferReply === 'function') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }

  const qrBuffer = await fetchVietQrImageBuffer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount: testAmount,
    addInfo: testTransferCode,
    template: vietqr.template || 'compact2',
  });

  const files: AttachmentBuilder[] = [];
  let attachmentName: string | null = null;
  if (qrBuffer) {
    attachmentName = 'test_vietqr.png';
    files.push(new AttachmentBuilder(qrBuffer, { name: attachmentName }));
  }

  const container = buildVietQrContainer({
    bankId: vietqr.bankId,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount: testAmount,
    transferCode: testTransferCode,
    memo: 'Mã QR thử nghiệm cấu hình',
    serverName: guild.name,
    creatorId: interaction.user.id,
    customerId: interaction.user.id,
    attachmentName,
    txId: 'TEST-CONFIG',
  });

  const replyContent =
    '> 🧪 **CHẾ ĐỘ XEM TRƯỚC (PREVIEW)**: Hãy dùng app ngân hàng quét thử mã bên dưới để kiểm tra tên chủ tài khoản và số tài khoản nhận tiền.';

  if (interaction.deferred && typeof interaction.editReply === 'function') {
    await interaction.editReply({
      content: replyContent,
      components: container.toJSON(),
      files,
    });
  } else {
    await interaction.reply({
      content: replyContent,
      components: container.toJSON(),
      files,
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

export async function handleVietQrReset(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        'Lệnh này chỉ có thể sử dụng trong máy chủ Discord.',
      ).toJSON(),
    });
    return;
  }

  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, buildQrPremiumLockedResponse());
    return;
  }

  // Kiểm tra quyền: Chỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền gỡ bỏ STK ngân hàng
  const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
  if (!isGuildOwner) {
    logger.warn('[Audit][Security] Từ chối gỡ cấu hình VietQR (không phải Server Owner)', {
      actorId: interaction.user.id,
      guildId,
      action: 'vietqr.reset',
      timestamp: Date.now(),
      result: 'denied_not_owner',
    });
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền gỡ bỏ cấu hình ngân hàng của máy chủ.\nChỉ duy nhất Chủ sở hữu máy chủ (Server Owner) mới có quyền thực hiện.',
      ).toJSON(),
    });
    return;
  }

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(guildId);
  const currentVietQr = currentSettings.vietqr;

  settingsService.update(guildId, {
    vietqr: {
      enabled: false,
      bankId: null,
      accountNo: null,
      accountName: null,
      prefix: currentVietQr?.prefix || 'NAP',
      template: currentVietQr?.template || 'compact2',
      staffRoleId: null,
      feedbackChannelId: null,
      enableRating: true,
      thanksMessage: null,
    },
  });

  logger.info('[Audit] Server Owner đã gỡ bỏ cấu hình VietQR thành công', {
    actorId: interaction.user.id,
    guildId,
    action: 'vietqr.reset',
    timestamp: Date.now(),
    result: 'success',
  });

  const container = buildInfoContainer(
    `### 🗑️ Đã Gỡ Bỏ Cấu Hình VietQR Máy Chủ\n\n` +
      `• **Trạng thái**: Đã xóa thông tin tài khoản ngân hàng nhận tiền.\n` +
      `• **Người thực hiện**: <@${interaction.user.id}> (Chủ sở hữu máy chủ)\n\n` +
      `> ℹ️ *Mọi lệnh tạo hóa đơn \`/pay create\` trên máy chủ sẽ tạm dừng cho đến khi Server Owner thiết lập lại STK qua lệnh \`/config vietqr set\`.*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

export async function executeVietQrGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'set') {
    await handleVietQrSet(interaction, database);
  } else if (subcommand === 'workflow') {
    await handleVietQrWorkflow(interaction, database);
  } else if (subcommand === 'status') {
    await handleVietQrStatus(interaction, database);
  } else if (subcommand === 'preview') {
    await handleVietQrPreview(interaction, database);
  } else if (subcommand === 'reset') {
    await handleVietQrReset(interaction, database);
  }
}
