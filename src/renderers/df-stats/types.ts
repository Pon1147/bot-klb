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
  /** Tỷ lệ rút thành công (%) */
  extractionRate?: string;
  /** Số lần rút thành công */
  numberOfExtractions?: number;
  /** Tài sản trung bình mỗi match */
  averageAssetsPerMatch?: string;
  /** Tổng số lượng thu thập */
  collectionQuantity?: number;
}

/** Thống kê chiến đấu */
export interface DFCombatStats {
  kills: number;
  hitRate: string;
  headshotRate: string;
  kdLow: string;
  kdMed: string;
  kdHigh: string;
  /** Số operator đã kill */
  operatorsKilled?: number;
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
  /** Operator name card — most used operator in mode */
  mostUsedOperator?: string;
  /** Operator portrait URL */
  operatorPortraitUrl?: string;
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
  /** Badge icon URLs cho Operator Name Card */
  nameCardBadges?: string[];
  seasonLabel: string;
}
