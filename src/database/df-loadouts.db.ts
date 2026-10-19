/**
 * Database layer cho dữ liệu Weapon Loadouts (Cẩm nang & Mã Gunsmith).
 * Lưu trữ và phục vụ tra cứu offline/cache từ API của DeltaForceTools.
 */

import Database from 'better-sqlite3';

export interface WeaponLoadoutRecord {
  weapon_name: string;
  weapon_type: string;
  game_mode: string;
  loadout_code: string;
  tags: string;
  description: string;
  image_url: string;
  author: string;
  server_region: string;
}

/**
 * Khởi tạo bảng df_weapon_loadouts và index tra cứu.
 */
export function initializeWeaponLoadoutsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_weapon_loadouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weapon_name TEXT NOT NULL,
      weapon_type TEXT NOT NULL DEFAULT '',
      game_mode TEXT NOT NULL,
      loadout_code TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT 'deltaforcetools.gg',
      server_region TEXT NOT NULL DEFAULT 'Garena',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(server_region, weapon_name, loadout_code)
    );

    CREATE INDEX IF NOT EXISTS idx_df_weapon_lookup 
    ON df_weapon_loadouts (server_region, weapon_name);
  `);
}

/**
 * Lưu danh sách loadout vào SQLite (Upsert).
 */
export function upsertWeaponLoadouts(
  database: Database.Database,
  loadouts: WeaponLoadoutRecord[],
): number {
  if (loadouts.length === 0) return 0;

  const stmt = database.prepare(`
    INSERT INTO df_weapon_loadouts (
      weapon_name, weapon_type, game_mode, loadout_code,
      tags, description, image_url, author, server_region, updated_at
    ) VALUES (
      @weapon_name, @weapon_type, @game_mode, @loadout_code,
      @tags, @description, @image_url, @author, @server_region, CURRENT_TIMESTAMP
    )
    ON CONFLICT(server_region, weapon_name, loadout_code) DO UPDATE SET
      weapon_type = excluded.weapon_type,
      game_mode = excluded.game_mode,
      tags = excluded.tags,
      description = excluded.description,
      image_url = excluded.image_url,
      author = excluded.author,
      updated_at = CURRENT_TIMESTAMP
  `);

  const runMany = database.transaction((items: WeaponLoadoutRecord[]) => {
    let count = 0;
    for (const item of items) {
      stmt.run(item);
      count++;
    }
    return count;
  });

  return runMany(loadouts);
}

/**
 * Tra cứu danh sách loadout theo tên súng hoặc chế độ chơi.
 */
export function searchWeaponLoadouts(
  database: Database.Database,
  options: {
    weapon?: string;
    gameMode?: string;
    serverRegion?: string;
    limit?: number;
  },
): WeaponLoadoutRecord[] {
  const { weapon, gameMode, serverRegion = 'Garena', limit = 5 } = options;

  let query = `
    SELECT 
      weapon_name, weapon_type, game_mode, loadout_code,
      tags, description, image_url, author, server_region
    FROM df_weapon_loadouts
    WHERE server_region = ?
  `;
  const params: unknown[] = [serverRegion];

  if (weapon && weapon.trim() !== '') {
    query += ` AND LOWER(weapon_name) LIKE ?`;
    params.push(`%${weapon.trim().toLowerCase()}%`);
  }

  if (gameMode && gameMode.trim() !== '') {
    query += ` AND LOWER(game_mode) LIKE ?`;
    params.push(`%${gameMode.trim().toLowerCase()}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);

  return database.prepare(query).all(...params) as WeaponLoadoutRecord[];
}

/**
 * Lấy danh sách tên vũ khí duy nhất để phục vụ autocomplete hoặc gợi ý.
 */
export function getDistinctWeaponNames(
  database: Database.Database,
  serverRegion: string = 'Garena',
): string[] {
  const rows = database
    .prepare(
      `
    SELECT DISTINCT weapon_name
    FROM df_weapon_loadouts
    WHERE server_region = ?
    ORDER BY weapon_name ASC
  `,
    )
    .all(serverRegion) as { weapon_name: string }[];

  return rows.map((r) => r.weapon_name);
}
