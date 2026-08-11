import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { toComponentsV2 } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getOverviewData } from '../../services/deltaforce.api.js';
import { resolveRankFromScore } from '../../utils/df-rank.utils.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { runDfCommand } from '../../utils/df-command.runner.js';
import { buildSeasonOptions, getSeasonLabel } from '../../config/season.config.js';

export const data = new SlashCommandBuilder()
  .setName('df-stats')
  .setDescription('Xem thong ke tai khoan Delta Force.');

/** Custom ID prefix for df-stats select menu */
export const DF_STATS_SELECT_ID = 'df_stats_season_select';

/** Build stats container from API data */
export function buildStatsContainer(
  data: {
    player_info: { nickname: string; level: number; play_duration: string; register_time: string };
    rank_data: { current_rank_score: number; current_rank: string };
    summary_data: {
      combat: {
        kill_operator_count: number;
        hit_rate: string;
        headshot_kill_rate: string;
        high_kill_death_ratio: string;
        med_kill_death_ratio: string;
        low_kill_death_ratio: string;
      } | null;
      economy: {
        total_reward: string;
        extract_value: string;
        profit_loss_ratio: string;
        total_mandel_brick: number;
      } | null;
      team: {
        revive_teammate_count: number;
        rescue_teammate_count: number;
        retreat_rate: string;
        teammate_extract_value: string;
      } | null;
      total_match_count: number;
    };
  },
  seasonLabel: string,
): { components: readonly unknown[]; flags: number } {
  const playHours = Math.floor(Number(data.player_info.play_duration));
  const playMinutes = Math.round((Number(data.player_info.play_duration) - playHours) * 60);
  const regDate = new Date(Number(data.player_info.register_time) * 1000).toLocaleDateString(
    'vi-VN',
  );

  const combat = data.summary_data.combat;
  const economy = data.summary_data.economy;
  const team = data.summary_data.team;

  const rankScore = Number(data.rank_data.current_rank_score);
  const rankInfo = resolveRankFromScore(rankScore);
  const rankName = rankInfo?.name ?? 'Chưa rõ';
  const rankImage = rankInfo?.imageUrl;
  const totalMatches = data.summary_data.total_match_count;

  const headerSection: Record<string, unknown> = {
    type: ComponentType.Section,
    components: [
      {
        type: ComponentType.TextDisplay,
        content:
          `## **${rankName}**\n` +
          `**${seasonLabel}** • ${rankScore} pts\n` +
          `${data.player_info.nickname} · Lv.${data.player_info.level}`,
      },
    ],
    accessory: {
      type: ComponentType.Thumbnail,
      media: { url: rankImage },
      description: `${data.player_info.nickname} · Lv.${data.player_info.level}`,
    },
  };

  const economyBlock = economy
    ? [
        `- **Tổng reward**: ${Number(economy.total_reward).toLocaleString('vi-VN')}`,
        `- **Extract value**: ${Number(economy.extract_value).toLocaleString('vi-VN')}`,
        `- **Profit/Loss**: ${economy.profit_loss_ratio}`,
        `- **Mandel Brick**: ${economy.total_mandel_brick}`,
      ].join('\n')
    : '- Chưa có dữ liệu';

  const combatBlock = combat
    ? [
        `- **Kill**: ${combat.kill_operator_count}`,
        `- **Hit rate**: ${combat.hit_rate}`,
        `- **Headshot**: ${combat.headshot_kill_rate}`,
        `- **KD**: ${combat.low_kill_death_ratio}/${combat.med_kill_death_ratio}/${combat.high_kill_death_ratio} `,
      ].join('\n')
    : '- Chưa có dữ liệu';

  const teamBlock = team
    ? [
        `- **Revive**: ${team.revive_teammate_count}`,
        `- **Rescue**: ${team.rescue_teammate_count}`,
        `- **Retreat rate**: ${team.retreat_rate}`,
        `- **Team extract**: ${Number(team.teammate_extract_value).toLocaleString('vi-VN')}`,
      ].join('\n')
    : '- Chưa có dữ liệu';

  const statsContent = [
    `Tham gia: ${regDate} · Thời gian: ${playHours}h ${playMinutes}m · Trận: ${totalMatches}`,
    ``,
    `__**Kinh Tế**__`,
    economyBlock,
    ``,
    `__**Chiến Đấu**__`,
    combatBlock,
    ``,
    `__**Tiểu Đội**__`,
    teamBlock,
  ].join('\n');

  const containerInner: unknown[] = [];
  containerInner.push(headerSection);
  containerInner.push({
    type: ComponentType.TextDisplay,
    content: statsContent,
  });
  containerInner.push({ type: ComponentType.Separator, accentColor: COLORS.WELCOME });

  const containerComponents: Record<string, unknown> = {
    type: ComponentType.Container,
    components: containerInner,
  };

  return {
    components: toComponentsV2([containerComponents]),
    flags: MessageFlags.IsComponentsV2,
  };
}

/** Build season select menu */
export function buildSeasonSelectMenu(
  selectedValue: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = buildSeasonOptions().map((opt) =>
    new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value),
  );

  const label = getSeasonLabel(selectedValue);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(DF_STATS_SELECT_ID)
      .setPlaceholder(`Đang chọn: ${label}`)
      .addOptions(options),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await runDfCommand({ userId: interaction.user.id, database, interaction }, async (tokenRow) => {
    const apiToken = buildDfApiToken(tokenRow);
    const data = await getOverviewData(apiToken);
    const seasonLabel = getSeasonLabel('overview');

    const result = buildStatsContainer(data, seasonLabel);
    const selectMenu = buildSeasonSelectMenu('overview');

    return {
      components: [...result.components, selectMenu.toJSON()],
      flags: result.flags,
    };
  });
}
