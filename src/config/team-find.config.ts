/** Map display config - shared between /df-code and /team-find */

import type { DailyCodes } from '../services/deltaforce.scraper.js';

/** Path tới ảnh map */
export const ASSETS_PATH = './src/assets/img/map/';

/** Giới hạn mặc định cho /df-history */
export const MAX_HISTORY_LIMIT = 10;

/** Map info: display name and image filename */
export interface MapInfo {
  name: string;
  image: string;
}

/** Derive from DailyCodes so both types stay in sync */
export type MapKey = keyof DailyCodes;

/** Map display registry - keys match DailyCodes from scraper */
export const MAP_DISPLAY: Record<MapKey, MapInfo> = {
  'Đập Nước Zero': { name: 'Zero Dam', image: 'map_zero.png' },
  'Thung lũng Layali': { name: 'Layali', image: 'map_layali.png' },
  'Phố Cổ Brakkesh': { name: 'Brakkesh', image: 'map_brakkesh.png' },
  'Trạm Không Gian': { name: 'Space City', image: 'map_spacecity.png' },
  'Ngục Giam Thủy Triều': { name: 'Tide Prison', image: 'map_tideprison.png' },
};

/** Difficulty levels for /team-find */
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  color: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { id: 'easy', label: 'Dễ', color: 0x57f287 },
  normal: { id: 'normal', label: 'Thường', color: 0xfee75c },
  hard: { id: 'hard', label: 'Khó', color: 0xed4245 },
};

/** Map → available modes mapping (controls dependent options) */
export const MAP_MODES: Record<MapKey, Difficulty[]> = {
  'Thung lũng Layali': ['easy'],
  'Đập Nước Zero': ['easy', 'normal'],
  'Phố Cổ Brakkesh': ['normal', 'hard'],
  'Trạm Không Gian': ['normal', 'hard'],
  'Ngục Giam Thủy Triều': ['hard'],
};

/** DF-history emoji IDs */
export const EMOJI_WIN = '<a:HoA:1512368174614446181>';
export const EMOJI_DEFEAT = '<:hom_xac:1514470840312401971>';
export const EMOJI_MONEY = '<:icon9De6T9unB:1514474246779306115>';
export const EMOJI_KILL = '<:kill:1514482180254990407>';

/** Map ID → display name (used by /df-history) */
export const MAP_NAMES: Record<number, string> = {
  2201: 'Haven',
  2202: 'Border',
  2203: 'Bank',
  2204: 'Fortress',
  2205: 'Tomb',
  2206: 'Substation',
  2207: 'Goldshore',
  2208: 'Ridge',
};

/** Season ID của mùa mới nhất — update khi mùa mới ra */
export const LATEST_SEASON = '10009';
export const LATEST_SEASON_NAME = 'S9';

/** SOL rank choices for /team-find — matches /df-stats display */
export const TEAM_FIND_RANKS: { name: string; value: string }[] = [
  { name: 'Đồng III', value: 'Đồng III' },
  { name: 'Đồng II', value: 'Đồng II' },
  { name: 'Đồng I', value: 'Đồng I' },
  { name: 'Bạc III', value: 'Bạc III' },
  { name: 'Bạc II', value: 'Bạc II' },
  { name: 'Bạc I', value: 'Bạc I' },
  { name: 'Vàng IV', value: 'Vàng IV' },
  { name: 'Vàng III', value: 'Vàng III' },
  { name: 'Vàng II', value: 'Vàng II' },
  { name: 'Vàng I', value: 'Vàng I' },
  { name: 'Bạch Kim IV', value: 'Bạch Kim IV' },
  { name: 'Bạch Kim III', value: 'Bạch Kim III' },
  { name: 'Bạch Kim II', value: 'Bạch Kim II' },
  { name: 'Bạch Kim I', value: 'Bạch Kim I' },
  { name: 'Kim Cương V', value: 'Kim Cương V' },
  { name: 'Kim Cương IV', value: 'Kim Cương IV' },
  { name: 'Kim Cương III', value: 'Kim Cương III' },
  { name: 'Kim Cương II', value: 'Kim Cương II' },
  { name: 'Kim Cương I', value: 'Kim Cương I' },
  { name: 'Cao Thủ V', value: 'Cao Thủ V' },
  { name: 'Cao Thủ IV', value: 'Cao Thủ IV' },
  { name: 'Cao Thủ III', value: 'Cao Thủ III' },
  { name: 'Cao Thủ II', value: 'Cao Thủ II' },
  { name: 'Cao Thủ I', value: 'Cao Thủ I' },
  { name: 'Thách Đấu DF', value: 'Thách Đấu DF' },
];
