/** /team-find — Tìm đồng đội chơi theo bản đồ và chế độ */

import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { requireGuild } from '../../utils/df-guards.js';
import { checkVoiceForTeamFind } from '../../utils/df-voice.utils.js';
import { buildTeamFindEmbed } from './team-find.embed.js';
import { resolveRankFromScore } from '../../utils/df-rank.utils.js';
import { buildErrorContainer } from '../../utils/container.utils.js';

export const data = new SlashCommandBuilder()
  .setName('team-find')
  .setDescription('Tìm đồng đội chơi theo bản đồ và chế độ')
  .addStringOption((option) =>
    option
      .setName('map')
      .setDescription('Bản đồ muốn chơi')
      .setRequired(true)
      .addChoices(
        { name: 'Đập Nước Zero', value: 'Đập Nước Zero' },
        { name: 'Thung lũng Layali', value: 'Thung lũng Layali' },
        { name: 'Phố Cổ Brakkesh', value: 'Phố Cổ Brakkesh' },
        { name: 'Trạm Không Gian', value: 'Trạm Không Gian' },
        { name: 'Ngục Giam Thủy Triều', value: 'Ngục Giam Thủy Triều' },
      ),
  )
  .addStringOption((option) =>
    option
      .setName('mode')
      .setDescription('Độ khó muốn chơi')
      .setRequired(true)
      .addChoices(
        { name: 'Dễ', value: 'easy' },
        { name: 'Thường', value: 'normal' },
        { name: 'Khó', value: 'hard' },
      ),
  )
  .addIntegerOption((option) =>
    option
      .setName('rank')
      .setDescription('Điểm rank của bạn (tùy chọn)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(6000),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  // Check voice state
  const voiceResult = checkVoiceForTeamFind(interaction);
  if (!voiceResult.success) {
    const err = buildErrorContainer(voiceResult.errorMessage!);
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  // Get options
  const mapKey = interaction.options.getString('map', true) as 'Đập Nước Zero' | 'Thung lũng Layali' | 'Phố Cổ Brakkesh' | 'Trạm Không Gian' | 'Ngục Giam Thủy Triều';
  const mode = interaction.options.getString('mode', true) as 'easy' | 'normal' | 'hard';
  const rankScore = interaction.options.getInteger('rank', false);

  // Resolve rank if provided
  const rank = rankScore ? resolveRankFromScore(rankScore) : null;

  // Build embed
  const embed = buildTeamFindEmbed({
    mapKey,
    difficulty: mode,
    channelName: voiceResult.channelName!,
    channelId: voiceResult.channelId!,
    username: interaction.user.username,
    rank,
  });

  await interaction.reply({
    components: embed.toJSON(),
    files: embed.files,
    flags: MessageFlags.IsComponentsV2,
  });
}
