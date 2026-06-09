import Database from 'better-sqlite3';

export interface DfTokenRow {
  discord_id: string;
  openid: string;
  token: string;
  linked_at: string;
  last_used_at: string | null;
}

/**
 * Initialize the df_tokens table.
 * WHY: Separate table from guild_settings -- user-level data, not guild-level.
 */
export function initializeDfTokensTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_tokens (
      discord_id TEXT PRIMARY KEY,
      openid TEXT NOT NULL,
      token TEXT NOT NULL,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME
    )
  `);
}

export function getDfToken(
  database: Database.Database,
  discordId: string,
): DfTokenRow | undefined {
  return database
    .prepare('SELECT * FROM df_tokens WHERE discord_id = ?')
    .get(discordId) as DfTokenRow | undefined;
}

export function saveDfToken(
  database: Database.Database,
  discordId: string,
  openid: string,
  token: string,
): void {
  database
    .prepare(
      'INSERT OR REPLACE INTO df_tokens (discord_id, openid, token, linked_at, last_used_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)',
    )
    .run(discordId, openid, token);
}

export function touchDfToken(database: Database.Database, discordId: string): void {
  database
    .prepare('UPDATE df_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE discord_id = ?')
    .run(discordId);
}

export function deleteDfToken(database: Database.Database, discordId: string): void {
  database.prepare('DELETE FROM df_tokens WHERE discord_id = ?').run(discordId);
}
