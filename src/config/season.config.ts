/** Season config for /df-stats — dynamic list, auto-generated from season numbers */

import { SEASONS_MY_DATA } from './deltaforce.config.js';

export interface SeasonOption {
  label: string;
  value: string;
  seasonNo: string;
}

/** Mapping API seasonNo → S-label (trực tiếp, không có S2) */
const SEASON_LABEL_MAP: Record<string, string> = {
  '10001': 'S1',
  '10003': 'S3',
  '10004': 'S4',
  '10005': 'S5',
  '10006': 'S6',
  '10007': 'S7',
  '10008': 'S8',
  '10009': 'S9',
  '10010': 'S10',
};

/** Build season options: Tổng Quan, S10, S9, ..., S1 (giảm dần) */
export function buildSeasonOptions(): SeasonOption[] {
  const options: SeasonOption[] = [{ label: 'Tổng Quan', value: 'overview', seasonNo: 'overview' }];

  // Reverse để S10 lên đầu
  const reversed = [...SEASONS_MY_DATA].reverse();
  reversed.forEach((no) => {
    options.push({
      label: SEASON_LABEL_MAP[no] ?? `S?`,
      value: no,
      seasonNo: no,
    });
  });

  return options;
}

/** Get season label from seasonNo */
export function getSeasonLabel(seasonNo: string): string {
  if (seasonNo === 'overview') return 'Tổng Quan';
  return SEASON_LABEL_MAP[seasonNo] ?? `S?`;
}
