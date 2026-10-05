import { GuildMember } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('BoosterEvent');

/**
 * Gán role booster tự động cho member khi server boost.
 */
export async function assignBoosterRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return;

  try {
    await member.roles.add(role);
  } catch (error) {
    logger.error(
      `Failed to assign booster role ${role.name} to ${member.user.tag}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Xử lý sự kiện khi member bắt đầu Boost server (guildMemberUpdate).
 *
 * @param oldMember Trạng thái member trước update
 * @param newMember Trạng thái member sau update
 */
export async function handleBoosterMemberUpdate(
  oldMember: GuildMember,
  newMember: GuildMember,
): Promise<void> {
  // Bỏ qua nếu member là bot
  if (newMember.user.bot) {
    return;
  }

  const wasBoosting = oldMember.premiumSince !== null;
  const isNowBoosting = newMember.premiumSince !== null;

  // Chỉ kích hoạt khi chuyển trạng thái từ chưa boost sang boost
  if (!wasBoosting && isNowBoosting) {
    try {
      const settingsService = getSettingsService();
      const booster = settingsService.getBooster(newMember.guild.id);

      if (!booster.enabled) return;
      if (!booster.channelId) return;

      const boosterChannel = newMember.guild.channels.cache.get(booster.channelId);
      if (!boosterChannel || !boosterChannel.isTextBased()) return;

      const boosterContainer = settingsService.buildBoosterContainer(newMember.guild.id, {
        member: newMember,
        guild: newMember.guild,
      });

      await boosterChannel.send({
        components: boosterContainer.toJSON(),
        flags: boosterContainer.flags,
        files: boosterContainer.files,
      });

      if (booster.roleId) {
        await assignBoosterRole(newMember, booster.roleId);
      }
    } catch (error) {
      logger.error(
        `Error sending booster message for ${newMember.user.tag}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
