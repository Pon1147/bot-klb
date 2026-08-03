/** Team-find interaction handlers — join voice, button routing */

import {
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  StringSelectMenuInteraction,
} from 'discord.js';
import { VOICE_CHANNEL_FULL_MESSAGE } from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';
import { handleTeamFindInteraction } from './team-find.interaction.js';
import { TeamFindIds } from './team-find-ids.js';

const logger = createLogger('TeamFindHandlers');

/** Result of handling a team-find interaction */
export interface TeamFindInteractionResult {
  handled: boolean;
}

/**
 * Unified handler for all team-find button interactions.
 * Routes Map/Mode/Done → handleTeamFindInteraction(), Join → handleJoinVoice().
 */
export async function handleTeamFindButton(
  interaction: ButtonInteraction,
): Promise<TeamFindInteractionResult> {
  const customId = interaction.customId;

  // ── Map/Mode/Done buttons → existing handler ──
  if (
    customId.startsWith(TeamFindIds.MAP) ||
    customId.startsWith(TeamFindIds.MODE) ||
    customId.startsWith(TeamFindIds.DONE)
  ) {
    try {
      const handled = await handleTeamFindInteraction(interaction);
      if (handled) return { handled: true };
    } catch (error) {
      logger.error(
        'Error in team-find button handler: ' +
          (error instanceof Error ? error.message : String(error)),
      );
      return { handled: true };
    }
  }

  // ── Join voice channel button ──
  if (customId.startsWith(TeamFindIds.JOIN)) {
    return await handleJoinVoice(interaction);
  }

  return { handled: false };
}

/**
 * Handle team-find join voice channel button.
 * Extracts channel ID from customId, validates, and joins.
 */
async function handleJoinVoice(interaction: ButtonInteraction): Promise<TeamFindInteractionResult> {
  const channelId = interaction.customId.split(':')[1];
  const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

  if (!channel || channel.type !== 2) {
    await interaction.reply({
      content: 'Phòng thoại không còn tồn tại.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const member = interaction.member;
  const memberVoice = member instanceof GuildMember ? member.voice : null;
  if (memberVoice?.channel?.id === channelId) {
    await interaction.reply({
      content: 'Bạn đã đang trong phòng này.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  if (channel.full) {
    await interaction.reply({
      content: VOICE_CHANNEL_FULL_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const me = interaction.guild!.members.me;
  const botPerms = me ? channel.permissionsFor(me) : null;
  if (!botPerms?.has('Connect')) {
    await interaction.reply({
      content: 'Bot không có quyền tham gia phòng thoại này.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // channel là VoiceChannel nhưng type là GuildVoiceChannel — discord.js v14 type hierarchy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (channel as any).join();
  await interaction.reply({
    content: 'Đã join phòng thành công!',
    flags: MessageFlags.Ephemeral,
  });
  return { handled: true };
}

/**
 * Handle team-find string select menu (rank selection).
 */
export async function handleTeamFindSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  try {
    await handleTeamFindInteraction(interaction);
  } catch (error) {
    logger.error(
      'Error in team-find select handler: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
