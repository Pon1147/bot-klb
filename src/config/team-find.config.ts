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
  url?: string;
}

/** Derive from DailyCodes so both types stay in sync */
export type MapKey = keyof DailyCodes;

/** Map display registry - keys match DailyCodes from scraper */
export const MAP_DISPLAY: Record<MapKey, MapInfo> = {
  'Đập Nước Zero': {
    name: 'Zero Dam',
    image: 'map_zero.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step1_1-SIL-2Nfi.png',
  },
  'Thung lũng Layali': {
    name: 'Layali',
    image: 'map_layali.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step2_1-CvDG735k.png',
  },
  'Phố Cổ Brakkesh': {
    name: 'Brakkesh',
    image: 'map_brakkesh.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step3_1-CWwIzVnv.png',
  },
  AZ3: {
    name: 'AZ3',
    image: 'map_az3.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step6_1-DleYkxyf.png',
  },
  'Trạm Không Gian': {
    name: 'Space City',
    image: 'map_spacecity.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step4_1-BVYxxjY3.png',
  },
  'Ngục Giam Thủy Triều': {
    name: 'Tide Prison',
    image: 'map_tideprison.png',
    url: 'https://www.playdeltaforce.com/events/hq/assets/step5_1-B8Z-Mgmx.png',
  },
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
  AZ3: ['easy', 'normal'],
  'Trạm Không Gian': ['normal', 'hard'],
  'Ngục Giam Thủy Triều': ['hard'],
};

// Re-export core game emojis & map names from central deltaforce.config for backwards compatibility
export {
  EMOJI_WIN,
  EMOJI_DEFEAT,
  EMOJI_MONEY,
  EMOJI_KILL,
  MAP_NAMES,
} from './deltaforce.config.js';

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
