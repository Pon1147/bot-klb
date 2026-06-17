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
  emoji: string;
  color: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { id: 'easy', label: 'Dễ', emoji: '\u{1f7e2}', color: 0x57f287 },
  normal: { id: 'normal', label: 'Thường', emoji: '\u{1f7e1}', color: 0xfee75c },
  hard: { id: 'hard', label: 'Khó', emoji: '\u{1f534}', color: 0xed4245 },
};
