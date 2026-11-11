/**
 * Subcommand Group: /config bot
 * Quản trị bot cấp cao và thông báo toàn hệ thống (BM-01).
 */

import {
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  TextChannel,
  ComponentType,
} from 'discord.js';
import Database from 'better-sqlite3';
import { getSettingsService } from '../../../services/settings.service.js';
import { botConfig } from '../../../config/bot.config.js';
import {
  buildErrorContainer,
  buildInfoContainer,
  makeResult,
} from '../../../utils/container.utils.js';
import { sendReply } from '../../../utils/reply.utils.js';
import { COLORS } from '../../../config/container.variables.js';
import { EN_LOCALE } from '../../../locales/en.js';

export function buildBotGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('bot')
    .setDescription('Xem thông tin và quản trị cấp cao bot.')
    .setDescriptionLocalizations({
      'en-US': 'Global bot administration and multi-server broadcasts.',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('guilds')
        .setDescription('Xem danh sách các máy chủ (guilds) bot đang tham gia.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.bot.guilds'].desc,
        }),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setannouncechannel')
        .setDescription('Cấu hình kênh nhận thông báo cập nhật bot cho máy chủ này.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.bot.setannouncechannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Kênh văn bản nhận thông báo từ bot')
            .setDescriptionLocalizations({ 'en-US': 'Text channel for bot update announcements' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('announce')
        .setDescription('Phát thông báo cập nhật tới toàn bộ máy chủ (chỉ dành cho Bot Owner).')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.bot.announce'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Tiêu đề thông báo tùy chỉnh (tùy chọn)')
            .setDescriptionLocalizations({ 'en-US': 'Custom announcement title (optional)' })
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Nội dung thông báo cần phát sóng (tùy chọn nếu muốn gửi changelog)')
            .setDescriptionLocalizations({ 'en-US': 'Broadcast message body (optional)' })
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('preview')
            .setDescription('Chỉ xem trước giao diện thông báo, chưa phát thật (mặc định: false)')
            .setDescriptionLocalizations({ 'en-US': 'Preview announcement layout without sending' })
            .setRequired(false),
        ),
    );
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
    const headerTitle = title?.trim()
      ? `# ${title.trim()}`
      : '# 📢 THÔNG BÁO TỪ BAN QUẢN TRỊ BOT DELTA';
    bodyContent = [headerTitle, '', message.trim(), '', footerText].join('\n');
  } else {
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

  if (guild.systemChannel) {
    const perms = botMember ? guild.systemChannel.permissionsFor(botMember) : null;
    if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
      return { channel: guild.systemChannel as TextChannel, isConfigured: false };
    }
  }

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

export async function handleBotAnnounce(interaction: ChatInputCommandInteraction): Promise<void> {
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

export async function executeBotGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'guilds') {
    await handleBotGuilds(interaction);
  } else if (subcommand === 'announce') {
    await handleBotAnnounce(interaction);
  } else if (subcommand === 'setannouncechannel') {
    await handleBotSetAnnounceChannel(interaction, database);
  }
}
