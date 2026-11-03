import { GuildMember } from 'discord.js';
import { handleBoosterMemberUpdate } from '../features/booster/booster.event.js';

/**
 * Handle guildMemberUpdate event:
 * - Detect khi member Server Boost (uỷ quyền cho feature booster)
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

  // Booster detection (Feature Booster)
  await handleBoosterMemberUpdate(oldMember, newMember);
}

export default {
  name: 'guildMemberUpdate',
  once: false,
  execute,
};
