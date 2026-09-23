/**
 * ViewModel builder — normalize DfMyDataResponse → DFStatsViewModel.
 * Tách biệt raw API shape khỏi renderer input.
 */

import type { DfMyDataResponse } from '../../types/deltaforce.types.js';
import type { DFStatsViewModel } from './types.js';
import { HEADER_LABELS } from '../../config/df-stats-renderer.config.js';
import { resolveRankFromScore } from '../../utils/df-rank.utils.js';

/** Chuyển đổi raw API response thành ViewModel cho renderer */
export function buildViewModel(data: DfMyDataResponse, seasonNo: string): DFStatsViewModel {
  const { player_info, rank_data, summary_data } = data;

  // Parse play_duration (string → hours + minutes)
  const playDurationNum = Number(player_info.play_duration);
  const playHours = Number.isNaN(playDurationNum) ? 0 : Math.floor(playDurationNum);
  const playMinutes = Number.isNaN(playDurationNum)
    ? 0
    : Math.round((playDurationNum - playHours) * 60);

  // Parse register_time (unix timestamp → formatted date string)
  const regTimestamp = Number(player_info.register_time);
  const joinDate = Number.isNaN(regTimestamp)
    ? 'Không rõ'
    : new Date(regTimestamp * 1000).toLocaleDateString('vi-VN');

  // Season label
  const seasonLabel = HEADER_LABELS[seasonNo] ?? 'SEASON ?';

  // Total matches
  const totalMatches = summary_data.total_match_count;

  // Tính toán các metrics từ data có sẵn
  const totalReward = summary_data.economy?.total_reward ?? '0';
  const totalRewardNum = Number(totalReward);
  const averageAssetsPerMatch =
    totalMatches > 0 && totalRewardNum > 0 ? formatAssets(totalRewardNum / totalMatches) : '0';

  // Extraction rate: numberOfExtractions / totalMatches * 100
  // Reference: 1337 / 2493 = 53.63%
  const numberOfExtractions = summary_data.team?.rescue_teammate_count ?? 0;
  const extractionRate =
    totalMatches > 0 ? ((numberOfExtractions / totalMatches) * 100).toFixed(2) + '%' : '0%';

  // Collection quantity: total_mandel_brick
  const collectionQuantity = summary_data.economy?.total_mandel_brick ?? 0;

  // Operators killed: kill_operator_count
  const operatorsKilled = summary_data.combat?.kill_operator_count ?? 0;

  return {
    player: {
      nickname: player_info.nickname,
      level: player_info.level,
      avatarUrl: player_info.avatar || undefined,
      joinDate,
      playDurationHours: playHours,
      playDurationMinutes: playMinutes,
      totalMatches,
    },
    economy: summary_data.economy
      ? {
          totalReward: summary_data.economy.total_reward,
          extractValue: summary_data.economy.extract_value,
          profitLoss: summary_data.economy.profit_loss_ratio,
          mandelBrick: summary_data.economy.total_mandel_brick,
          extractionRate,
          numberOfExtractions,
          averageAssetsPerMatch,
          collectionQuantity,
        }
      : null,
    combat: summary_data.combat
      ? {
          kills: summary_data.combat.kill_operator_count,
          hitRate: summary_data.combat.hit_rate,
          headshotRate: summary_data.combat.headshot_kill_rate,
          kdLow: summary_data.combat.low_kill_death_ratio,
          kdMed: summary_data.combat.med_kill_death_ratio,
          kdHigh: summary_data.combat.high_kill_death_ratio,
          operatorsKilled,
        }
      : null,
    squad: summary_data.team
      ? {
          revive: summary_data.team.revive_teammate_count,
          rescue: summary_data.team.rescue_teammate_count,
          retreatRate: summary_data.team.retreat_rate,
          teamExtract: summary_data.team.teammate_extract_value,
        }
      : null,
    rank: (() => {
      const score = rank_data.current_rank_score;
      const resolved = resolveRankFromScore(score);
      return {
        name: rank_data.current_rank,
        score,
        imageUrl: resolved?.imageUrl ?? undefined,
      };
    })(),
    seasonLabel,
  };
}

/** Format số với suffix K/M/B */
function formatAssets(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  }
  return value.toLocaleString('vi-VN');
}
