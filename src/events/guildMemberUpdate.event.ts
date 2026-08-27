import { Guild, GuildMember } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GuildMemberUpdate');
import { getMessageRef, deleteMessageRef } from '../services/team-find-message-store.js';
import { getSession, deleteSession } from '../services/team-find-session.js';

/**
 * Handle guildMemberUpdate event:
 * - Detect khi member Server Boost
 * - Tự động xóa team-find embed khi user rời/chuyển phòng thoại
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

  // ── 1. Booster detection ──
  const wasBoosting = oldMember.premiumSince !== null;
  const isNowBoosting = newMember.premiumSince !== null;

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
        'Error sending booster message for ' +
          newMember.user.tag +
          ': ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // ── 2. Voice channel change → cleanup team-find ──
  const oldChannelId = oldMember.voice?.channelId;
  const newChannelId = newMember.voice?.channelId;

  // Chỉ cleanup khi user thực sự rời voice channel (oldChannelId !== null)
  // Tránh trigger sai khi user join voice channel đầu tiên
  const changed = oldChannelId !== null && (!newChannelId || oldChannelId !== newChannelId);
  if (changed) {
    // Xóa embed message nếu tồn tại
    await cleanupOldEmbed(newMember.guild, newMember.user.id);
    // Xóa session đang hoạt động (select menu flow)
    const session = getSession(newMember.user.id);
    if (session) {
      try {
        const menuChannel = await newMember.guild.channels
          .fetch(session.channelId)
          .catch(() => null);
        if (menuChannel && menuChannel.isTextBased()) {
          const menuMsg = await menuChannel.messages.fetch(session.messageId).catch(() => null);
          if (menuMsg) await menuMsg.delete();
        }
      } catch {
        // Menu message already gone
      }
      deleteSession(newMember.user.id);
    }
  }
}

async function cleanupOldEmbed(guild: Guild, userId: string): Promise<void> {
  const ref = getMessageRef(guild.id, userId);
  if (!ref) return;
  try {
    const channel = await guild.channels.fetch(ref.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const msg = await channel.messages.fetch(ref.messageId).catch(() => null);
      if (msg) await msg.delete();
    }
  } catch {
    // Message already gone
  }
  deleteMessageRef(guild.id, userId);
}

async function assignBoosterRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return;

  try {
    await member.roles.add(role);
  } catch (error) {
    logger.error(
      'Failed to assign booster role ' +
        role.name +
        ' to ' +
        member.user.tag +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

export default {
  name: 'guildMemberUpdate',
  once: false,
  execute,
};
