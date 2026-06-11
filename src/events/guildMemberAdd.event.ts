import { Client, GuildMember } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';

/**
 * Handle guildMemberAdd event: gửi welcome message khi member mới join.
 * Settings được load từ SettingsService (DB + cache + fallback default).
 *
 * Arg đầu tiên luôn là `client` (được bind từ event handler).
 */
export async function execute(_client: Client, member: GuildMember): Promise<void> {
  // Guard clause: bỏ qua bot
  if (member.user.bot) {
    return;
  }

  try {
    const settingsService = getSettingsService();
    const welcome = settingsService.getWelcome(member.guild.id);

    // Guard clause: welcome bị tắt
    if (!welcome.enabled) {
      return;
    }

    // Guard clause: chưa cấu hình channel
    if (!welcome.channelId) {
      return;
    }

    const welcomeChannel = member.guild.channels.cache.get(welcome.channelId);

    // Guard clause: channel không tồn tại hoặc không phải text channel
    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      return;
    }

    // Build welcome container V2 (Components V2)
    const welcomeContainer = settingsService.buildWelcomeContainer(member.guild.id, {
      member,
      guild: member.guild,
    });

    // Gửi Container V2 message
    // Note: cast components vì discord.js v14 chưa có type chính thức cho Components V2
    await welcomeChannel.send({
      components: welcomeContainer.toJSON(),
      flags: welcomeContainer.flags,
      files: welcomeContainer.files,
    });

    // Gán role welcome nếu có cấu hình
    if (welcome.roleId) {
      await assignWelcomeRole(member, welcome.roleId);
    }
  } catch (error) {
    console.error(`Error sending welcome message for ${member.user.tag}:`, error);
  }
}

/**
 * Gán role welcome cho member mới.
 * Xử lý lỗi gracefully để fail role không chặn welcome message.
 */
async function assignWelcomeRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);

  if (!role) {
    console.warn(`Welcome role ${roleId} not found in guild ${member.guild.id}.`);
    return;
  }

  try {
    await member.roles.add(role);
  } catch (error) {
    console.error(`Failed to assign role ${role.name} to ${member.user.tag}:`, error);
  }
}

export default {
  name: 'guildMemberAdd',
  once: false,
  execute,
};
