/**
 * Delta Force Metadata Service.
 * Tự động đồng bộ và nạp dữ liệu realtime từ CDN chính thức của Delta Force:
 * - Operators (Đặc vụ mới, Avatar, Tên tiếng Việt): operators_vi.js
 * - Seasons (Mùa giải mới, Tên season tiếng Việt): seasons_vi.js
 * - Maps (Tên các bản đồ): maps_vi.js
 *
 * Cơ chế:
 * 1. Cache in-memory với TTL 1 giờ.
 * 2. Preload khi bot khởi động.
 * 3. Luôn có fallback tĩnh vững chắc nếu CDN lỗi hoặc timeout.
 */

import { createLogger } from '../utils/logger.js';
import type { DfOperator } from '../utils/df-operator.utils.js';

const logger = createLogger('DfMetadata');

const OPERATORS_URL = 'https://www.playdeltaforce.com/basic_info/operators_vi.js';
const SEASONS_URL = 'https://www.playdeltaforce.com/basic_info/seasons_vi.js';
const MAPS_URL = 'https://www.playdeltaforce.com/basic_info/maps_vi.js';

/** Thời gian sống của cache (1 giờ) */
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Timeout khi fetch metadata từ CDN (10 giây) */
const FETCH_TIMEOUT_MS = 10_000;

export interface DfSeasonInfo {
  seasonId: string;
  name: string;
  shortLabel: string;
}

// ─── Danh sách tĩnh dự phòng (Static Fallbacks) ─────────────────────────

export const FALLBACK_OPERATORS: DfOperator[] = [
  {
    operatorId: '20003',
    name: 'Stinger',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_1e21f39645b1d994e5840913594f76fe.png',
  },
  {
    operatorId: '10010',
    name: 'Vyron',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_eedcf8b0b48f7fec3dcf46087b92a643.png',
  },
  {
    operatorId: '40005',
    name: 'Luna',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_2cb64ca1f98c9daedc15e58145300e07.png',
  },
  {
    operatorId: '40010',
    name: 'Hackclaw',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_eef8d51478f30888d05fa5f14dda7c54.png',
  },
  {
    operatorId: '30010',
    name: 'Sineva',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_8775ddc0c75827beb6496a6ddb0b8565.png',
  },
  {
    operatorId: '10011',
    name: 'Nox',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_df672d957abc356c695e7410f67e983e.png',
  },
  {
    operatorId: '10012',
    name: 'Tempest',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_9bd318d90b680e233cc25fb9dddc1fb1.png',
  },
  {
    operatorId: '40011',
    name: 'Raptor',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_1af02999e3f3c6e2d8c3021d85c5fb15.png',
  },
  {
    operatorId: '30011',
    name: 'Gizmo',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_791425e6c061485479652e6d2bee5547.png',
  },
  {
    operatorId: '20005',
    name: 'Vlinder',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_b01b896f3c47247a4aa4fb4bc2013d2c.png',
  },
  {
    operatorId: '50001',
    name: 'Mắt Lửa Vô Hình',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_21cac283554746332a5deacb09e78a25.png',
  },
  {
    operatorId: '50002',
    name: 'Súng Phun Lửa',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_6a0074d9b74123b7bf7485258d210109.png',
  },
  {
    operatorId: '50003',
    name: 'Lính Hỏa Tiễn',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_09eebf740eeefe7ab84effcc353945ff.png',
  },
  {
    operatorId: '40012',
    name: 'Morse',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_fdd40cd713b1a48532600ee53f29d88a.png',
  },
  {
    operatorId: '10007',
    name: 'D-wolf',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_35cbe5081bfaf02e7f4a41651ff9c7a9.png',
  },
  {
    operatorId: '30008',
    name: 'Shepherd',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_4cd384d3d9f84544d83e86c8ade27f4a.png',
  },
  {
    operatorId: '30009',
    name: 'Uluru',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_dc708fdbd7858330365899b543817fa4.png',
  },
  {
    operatorId: '20004',
    name: 'Toxik',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_87fa922d1887bd005b434e56f2ab6a4e.png',
  },
  {
    operatorId: '30012',
    name: 'N-2',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_ea2ed8da5257841b2e3559d5980a1165.png',
  },
  {
    operatorId: '20006',
    name: 'Rover',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_00578ceeacd2ef787efcef468dd3f6d9.png',
  },
  {
    operatorId: '60001',
    name: 'Desmoulins',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_1c48ac8b92afac576af9d392edbbeef7.png',
  },
  {
    operatorId: '60002',
    name: 'Athos Leal',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_42218f78dede57802cb11ec5d2218499.png',
  },
  {
    operatorId: '60003',
    name: 'Aramis Orgueil',
    avatarUrl:
      'https://www.playdeltaforce.com/basic_info/operators_e7ddf21aa8a5b232f666273cba8f5dfd.png',
  },
];

