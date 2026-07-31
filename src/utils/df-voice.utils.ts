import { ChatInputCommandInteraction, Guild, GuildMember, PermissionsBitField } from 'discord.js';

export interface VoiceStateResult {
  success: boolean;
  channelId?: string;
  channelName?: string;
  memberCount?: number;
  isUserDeafened?: boolean;
  isUserMuted?: boolean;
  botCanConnect?: boolean;
  botCanSpeak?: boolean;
  errorMessage?: string;
  warnings?: string[];
}

/** Narrow `interaction.member` to `GuildMember` (has `roles`, which APIInteractionGuildMember lacks). */
function getGuildMember(interaction: ChatInputCommandInteraction): GuildMember | null {
  const member = interaction.member;
  if (!member || !('roles' in member)) return null;
  return member as GuildMember;
}

/** Lấy thông tin voice channel của user. Trả về null nếu không trong VC. */
export function getUserVoiceState(
  interaction: ChatInputCommandInteraction,
): VoiceStateResult | null {
  const member = getGuildMember(interaction);
  if (!member) return null;

  const channel = member.voice.channel;
  if (!channel) return null;

  const voice = member.voice;
  return {
    success: true,
    channelId: channel.id,
    channelName: channel.name,
    memberCount: channel.members.size,
    isUserDeafened: !!voice.deaf,
    isUserMuted: !!voice.mute,
    botCanConnect: true,
  };
}

/** Kiểm tra voice channel trước khi xử lý /team-find. Trả về guard result. */
export function checkVoiceForTeamFind(interaction: ChatInputCommandInteraction): VoiceStateResult {
  const member = getGuildMember(interaction);

  // Case 1: Không trong VC (hoặc không thể đọc member/voice channel)
  if (!member || !member.voice.channel) {
    return {
      success: false,
      errorMessage: 'Bạn phải đang trong phòng thoại để sử dụng lệnh này.',
    };
  }

  const channel = member.voice.channel;
  const voice = member.voice;
  const warnings: string[] = [];

  // Case 4: User bị server deaf
  if (voice.deaf) {
    warnings.push('Bạn đang bị điếc. Có thể không nghe thấy đồng đội.');
  }

  // Case 5: User bị server mute
  if (voice.mute) {
    warnings.push('Bạn đang bị tắt micro.');
  }

  // Case 7: VC đầy
  if (channel.full) {
    return {
      success: false,
      errorMessage: 'Phòng thoại đã đầy (99 người).',
    };
  }

  // Case 8, 9: Bot không có quyền Connect/Speak
  const guild = interaction.guild as Guild | null;
  const botMember = guild?.members.me;
  const botPerms = botMember ? channel.permissionsFor(botMember) : null;

  if (!botPerms?.has(PermissionsBitField.Flags.Connect)) {
    return {
      success: false,
      errorMessage: 'Bot không có quyền tham gia phòng thoại này.',
    };
  }

  if (!botPerms.has(PermissionsBitField.Flags.Speak)) {
    warnings.push('Bot không thể nói trong phòng này.');
  }

  return {
    success: true,
    channelId: channel.id,
    channelName: channel.name,
    memberCount: channel.members.size,
    isUserDeafened: !!voice.deaf,
    isUserMuted: !!voice.mute,
    botCanConnect: botPerms.has(PermissionsBitField.Flags.Connect),
    botCanSpeak: botPerms.has(PermissionsBitField.Flags.Speak),
    warnings,
  };
}
