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

/** Check customId and handle team-find interactions. Returns true if handled. */
export async function handleTeamFindInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<boolean> {
  const customId = interaction.customId;

  // ── Map Button ──
  if (interaction.isButton() && customId.startsWith('team-find-map:')) {
    const parts = customId.replace('team-find-map:', '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: SESSION_EXPIRED_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    updateSelection(userId, 'map', value as any);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });
    await interaction.update({
      content: menu.content,
      components: menu.components,
      flags: MessageFlags.Ephemeral,
    } as any);
    return true;
  }

  // ── Mode Button ──
  if (interaction.isButton() && customId.startsWith('team-find-mode:')) {
    const parts = customId.replace('team-find-mode:', '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: SESSION_EXPIRED_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
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
      flags: MessageFlags.Ephemeral,
    } as any);
    return true;
  }

  // ── Rank Select Menu ──
  if (interaction.isStringSelectMenu() && customId.startsWith('team-find-rank:')) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: SESSION_EXPIRED_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
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
      flags: MessageFlags.Ephemeral,
    } as any);
    return true;
  }

  // ── Done Button ──
  if (interaction.isButton() && customId.startsWith('team-find-done:')) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    if (!session || !session.map || !session.mode) {
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
      const err = buildErrorContainer('Bạn phải đang trong phòng thoại để sử dụng lệnh này.');
      await interaction.reply({
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
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

    const response = await (interaction.channel as any).send({
      components: embed.toJSON(),
      files: embed.files,
      flags: MessageFlags.IsComponentsV2,
    });

    console.log('[team-find] embed sent:', response.id);
    storeMessage(session.guildId, userId, response.id, interaction.channel!.id);
    // Delete session after successful send
    deleteSession(userId);
    return true;
  }

  return false;
}
