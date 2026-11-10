/**
 * /config — Quản lý cấu hình máy chủ (Roles RBAC, Welcome, Booster, Container).
 *
 * Cấu trúc:
 * /config roles set <role_type> <role>
 * /config roles view
 * /config welcome setchannel <channel>
 * /config welcome setrole <role>
 * /config welcome toggle <enabled>
 * /config welcome status
 * /config booster setchannel <channel>
 * /config booster setrole <role>
 * /config booster toggle <enabled>
 * /config booster status
 * /config container edit <type>
 * /config container reset <type>
 */

import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  Guild,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  TextChannel,
} from 'discord.js';
import Database from 'better-sqlite3';
import {
  getSettingsService,
  SettingsService,
  isQrServerEnabled,
} from '../../services/settings.service.js';
import {
  SUPPORTED_BANKS,
  normalizeBankCode,
  fetchVietQrImageBuffer,
  buildVietQrContainer,
} from '../../utils/vietqr.utils.js';
import { botConfig } from '../../config/bot.config.js';
import {
  buildErrorContainer,
  buildInfoContainer,
  buildTextOnlyContainer,
  buildEditTypeOptionCallback,
  buildResetTypeOptionCallback,
  makeResult,
} from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';
import {
  executeSectionCommand,
  getBoosterConfig,
  getLeaveConfig,
  getWelcomeConfig,
} from '../../utils/section-config.handlers.js';
import { startInteractiveEdit } from '../container/container-edit.handler.js';
import { handleContainerReset } from '../container/container-reset.handler.js';
import { COLORS } from '../../config/container.variables.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ConfigCommand');

// ─── Subcommand Builders ──────────────────────────────────────────

/** Nhóm roles: cấu hình và xem RBAC roles */
function buildRolesGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('roles')
    .setDescription('Cấu hình và xem các role RBAC của máy chủ.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Thiết lập role cho một phân quyền bot.')
        .addStringOption((opt) =>
          opt
            .setName('role_type')
            .setDescription('Loại quyền cần gán role')
            .setRequired(true)
            .addChoices(
              { name: 'Bot Admin', value: 'bot_admin' },
              { name: 'Moderator', value: 'moderator' },
              { name: 'Member', value: 'member' },
            ),
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Discord cần gán').setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('view').setDescription('Xem danh sách role RBAC hiện tại của máy chủ.'),
    );
}

/** Nhóm welcome: cấu hình hệ thống chào mừng */
function buildWelcomeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('welcome')
    .setDescription('Cấu hình hệ thống chào mừng thành viên mới.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn chào mừng.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role tự động cấp khi vào server.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role cần cấp').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống chào mừng.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình chào mừng hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('Gửi tin nhắn chào mừng thử nghiệm để kiểm tra hiển thị.'),
    );
}

/** Nhóm leave: cấu hình hệ thống tạm biệt thành viên rời server */
function buildLeaveGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('leave')
    .setDescription('Cấu hình hệ thống tạm biệt khi thành viên rời server.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn tạm biệt.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống tạm biệt.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình tạm biệt hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('Gửi tin nhắn tạm biệt thử nghiệm để kiểm tra hiển thị.'),
    );
}

/** Nhóm booster: cấu hình hệ thống cảm ơn server booster */
function buildBoosterGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('booster')
    .setDescription('Cấu hình hệ thống cảm ơn Server Booster.')
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setDescription('Chọn kênh gửi tin nhắn cảm ơn Booster.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh tin nhắn').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setDescription('Chọn role dành riêng cho Booster.')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role Booster').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt hệ thống thông báo Booster.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình Booster hiện tại.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Gửi tin nhắn cảm ơn Booster thử nghiệm để kiểm tra hiển thị.'),
    );
}

/** Nhóm container: biên tập giao diện Components V2 */
function buildContainerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('container')
    .setDescription('Tùy biến giao diện thông báo Components V2.')
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Chỉnh sửa container settings (Interactive UI).')
        .addStringOption(buildEditTypeOptionCallback),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset container settings về mặc định.')
        .addStringOption(buildResetTypeOptionCallback),
    );
}

