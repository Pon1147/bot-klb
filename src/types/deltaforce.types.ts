/** Delta Force HQ API response types extracted from intercepted requests. */

export interface DfPlayerInfo {
  avatar: string;
  level: number;
  nickname: string;
  play_duration: string;
  register_time: string;
}

export interface DfRankData {
  current_rank: string;
  current_rank_score: number;
  highest_rank: string;
  highest_rank_season_id: number;
}

export interface DfCombatStats {
  headshot_kill_rate: string;
  high_kill_death_ratio: string;
  hit_rate: string;
  kill_operator_count: number;
  low_kill_death_ratio: string;
  med_kill_death_ratio: string;
}

export interface DfEconomyStats {
  extract_value: string;
  profit_loss_ratio: string;
  total_mandel_brick: number;
  total_reward: string;
}

export interface DfTeamStats {
  rescue_teammate_count: number;
  retreat_rate: string;
  revive_teammate_count: number;
  teammate_extract_value: string;
}

export interface DfSummaryData {
  bf_combat: null;
  combat: DfCombatStats | null;
  economy: DfEconomyStats | null;
  performance: null;
  team: DfTeamStats | null;
  total_match_count: number;
  vehicle: null;
}

export interface DfMyDataResponse {
  player_info: DfPlayerInfo;
  rank_data: DfRankData;
  summary_data: DfSummaryData;
}

export interface DfMatchEntry {
  carry_out_value: string;
  is_leave: number;
  kill_count: number;
  map_id: number;
  match_time: string;
  net_income: string;
  operator_icon: string;
  operator_id: string;
  result: number; // 1 = win
  room_id: string;
  score: number;
}

export interface DfMatchListResponse {
  commonly_used_operators_id: string;
  list: DfMatchEntry[];
}

export interface DfCollectionItem {
  count: number;
  is_new: boolean;
  item_id: string;
}

export interface DfCollectionResponse {
  collection_list: DfCollectionItem[];
}

export interface DfApiToken {
  openid: string;
  token: string;
}

/** Generic API response wrapper */
export interface DfApiResponse<T = unknown> {
  code: number;
  code_type: number;
  msg: string;
  data: T;
  seq: string;
}