export const DEFAULT_AVATAR =
  'https://www.playdeltaforce.com/basic_info/operators_1e21f39645b1d994e5840913594f76fe.png';

export const FALLBACK_SEASONS: DfSeasonInfo[] = [
  { seasonId: '10001', name: 'S1 - Genesis', shortLabel: 'S1' },
  { seasonId: '10003', name: 'S3 - Blazefall', shortLabel: 'S3' },
  { seasonId: '10004', name: 'S4 - Eclipse Vigil', shortLabel: 'S4' },
  { seasonId: '10005', name: 'S5 - Break', shortLabel: 'S5' },
  { seasonId: '10006', name: 'S6 - War Ablaze', shortLabel: 'S6' },
  { seasonId: '10007', name: 'S7 - Ahsarah', shortLabel: 'S7' },
  { seasonId: '10008', name: 'S8 - Morphosis', shortLabel: 'S8' },
  { seasonId: '10009', name: 'S9 - Echo', shortLabel: 'S9' },
  { seasonId: '10010', name: 'S10 - Meltdown', shortLabel: 'S10' },
  { seasonId: '10011', name: 'S11 – Kỷ Nguyên Mới', shortLabel: 'S11' },
];

export const FALLBACK_MAP_NAMES: Record<number, string> = {
  1001: 'Đập Nước Zero',
  1002: 'Thung Lũng Layali',
  1003: 'Phố Cổ Brakkesh',
  1004: 'Trạm Không Gian Haavk',
  1005: 'Ngục Giam Thủy Triều',
  2201: 'Đập Nước Zero - Dễ',
  2202: 'Đập nước Zero - Thường',
  2221: 'Đập Nước Zero - Tầng Hầm',
  2222: 'Đập Nước Zero - Doanh Trại',
  2223: 'Đập Nước Zero - TTHC',
  1901: 'Thung Lũng Layali - Dễ',
  1902: 'Thung Lũng Layali - Thường',
};

// ─── Cache State ────────────────────────────────────────────────────────

interface MetadataCache {
  operators: Map<string, DfOperator>;
  seasons: DfSeasonInfo[];
  seasonLabelMap: Map<string, string>;
  maps: Map<number, string>;
  latestSeasonNo: string;
  loadedAt: number;
}

interface RawMapPayload {
  mapname_map?: string[];
  maps?: Array<{
    map_id: string | number;
    map_name?: number;
    language?: { vi?: string };
  }>;
}

interface RawOperatorItem {
  operator_id: string;
  image_url?: string;
  daily_report_avatar_url?: string;
  language?: { vi?: string };
  full_name_i18n?: { vi?: string };
}

interface RawSeasonItem {
  season_id: string;
  language?: { vi?: string };
}

let cache: MetadataCache = {
  operators: new Map(FALLBACK_OPERATORS.map((o) => [o.operatorId, o])),
  seasons: [...FALLBACK_SEASONS],
  seasonLabelMap: new Map(FALLBACK_SEASONS.map((s) => [s.seasonId, s.shortLabel])),
  maps: new Map(Object.entries(FALLBACK_MAP_NAMES).map(([k, v]) => [Number(k), v])),
  latestSeasonNo: FALLBACK_SEASONS[FALLBACK_SEASONS.length - 1].seasonId,
  loadedAt: 0,
};

let refreshPromise: Promise<void> | null = null;

