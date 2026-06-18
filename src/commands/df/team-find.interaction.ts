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
    const customId = interaction.customId;
    if (!customId.startsWith('team-find-select-')) return false;

    const parts = customId.replace('team-find-select-', '').split(':');
    const field = parts[0] as 'map' | 'mode' | 'rank';
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
        content: 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const value = interaction.values[0];
    updateSelection(userId, field, value);

    const updated = getSession(userId)!;
    const menu = buildSelectMenuMessage(userId, interaction.user.username, {
      map: updated.map,
      mode: updated.mode,
      rank: updated.rank,
    });

    await interaction.update({
      content: menu.content,
      components: menu.components,
    });
    return true;
  }

  // ── Done Button ──
  if (interaction.isButton() && interaction.customId.startsWith('team-find-done:')) {
    const userId = interaction.customId.split(':')[1];

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
    const voiceChannel = (interaction.member as any).voice?.channel;
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
    await interaction.deleteReply().catch(() => {});
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

    const response = await interaction.channel.send({
      components: embed.toJSON(),
      files: embed.files,
      flags: MessageFlags.IsComponentsV2,
    }) as any;

    storeMessage(session.guildId, userId, response.id, interaction.channel.id);
    return true;
  }

  return false;
}
