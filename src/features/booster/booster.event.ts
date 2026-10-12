import { GuildMember } from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('BoosterEvent');

/**
 * Xử lý sự kiện khi member bắt đầu Boost server (guildMemberUpdate).
 * Discord đã tự động gán role Nitro Booster cho member, bot chỉ cần gửi tin nhắn cảm ơn.
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
    } catch (error) {
      logger.error(
        `Error sending booster message for ${newMember.user.tag}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
