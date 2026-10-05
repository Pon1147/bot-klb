import { Client, GuildMember } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WelcomeEvent');

/**
 * Gán role welcome cho member mới.
 * Xử lý lỗi gracefully để thất bại cấp role không chặn việc gửi welcome message.
 */
export async function assignWelcomeRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);

  if (!role) {
    logger.warn(`Welcome role ${roleId} not found in guild ${member.guild.id}.`);
    return;
  }

  try {
    await member.roles.add(role);
  } catch (error) {
    logger.error(
      `Failed to assign role ${role.name} to ${member.user.tag}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Xử lý sự kiện guildMemberAdd: gửi welcome message khi member mới join.
 * Settings được lấy từ SettingsService (Database + in-memory cache).
 *
 * @param _client Discord Client (được bind từ event loader)
 * @param member Member vừa tham gia server
 */
export async function handleWelcomeMemberAdd(
  _client: Client | unknown,
  member: GuildMember,
): Promise<void> {
  // Bỏ qua nếu member là bot
  if (member.user.bot) {
    return;
  }

  try {
    const settingsService = getSettingsService();
    const welcome = settingsService.getWelcome(member.guild.id);

    // Bỏ qua nếu tính năng welcome đang tắt
    if (!welcome.enabled) {
      return;
    }

    // Bỏ qua nếu chưa cấu hình kênh chào mừng
    if (!welcome.channelId) {
      return;
    }

    const welcomeChannel = member.guild.channels.cache.get(welcome.channelId);

    // Bỏ qua nếu kênh không tồn tại hoặc không phải kênh chat văn bản
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      return;
    }

    // Tạo nội dung Container V2 (Components V2)
    const welcomeContainer = settingsService.buildWelcomeContainer(member.guild.id, {
      member,
      guild: member.guild,
    });

    // Gửi tin nhắn chào mừng
    await welcomeChannel.send({
      components: welcomeContainer.toJSON(),
      flags: welcomeContainer.flags,
      files: welcomeContainer.files,
    });

    // Cấp role welcome tự động nếu có cấu hình
    if (welcome.roleId) {
      await assignWelcomeRole(member, welcome.roleId);
    }
  } catch (error) {
    logger.error(
      `Error sending welcome message for ${member.user.tag}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
