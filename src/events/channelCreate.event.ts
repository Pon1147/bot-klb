import { ChannelType, Client, Events, GuildChannel, TextChannel } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';
import { buildTicketWelcomeCard } from '../features/keo-lao-ban/keo.builder.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChannelCreateEvent');

export async function execute(_client: Client, channel: GuildChannel): Promise<void> {
  // Chỉ kiểm tra các kênh text trong Guild
  if (channel.type !== ChannelType.GuildText) {
    return;
  }

  const guild = channel.guild;
  if (!guild) {
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.get(guild.id);
  const keoConfig = settings.keo;

  // Nếu chưa cấu hình category ticket hoặc channel không thuộc category đó -> bỏ qua
  if (!keoConfig?.ticketCategoryId || channel.parentId !== keoConfig.ticketCategoryId) {
    return;
  }

  logger.info(
    `Phát hiện ticket mới tại #${channel.name} (${channel.id}). Chờ 2.5s để ticket bot setup...`,
  );

  // Đợi 2.5 giây để Ticket Bot hoàn tất gán quyền channel và gửi tin nhắn chào ban đầu
  await new Promise((resolve) => setTimeout(resolve, 2500));

  try {
    const textChannel = (guild.channels?.cache?.get(channel.id) ?? channel) as TextChannel;
    if (typeof textChannel.isTextBased === 'function' && !textChannel.isTextBased()) return;

    const card = buildTicketWelcomeCard(channel.id);
    await textChannel.send(card);
    logger.info(`Đã gửi thẻ Chào Mừng Kéo Lão Bản vào #${channel.name}`);
  } catch (err) {
    logger.error(`Không thể gửi thẻ chào mừng vào #${channel.name}:`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export default {
  name: Events.ChannelCreate,
  once: false,
  execute,
};
