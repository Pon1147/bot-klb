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
    `# Cảm ơn bạn đã mời KL Bot vào server **${guildName}**!`,
    '',
    'Xin chào Quản trị viên và toàn thể thành viên! **KL Bot** là bot Discord chuyên biệt hỗ trợ tự động hóa máy chủ và tích hợp hệ thống game **Delta Force (Server Garena)**.',
    '',
    '---',
    '',
    '### Thiết lập cơ bản ban đầu (Dành cho Admin / Mod)',
    '',
    '• **Phân quyền Quản trị (RBAC):**',
    '> `/config roles set role_type:<Loại> role:<@Role>`',
    '> Thiết lập role Bot Admin, Moderator, Member để phân quyền thực thi lệnh. Kiểm tra lại bằng `/config roles view`.',
    '',
    '• **Kênh gửi Mật khẩu Két sắt tự động mỗi sáng (Khuyên dùng):**',
    '> `/df code setchannel channel:<#Kênh>`',
    '> Bot sẽ tự động gửi bảng mật khẩu két sắt của toàn bộ các map vào kênh này lúc 08:00 mỗi sáng.',
    '',
    '• **Kênh nhận thông báo cập nhật từ Bot:**',
    '> `/config bot setannouncechannel channel:<#Kênh>`',
    '> Nhận thông báo tự động khi có tính năng mới hoặc cập nhật bảo trì.',
    '',
    '• **Hệ thống Chào mừng, Tạm biệt & Server Booster (Container V2):**',
    '> `/config welcome setchannel channel:<#Kênh>` & `/config welcome toggle enabled:True` (Chào mừng)',
    '> `/config leave setchannel channel:<#Kênh>` & `/config leave toggle enabled:True` (Tạm biệt)',
    '> `/config booster setchannel channel:<#Kênh>` & `/config booster toggle enabled:True` (Booster)',
    '> *Thử nghiệm trước giao diện:* `/config welcome test` | `/config leave test` | `/config booster test`',
    '',
    '---',
    '',
    '### Lệnh nổi bật cho Thành viên (Delta Force)',
    '',
    '• `/df code show`: Xem ngay mật khẩu két sắt hôm nay của các map.',
    '• `/df build` (hoặc `/df gun`): Thư viện build súng meta Garena từ DeltaForceTools, lọc theo chế độ/loại súng & copy mã Gunsmith 1-chạm.',
    '• `/df map`: Mô phỏng bản đồ 3D tương tác, soi két sắt và lối rút quân an toàn.',
    '• `/df stats`: Xem thống kê cá nhân (K/D, tỷ lệ rút quân, rank) & đổi mùa giải độc quyền.',
    '• `/team find`: Đăng tin tuyển hoặc tìm đồng đội squad leo rank.',
    '• `/df help`: Trung tâm trợ giúp toàn diện & tải tiện ích liên kết tài khoản HQ.',
    '',
    '---',
    '',
    '> 💬 **Hỗ trợ & Thắc mắc:** Vui lòng liên hệ Discord: `crushpon` hoặc tham gia server [KLB Community](https://discord.gg/vz6w6c3Xe3) để được hỗ trợ.',
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
