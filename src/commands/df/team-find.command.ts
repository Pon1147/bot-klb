/** /team-find — Tìm đồng đội (select menu flow) */

import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  SlashCommandBuilder,
} from 'discord.js';
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
  _database: unknown,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const voiceResult = checkVoiceForTeamFind(interaction);
  if (!voiceResult.success) {
    const err = buildErrorContainer(voiceResult.errorMessage!);
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | 64, // Ephemeral
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
    components: menu.toJSON() as any,
  }) as any;

  createSession(interaction.user.id, guild.id, response.id, channel.id);
}
