/**
 * Types cho DF Stats Dashboard Renderer.
 * ViewModel interface — dữ liệu đã normalize từ raw API response.
 */

/** Thống kê kinh tế */
export interface DFEconomyStats {
  totalReward: string;
  extractValue: string;
  profitLoss: string;
  mandelBrick: number;
}

/** Thống kê chiến đấu */
export interface DFCombatStats {
  kills: number;
  hitRate: string;
  headshotRate: string;
  kdLow: string;
  kdMed: string;
  kdHigh: string;
}

/** Thống kê tiểu đội */
export interface DFSquadStats {
  revive: number;
  rescue: number;
  retreatRate: string;
  teamExtract: string;
}

/** Thông tin người chơi */
export interface DFPlayerInfo {
  nickname: string;
  level: number;
  avatarUrl?: string;
  joinDate: string;
  playDurationHours: number;
  playDurationMinutes: number;
  totalMatches: number;
}

/** Thông tin rank */
export interface DFRankInfo {
  name: string;
  score: number;
  imageUrl?: string;
}

/** ViewModel hoàn chỉnh cho dashboard renderer */
export interface DFStatsViewModel {
  player: DFPlayerInfo;
  economy: DFEconomyStats | null;
  combat: DFCombatStats | null;
  squad: DFSquadStats | null;
  rank: DFRankInfo;
  seasonLabel: string;
}
