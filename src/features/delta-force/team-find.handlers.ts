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

  // ── Join voice channel button (tương thích ngược cho các tin nhắn cũ) ──
  if (customId.startsWith(TeamFindIds.JOIN)) {
    try {
      return await handleJoinVoice(interaction);
    } catch (error) {
      logger.error(
        'Lỗi trong xử lý tham gia phòng thoại: ' +
          (error instanceof Error ? error.message : String(error)),
      );
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: 'Đã xảy ra lỗi khi tham gia phòng thoại.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
      return { handled: true };
    }
  }

  return { handled: false };
}

/**
 * Xử lý nút tham gia phòng thoại của tin nhắn tìm đội (fallback cho tin nhắn cũ).
 * Trích xuất channelId từ customId, xác thực và hướng dẫn/di chuyển người dùng.
 */
async function handleJoinVoice(interaction: ButtonInteraction): Promise<TeamFindInteractionResult> {
  const channelId = interaction.customId.split(':')[1];
  const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);

  // Kiểm tra phòng thoại có tồn tại và đúng loại voice channel (type 2: GuildVoice)
  if (!channel || channel.type !== 2) {
    await interaction.reply({
      content: 'Phòng thoại không còn tồn tại.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  const member = interaction.member;
  const memberVoice = member instanceof GuildMember ? member.voice : null;

  // Trường hợp người dùng đã ở sẵn trong phòng này
  if (memberVoice?.channel?.id === channelId) {
    await interaction.reply({
      content: 'Bạn đã đang trong phòng thoại này rồi.',
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // Trường hợp phòng thoại đã đầy
  if (channel.full) {
    await interaction.reply({
      content: VOICE_CHANNEL_FULL_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return { handled: true };
  }

  // Nếu người dùng đang ở một phòng voice khác, thử di chuyển họ sang phòng của đội
  if (memberVoice?.channel) {
    try {
      await memberVoice.setChannel(channelId);
      await interaction.reply({
        content: `Đã di chuyển bạn vào phòng thoại <#${channelId}>!`,
        flags: MessageFlags.Ephemeral,
      });
      return { handled: true };
    } catch {
      // Bot không có quyền MoveMembers hoặc không move được -> fallback hướng dẫn click
    }
  }

  // Nếu người dùng chưa vào phòng thoại nào, hướng dẫn họ click vào tag kênh
  await interaction.reply({
    content: `Vui lòng bấm vào phòng thoại <#${channelId}> để tham gia cùng đội nhé!`,
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
