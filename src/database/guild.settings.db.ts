import Database from 'better-sqlite3';
import { GuildSettings, RawGuildSettingsRow } from '../types/settings.types.js';
import { cloneDefaultSettings } from '../config/default.settings.js';
import { botConfig } from '../config/bot.config.js';
import { ensureDatabaseDirectory } from './welcome.database.js';

/**
 * DeepPartial - làm optional tất cả cấp độ nested.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

/**
 * Khởi tạo bảng guild_settings (JSON-based) và bảng guild_welcome_audit.
 * Chỉ gọi 1 lần khi bootstrap bot.
 */
export function initializeSettingsTable(database: Database.Database): void {
  ensureDatabaseDirectory(botConfig.databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  initializeGuildWelcomeAuditTable(database);
}

/**
 * Khởi tạo bảng audit trạng thái gửi tin nhắn chào mừng server mới (At-Most-Once).
 */
export function initializeGuildWelcomeAuditTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_welcome_audit (
      guild_id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
      channel_id TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

export interface GuildWelcomeAuditRow {
  guild_id: string;
  status: 'pending' | 'sent' | 'failed';
  channel_id: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Atomic Claim First: Thực thi INSERT OR IGNORE bản ghi pending.
 * - Trả về true: claim thành công (changes === 1).
 * - Trả về false: guild đã có bản ghi (changes === 0, bất kể trạng thái).
 * - Throw exception: lỗi DB (caller phải bắt và fail-closed).
 */
export function claimGuildWelcome(database: Database.Database, guildId: string): boolean {
  const now = Date.now();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO guild_welcome_audit (guild_id, status, created_at, updated_at)
    VALUES (?, 'pending', ?, ?)
  `);
  const result = stmt.run(guildId, now, now);
  return result.changes === 1;
}

/**
 * Cập nhật kết quả gửi thông điệp chào mừng (sent hoặc failed).
 */
export function updateGuildWelcomeResult(
  database: Database.Database,
  guildId: string,
  status: 'sent' | 'failed',
  channelId?: string,
  errorMessage?: string,
): void {
  const now = Date.now();
  database
    .prepare(
      `
      UPDATE guild_welcome_audit
      SET status = ?, channel_id = ?, error_message = ?, updated_at = ?
      WHERE guild_id = ?
    `,
    )
    .run(status, channelId ?? null, errorMessage ?? null, now, guildId);
}

/**
 * Lấy thông tin audit chào mừng của máy chủ (dùng cho test/kiểm tra).
 */
export function getGuildWelcomeAudit(
  database: Database.Database,
  guildId: string,
): GuildWelcomeAuditRow | undefined {
  return database.prepare('SELECT * FROM guild_welcome_audit WHERE guild_id = ?').get(guildId) as
    GuildWelcomeAuditRow | undefined;
}

/**
 * Đọc settings từ DB cho guild.
 * Nếu chưa có → lưu default vào DB và trả về default.
 */
export function loadGuildSettings(database: Database.Database, guildId: string): GuildSettings {
  const row = database.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as
    RawGuildSettingsRow | undefined;

  if (row) {
    try {
      const parsed = JSON.parse(row.settings_json) as GuildSettings;
      // Merge với defaults để fill missing fields (ví dụ: booster khi DB cũ chưa có)
      const defaults = cloneDefaultSettings();
      const merged = deepMerge(
        defaults as unknown as Record<string, unknown>,
        parsed as unknown as Record<string, unknown>,
      );
      // Lưu lại version đầy đủ để lần sau không cần merge
      saveGuildSettings(database, guildId, merged as unknown as GuildSettings);
      return merged as unknown as GuildSettings;
    } catch {
      // JSON bị hỏng → fallback default, và lưu lại default vào DB
      const defaults = cloneDefaultSettings();
      saveGuildSettings(database, guildId, defaults);
      return defaults;
    }
  }

  // Chưa có row → lưu default và trả về
  const defaults = cloneDefaultSettings();
  saveGuildSettings(database, guildId, defaults);
  return defaults;
}

/**
 * Lưu toàn bộ settings lên DB (upsert).
 */
export function saveGuildSettings(
  database: Database.Database,
  guildId: string,
  settings: GuildSettings,
): void {
  database
    .prepare(
      `
      INSERT OR REPLACE INTO guild_settings (guild_id, settings_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `,
    )
    .run(guildId, JSON.stringify(settings));
}

/**
 * Cập nhật partial settings (merge vào settings cũ).
 * Dùng deep merge đơn giản cho 2 cấp độ.
 */
export function updateGuildSettings(
  database: Database.Database,
  guildId: string,
  partial: DeepPartial<GuildSettings>,
): GuildSettings {
  const current = loadGuildSettings(database, guildId);
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>,
  );
  saveGuildSettings(database, guildId, merged as unknown as GuildSettings);
  return merged as unknown as GuildSettings;
}

/**
 * Recursive deep merge: merge tất cả cấp độ nested objects.
 * Arrays được thay thế hoàn toàn (không merge element-by-element).
 * Primitive values từ source ghi đè target.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}