/** Helper tải nội dung text an toàn với timeout */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Parse JavaScript file dạng `var basic_info_xxx = [...]` sang JSON */
function parseJsVariable<T>(jsText: string): T {
  const jsonStr = jsText.replace(/^var\s+[\w$]+\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(jsonStr) as T;
}

/**
 * Chuẩn hóa tên đặc vụ từ CDN:
 * - Fix lỗi dịch thuật: CDN game dịch nhầm codename "Gizmo" (Rashid Rahal - 30011) thành "Thiết Bị".
 * - Fix lỗi typo: CDN game từng để tên "Tempest1" thay vì "Tempest".
 */
function normalizeOperatorName(id: string, rawName?: string): string {
  if (id === '30011' || rawName === 'Thiết Bị') return 'Gizmo';
  if (rawName === 'Tempest1') return 'Tempest';
  return rawName || `Operator ${id}`;
}

/** Tự động trích xuất label ngắn S1, S2, S11 từ tên mùa giải */
function extractShortLabel(seasonId: string, fullName: string): string {
  const match = fullName.match(/^(S\d+)/i);
  if (match) return match[1].toUpperCase();
  // Fallback từ seasonId (vd: 10011 -> S11, 10001 -> S1)
  const num = parseInt(seasonId.slice(2), 10);
  return isNaN(num) ? `S?` : `S${num}`;
}

/**
 * Nạp lại toàn bộ metadata từ CDN chính thức của Delta Force.
 */
export async function refreshDfMetadata(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const [operatorsText, seasonsText, mapsText] = await Promise.all([
        fetchWithTimeout(OPERATORS_URL).catch((e) => {
          logger.warn(`Failed to fetch operators: ${(e as Error).message}`);
          return null;
        }),
        fetchWithTimeout(SEASONS_URL).catch((e) => {
          logger.warn(`Failed to fetch seasons: ${(e as Error).message}`);
          return null;
        }),
        fetchWithTimeout(MAPS_URL).catch((e) => {
          logger.warn(`Failed to fetch maps: ${(e as Error).message}`);
          return null;
        }),
      ]);

      // 1. Cập nhật Operators
      if (operatorsText) {
        try {
          const rawOperators = parseJsVariable<RawOperatorItem[]>(operatorsText);

          if (Array.isArray(rawOperators) && rawOperators.length > 0) {
            const opMap = new Map<string, DfOperator>();
            // Giữ lại fallback trước
            for (const fb of FALLBACK_OPERATORS) opMap.set(fb.operatorId, fb);

            for (const op of rawOperators) {
              if (op.operator_id) {
                const id = String(op.operator_id);
                const rawName = op.language?.vi || op.full_name_i18n?.vi;
                const name = normalizeOperatorName(id, rawName);
                const avatarUrl = op.image_url || op.daily_report_avatar_url || DEFAULT_AVATAR;
                opMap.set(id, { operatorId: id, name, avatarUrl });
              }
            }
            cache.operators = opMap;
            logger.info(`✓ Loaded ${opMap.size} operators from CDN`);
          }
        } catch (err) {
          logger.warn(`Failed to parse operators_vi.js: ${(err as Error).message}`);
        }
      }

      // 2. Cập nhật Seasons
      if (seasonsText) {
        try {
          const rawSeasons = parseJsVariable<RawSeasonItem[]>(seasonsText);

          if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
            const validSeasons: DfSeasonInfo[] = [];
            for (const s of rawSeasons) {
              const name = s.language?.vi;
              if (s.season_id && name && name.trim().length > 0) {
                validSeasons.push({
                  seasonId: String(s.season_id),
                  name: name.trim(),
                  shortLabel: extractShortLabel(String(s.season_id), name.trim()),
                });
              }
            }

            if (validSeasons.length > 0) {
              cache.seasons = validSeasons;
              cache.seasonLabelMap = new Map(validSeasons.map((s) => [s.seasonId, s.shortLabel]));
              cache.latestSeasonNo = validSeasons[validSeasons.length - 1].seasonId;
              logger.info(
                `✓ Loaded ${validSeasons.length} seasons from CDN (Latest: ${cache.latestSeasonNo} - ${cache.seasons[cache.seasons.length - 1].name})`,
              );
            }
          }
        } catch (err) {
          logger.warn(`Failed to parse seasons_vi.js: ${(err as Error).message}`);
        }
      }

      // 3. Cập nhật Maps
      if (mapsText) {
        try {
          const rawMaps = parseJsVariable<RawMapPayload>(mapsText);

          if (rawMaps && Array.isArray(rawMaps.maps) && rawMaps.maps.length > 0) {
            const mapDict = new Map<number, string>(
              Object.entries(FALLBACK_MAP_NAMES).map(([k, v]) => [Number(k), v]),
            );
            for (const m of rawMaps.maps) {
              const id = Number(m.map_id);
              if (!isNaN(id)) {
                const name =
                  m.language?.vi ||
                  (m.map_name !== undefined && rawMaps.mapname_map?.[m.map_name]) ||
                  `Bản đồ #${id}`;
                mapDict.set(id, name);
              }
            }
            cache.maps = mapDict;
            logger.info(`✓ Loaded ${mapDict.size} map names from CDN`);
          }
        } catch (err) {
          logger.warn(`Failed to parse maps_vi.js: ${(err as Error).message}`);
        }
      }

      cache.loadedAt = Date.now();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Đảm bảo cache được nạp hoặc tự động refresh nếu quá TTL */
function ensureFreshCache(): void {
  // Không tự động fetch ngầm trong unit test environment
  if (process.env.NODE_ENV === 'test') return;

  // Chỉ tự động refresh khi đã từng nạp và đã quá hạn TTL
  const isExpired = cache.loadedAt > 0 && Date.now() - cache.loadedAt > CACHE_TTL_MS;
  if (isExpired && !refreshPromise) {
    refreshDfMetadata().catch(() => {});
  }
}

// ─── Public Getters (Synchronous & Fast) ────────────────────────────────

/**
 * Tra cứu thông tin Đặc vụ (Operator) theo ID.
 * Đồng bộ, cực nhanh (O(1)), tự động background refresh khi quá hạn.
 */
export function resolveOperator(operatorId: string | number | undefined | null): DfOperator {
  ensureFreshCache();
  if (operatorId === undefined || operatorId === null) {
    return {
      operatorId: 'unknown',
      name: 'Chiến binh',
      avatarUrl: DEFAULT_AVATAR,
    };
  }

  const idStr = String(operatorId);
  const found = cache.operators.get(idStr);
  if (found) {
    if (idStr === '30011' || found.name === 'Thiết Bị') {
      return { ...found, name: 'Gizmo' };
    }
    return found;
  }

  return {
    operatorId: idStr,
    name: `Operator ${idStr}`,
    avatarUrl: DEFAULT_AVATAR,
  };
}

/**
 * Lấy Season mới nhất (Latest Season No) phục vụ truy vấn lịch sử đấu.
 */
export function getLatestSeasonNo(): string {
  ensureFreshCache();
  return cache.latestSeasonNo;
}

/**
 * Lấy danh sách Season Options phục vụ Select Menu (/df stats).
 */
export function getSeasonOptions(): Array<{ label: string; value: string; seasonNo: string }> {
  ensureFreshCache();
  const options = [{ label: 'Tổng Quan', value: 'overview', seasonNo: 'overview' }];

  // Sắp xếp giảm dần (Mùa mới nhất lên đầu)
  const reversed = [...cache.seasons].reverse();
  for (const s of reversed) {
    options.push({
      label: s.shortLabel,
      value: s.seasonId,
      seasonNo: s.seasonId,
    });
  }

  return options;
}

/**
 * Lấy nhãn hiển thị của Season (S11, S10, Tổng Quan...).
 */
export function getSeasonLabel(seasonNo: string): string {
  ensureFreshCache();
  if (seasonNo === 'overview') return 'Tổng Quan';
  return cache.seasonLabelMap.get(seasonNo) ?? `S?`;
}

/**
 * Tra cứu tên bản đồ theo Map ID.
 */
export function resolveMapName(mapId: number | string | undefined | null): string {
  ensureFreshCache();
  if (mapId === undefined || mapId === null) return 'Bản đồ không xác định';
  const numId = Number(mapId);
  if (isNaN(numId)) return `Bản đồ #${mapId}`;
  return cache.maps.get(numId) ?? `Bản đồ #${numId}`;
}

/**
 * Lấy danh sách tất cả season IDs cho API myData.
 */
export function getAllSeasonIds(): string[] {
  ensureFreshCache();
  return cache.seasons.map((s) => s.seasonId);
}
