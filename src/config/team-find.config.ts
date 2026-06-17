/** Map display config - shared between /df-code and /team-find */

import type { DailyCodes } from '../services/deltaforce.scraper.js';

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

/** MP rank choices for /team-find — user picks rank name directly */
export const TEAM_FIND_RANKS: { name: string; value: string }[] = [
  { name: 'Binh Nhì III', value: 'Binh Nhì III' },
  { name: 'Binh Nhì II', value: 'Binh Nhì II' },
  { name: 'Binh Nhì I', value: 'Binh Nhì I' },
  { name: 'Hạ Sĩ III', value: 'Hạ Sĩ III' },
  { name: 'Hạ Sĩ II', value: 'Hạ Sĩ II' },
  { name: 'Hạ Sĩ I', value: 'Hạ Sĩ I' },
  { name: 'Trung Sĩ IV', value: 'Trung Sĩ IV' },
  { name: 'Trung Sĩ III', value: 'Trung Sĩ III' },
  { name: 'Trung Sĩ II', value: 'Trung Sĩ II' },
  { name: 'Trung Sĩ I', value: 'Trung Sĩ I' },
  { name: 'Trung Úy IV', value: 'Trung Úy IV' },
  { name: 'Trung Úy III', value: 'Trung Úy III' },
  { name: 'Trung Úy II', value: 'Trung Úy II' },
  { name: 'Trung Úy I', value: 'Trung Úy I' },
  { name: 'Đại Tá V', value: 'Đại Tá V' },
  { name: 'Đại Tá IV', value: 'Đại Tá IV' },
  { name: 'Đại Tá III', value: 'Đại Tá III' },
  { name: 'Đại Tá II', value: 'Đại Tá II' },
  { name: 'Đại Tá I', value: 'Đại Tá I' },
  { name: 'Đại Tướng V', value: 'Đại Tướng V' },
  { name: 'Đại Tướng IV', value: 'Đại Tướng IV' },
  { name: 'Đại Tướng III', value: 'Đại Tướng III' },
  { name: 'Đại Tướng II', value: 'Đại Tướng II' },
  { name: 'Đại Tướng I', value: 'Đại Tướng I' },
  { name: 'Nguyên Soái', value: 'Nguyên Soái' },
];
