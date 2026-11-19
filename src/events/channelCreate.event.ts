import { ChannelType, Client, Events, GuildChannel, TextChannel } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';
import { buildTicketWelcomeCard } from '../features/keo-lao-ban/keo.builder.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChannelCreateEvent');

// Set lưu các channelId đã hoặc đang được xử lý để triệt tiêu hoàn toàn race condition
export const welcomedChannels = new Set<string>();

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

  const channelName = channel.name.toLowerCase();

  // Nếu chưa cấu hình category ticket hoặc channel không thuộc category đó -> bỏ qua
  // Guard: Phải có chữ 'ticket' trong tên kênh và không trùng kênh bắn đơn
  if (
    !keoConfig?.ticketCategoryId ||
    channel.parentId !== keoConfig.ticketCategoryId ||
    !channelName.includes('ticket') ||
    channel.id === keoConfig.dispatchChannelId
  ) {
    return;
  }

  // Khóa đồng bộ ngay lập tức trước khi await để chặn mọi race condition
  if (welcomedChannels.has(channel.id)) {
    return;
  }
  welcomedChannels.add(channel.id);
  if (welcomedChannels.size > 1000) {
    const first = welcomedChannels.values().next().value;
    if (first) welcomedChannels.delete(first);
  }

  logger.info(
    `Phát hiện ticket mới tại #${channel.name} (${channel.id}). Chờ 2.5s để ticket bot setup...`,
  );

  // Đợi 2.5 giây để Ticket Bot hoàn tất gán quyền channel và gửi tin nhắn chào ban đầu
  await new Promise((resolve) => setTimeout(resolve, 2500));

  try {
    const textChannel = (guild.channels?.cache?.get(channel.id) ?? channel) as TextChannel;
    if (typeof textChannel.isTextBased === 'function' && !textChannel.isTextBased()) return;

    // Tránh gửi đúp: kiểm tra xem đã có tin nhắn chào mừng từ bot chưa (do fallback messageCreate gửi trước)
    if (typeof textChannel.messages?.fetch === 'function') {
      const recentMessages = await textChannel.messages.fetch({ limit: 5 }).catch(() => null);
      const alreadySent = recentMessages?.some((m) => m.author.id === guild.client.user?.id);
      if (alreadySent) {
        logger.debug(`Thẻ chào mừng đã được gửi trước đó vào #${channel.name}, bỏ qua.`);
        return;
      }
    }

    const card = buildTicketWelcomeCard(channel.id);
    await textChannel.send(card);
    logger.info(`Đã gửi thẻ Chào Mừng Kéo Lão Bản vào #${channel.name}`);
  } catch (err) {
    welcomedChannels.delete(channel.id);
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