/** Nhóm bot: xem thông tin và trạng thái của bot */
function buildBotGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('bot')
    .setDescription('Xem thông tin và quản trị cấp cao bot.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('guilds').setDescription('Xem danh sách các máy chủ (guilds) bot đang tham gia.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setannouncechannel')
        .setDescription('Cấu hình kênh nhận thông báo cập nhật bot cho máy chủ này.')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Kênh văn bản nhận thông báo từ bot')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('announce')
        .setDescription('Phát thông báo cập nhật tới toàn bộ máy chủ (chỉ dành cho Bot Owner).')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Tiêu đề thông báo tùy chỉnh (tùy chọn)')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Nội dung thông báo cần phát sóng (tùy chọn nếu muốn gửi changelog)')
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('preview')
            .setDescription('Chỉ xem trước giao diện thông báo, chưa phát thật (mặc định: false)')
            .setRequired(false),
        ),
    );
}

// ─── Slash Command Builder ────────────────────────────────────────

/** Nhóm qr-server: quản lý cấp phép tính năng QR trả phí theo máy chủ (chỉ dành cho Bot Owner) */
function buildQrServerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('qr-server')
    .setDescription('Quản lý cấp quyền tính năng QR trả phí cho máy chủ (chỉ dành cho Bot Owner).')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt tính năng QR tự động cho máy chủ.')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (true) hoặc Tắt (false)').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('ID máy chủ Discord (để trống sẽ áp dụng cho máy chủ hiện tại)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setDescription('Xem trạng thái tính năng QR của máy chủ.')
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('ID máy chủ Discord (để trống sẽ xem máy chủ hiện tại)')
            .setRequired(false),
        ),
    );
}

/** Nhóm vietqr: cấu hình tài khoản ngân hàng nhận tiền chuyển khoản (yêu cầu server được mở QR) */
function buildVietQrGroup(
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
    );
}

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Quản lý cấu hình bot, roles, welcome, booster, và container.')
  .addSubcommandGroup(buildRolesGroup)
  .addSubcommandGroup(buildWelcomeGroup)
  .addSubcommandGroup(buildLeaveGroup)
  .addSubcommandGroup(buildBoosterGroup)
  .addSubcommandGroup(buildContainerGroup)
  .addSubcommandGroup(buildBotGroup)
  .addSubcommandGroup(buildQrServerGroup)
  .addSubcommandGroup(buildVietQrGroup);

// ─── Roles Mapping ────────────────────────────────────────────────

const ROLE_TYPE_MAP = {
  bot_admin: { label: 'Bot Admin', field: 'botAdminRoleId' },
  moderator: { label: 'Moderator', field: 'moderatorRoleId' },
  member: { label: 'Member', field: 'memberRoleId' },
} as const;

// ─── Roles Subcommand Handlers ────────────────────────────────────

