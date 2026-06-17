import { GuildMember } from 'discord.js';
import { getSettingsService } from '../services/settings.service.js';
import { getMessageRef, deleteMessageRef } from '../services/team-find-message-store.js';

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
      console.error(`Error sending booster message for ${newMember.user.tag}:`, error);
    }
  }

  // ── 2. Voice channel change → xóa team-find embed cũ ──
  const oldChannelId = oldMember.voice?.channelId;
  const newChannelId = newMember.voice?.channelId;

  // Helper: xóa embed theo reference
  async function cleanupOldEmbed(guild: any, userId: string): Promise<void> {
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

  if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    await cleanupOldEmbed(newMember.guild, newMember.user.id);
  }

  // User rời phòng thoại → xóa embed
  if (oldChannelId && !newChannelId) {
    await cleanupOldEmbed(newMember.guild, newMember.user.id);
  }
}

async function assignBoosterRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return;

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
