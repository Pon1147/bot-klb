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
import { makeResult, BuildContainerResult } from '../../utils/container.utils.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('GuildCreateHandler');

/** Xây dựng container V2 hướng dẫn cài đặt ban đầu khi bot vào server */
export function buildGuildWelcomeContainer(guildName: string): BuildContainerResult {
  const content = [
    `# 🎉 CẢM ƠN BẠN ĐÃ MỜI KL BOT VÀO SERVER **${guildName}**!`,
    '',
    'Xin chào Quản trị viên và toàn thể thành viên! **KL Bot** là bot Discord đa năng hỗ trợ quản lý cộng đồng, tự động hóa máy chủ và tích hợp sâu hệ thống game Delta Force.',
    '',
    '---',
    '',
    '### ⚙️ CÁC BƯỚC THIẾT LẬP CƠ BẢN BAN ĐẦU (DÀNH CHO ADMIN / MOD)',
    '',
    '1️⃣ **Cấu hình phân quyền Quản trị (RBAC)**',
    '> `/config roles set role_type:<Loại> role:<@Role>`',
    '> • Thiết lập role **Bot Admin**, **Moderator**, và **Member** để phân quyền thực thi các lệnh quan trọng.',
    '> • Xem lại phân quyền bất kỳ lúc nào với: `/config roles view`.',
    '',
    '2️⃣ **Chỉ định kênh nhận thông báo cập nhật từ Bot**',
    '> `/config bot setannouncechannel channel:<#Kênh>`',
    '> • Nhận thông báo tự động mỗi khi bot cập nhật tính năng mới, sự kiện hoặc lịch bảo trì.',
    '',
    '3️⃣ **Cấu hình Chào mừng (Welcome) & Cảm ơn Booster (Tùy chọn)**',
    '> `/config welcome setchannel channel:<#Kênh>` & `/config welcome toggle enabled:True`',
    '> `/config booster setchannel channel:<#Kênh>` & `/config booster toggle enabled:True`',
    '> • Tự động gửi thiệp chào mừng thành viên mới và cảm ơn thành viên nâng cấp (Boost) server.',
    '',
    '---',
    '',
    '### 🎮 TÍNH NĂNG GAME DELTA FORCE & TIỆN ÍCH MỞ RỘNG',
    '',
    '• 📌 **`/df help`**: Trung tâm trợ giúp toàn diện, tải trực tiếp tiện ích **DF-Extension.zip** (1-Click) và hướng dẫn kết nối tài khoản HQ.',
    '• 🔑 **`/df code`**: Tra cứu mã mật mã hòm đồ hằng ngày (tự động cập nhật 08:00 mỗi sáng).',
    '• 📊 **`/df stats`**: Tra cứu hồ sơ tác chiến cá nhân và lịch sử đấu.',
    '• 👥 **`/team create`**: Tạo phòng tìm đồng đội leo rank tác chiến Delta Force.',
    '',
    '👉 *Chúc cộng đồng máy chủ có những trải nghiệm tuyệt vời! Nếu cần xem trợ giúp, hãy gõ ngay `/df help`.*',
  ].join('\n');

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

/** Xử lý sự kiện bot gia nhập guild mới */
export async function handleGuildCreate(_client: Client, guild: Guild): Promise<void> {
  logger.info(
    `[GuildCreate] Bot đã được thêm vào máy chủ mới: "${guild.name}" (ID: ${guild.id}, Members: ${guild.memberCount})`,
  );

  try {
    const targetChannel = findInitialAnnouncementChannel(guild);

    if (!targetChannel) {
      logger.warn(
        `[GuildCreate] Không tìm thấy kênh văn bản thích hợp có quyền gửi tin nhắn trong máy chủ "${guild.name}" (${guild.id}).`,
      );
      return;
    }

    const welcomeContainer = buildGuildWelcomeContainer(guild.name);

    await targetChannel.send({
      components: welcomeContainer.toJSON(),
      flags: MessageFlags.IsComponentsV2,
    });

    logger.info(
      `✓ [GuildCreate] Đã gửi thông báo hướng dẫn ban đầu tới kênh #${targetChannel.name} trong "${guild.name}"`,
    );
  } catch (error) {
    logger.error(`✗ [GuildCreate] Lỗi khi gửi thông báo chào mừng trong máy chủ "${guild.name}":`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
