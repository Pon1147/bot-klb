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
 * expires_at lưu numeric Unix timestamp (giây) → so sánh không phụ thuộc timezone.
 */
export function initializeClaimSessionsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS df_claim_sessions (
      code TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'consumed', 'expired')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at NUMERIC NOT NULL,
      consumed_at DATETIME,
      fail_count INTEGER DEFAULT 0
    )
  `);

  database.exec('CREATE INDEX IF NOT EXISTS idx_claim_expires ON df_claim_sessions(expires_at)');
}

/**
 * Migration: chuẩn hóa expires_at sang numeric Unix timestamp (giây).
 * Xử lý 2 trường hợp:
 * 1. datetime string (chứa ':') → strftime('%s', ...)
 * 2. numeric có decimal (ms chưa chia 1000) → floor(expires_at / 1000)
 * Chạy 1 lần khi deploy.
 */
export function migrateClaimSessionsToNumeric(database: Database.Database): void {
  // 1. Migrate datetime string → numeric giây
  const stringRows = database
    .prepare("SELECT code, expires_at FROM df_claim_sessions WHERE expires_at LIKE '%:%'")
    .all() as { code: string; expires_at: string }[];

  // 2. Migrate numeric ms (có decimal, > 1e12) → numeric giây
  const msRows = database
    .prepare(
      "SELECT code, expires_at FROM df_claim_sessions WHERE expires_at LIKE '%.%' AND expires_at > 1000000000000",
    )
    .all() as { code: string; expires_at: number }[];

  const total = stringRows.length + msRows.length;
  if (total === 0) {
    return; // Không có row nào cần migrate
  }

  const updateString = database.prepare(
    "UPDATE df_claim_sessions SET expires_at = strftime('%s', expires_at) WHERE code = ?",
  );
  const updateMs = database.prepare(
    'UPDATE df_claim_sessions SET expires_at = CAST(floor(expires_at / 1000) AS INTEGER) WHERE code = ?',
  );

  database.transaction(() => {
    for (const row of stringRows) {
      updateString.run(row.code);
    }
    for (const row of msRows) {
      updateMs.run(row.code);
    }
  })();

  console.log(
    `[ClaimSessions] Migrated ${stringRows.length} string + ${msRows.length} ms rows to numeric expires_at`,
  );
}

/**
 * Tạo claim session mới.
 * Lưu expires_at dưới dạng numeric Unix timestamp (giây) để tránh timezone issues.
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
       VALUES (?, ?, 'pending', ? / 1000)`,
    )
    .run(code, discordUserId, expiresAtMs);
}

/**
 * Atomic consume: SELECT pending claim + UPDATE to consumed trong transaction.
 * So sánh numeric timestamp (giây) → không phụ thuộc timezone.
 * Trả về discord_user_id nếu thành công, null nếu không (đã consumed / expired / missing).
 */
export function atomicConsumeClaim(database: Database.Database, code: string): string | null {
  // CAST strftime về REAL → so sánh numeric với numeric, tránh type coercion sai
  const consumeSql = `
    UPDATE df_claim_sessions
    SET status = 'consumed', consumed_at = datetime('now')
    WHERE code = ?
      AND status = 'pending'
      AND expires_at > CAST(strftime('%s', 'now') AS REAL)
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
 * Invalid tất cả pending claims của user (dùng khi user gọi /df-link start mới).
 */
export function invalidateUserClaims(database: Database.Database, discordUserId: string): void {
  database
    .prepare(
      "UPDATE df_claim_sessions SET status = 'expired' WHERE discord_user_id = ? AND status = 'pending'",
    )
    .run(discordUserId);
}
