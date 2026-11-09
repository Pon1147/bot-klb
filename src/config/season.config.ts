/**
 * Season config for /df-stats — danh sách mùa giải động nạp từ DfMetadataService.
 */

import {
  getSeasonOptions,
  getSeasonLabel as getSeasonLabelFromService,
} from '../services/df-metadata.service.js';

export interface SeasonOption {
  label: string;
  value: string;
  seasonNo: string;
}

/** Build season options: Tổng Quan, S11, S10, ..., S1 (giảm dần) */
export function buildSeasonOptions(): SeasonOption[] {
  return getSeasonOptions();
}

/** Get season label from seasonNo */
export function getSeasonLabel(seasonNo: string): string {
  return getSeasonLabelFromService(seasonNo);
}
