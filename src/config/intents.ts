import { GatewayIntentBits } from 'discord.js';

/**
 * Discord Gateway Intents - tập trung tất cả intents bot cần ở 1 nơi.
 * Thêm/bỏ intent → chỉ cần chỉnh file này.
 */
export const BOT_INTENTS = [
  /** Cần để nhận events guild tạo/xóa/cập nhật */
  GatewayIntentBits.Guilds,
  /** Cần để nhận guildMemberAdd, guildMemberUpdate events */
  GatewayIntentBits.GuildMembers,
  /** Cần để nhận message events trong guild */
  GatewayIntentBits.GuildMessages,
  /** Cần để đọc nội dung tin nhắn */
  GatewayIntentBits.MessageContent,
  /** Cần để track voice channel state (interaction.member.voice.channel) */
  GatewayIntentBits.GuildVoiceStates,
] as const;