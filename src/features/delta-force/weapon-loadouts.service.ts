/**
 * Service tích hợp Weapon Loadouts API từ deltaforcetools.gg.
 * Thực hiện lấy dữ liệu, phân trang và đồng bộ cache vào SQLite theo tài liệu tích hợp.
 */

import Database from 'better-sqlite3';
import { botConfig } from '../../config/bot.config.js';
import { upsertWeaponLoadouts, WeaponLoadoutRecord } from '../../database/df-loadouts.db.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WeaponLoadouts');

export const WEAPON_LOADOUTS_API_BASE = 'https://deltaforcetools.gg';
export const WEAPON_LOADOUTS_ENDPOINT = `${WEAPON_LOADOUTS_API_BASE}/api/weapon-loadouts`;

export interface ApiWeaponLoadoutItem {
  weapon_name: string;
  weapon_type: string;
  game_mode: string;
  loadout_code: string;
  tags: string;
  description: string;
  image_url: string;
  author: string;
}

export interface ApiWeaponLoadoutsResponse {
  code: number;
  message: string;
  data: {
    list: ApiWeaponLoadoutItem[];
    total: number;
    page: number;
    pageSize: number;
  } | null;
}

/**
 * Gọi API deltaforcetools.gg để lấy danh sách loadout (1 trang).
 */
export async function fetchLoadoutsPage(options: {
  token: string;
  serverRegion?: string;
  lang?: string;
  page?: number;
  pageSize?: number;
  weapon?: string;
  gameMode?: string;
}): Promise<ApiWeaponLoadoutsResponse> {
  const {
    token,
    serverRegion = 'Garena',
    lang = 'en',
    page = 1,
    pageSize = 50,
    weapon,
    gameMode,
  } = options;

  const url = new URL(WEAPON_LOADOUTS_ENDPOINT);
  url.searchParams.set('server_region', serverRegion);
  url.searchParams.set('lang', lang);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));

  if (weapon) url.searchParams.set('weapon', weapon);
  if (gameMode) url.searchParams.set('game_mode', gameMode);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Weapon Loadouts API HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as ApiWeaponLoadoutsResponse;
  if (json.code !== 0 || !json.data) {
    throw new Error(`Weapon Loadouts API Error (code ${json.code}): ${json.message}`);
  }

  return json;
}

/**
 * Đồng bộ toàn bộ loadout từ API về SQLite theo khuyến nghị mục 8 của tài liệu:
 * - Lấy pageSize=50 từ page=1 đến hết tuần tự.
 * - Lưu vào SQLite database (upsert).
 */
export async function syncWeaponLoadouts(
  database: Database.Database,
  token?: string,
  serverRegion: string = 'Garena',
): Promise<{ success: boolean; totalSynced: number; error?: string }> {
  const authToken = token || botConfig.weaponLoadoutsToken;

  if (!authToken) {
    logger.warn('Chưa cấu hình WEAPON_LOADOUTS_TOKEN — bỏ qua đồng bộ từ API.');
    return {
      success: false,
      totalSynced: 0,
      error: 'Missing WEAPON_LOADOUTS_TOKEN in configuration',
    };
  }

  logger.info(`Bắt đầu đồng bộ Weapon Loadouts từ API (server_region=${serverRegion})...`);

  try {
    const pageSize = 50;
    let currentPage = 1;
    let totalItems = 0;
    let allRecords: WeaponLoadoutRecord[] = [];

    // Trang 1
    const firstPageRes = await fetchLoadoutsPage({
      token: authToken,
      serverRegion,
      page: currentPage,
      pageSize,
    });

    totalItems = firstPageRes.data?.total ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const mapToRecord = (item: ApiWeaponLoadoutItem): WeaponLoadoutRecord => ({
      weapon_name: item.weapon_name || '',
      weapon_type: item.weapon_type || '',
      game_mode: item.game_mode || '',
      loadout_code: item.loadout_code || '',
      tags: item.tags || '',
      description: item.description || '',
      image_url: item.image_url || '',
      author: item.author || 'deltaforcetools.gg',
      server_region: serverRegion,
    });

    if (firstPageRes.data?.list) {
      allRecords.push(...firstPageRes.data.list.map(mapToRecord));
    }

    // Các trang tiếp theo nếu có
    while (currentPage < totalPages) {
      currentPage++;
      const pageRes = await fetchLoadoutsPage({
        token: authToken,
        serverRegion,
        page: currentPage,
        pageSize,
      });

      if (pageRes.data?.list) {
        allRecords.push(...pageRes.data.list.map(mapToRecord));
      }
    }

    // Lưu toàn bộ vào SQLite
    const upsertedCount = upsertWeaponLoadouts(database, allRecords);
    logger.info(`Đồng bộ thành công ${upsertedCount}/${totalItems} loadouts vào SQLite.`);

    return {
      success: true,
      totalSynced: upsertedCount,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Lỗi khi đồng bộ Weapon Loadouts: ${msg}`);
    return {
      success: false,
      totalSynced: 0,
      error: msg,
    };
  }
}
