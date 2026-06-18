/** Handle select menu interactions for /team-find flow */

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

export async function handleTeamFindInteraction(interaction: any): Promise<boolean> {
  // ── Select Menu ──
  if (interaction.isStringSelectMenu()) {
    console.log('[team-find] Select menu interaction:', interaction.customId);
    const customId = interaction.customId;
    if (!customId.startsWith('team-find-select-')) return false;

    const parts = customId.replace('team-find-select-', '').split(':');
    const field = parts[0] as 'map' | 'mode' | 'rank';
    const userId = parts[1];
    console.log('[team-find] field=%s, userId=%s, interactionUserId=%s', field, userId, interaction.user.id);

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    console.log('[team-find] session:', session ? session.map + '/' + session.mode + '/' + session.rank : 'null');
    if (!session) {
      await interaction.reply({
        content: 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const value = interaction.values[0];
    console.log('[team-find] selected value:', value);
    updateSelection(userId, field, value);

    const updated = getSession(userId)!;
    console.log('[team-find] updated session:', updated.map + '/' + updated.mode + '/' + updated.rank);
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });

    console.log('[team-find] calling interaction.update()');
    await interaction.update({
      content: menu.content,
      components: menu.components,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // ── Done Button ──
  if (interaction.isButton() && interaction.customId.startsWith('team-find-done:')) {
    console.log('[team-find] Done button clicked:', interaction.customId);
    const userId = interaction.customId.split(':')[1];
    console.log('[team-find] userId=%s, interactionUserId=%s', userId, interaction.user.id);

    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: 'Đây không phải session của bạn.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const session = getSession(userId);
    console.log('[team-find] Done session:', session ? { map: session.map, mode: session.mode, rank: session.rank } : 'null');
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
    console.log('[team-find] difficulty:', difficulty);

    // Re-check voice state
    const voiceChannel = (interaction.member as any).voice?.channel;
    console.log('[team-find] voiceChannel:', voiceChannel ? voiceChannel.name : 'null');
    if (!voiceChannel) {
      const err = buildErrorContainer('Bạn phải đang trong phòng thoại để sử dụng lệnh này.');
      await interaction.reply({
        components: err.toJSON(),
        flags: err.flags | MessageFlags.Ephemeral,
      });
      deleteSession(userId);
      return true;
    }

    // Delete the menu message
    console.log('[team-find] deleting ephemeral menu message');
    try {
      await interaction.deleteReply();
    } catch (e) {
      console.log('[team-find] deleteReply failed:', (e as Error).message);
    }
    deleteSession(userId);

    // Build and send embed
    const embed = buildTeamFindEmbed({
      mapKey: session.map as any,
      difficulty,
      channelName: voiceChannel.name,
      channelId: voiceChannel.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
      rank: session.rank ?? null,
    });

    console.log('[team-find] sending embed to channel:', interaction.channel.id);
    const response = await interaction.channel.send({
      components: embed.toJSON(),
      files: embed.files,
      flags: MessageFlags.IsComponentsV2,
    }) as any;

    console.log('[team-find] embed sent, message id:', response.id);
    storeMessage(session.guildId, userId, response.id, interaction.channel.id);
    return true;
  }

  return false;
}