async function handleRolesSet(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guild = interaction.guild!;
  const roleType = interaction.options.getString('role_type', true) as keyof typeof ROLE_TYPE_MAP;
  const role = interaction.options.getRole('role', true) as Role;
  const mapping = ROLE_TYPE_MAP[roleType];

  if (!mapping) {
    await sendReply(interaction, {
      components: buildErrorContainer('Loại role không hợp lệ.').toJSON(),
    });
    return;
  }

  // Kiểm tra không set @everyone (ID = guild ID)
  if (role.id === guild.id) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không thể dùng @everyone làm role RBAC.').toJSON(),
    });
    return;
  }

  // Kiểm tra role name không rỗng
  if (!role.name || role.name.trim() === '') {
    await sendReply(interaction, {
      components: buildErrorContainer('Role phải có tên hợp lệ.').toJSON(),
    });
    return;
  }

  try {
    let settingsService: SettingsService;
    try {
      settingsService = getSettingsService();
    } catch {
      if (!database) {
        throw new Error('SettingsService chưa được khởi tạo và database không khả dụng.');
      }
      settingsService = new SettingsService(database);
    }

    const rbacUpdate: Record<string, string> = {
      [mapping.field]: role.id,
    };
    // Đồng bộ legacy ownerRoleId nếu cấu hình bot_admin
    if (roleType === 'bot_admin') {
      rbacUpdate.ownerRoleId = role.id;
    }

    settingsService.update(guild.id, {
      rbac: rbacUpdate,
    });

    await sendReply(interaction, {
      content: `✅ Đã thiết lập **${mapping.label}** role: ${role} (\`${role.id}\`) cho máy chủ này.`,
    });
  } catch (error) {
    logger.error(`Error saving role config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await sendReply(interaction, { components: err.toJSON() });
  }
}

async function handleRolesView(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const guild = interaction.guild!;

  try {
    let settingsService: SettingsService;
    try {
      settingsService = getSettingsService();
    } catch {
      if (!database) {
        throw new Error('SettingsService chưa được khởi tạo và database không khả dụng.');
      }
      settingsService = new SettingsService(database);
    }

    const settings = settingsService.get(guild.id);
    const rbac = settings.rbac ?? {};

    const botAdminRole = rbac.botAdminRoleId ?? rbac.ownerRoleId;
    const moderatorRole = rbac.moderatorRoleId;
    const memberRole = rbac.memberRoleId;

    const content = [
      '## 🛡️ Cấu hình RBAC Roles hiện tại',
      '',
      `• **Bot Admin:** ${botAdminRole ? `<@&${botAdminRole}> (\`${botAdminRole}\`)` : '_Chưa đặt_'}`,
      `• **Moderator:** ${moderatorRole ? `<@&${moderatorRole}> (\`${moderatorRole}\`)` : '_Chưa đặt_'}`,
      `• **Member:** ${memberRole ? `<@&${memberRole}> (\`${memberRole}\`)` : '_Chưa đặt_'}`,
      '',
      '> 💡 _Guild Owner và Discord Administrator luôn có toàn quyền quản trị._',
    ].join('\n');

    const container = buildTextOnlyContainer(content, COLORS.INFO);
    await sendReply(interaction, { components: container.toJSON() });
  } catch (error) {
    logger.error(`Error viewing roles config: ${(error as Error).message}`);
    const err = buildErrorContainer(`Lỗi khi đọc cấu hình: ${(error as Error).message}`);
    await sendReply(interaction, { components: err.toJSON() });
  }
}

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  if (!interaction.guild) {
    await sendReply(interaction, { content: 'Lệnh này chỉ dùng được trong server.' });
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const db = (database ?? interaction.client.database) as Database.Database;

  switch (group) {
    case 'roles': {
      if (subcommand === 'set') {
        await handleRolesSet(interaction, db);
      } else if (subcommand === 'view') {
        await handleRolesView(interaction, db);
      }
      break;
    }

    case 'leave': {
      await executeSectionCommand(interaction, db, getLeaveConfig());
      break;
    }

    case 'welcome': {
      await executeSectionCommand(interaction, db, getWelcomeConfig());
      break;
    }

    case 'booster': {
      await executeSectionCommand(interaction, db, getBoosterConfig());
      break;
    }

    case 'container': {
      if (subcommand === 'edit') {
        const type = interaction.options.getString('type', true) as 'welcome' | 'leave' | 'booster';
        await startInteractiveEdit(interaction, type);
      } else if (subcommand === 'reset') {
        await handleContainerReset(interaction, interaction.guild.id);
      }
      break;
    }

    case 'bot': {
      if (subcommand === 'guilds') {
        await handleBotGuilds(interaction);
      } else if (subcommand === 'announce') {
        await handleBotAnnounce(interaction);
      } else if (subcommand === 'setannouncechannel') {
        await handleBotSetAnnounceChannel(interaction, db);
      }
      break;
    }

    case 'qr-server': {
      if (subcommand === 'toggle') {
        await handleQrServerToggle(interaction, db);
      } else if (subcommand === 'status') {
        await handleQrServerStatus(interaction, db);
      }
      break;
    }

    case 'vietqr': {
      if (subcommand === 'set') {
        await handleVietQrSet(interaction, db);
      } else if (subcommand === 'workflow') {
        await handleVietQrWorkflow(interaction, db);
      } else if (subcommand === 'status') {
        await handleVietQrStatus(interaction, db);
      } else if (subcommand === 'preview') {
        await handleVietQrPreview(interaction, db);
      }
      break;
    }

    default: {
      await sendReply(interaction, {
        components: buildErrorContainer('Nhóm lệnh không hợp lệ.').toJSON(),
      });
    }
  }
}

/** Subcommand `bot guilds` — xem danh sách toàn bộ server bot đang tham gia */
async function handleBotGuilds(interaction: ChatInputCommandInteraction): Promise<void> {
  const guilds = interaction.client.guilds.cache;
  if (!guilds.size) {
    await sendReply(interaction, {
      components: buildInfoContainer('Bot hiện chưa tham gia máy chủ nào.').toJSON(),
    });
    return;
  }

  const lines = Array.from(guilds.values()).map(
    (g, idx) =>
      `**${idx + 1}. ${g.name}**\n• **ID**: \`${g.id}\`\n• **Thành viên**: ${g.memberCount}\n• **Chủ sở hữu ID**: \`${g.ownerId}\``,
  );

  const container = buildInfoContainer(
    `### 🌐 Danh sách máy chủ (${guilds.size} servers)\n\n` + lines.join('\n\n'),
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

/** Subcommand `bot setannouncechannel` — đặt kênh nhận thông báo cập nhật bot cho máy chủ này */
async function handleBotSetAnnounceChannel(
  interaction: ChatInputCommandInteraction,
  _db: Database.Database,
): Promise<void> {
  const guildId = interaction.guildId ?? interaction.guild?.id;
  if (!guildId) return;

  const channel = interaction.options.getChannel('channel', true);
  const settingsService = getSettingsService();

  settingsService.update(guildId, {
    botAnnounce: {
      channelId: channel.id,
    },
  });

  await sendReply(interaction, {
    content: `✅ Đã thiết lập kênh nhận thông báo cập nhật của bot cho máy chủ này là <#${channel.id}> (\`${channel.id}\`).`,
  });
}

export interface AnnouncementOptions {
  title?: string | null;
  message?: string | null;
  isPreview?: boolean;
}

/** Xây dựng container thông báo phát sóng toàn hệ thống */
export function buildAnnouncementContainer(
  optionsOrNote?: string | null | AnnouncementOptions,
  isPreviewArg?: boolean,
) {
  let title: string | null | undefined;
  let message: string | null | undefined;
  let isPreview = isPreviewArg ?? false;

  if (typeof optionsOrNote === 'object' && optionsOrNote !== null) {
    title = optionsOrNote.title;
    message = optionsOrNote.message;
    if (optionsOrNote.isPreview !== undefined) {
      isPreview = optionsOrNote.isPreview;
    }
  } else {
    message = optionsOrNote;
  }

  const previewBanner = isPreview
    ? '> 👁️ **CHẾ ĐỘ XEM TRƯỚC (PREVIEW)**\n> *Giao diện thông báo mẫu sẽ gửi tới các máy chủ. Chạy lệnh với `preview: false` để phát thật.*\n\n'
    : '';

  const footerText =
    '> 💡 *Admin server có thể dùng lệnh `/config bot setannouncechannel` để chọn kênh nhận tin cập nhật chính thức từ bot.*';

  let bodyContent = '';

  if (message && message.trim().length > 0) {
    // Trường hợp 1: Có nội dung tùy biến từ Developer -> Phát chính xác nội dung này, không chèn changelog cũ
    const headerTitle = title?.trim()
      ? `# ${title.trim()}`
      : '# 📢 THÔNG BÁO TỪ BAN QUẢN TRỊ BOT DELTA';
    bodyContent = [headerTitle, '', message.trim(), '', footerText].join('\n');
  } else {
    // Trường hợp 2: Không truyền message -> Phát thông báo giới thiệu/cập nhật tính năng Bot Delta
    const headerTitle = title?.trim()
      ? `# ${title.trim()}`
      : '# 🚀 BẢN CẬP NHẬT TÍNH NĂNG MỚI — BOT DELTA';
    bodyContent = [
      headerTitle,
      '',
      'Chào các Chỉ Huy và Quản trị viên máy chủ! Bot Delta vừa được cập nhật hệ thống với các tính năng tác chiến và tiện ích tự động:',
      '',
      '### 1. 🗺️ Trình Mô Phỏng Bản Đồ 3D Tương Tác (`/df map`)',
      '• Trải nghiệm mô phỏng di chuyển góc nhìn 3D (FPS / Top-down) trực quan trên mọi thiết bị.',
      '• Soi vị trí két sắt, hòm Safe Box, tài nguyên giá trị cao và các lối rút quân an toàn.',
      '',
      '### 2. 🔫 Thư Viện Build Súng Chuẩn Meta Garena (`/df build` / `/df gun`)',
      '• Tra cứu cấu hình phụ kiện tối ưu cho từng loại vũ khí theo meta chiến đấu hiện tại.',
      '• Sao chép mã Gunsmith code chỉ với 1-click để nhập thẳng vào game.',
      '',
      '### 3. 🤖 Hệ Thống Cẩm Nang Tự Động & Live Board Thông Minh (`/df autopost`)',
      '• Định kỳ phát sóng cẩm nang Bản đồ 3D và Build súng meta tới các kênh cộng đồng.',
      '• Tự động dọn dẹp tin nhắn cũ trước khi đăng bài mới, giữ kênh luôn ngăn nắp.',
      '',
      '### 4. ⚙️ Phân Luồng Kênh Quản Trị & Tra Cứu',
      '• `/df code setchannel`: Thiết lập kênh nhận mật mã hòm đồ két sắt hàng ngày (08:00 sáng).',
      '• `/config bot setannouncechannel`: Thiết lập kênh nhận thông báo cập nhật của bot.',
      '• `/df help`: Xem toàn bộ danh sách lệnh và hướng dẫn cài đặt tiện ích đồng bộ tài khoản.',
      '',
      footerText,
    ].join('\n');
  }

  const content = `${previewBanner}${bodyContent}`;

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.INFO },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/** Tìm kênh thích hợp nhất để gửi thông báo trong guild (ưu tiên kênh đã cấu hình) */
export function findAnnouncementChannel(
  guild: Guild,
  configuredChannelId?: string | null,
): { channel: TextChannel | null; reason?: string; isConfigured: boolean } {
  const botMember = guild.members.me;

  // 1. Kênh đã cấu hình riêng cho guild
  if (configuredChannelId) {
    const configured = guild.channels.cache.get(configuredChannelId);
    if (
      configured &&
      configured.isTextBased() &&
      !configured.isDMBased() &&
      !configured.isVoiceBased()
    ) {
      const textChan = configured as TextChannel;
      const perms = botMember ? textChan.permissionsFor(botMember) : null;
      if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return { channel: textChan, isConfigured: true };
      }
      return {
        channel: null,
        isConfigured: true,
        reason: `Kênh đã cấu hình (#${textChan.name}) nhưng bot thiếu quyền ViewChannel hoặc SendMessages`,
      };
    }
  }

  // 2. Kênh hệ thống nếu có quyền
  if (guild.systemChannel) {
    const perms = botMember ? guild.systemChannel.permissionsFor(botMember) : null;
    if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
      return { channel: guild.systemChannel as TextChannel, isConfigured: false };
    }
  }

  // 3. Kênh văn bản có tên chứa từ khóa ưu tiên
  const textChannels = Array.from(guild.channels.cache.values()).filter(
    (c): c is TextChannel =>
      c.isTextBased() && !c.isDMBased() && !c.isVoiceBased() && 'permissionsFor' in c,
  );

  const priorityKeywords = [
    'thông-báo',
    'announcement',
    'announcements',
    'general',
    'chung',
    'chat',
  ];
  for (const keyword of priorityKeywords) {
    const found = textChannels.find((c) => c.name.toLowerCase().includes(keyword));
    if (found && botMember) {
      const perms = found.permissionsFor(botMember);
      if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return { channel: found, isConfigured: false };
      }
    }
  }

  // 4. Kênh văn bản đầu tiên bot có quyền gửi
  for (const c of textChannels) {
    if (botMember) {
      const perms = c.permissionsFor(botMember);
      if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return { channel: c, isConfigured: false };
      }
    }
  }

  return {
    channel: null,
    isConfigured: false,
    reason: 'Không tìm thấy kênh văn bản khả dụng có quyền gửi tin nhắn',
  };
}

