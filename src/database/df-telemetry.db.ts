/**
 * Database schema cho credential capture events (telemetry research).
 *
 * Tách biệt khỏi AccountBinding — không nhét research log vào production table.
 * Không lưu full credential.
 */

import Database from 'better-sqlite3';

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
