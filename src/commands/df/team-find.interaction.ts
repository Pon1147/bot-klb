/** Handle interactions for /team-find flow — buttons for Map/Mode, select for Rank */

import { MessageFlags } from 'discord.js';
import {
  getSession,
  updateSelection,
  deleteSession,
} from '../../services/team-find-session.js';
import { storeMessage } from '../../services/team-find-message-store.js';
import { buildSelectMenuMessage } from './team-find.menu.js';
import { buildTeamFindEmbed } from './team-find.embed.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../config/team-find.config.js';

/** Check customId and handle team-find interactions. Returns true if handled. */
export async function handleTeamFindInteraction(interaction: any): Promise<boolean> {
  const customId = interaction.customId;

  // ── Map Button ──
  if (interaction.isButton() && customId.startsWith('team-find-map:')) {
    const parts = customId.replace('team-find-map:', '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({ content: 'Đây không phải session của bạn.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    updateSelection(userId, 'map', value);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map, mode: updated.mode, rank: updated.rank,
    });
    await interaction.update({ content: menu.content, components: menu.components, flags: MessageFlags.Ephemeral });
    return true;
  }

  // ── Mode Button ──
  if (interaction.isButton() && customId.startsWith('team-find-mode:')) {
    const parts = customId.replace('team-find-mode:', '').split(':');
    const value = parts[0];
    const userId = parts[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({ content: 'Đây không phải session của bạn.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    updateSelection(userId, 'mode', value);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map, mode: updated.mode, rank: updated.rank,
    });
    await interaction.update({ content: menu.content, components: menu.components, flags: MessageFlags.Ephemeral });
    return true;
  }

  // ── Rank Select Menu ──
  if (interaction.isStringSelectMenu() && customId.startsWith('team-find-rank:')) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({ content: 'Đây không phải session của bạn.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const session = getSession(userId);
    if (!session) {
      await interaction.reply({
        content: 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const value = interaction.values[0];
    updateSelection(userId, 'rank', value);
    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map, mode: updated.mode, rank: updated.rank,
    });
    await interaction.update({ content: menu.content, components: menu.components, flags: MessageFlags.Ephemeral });
    return true;
  }

  // ── Done Button ──
  if (interaction.isButton() && customId.startsWith('team-find-done:')) {
    const userId = customId.split(':')[1];

    if (userId !== interaction.user.id) {
      await interaction.reply({ content: 'Đây không phải session của bạn.', flags: MessageFlags.Ephemeral });
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
    const voiceChannel = (interaction.member as any).voice?.channel;
    if (!voiceChannel) {
      const err = buildErrorContainer('Bạn phải đang trong phòng thoại để sử dụng lệnh này.');
      await interaction.reply({ components: err.toJSON(), flags: err.flags | MessageFlags.Ephemeral });
      deleteSession(userId);
      return true;
    }

    // Acknowledge interaction to avoid "Tương tác không thành công"
    await interaction.deferUpdate();
    deleteSession(userId);

    const embed = buildTeamFindEmbed({
      mapKey: session.map as any,
      difficulty,
      channelName: voiceChannel.name,
      channelId: voiceChannel.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
      rank: session.rank ?? null,
    });

    const response = await interaction.channel.send({
      components: embed.toJSON(),
      files: embed.files,
      flags: MessageFlags.IsComponentsV2,
    }) as any;

    console.log('[team-find] embed sent:', response.id);
    storeMessage(session.guildId, userId, response.id, interaction.channel.id);
    return true;
  }

  return false;
}
