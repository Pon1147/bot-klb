/**
 * Handler xử lý sự kiện khi bot được mời vào máy chủ mới (GuildCreate).
 * Tự động gửi thông điệp chào mừng và hướng dẫn các lệnh cài đặt cơ bản ban đầu cho Admin.
 */

import {
  Client,
  ComponentType,
  Guild,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { COLORS } from '../../config/container.variables.js';
import { BOT_VERSION } from '../../config/version.js';
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { createLogger } from '../../utils/logger.js';
import { claimGuildWelcome, updateGuildWelcomeResult } from '../../database/guild.settings.db.js';

const logger = createLogger('GuildCreateHandler');

/** Xây dựng container V2 hướng dẫn cài đặt ban đầu khi bot vào server (ngắn gọn, tập trung /df help) */
export function buildGuildWelcomeContainer(guildName: string): BuildContainerResult {
  const content = [
    `# Chào mừng Bot Delta đến với **${guildName}**!`,
    '',
    '**Bot Delta** hỗ trợ tự động hóa máy chủ và đồng hành cùng game thủ **Delta Force (Garena)**.',
    'Để xem toàn bộ cẩm nang lệnh, tra cứu chỉ số, nhận mã két sắt và liên kết tài khoản:',
    '',
    '> **Hãy gõ lệnh `/df help` để bắt đầu khám phá ngay!**',
    '',
    `> **Bot Delta v${BOT_VERSION}** • Tác giả: **Pon1147** • Hỗ trợ: [KLB Community](https://discord.gg/vz6w6c3Xe3)`,
  ].join('\n');

  return makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.DF },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );
}

/** Tìm kênh phù hợp nhất để gửi thông báo chào mừng ban đầu */
export function findInitialAnnouncementChannel(guild: Guild): TextChannel | null {
  const botMember = guild.members.me;

  // 1. Ưu tiên Kênh hệ thống nếu có quyền
  if (guild.systemChannel && botMember) {
    const perms = guild.systemChannel.permissionsFor(botMember);
    if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
      return guild.systemChannel as TextChannel;
    }
  }

  // 2. Kênh văn bản có tên chứa từ khóa thông dụng
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
    'bot',
    'lệnh',
    'commands',
  ];

  for (const keyword of priorityKeywords) {
    const found = textChannels.find((c) => c.name.toLowerCase().includes(keyword));
    if (found && botMember) {
      const perms = found.permissionsFor(botMember);
      if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return found;
      }
    }
  }

  // 3. Fallback: Kênh văn bản đầu tiên có quyền gửi tin
  for (const chan of textChannels) {
    if (botMember) {
      const perms = chan.permissionsFor(botMember);
      if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return chan;
      }
    }
  }

  return null;
}

/** Xử lý sự kiện bot gia nhập guild mới theo nguyên tắc At-Most-Once và Fail-Closed */
export async function handleGuildCreate(client: Client, guild: Guild): Promise<void> {
  logger.info(
    `[GuildCreate] Bot đã được thêm vào máy chủ mới: "${guild.name}" (ID: ${guild.id}, Members: ${guild.memberCount})`,
  );

  const database = client.database;
  if (!database) {
    logger.warn(
      `[GuildCreate] Database chưa sẵn sàng, bỏ qua xử lý chào mừng cho "${guild.name}" (${guild.id}).`,
    );
    return;
  }

  // 1. Atomic Claim First (Fail-Closed)
  let claimSuccess = false;
  try {
    claimSuccess = claimGuildWelcome(database, guild.id);
  } catch (dbError) {
    logger.error(
      `[GuildCreate] Lỗi DB khi claim chào mừng cho "${guild.name}" (${guild.id}) - Fail-Closed:`,
      { error: dbError instanceof Error ? dbError.message : String(dbError) },
    );
    return;
  }

  if (!claimSuccess) {
    logger.info(
      `[GuildCreate] Máy chủ "${guild.name}" (${guild.id}) đã có bản ghi audit. Bỏ qua gửi chào mừng.`,
    );
    return;
  }

  // 2. Tìm kênh thích hợp
  const targetChannel = findInitialAnnouncementChannel(guild);
  if (!targetChannel) {
    logger.warn(
      `[GuildCreate] Không tìm thấy kênh văn bản thích hợp có quyền gửi tin nhắn trong máy chủ "${guild.name}" (${guild.id}).`,
    );
    try {
      updateGuildWelcomeResult(
        database,
        guild.id,
        'failed',
        undefined,
        'No writable channel found',
      );
    } catch (err) {
      logger.error(`[GuildCreate] Lỗi khi cập nhật trạng thái failed:`, { error: String(err) });
    }
    return;
  }

  // 3. Gửi tin nhắn chào mừng (Components V2)
  try {
    const welcomeContainer = buildGuildWelcomeContainer(guild.name);
    await targetChannel.send({
      components: welcomeContainer.toJSON(),
      flags: MessageFlags.IsComponentsV2,
    });

    try {
      updateGuildWelcomeResult(database, guild.id, 'sent', targetChannel.id);
    } catch (updateErr) {
      logger.error(
        `[GuildCreate] Tin nhắn đã gửi tới #${targetChannel.name} nhưng lỗi cập nhật status 'sent' trong DB:`,
        { error: updateErr instanceof Error ? updateErr.message : String(updateErr) },
      );
    }

    logger.info(
      `[GuildCreate] Đã gửi thông báo chào mừng ban đầu tới kênh #${targetChannel.name} trong "${guild.name}"`,
    );
  } catch (error) {
    logger.error(`[GuildCreate] Lỗi khi gửi thông báo chào mừng trong máy chủ "${guild.name}":`, {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      updateGuildWelcomeResult(
        database,
        guild.id,
        'failed',
        targetChannel.id,
        error instanceof Error ? error.message : String(error),
      );
    } catch (failUpdateErr) {
      logger.error(`[GuildCreate] Lỗi khi cập nhật status 'failed' trong DB:`, {
        error: failUpdateErr instanceof Error ? failUpdateErr.message : String(failUpdateErr),
      });
    }
  }
}
