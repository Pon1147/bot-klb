/**
 * Database layer cho tính năng Auto-Post định kỳ của Delta Force (Global Scheduler).
 * Lưu trữ cấu hình bật/tắt, khoảng cách giờ lặp lại và lịch sử lần chạy gần nhất.
 */

import Database from 'better-sqlite3';

export type AutoPostContentType = 'map' | 'gun';

export interface AutoPostConfig {
  type: AutoPostContentType;
  enabled: boolean;
  intervalHours: number;
  lastRunAt: string | null;
  updatedAt: string;
}

interface RawAutoPostRow {
  type: string;
  enabled: number;
  interval_hours: number;
  last_run_at: string | null;
  updated_at: string;
}

/**
 * Khởi tạo bảng df_autopost_config trong SQLite và tạo dữ liệu mặc định.
 */
export function initializeAutoPostTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_autopost_config (
      type TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      interval_hours INTEGER NOT NULL DEFAULT 6,
      last_run_at TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const insertStmt = database.prepare(`
    INSERT OR IGNORE INTO df_autopost_config (type, enabled, interval_hours, last_run_at, updated_at)
    VALUES (?, 0, 6, NULL, CURRENT_TIMESTAMP)
  `);

  insertStmt.run('map');
  insertStmt.run('gun');
}

/**
 * Chuyển đổi dữ liệu thô từ SQLite sang AutoPostConfig.
 */
function toConfig(row: RawAutoPostRow): AutoPostConfig {
  return {
    type: row.type as AutoPostContentType,
    enabled: row.enabled === 1,
    intervalHours: row.interval_hours,
    lastRunAt: row.last_run_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lấy cấu hình của một loại nội dung (map hoặc gun).
 */
export function getAutoPostConfig(
  database: Database.Database,
  type: AutoPostContentType,
): AutoPostConfig {
  const row = database.prepare('SELECT * FROM df_autopost_config WHERE type = ?').get(type) as
    RawAutoPostRow | undefined;

  if (row) {
    return toConfig(row);
  }

  return {
    type,
    enabled: false,
    intervalHours: 6,
    lastRunAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Lấy danh sách toàn bộ cấu hình Auto-Post hiện có.
 */
export function getAllAutoPostConfigs(database: Database.Database): AutoPostConfig[] {
  const rows = database
    .prepare('SELECT * FROM df_autopost_config ORDER BY type ASC')
    .all() as RawAutoPostRow[];

  return rows.map(toConfig);
}

/**
 * Cập nhật cấu hình Auto-Post cho một loại nội dung.
 */
export function updateAutoPostConfig(
  database: Database.Database,
  type: AutoPostContentType,
  patch: {
    enabled?: boolean;
    intervalHours?: number;
    lastRunAt?: string | null;
  },
): void {
  const current = getAutoPostConfig(database, type);
  const newEnabled =
    patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled ? 1 : 0;
  const newInterval =
    patch.intervalHours !== undefined ? patch.intervalHours : current.intervalHours;
  const newLastRun = patch.lastRunAt !== undefined ? patch.lastRunAt : current.lastRunAt;

  database
    .prepare(
      `
      INSERT INTO df_autopost_config (type, enabled, interval_hours, last_run_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(type) DO UPDATE SET
        enabled = excluded.enabled,
        interval_hours = excluded.interval_hours,
        last_run_at = excluded.last_run_at,
        updated_at = CURRENT_TIMESTAMP
    `,
    )
    .run(type, newEnabled, newInterval, newLastRun);
}
