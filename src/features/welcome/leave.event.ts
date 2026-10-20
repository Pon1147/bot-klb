import { Client, GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('LeaveEvent');

/**
 * Xử lý sự kiện guildMemberRemove: gửi leave message khi member rời server.
 * Settings được lấy từ SettingsService (Database + in-memory cache).
 *
 * @param _client Discord Client (được bind từ event loader)
 * @param member Member vừa rời khỏi server
 */
export async function handleLeaveMemberRemove(
  _client: Client | unknown,
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  // Bỏ qua nếu member là bot
  if (member.user?.bot) {
    return;
  }

  try {
    const settingsService = getSettingsService();
    const leave = settingsService.getLeave(member.guild.id);

    // Bỏ qua nếu tính năng leave đang tắt
    if (!leave.enabled) {
      return;
    }

    // Bỏ qua nếu chưa cấu hình kênh leave
    if (!leave.channelId) {
      return;
    }

    const leaveChannel = member.guild.channels.cache.get(leave.channelId);

    // Bỏ qua nếu kênh không tồn tại hoặc không phải kênh chat văn bản
    if (!leaveChannel || !leaveChannel.isTextBased()) {
      return;
    }

    // Tạo nội dung Container V2 (Components V2)
    const leaveContainer = settingsService.buildLeaveContainer(member.guild.id, {
      member: member as GuildMember,
      guild: member.guild,
    });

    // Gửi tin nhắn tạm biệt
    await (leaveChannel as TextChannel).send({
      components: leaveContainer.toJSON(),
      flags: leaveContainer.flags,
      files: leaveContainer.files,
    });
  } catch (error) {
    logger.error(
      `Error sending leave message for ${member.user?.tag ?? member.id}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
