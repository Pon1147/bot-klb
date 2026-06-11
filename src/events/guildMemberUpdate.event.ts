import { GuildMember } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';

/**
 * Handle guildMemberUpdate event: detect khi member Server Boost.
 * Discord không có event riêng cho boost, phải so sánh premiumSince field.
 *
 * Logic: oldMember.premiumSince === null && newMember.premiumSince !== null
 * → Member vừa boost server! → Gửi tin nhắn cảm ơn + cấp role.
 *
 * Arg đầu tiên luôn là `client` (được bind từ event handler).
 */
export async function execute(
  _client: unknown,
  oldMember: GuildMember,
  newMember: GuildMember,
): Promise<void> {
  // Guard clause: bỏ qua bot
  if (newMember.user.bot) {
    return;
  }

  // Detect boost: premiumSince chuyển từ null → có giá trị
  const wasBoosting = oldMember.premiumSince !== null;
  const isNowBoosting = newMember.premiumSince !== null;

  // Guard clause: chỉ xử lý khi member vừa boost (chưa boost → đang boost)
  if (wasBoosting || !isNowBoosting) {
    return;
  }

  try {
    const settingsService = getSettingsService();
    const booster = settingsService.getBooster(newMember.guild.id);

    // Guard clause: booster bị tắt
    if (!booster.enabled) {
      return;
    }

    // Guard clause: chưa cấu hình channel
    if (!booster.channelId) {
      return;
    }

    const boosterChannel = newMember.guild.channels.cache.get(booster.channelId);

    // Guard clause: channel không tồn tại hoặc không phải text channel
    if (!boosterChannel || !boosterChannel.isTextBased()) {
      return;
    }

    // Build booster container V2 (Components V2)
    const boosterContainer = settingsService.buildBoosterContainer(newMember.guild.id, {
      member: newMember,
      guild: newMember.guild,
    });

    // Gửi Container V2 message
    // Note: cast components vì discord.js v14 chưa có type chính thức cho Components V2
    await boosterChannel.send({
      components: boosterContainer.toJSON(),
      flags: boosterContainer.flags,
      files: boosterContainer.files,
    });

    // Gán role booster nếu có cấu hình
    if (booster.roleId) {
      await assignBoosterRole(newMember, booster.roleId);
    }
  } catch (error) {
    console.error(`Error sending booster message for ${newMember.user.tag}:`, error);
  }
}

/**
 * Gán role booster cho member vừa boost server.
 * Xử lý lỗi gracefully để fail role không chặn booster message.
 */
async function assignBoosterRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);

  if (!role) {
    console.warn(`Booster role ${roleId} not found in guild ${member.guild.id}.`);
    return;
  }

  try {
    await member.roles.add(role);
  } catch (error) {
    console.error(`Failed to assign booster role ${role.name} to ${member.user.tag}:`, error);
  }
}

export default {
  name: 'guildMemberUpdate',
  once: false,
  execute,
};