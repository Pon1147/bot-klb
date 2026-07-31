/**
 * Cấu hình cố định cho DeltaForce API.
 * Tất cả URLs, params, timeout dùng constants thay vì hardcoded.
 */

// ===== API Base =====
export const BASE_API_URL = 'https://sg-act.playerinfinite.com/api/proxy/logicial/DfTools';

// ===== Request Params (cố định cho mọi request) =====
export const GAME_ID = '30150';
export const DF_CHANNEL = '10';
export const ACCOUNT_TYPE = '1';
export const ACCOUNT_A_PARAM = '10005';
export const LANG_TYPE = 'vi';

// ===== Headers =====
export const DF_ORIGIN = 'https://www.playdeltaforce.com';
export const DF_REFERER = 'https://www.playdeltaforce.com/';

// ===== HQ (Human Quest) =====
export const HQ_URL_BASE =
  'https://www.playdeltaforce.com/events/hq/vi/index.html?language=vi&info=';
export const HQ_PAGE_TIMEOUT = 30_000;
export const HQ_SELECTOR_TIMEOUT = 15_000;

// ===== API Timeout =====
export const API_TIMEOUT_MS = 15_000;

// ===== Seasons =====
export const SEASONS_MY_DATA = [
  '10001',
  '10003',
  '10004',
  '10005',
  '10006',
  '10007',
  '10008',
  '10009',
] as const;
export const SEASON_LATEST = '10009';

// ===== SOL Mode Threshold =====
export const SOL_MODE_THRESHOLD = 1000;
