/**
 * Database schema cho claim sessions — replaces in-memory TTLStore.
 *
 * Claim session: ephemeral, security-critical.
 * Luật: random + short-lived + one-time + bound to Discord user.
 * Consume phải atomic (transaction).
 */

import Database from 'better-sqlite3';

/**
 * Khởi tạo bảng df_claim_sessions.
 */
export function initializeClaimSessionsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_claim_sessions (
      code TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'consumed', 'expired')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME,
      fail_count INTEGER DEFAULT 0
    )
  `);

  database.exec('CREATE INDEX IF NOT EXISTS idx_claim_expires ON df_claim_sessions(expires_at)');
}

/**
 * Tạo claim session mới.
 */
export function createClaimSession(
  database: Database.Database,
  code: string,
  discordUserId: string,
  expiresAtMs: number,
): void {
  database
    .prepare(
      `INSERT INTO df_claim_sessions (code, discord_user_id, status, expires_at)
       VALUES (?, ?, 'pending', datetime(? / 1000, 'unixepoch'))`,
    )
    .run(code, discordUserId, expiresAtMs);
}

/**
 * Atomic consume: SELECT pending claim + UPDATE to consumed trong transaction.
 * Trả về discord_user_id nếu thành công, null nếu không (đã consumed / expired / missing).
 */
export function atomicConsumeClaim(database: Database.Database, code: string): string | null {
  // SQLite transaction: BEGIN IMMEDIATE để lock write
  const consumeSql = `
    UPDATE df_claim_sessions
    SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
    WHERE code = ?
      AND status = 'pending'
      AND expires_at > datetime('now')
  `;

  const result = database.prepare(consumeSql).run(code);
  if (result.changes === 0) {
    return null;
  }

  // Lấy discord_user_id của session vừa consume
  const row = database
    .prepare('SELECT discord_user_id FROM df_claim_sessions WHERE code = ?')
    .get(code) as { discord_user_id: string } | undefined;

  return row?.discord_user_id ?? null;
}

/**
 * Xóa các claim session hết hạn.
 */
export function cleanupExpiredClaims(database: Database.Database): number {
  const result = database
    .prepare(
      "DELETE FROM df_claim_sessions WHERE status = 'pending' AND expires_at <= datetime('now')",
    )
    .run();
  return result.changes;
}

/**
 * Invalid tất cả pending claims của user (dùng khi user gọi /df-link start mới).
 */
export function invalidateUserClaims(database: Database.Database, discordUserId: string): void {
  database
    .prepare(
      "UPDATE df_claim_sessions SET status = 'expired' WHERE discord_user_id = ? AND status = 'pending'",
    )
    .run(discordUserId);
}

/**
 * Tăng fail count cho claim code.
 */
export function incrementClaimFailCount(database: Database.Database, code: string): void {
  database
    .prepare('UPDATE df_claim_sessions SET fail_count = fail_count + 1 WHERE code = ?')
    .run(code);
}
