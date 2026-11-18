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
    `Phát hiện ticket mới tại #${channel.name} (${channel.id}). Gửi thẻ chào mừng Kéo Lão Bản...`,
  );

  try {
    const textChannel = channel as TextChannel;
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
