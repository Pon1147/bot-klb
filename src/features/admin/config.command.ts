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
import { getSettingsService, SettingsService } from '../../services/settings.service.js';
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
        .addBooleanOption((opt) =>
          opt
            .setName('preview')
            .setDescription('Chỉ xem trước giao diện thông báo, chưa phát thật (mặc định: false)')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Lời nhắn thêm từ nhà phát triển (tùy chọn)')
            .setRequired(false),
        ),
    );
}

// ─── Slash Command Builder ────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Quản lý cấu hình bot, roles, welcome, booster, và container.')
  .addSubcommandGroup(buildRolesGroup)
  .addSubcommandGroup(buildWelcomeGroup)
  .addSubcommandGroup(buildBoosterGroup)
  .addSubcommandGroup(buildContainerGroup)
  .addSubcommandGroup(buildBotGroup);

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

/** Xây dựng container thông báo cập nhật tính năng mới */
export function buildAnnouncementContainer(customNote?: string | null, isPreview?: boolean) {
  const previewBanner = isPreview
    ? '> 👁️ **CHẾ ĐỘ XEM TRƯỚC (PREVIEW)**\n> *Giao diện thông báo mẫu sẽ gửi tới các máy chủ. Chạy lệnh với `preview: false` để phát thật.*\n\n'
    : '';

  const content = [
    previewBanner,
    '## 🚀 BẢN CẬP NHẬT MỚI: DELTA FORCE BOT & TIỆN ÍCH EXTENSION',
    '',
    'Xin chào tất cả các Đặc vụ! Bot vừa được cập nhật các tính năng mới giúp trải nghiệm và liên kết tài khoản mượt mà hơn:',
    '',
    '### 📌 Lệnh mới: `/df help`',
    '- **Trung tâm trợ giúp toàn diện**: Tra cứu nhanh danh sách mọi lệnh của bot (`/df`, `/team`, `/config`).',
    '- **Tải Tiện ích 1-Click**: Tự động đính kèm tệp tiện ích mở rộng `DF-Extension.zip` sạch và an toàn.',
    '- **Hướng dẫn 5 bước**: Cài đặt tiện ích qua chế độ Developer mode và liên kết tài khoản Delta Force HQ dễ dàng.',
    '',
    '### ⚡ Cải tiến lệnh: `/df link start`',
    '- Giờ đây khi lấy mã claim, bot đính kèm sẵn tệp `DF-Extension.zip` để bạn cài đặt ngay mà không cần tìm link ngoài.',
    '',
    customNote ? `> 💬 **Lời nhắn từ Nhà phát triển:**\n> ${customNote}\n\n` : '',
    '👉 *Hãy gõ ngay lệnh `/df help` trên máy chủ để trải nghiệm thử nhé!*',
  ]
    .filter(Boolean)
    .join('\n');

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
  const customMessage = interaction.options.getString('message');

  if (preview) {
    const container = buildAnnouncementContainer(customMessage, true);
    await sendReply(interaction, {
      components: container.toJSON(),
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const container = buildAnnouncementContainer(customMessage, false);
  const guilds = interaction.client.guilds.cache;
  const settingsService = getSettingsService();
  const results: {
    guildName: string;
    channelName?: string;
    success: boolean;
    reason?: string;
    isConfigured: boolean;
  }[] = [];

  for (const guild of guilds.values()) {
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
        success: true,
        isConfigured,
      });
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
      return `**${idx + 1}. ${r.guildName}**: ✅ Đã gửi → <#${r.channelName ? r.channelName : ''}> (#${r.channelName}) ${tag}`;
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
    `• 🌐 Tổng số máy chủ bot có mặt: **${guilds.size}**`,
    `• ✅ Gửi thành công: **${successCount} / ${guilds.size}** máy chủ`,
    `• ⚠️ Thất bại / Bỏ qua: **${failCount}** máy chủ`,
    ``,
    `### 📋 Chi Tiết Từng Máy Chủ:`,
    ...summaryLines,
  ].join('\n');

  await interaction.editReply({
    content: summaryContent,
  });
}