/** Subcommand `bot announce` — phát thông báo toàn hệ thống (chỉ dành cho Bot Owner) */
export async function handleBotAnnounce(interaction: ChatInputCommandInteraction): Promise<void> {
  // Guard bảo mật tối cao: Chỉ duy nhất Bot Owner được phép phát thông báo toàn hệ thống
  if (interaction.user.id !== botConfig.botOwnerId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền sử dụng lệnh này. Chỉ duy nhất Chủ sở hữu Bot (Bot Developer) mới có quyền phát thông báo toàn hệ thống.',
      ).toJSON(),
    });
    return;
  }

  const preview = interaction.options.getBoolean('preview') ?? false;
  const customTitle = interaction.options.getString('title');
  const customMessage = interaction.options.getString('message');

  const container = buildAnnouncementContainer({
    title: customTitle,
    message: customMessage,
    isPreview: preview,
  });

  if (preview) {
    await sendReply(interaction, {
      components: container.toJSON(),
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildList = Array.from(interaction.client.guilds.cache.values());
  const totalGuildCount = interaction.client.guilds.cache.size;
  const settingsService = getSettingsService();
  const delayMs = process.env.NODE_ENV === 'test' ? 0 : 1000;
  const results: {
    guildName: string;
    channelName?: string;
    channelId?: string;
    success: boolean;
    reason?: string;
    isConfigured: boolean;
  }[] = [];

  for (let i = 0; i < guildList.length; i++) {
    const guild = guildList[i];
    try {
      const configuredChannelId = settingsService.get(guild.id).botAnnounce?.channelId;
      const { channel, reason, isConfigured } = findAnnouncementChannel(guild, configuredChannelId);

      if (!channel) {
        results.push({
          guildName: guild.name,
          success: false,
          reason: reason || 'Không tìm thấy kênh văn bản có quyền gửi tin nhắn',
          isConfigured,
        });
        continue;
      }

      await channel.send({
        components: container.toJSON(),
        flags: MessageFlags.IsComponentsV2,
      });

      results.push({
        guildName: guild.name,
        channelName: channel.name,
        channelId: channel.id,
        success: true,
        isConfigured,
      });

      // Throttle nhẹ giữa các guild để chống Discord rate limit
      if (i < guildList.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      results.push({
        guildName: guild.name,
        success: false,
        reason: err instanceof Error ? err.message : String(err),
        isConfigured: false,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const summaryLines = results.map((r, idx) => {
    if (r.success) {
      const tag = r.isConfigured ? '*(Kênh đã cấu hình)*' : '*(Kênh tự động)*';
      const channelMention = r.channelId ? `<#${r.channelId}>` : `#${r.channelName ?? 'kênh'}`;
      return `**${idx + 1}. ${r.guildName}**: ✅ Đã gửi → ${channelMention} (#${r.channelName}) ${tag}`;
    }
    const tag = r.isConfigured ? ' *(Kênh đã cấu hình)*' : '';
    return `**${idx + 1}. ${r.guildName}**: ⚠️ Bỏ qua → ${r.reason}${tag}`;
  });

  const nowUnix = Math.floor(Date.now() / 1000);
  const summaryContent = [
    `# 📢 BÁO CÁO PHÁT THÔNG BÁO TOÀN HỆ THỐNG`,
    `> ⏱️ **Thời gian thực hiện:** <t:${nowUnix}:f> (<t:${nowUnix}:R>)`,
    ``,
    `### 📊 Thống Kê Tổng Hợp:`,
    `• 🌐 Tổng số máy chủ bot có mặt: **${totalGuildCount}**`,
    `• ✅ Gửi thành công: **${successCount} / ${totalGuildCount}** máy chủ`,
    `• ⚠️ Thất bại / Bỏ qua: **${failCount}** máy chủ`,
    ``,
    `### 📋 Chi Tiết Từng Máy Chủ:`,
    ...summaryLines,
  ].join('\n');

  await interaction.editReply({
    content: summaryContent,
  });
}

// ─── QR Server Subcommand Handlers (Bot Owner Only) ────────────────

/** Subcommand `qr-server toggle` — Bật hoặc tắt tính năng QR tự động cho máy chủ */
export async function handleQrServerToggle(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  // Guard bảo mật tối cao: Chỉ duy nhất Bot Owner được phép quản lý cấp phép tính năng QR trả phí
  if (interaction.user.id !== botConfig.botOwnerId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền sử dụng lệnh này. Chỉ duy nhất Chủ sở hữu Bot (Bot Owner) mới có quyền quản lý cấp phép tính năng QR cho máy chủ.',
      ).toJSON(),
    });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled', true);
  const inputServerId = interaction.options.getString('server_id')?.trim();
  const targetGuildId = inputServerId || interaction.guildId || interaction.guild?.id;

  if (!targetGuildId) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không xác định được ID máy chủ cần cấu hình.').toJSON(),
    });
    return;
  }

  const settingsService = getSettingsService();
  const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
  const guildDisplayName = targetGuild ? targetGuild.name : `Máy chủ (${targetGuildId})`;

  const now = Date.now();
  settingsService.update(targetGuildId, {
    qrServer: {
      enabled,
      updatedAt: now,
      updatedBy: interaction.user.id,
    },
  });

  logger.info(
    `[QrServer] Bot Owner [${interaction.user.id}] đã ${enabled ? 'MỞ' : 'KHÓA'} tính năng QR cho máy chủ ${targetGuildId} (${guildDisplayName})`,
  );

  const statusBadge = enabled ? '🟢 ĐÃ KÍCH HOẠT (OPEN)' : '🔴 ĐÃ KHÓA (DISABLED)';
  const statusDesc = enabled
    ? 'Tính năng tạo mã QR tự động đã sẵn sàng hoạt động trên máy chủ này.'
    : 'Tính năng tạo mã QR tự động đã bị khóa trên máy chủ này.';

  const envTag = botConfig.isDev ? '\n• **Môi trường**: 🛠️ `DEV (Local VSCode)`' : '';

  const container = buildInfoContainer(
    `### 🛡️ Quản Lý Cấp Phép QR Server (Premium Feature)\n\n` +
      `• **Máy chủ**: **${guildDisplayName}** (\`${targetGuildId}\`)\n` +
      `• **Trạng thái**: ${statusBadge}\n` +
      `• **Thời gian cập nhật**: <t:${Math.floor(now / 1000)}:F> (<t:${Math.floor(now / 1000)}:R>)\n` +
      `• **Người thực hiện**: <@${interaction.user.id}>` +
      `${envTag}\n\n` +
      `> ℹ️ *${statusDesc}*`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

/** Subcommand `qr-server status` — Kiểm tra trạng thái cấp phép QR của máy chủ */
export async function handleQrServerStatus(
  interaction: ChatInputCommandInteraction,
  _db?: Database.Database,
): Promise<void> {
  // Guard bảo mật tối cao: Chỉ duy nhất Bot Owner được phép kiểm tra cấu hình QR
  if (interaction.user.id !== botConfig.botOwnerId) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Bạn không có quyền sử dụng lệnh này. Chỉ duy nhất Chủ sở hữu Bot (Bot Owner) mới có quyền kiểm tra cấu hình QR của máy chủ.',
      ).toJSON(),
    });
    return;
  }

  const inputServerId = interaction.options.getString('server_id')?.trim();
  const targetGuildId = inputServerId || interaction.guildId || interaction.guild?.id;

  if (!targetGuildId) {
    await sendReply(interaction, {
      components: buildErrorContainer('Không xác định được ID máy chủ cần kiểm tra.').toJSON(),
    });
    return;
  }

  const settingsService = getSettingsService();
  const currentSettings = settingsService.get(targetGuildId);
  const qrConfig = currentSettings.qrServer;
  const isEnabled = qrConfig?.enabled ?? false;

  const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
  const guildDisplayName = targetGuild ? targetGuild.name : `Máy chủ (${targetGuildId})`;

  const statusBadge = isEnabled ? '🟢 ĐÃ KÍCH HOẠT (OPEN)' : '🔴 ĐÃ KHÓA (DISABLED)';
  const updatedTime = qrConfig?.updatedAt
    ? `<t:${Math.floor(qrConfig.updatedAt / 1000)}:F> (<t:${Math.floor(qrConfig.updatedAt / 1000)}:R>)`
    : '*Chưa từng cập nhật*';
  const updatedByUser = qrConfig?.updatedBy ? `<@${qrConfig.updatedBy}>` : '*Hệ thống (mặc định)*';

  const envTag = botConfig.isDev ? '\n• **Môi trường**: 🛠️ `DEV (Local VSCode)`' : '';

  const container = buildInfoContainer(
    `### 🛡️ Trạng Thái Cấp Phép QR Server\n\n` +
      `• **Máy chủ**: **${guildDisplayName}** (\`${targetGuildId}\`)\n` +
      `• **Trạng thái**: ${statusBadge}\n` +
      `• **Cập nhật lần cuối**: ${updatedTime}\n` +
      `• **Người thực hiện**: ${updatedByUser}` +
      `${envTag}`,
  );

  await sendReply(interaction, {
    components: container.toJSON(),
  });
}

