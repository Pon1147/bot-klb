/** /team-find — Tìm đồng đội (select menu flow) */

import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { requireGuild } from '../../utils/df-guards.js';
import { checkVoiceForTeamFind } from '../../utils/df-voice.utils.js';
import { buildSelectMenuMessage } from './team-find.menu.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { createSession } from '../../services/team-find-session.js';

export const data = new SlashCommandBuilder()
  .setName('team-find')
  .setDescription('Tìm đồng đội chơi theo bản đồ và chế độ');

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const voiceResult = checkVoiceForTeamFind(interaction);
  if (!voiceResult.success) {
    const err = buildErrorContainer(voiceResult.errorMessage!);
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = interaction.guild!;
  const channel = interaction.channel as GuildTextBasedChannel;

  const menu = buildSelectMenuMessage(interaction.user.id, interaction.user.username, {
    map: null,
    mode: null,
    rank: null,
  });

  const response = await interaction.reply({
    content: menu.content,
    components: menu.components,
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  createSession(interaction.user.id, guild.id, response.id, channel.id);
}
