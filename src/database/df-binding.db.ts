/**
 * Database schema cho account bindings — production persistent store.
 *
 * Replaces plaintext df_tokens table.
 * Credentials encrypted at rest (AES-256-GCM).
 *
 * Không bắt buộc source_endpoint trong production binding.
 * openid = identifier (plaintext OK nhưng hạn chế log).
 */

import Database from 'better-sqlite3';
import { deleteDfToken } from './df.token.db.js';

interface AccountBindingRow {
  id: number;
  discord_user_id: string;
  provider: string;
  platform: string;
  openid: string;
  cred_nonce: string;
  cred_ciphertext: string;
  cred_tag: string;
  key_version: string;
  status: 'active' | 'expired' | 'revoked';
  captured_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Khởi tạo bảng df_account_bindings.
 */
export function initializeAccountBindingsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_account_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'garena',
      platform TEXT NOT NULL DEFAULT 'df_hq',
      openid TEXT NOT NULL,
      cred_nonce TEXT NOT NULL,
      cred_ciphertext TEXT NOT NULL,
      cred_tag TEXT NOT NULL,
      key_version TEXT NOT NULL DEFAULT 'v1',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'expired', 'revoked')),
      captured_at DATETIME,
      last_ok_at DATETIME,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_binding_user ON df_account_bindings(discord_user_id)',
  );
  database.exec('CREATE INDEX IF NOT EXISTS idx_binding_status ON df_account_bindings(status)');
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_binding_openid ON df_account_bindings(openid, status)',
  );
}

/**
 * Upsert account binding (encrypted credential).
 */
export function upsertAccountBinding(
  database: Database.Database,
  discordUserId: string,
  openid: string,
  credNonce: string,
  credCiphertext: string,
  credTag: string,
  keyVersion = 'v1',
): boolean {
  const result = database
    .prepare(
      `
      INSERT INTO df_account_bindings
        (discord_user_id, openid, cred_nonce, cred_ciphertext, cred_tag, key_version, captured_at, status)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')
      ON CONFLICT(discord_user_id) DO UPDATE SET
        openid = excluded.openid,
        cred_nonce = excluded.cred_nonce,
        cred_ciphertext = excluded.cred_ciphertext,
        cred_tag = excluded.cred_tag,
        key_version = excluded.key_version,
        status = 'active',
        captured_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `,
    )
    .run(discordUserId, openid, credNonce, credCiphertext, credTag, keyVersion);

  return result.changes > 0;
}

/**
 * Lấy binding active của user.
 */
export function getActiveBinding(
  database: Database.Database,
  discordUserId: string,
): AccountBindingRow | undefined {
  return database
    .prepare(`SELECT * FROM df_account_bindings WHERE discord_user_id = ? AND status = 'active'`)
    .get(discordUserId) as AccountBindingRow | undefined;
}

/**
 * Lấy binding active theo Garena openid.
 * Dùng để check xem account Garena đã được link với Discord user nào chưa.
 */
export function getActiveBindingByOpenid(
  database: Database.Database,
  openid: string,
): AccountBindingRow | undefined {
  return database
    .prepare(`SELECT * FROM df_account_bindings WHERE openid = ? AND status = 'active'`)
    .get(openid) as AccountBindingRow | undefined;
}

/**
 * Mark binding as expired.
 */
export function expireBinding(database: Database.Database, discordUserId: string): void {
  database
    .prepare(
      "UPDATE df_account_bindings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?",
    )
    .run(discordUserId);
  // Xóa legacy token đồng bộ
  deleteDfToken(database, discordUserId);
}

/**
 * Revoke binding (unlink).
 */
export function revokeBinding(database: Database.Database, discordUserId: string): void {
  database
    .prepare(
      "UPDATE df_account_bindings SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?",
    )
    .run(discordUserId);
}

/**
 * Update last_ok_at (khi DfToolsClient gọi API thành công).
 */
export function touchLastOk(database: Database.Database, discordUserId: string): void {
  database
    .prepare(
      'UPDATE df_account_bindings SET last_ok_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?',
    )
    .run(discordUserId);
}

/**
 * Update last_error (khi DfToolsClient gọi API thất bại).
 */
export function updateLastError(
  database: Database.Database,
  discordUserId: string,
  error: string,
): void {
  database
    .prepare(
      'UPDATE df_account_bindings SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ?',
    )
    .run(error.slice(0, 500), discordUserId);
}
