/**
 * Database schema cho credential capture events (telemetry research).
 *
 * Tách biệt khỏi AccountBinding — không nhét research log vào production table.
 * Không lưu full credential.
 */

import Database from 'better-sqlite3';

export interface CaptureEventRow {
  id: number;
  discord_user_id: string | null;
  endpoint: string;
  captured_at: string;
  credential_fingerprint: string;
  notes: string | null;
}

/**
 * Khởi tạo bảng credential_capture_events.
 */
export function initializeCaptureEventsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS credential_capture_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT,
      endpoint TEXT NOT NULL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      credential_fingerprint TEXT NOT NULL,
      notes TEXT
    )
  `);

  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_capture_endpoint ON credential_capture_events(endpoint)',
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_capture_user ON credential_capture_events(discord_user_id)',
  );
}

/**
 * Ghi capture event (không lưu full credential).
 *
 * @param fingerprint — hash ngắn hoặc length, KHÔNG phải secret
 */
export function recordCaptureEvent(
  database: Database.Database,
  endpoint: string,
  fingerprint: string,
  discordUserId?: string,
  notes?: string,
): void {
  database
    .prepare(
      `INSERT INTO credential_capture_events (discord_user_id, endpoint, credential_fingerprint, notes)
       VALUES (?, ?, ?, ?)`,
    )
    .run(discordUserId ?? null, endpoint, fingerprint, notes ?? null);
}
