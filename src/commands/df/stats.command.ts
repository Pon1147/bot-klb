import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { buildErrorContainer, toComponentsV2 } from '../../utils/container.utils.js';
import { COLORS } from '../../config/container.variables.js';
import { getSeasonData } from '../../services/deltaforce.api.js';
import { resolveRankFromScore } from '../../utils/df-rank.utils.js';
import { requireGuild } from '../../utils/df-guards.js';
import { buildDfApiToken } from '../../utils/df-token.utils.js';
import { touchDfToken, getDfToken } from '../../database/df.token.db.js';
import { LATEST_SEASON, LATEST_SEASON_NAME } from '../../config/team-find.config.js';

export const data = new SlashCommandBuilder()
  .setName('df-stats')
  .setDescription('Xem thống kê tài khoản Delta Force.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  if (await requireGuild(interaction)) return;

  const token = getDfToken(database, interaction.user.id);
  if (!token) {
    const err = buildErrorContainer('Bạn chưa liên kết tài khoản. Dùng `/df-link start` hoặc `/df-link manual` để bắt đầu.');
    await interaction.reply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const apiToken = buildDfApiToken(token);
    const data = await getSeasonData(apiToken, LATEST_SEASON);
    touchDfToken(database, interaction.user.id);

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

    // ── 1. HEADER SECTION: Rank badge (right) + rank info (left) ──
    const headerSection: Record<string, unknown> = {
      type: ComponentType.Section,
      components: [
        {
          type: ComponentType.TextDisplay,
          content:
            `## **${rankName}**\n` +
            `**${LATEST_SEASON_NAME}** • ${rankScore} pts\n` +
            `${data.player_info.nickname} · Lv.${data.player_info.level}`,
        },
      ],
      accessory: {
        type: ComponentType.Thumbnail,
        media: { url: rankImage },
        description: `${data.player_info.nickname} · Lv.${data.player_info.level}`,
      },
    };

    // ── 2. STATS TEXT ──
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
          `- **KD**: ${combat.high_kill_death_ratio} / ${combat.med_kill_death_ratio} / ${combat.low_kill_death_ratio}`,
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

    // ── 3. ASSEMBLE CONTAINER ──
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

    await interaction.editReply({
      components: toComponentsV2([containerComponents]),
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    const err = buildErrorContainer(
      `Lỗi khi lấy dữ liệu: ${(error as Error).message}\nNếu lỗi tiếp tục, hãy unlink và link lại tài khoản.`,
    );
    await interaction.editReply({
      components: err.toJSON(),
      flags: err.flags | MessageFlags.Ephemeral,
    });
  }
}
