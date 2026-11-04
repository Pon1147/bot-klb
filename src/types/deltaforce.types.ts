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
  map_id: number | string;
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
  dahong_total_count?: number;
  dahong_type_count?: number;
  dahong_total_value?: string | number;
}

export interface DfMatchMember {
  nickname: string;
  operator_id: string;
  is_self?: boolean;
  carry_out_value: string | number;
  kill_operator: number;
  kill_other: number;
  survival_duration?: number;
  rescue?: number;
  revive?: number;
}

export interface DfMatchDetailResponse {
  room_id: string;
  map_id: number | string;
  match_time: string | number;
  match_duration?: number;
  result: number; // 1: Win / Thắng, 2: Defeat / Tử trận
  net_income?: string | number;
  carry_out_value?: string | number;
  kill_count?: number;
  operator_id?: string;
  members?: DfMatchMember[];
}

export interface DfApiToken {
  openid: string;
  token: string;
  ts?: string;
  s?: string;
  u?: string;
}

export interface DfBattlefieldBattle {
  kd_ratio: string;
  kill_count: number;
  match_count: number;
  retreat_rate: string;
  revenue: string;
}

export interface DfDailyReportResponse {
  avatar: string;
  battlefield_battle: DfBattlefieldBattle | null;
  beacon_battle: DfBattlefieldBattle | null;
  common_operator_id: string;
  daily_passwords: unknown;
  date: string;
  field_support: unknown[];
  high_value_items: Array<{ item_id: string; item_num: number }>;
  highlight_match: unknown;
  nickname: string;
  tag_id: number;
}

export interface DfWorkbenchItem {
  hourly_income: string;
  item_id: string;
  recommended_recipe_id: string;
  remaining_time: number;
  status: number;
  workbench_id: string;
}

export interface DfWorkshopRecommendationResponse {
  timestamp: string;
  workbench_list: DfWorkbenchItem[];
}

export interface DfManufactureMaterial {
  material_count: number;
  material_id: string;
  total_price: string;
  unit_price: string;
}

export interface DfPriceFluctuation {
  hour_timestamp: string;
  price: string;
}

export interface DfManufactureDetailResponse {
  deposit: string;
  handling_fee: string;
  hourly_income: string;
  item_id: string;
  manufacture_cost: string;
  material_list: DfManufactureMaterial[];
  price_fluctuation_list: DfPriceFluctuation[];
  recommended_recipe_id: string;
  total_duration: number;
  total_income: string;
  total_sell_price: string;
}

/** Generic API response wrapper */
export interface DfApiResponse<T = unknown> {
  code: number;
  code_type: number;
  msg: string;
  data: T;
  seq: string;
}
