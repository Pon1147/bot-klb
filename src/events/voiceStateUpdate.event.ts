import { Guild, VoiceState } from 'discord.js';
import { getMessageRef, deleteMessageRef } from '../services/team-find-message-store.js';
import { deleteSession } from '../services/team-find-session.js';

/**
 * Handle voiceStateUpdate event:
 * - Tự động xóa team-find embed công khai khi user rời hoặc chuyển phòng thoại
 * - Dọn dẹp session tìm đội trong bộ nhớ (không gọi REST fetch trên ephemeral message để tránh lỗi 404)
 */
export async function execute(
  _client: unknown,
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (member?.user?.bot) {
    return;
  }

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  // Chỉ cleanup khi user thực sự rời hoặc chuyển phòng thoại (oldChannelId !== null)
  const changed = oldChannelId !== null && (!newChannelId || oldChannelId !== newChannelId);
  if (changed) {
    const userId = member?.id ?? oldState.id;
    await cleanupOldEmbed(oldState.guild, userId);
    deleteSession(userId);
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
    // Message already deleted or channel inaccessible
  } finally {
    deleteMessageRef(guild.id, userId);
  }
}

export default {
  name: 'voiceStateUpdate',
  once: false,
  execute,
};