// ─── VietQR Subcommand Handlers (Admin with Premium Guild Check) ───

/** Subcommand `vietqr workflow` — Cấu hình quy trình duyệt bill, kênh feedback và đánh giá 5 sao */
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

  // Guard: Server phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Tính năng QR Thanh toán tự động chưa được mở cho máy chủ này.\nVui lòng liên hệ Chủ sở hữu Bot (Bot Owner) để đăng ký kích hoạt gói QR Premium.',
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

/** Subcommand `vietqr set` — Cài đặt thông tin tài khoản ngân hàng nhận tiền */
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

  // Guard: Server phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Tính năng QR Thanh toán tự động chưa được mở cho máy chủ này.\nVui lòng liên hệ Chủ sở hữu Bot (Bot Owner) để đăng ký kích hoạt gói QR Premium.',
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
  settingsService.update(guildId, {
    vietqr: {
      enabled: true,
      bankId: bank,
      accountNo,
      accountName,
      prefix,
      template: 'compact2',
    },
  });

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

/** Subcommand `vietqr status` — Xem cấu hình tài khoản ngân hàng hiện tại của máy chủ */
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

  // Guard: Server phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Tính năng QR Thanh toán tự động chưa được mở cho máy chủ này.\nVui lòng liên hệ Chủ sở hữu Bot (Bot Owner) để đăng ký kích hoạt gói QR Premium.',
      ).toJSON(),
    });
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

/** Subcommand `vietqr preview` — Xem trước và quét thử mã QR thanh toán mẫu */
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

  // Guard: Server phải được Bot Owner mở tính năng QR trước đó
  if (!isQrServerEnabled(guildId)) {
    await sendReply(interaction, {
      components: buildErrorContainer(
        '🔒 Tính năng QR Thanh toán tự động chưa được mở cho máy chủ này.\nVui lòng liên hệ Chủ sở hữu Bot (Bot Owner) để đăng ký kích hoạt gói QR Premium.',
      ).toJSON(),
    });
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

  // Defer reply ngay lập tức để tránh timeout 3 giây của Discord khi fetch ảnh VietQR
  if (typeof interaction.deferReply === 'function') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
