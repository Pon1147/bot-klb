/** Handle interactions for /team-find flow — buttons for Map/Mode, select for Rank */

import {
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getSession, updateSelection, deleteSession } from '../../services/team-find-session.js';
import { storeMessage } from '../../services/team-find-message-store.js';
import { buildSelectMenuMessage } from './team-find.menu.js';
import { buildTeamFindEmbed } from './team-find.embed.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../config/team-find.config.js';
import { SESSION_EXPIRED_MESSAGE, EMBED_AVATAR_SIZE } from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';
import { TeamFindIds } from './team-find-ids.js';
import { sendReply } from '../../utils/reply.utils.js';

const logger = createLogger('TeamFind');

/** Check customId and handle team-find interactions. Returns true if handled. */
export async function handleTeamFindInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<boolean> {
  const customId = interaction.customId;

  // ── Map Button ──
  if (interaction.isButton() && customId.startsWith(TeamFindIds.MAP)) {
    const parts = customId.replace(TeamFindIds.MAP, '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await sendReply(interaction, { content: 'Đây không phải session của bạn.' });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await sendReply(interaction, { content: SESSION_EXPIRED_MESSAGE });
      return true;
    }

    // value là string từ customId, cast sang MapKey
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateSelection(userId, 'map', value as any);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });
    // Cập nhật ephemeral menu — chỉ user thấy
    // Cập nhật ephemeral menu — chỉ user thấy
    await interaction.update({
      content: menu.content,
      components: menu.components,
    } as Parameters<typeof interaction.update>[0]);
    return true;
  }

  // ── Mode Button ──
  if (interaction.isButton() && customId.startsWith(TeamFindIds.MODE)) {
    const parts = customId.replace(TeamFindIds.MODE, '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await sendReply(interaction, { content: 'Đây không phải session của bạn.' });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await sendReply(interaction, { content: SESSION_EXPIRED_MESSAGE });
      return true;
    }

    updateSelection(userId, 'mode', value);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });
    await interaction.update({
      content: menu.content,
      components: menu.components,
    } as Parameters<typeof interaction.update>[0]);
    return true;
  }

  // ── Rank Select Menu ──
  if (interaction.isStringSelectMenu() && customId.startsWith(TeamFindIds.RANK)) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await sendReply(interaction, { content: 'Đây không phải session của bạn.' });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await sendReply(interaction, { content: SESSION_EXPIRED_MESSAGE });
      return true;
    }

    const value = interaction.values[0];
    updateSelection(userId, 'rank', value);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });
    await interaction.update({
      content: menu.content,
      components: menu.components,
    } as Parameters<typeof interaction.update>[0]);
    return true;
  }

  // ── Done Button ──
  if (interaction.isButton() && customId.startsWith(TeamFindIds.DONE)) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await sendReply(interaction, { content: 'Đây không phải session của bạn.' });
      return true;
    }

    const session = getSession(userId);
    if (!session || !session.map || !session.mode) {
      // Show error message thay vì silent fail
      await sendReply(interaction, {
        components: buildErrorContainer('Bạn cần chọn map và mode trước khi hoàn thành.').toJSON(),
      });
      deleteSession(userId);
      return true;
    }

    // Resolve difficulty from mode label
    let difficulty: Difficulty = 'easy';
    for (const [, cfg] of Object.entries(DIFFICULTY_CONFIG)) {
      if (cfg.label === session.mode) {
        difficulty = cfg.id;
        break;
      }
    }

    // Re-check voice state
    const member = interaction.member;
    const voiceChannel = member instanceof GuildMember ? member.voice?.channel : null;
    if (!voiceChannel) {
      await sendReply(interaction, {
        components: buildErrorContainer(
          'Bạn phải đang trong phòng thoại để sử dụng lệnh này.',
        ).toJSON(),
      });
      deleteSession(userId);
      return true;
    }

    // Acknowledge interaction to avoid "Tương tác không thành công"
    await interaction.deferUpdate();

    const embed = buildTeamFindEmbed({
      mapKey: session.map!,
      difficulty,
      channelName: voiceChannel.name,
      channelId: voiceChannel.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: EMBED_AVATAR_SIZE }),
      rank: session.rank ?? null,
    });

    // interaction.channel là TextChannel nhưng type là GuildTextBasedChannel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (interaction.channel as any).send({
      components: embed.toJSON(),
      files: embed.files,
      flags: MessageFlags.IsComponentsV2,
    });

    logger.info('Embed sent: ' + response.id);
    storeMessage(session.guildId, userId, response.id, interaction.channel!.id);
    // Xóa session sau khi gửi thành công
    deleteSession(userId);
    return true;
  }

  return false;
}
