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
import {
  upsertAccountBindingToMongo,
  expireAccountBindingInMongo,
  revokeAccountBindingInMongo,
  touchLastOkInMongo,
  loadAllActiveBindingsFromMongo,
  isMongoConnected,
} from './mongo/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DfBindingDb');

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
 * Upsert account binding (encrypted credential) vào SQLite cache.
 * Có thể bỏ qua gọi MongoDB nếu caller đã chủ động ghi trước (syncToMongo = false).
 */
export function upsertAccountBinding(
  database: Database.Database,
  discordUserId: string,
  openid: string,
  credNonce: string,
  credCiphertext: string,
  credTag: string,
  keyVersion = 'v1',
  syncToMongo = true,
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

  if (syncToMongo && isMongoConnected()) {
    void upsertAccountBindingToMongo({
      discord_user_id: discordUserId,
      openid,
      cred_nonce: credNonce,
      cred_ciphertext: credCiphertext,
      cred_tag: credTag,
      key_version: keyVersion,
    });
  }

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
 * Mark binding as expired đồng bộ (fire-and-forget sync to Mongo).
 * Áp dụng conditional update với cred_nonce để chống race condition.
 */
export function expireBinding(
  database: Database.Database,
  discordUserId: string,
  expectedNonce?: string,
): void {
  const current = getActiveBinding(database, discordUserId);
  const nonce = expectedNonce ?? current?.cred_nonce;

  let changes = 0;
  if (nonce) {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND cred_nonce = ? AND status = 'active'",
      )
      .run(discordUserId, nonce);
    changes = result.changes;
  } else {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND status = 'active'",
      )
      .run(discordUserId);
    changes = result.changes;
  }

  // Không được xóa legacy token nếu binding generation đã thay đổi (changes === 0 khi nonce tồn tại)
  if (current && nonce) {
    if (changes > 0) {
      deleteDfToken(database, discordUserId);
    }
  } else {
    deleteDfToken(database, discordUserId);
  }

  if (isMongoConnected()) {
    void expireAccountBindingInMongo(discordUserId, nonce);
  }
}

/**
 * Mark binding as expired bất đồng bộ: MongoDB First -> SQLite Cache.
 * Trả về kết quả rõ ràng để caller phát hiện lỗi.
 */
export async function expireBindingAsync(
  database: Database.Database,
  discordUserId: string,
  expectedNonce?: string,
): Promise<{ success: boolean; error?: string }> {
  const current = getActiveBinding(database, discordUserId);
  const nonce = expectedNonce ?? current?.cred_nonce;

  // 1. Persistent Store First (MongoDB)
  if (isMongoConnected()) {
    const mongoRes = await expireAccountBindingInMongo(discordUserId, nonce);
    if (!mongoRes.success) {
      if (mongoRes.reason === 'unavailable') {
        return { success: false, error: 'database_unavailable' };
      }
      if (mongoRes.reason === 'generation_mismatch') {
        return { success: false, error: 'generation_mismatch' };
      }
    }
  }

  // 2. Runtime Cache (SQLite)
  let changes = 0;
  if (nonce) {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND cred_nonce = ? AND status = 'active'",
      )
      .run(discordUserId, nonce);
    changes = result.changes;
  } else {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND status = 'active'",
      )
      .run(discordUserId);
    changes = result.changes;
  }

  if (current && nonce) {
    if (changes > 0) {
      deleteDfToken(database, discordUserId);
    }
  } else {
    deleteDfToken(database, discordUserId);
  }

  return { success: true };
}

/**
 * Revoke binding (unlink) đồng bộ.
 * Áp dụng conditional update với cred_nonce.
 */
export function revokeBinding(
  database: Database.Database,
  discordUserId: string,
  expectedNonce?: string,
): void {
  const current = getActiveBinding(database, discordUserId);
  const nonce = expectedNonce ?? current?.cred_nonce;

  let changes = 0;
  if (nonce) {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'revoked', cred_ciphertext = 'PURGED', cred_nonce = 'PURGED', cred_tag = 'PURGED', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND cred_nonce = ? AND status = 'active'",
      )
      .run(discordUserId, nonce);
    changes = result.changes;
  } else {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'revoked', cred_ciphertext = 'PURGED', cred_nonce = 'PURGED', cred_tag = 'PURGED', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND status = 'active'",
      )
      .run(discordUserId);
    changes = result.changes;
  }

  if (current && nonce) {
    if (changes > 0) {
      deleteDfToken(database, discordUserId);
    }
  } else {
    deleteDfToken(database, discordUserId);
  }

  if (isMongoConnected()) {
    void revokeAccountBindingInMongo(discordUserId, nonce);
  }
}

/**
 * Revoke binding (unlink) bất đồng bộ: MongoDB First -> SQLite Cache.
 * Xử lý conditional update an toàn cho cả MongoDB và SQLite:
 * 1. Khi SQLite conditional UPDATE trả về changes > 0: xóa token legacy và trả về success.
 * 2. Khi changes === 0: đọc lại SQLite binding:
 *    - Nếu có active generation mới hơn: trả về generation_mismatch, không xóa legacy token.
 *    - Nếu bản ghi đã inactive hoặc không tồn tại: xóa token legacy theo hợp đồng idempotent và trả về success.
 */
export async function revokeBindingAsync(
  database: Database.Database,
  discordUserId: string,
  expectedNonce?: string,
): Promise<{ success: boolean; error?: string }> {
  const current = getActiveBinding(database, discordUserId);
  const nonce = expectedNonce ?? current?.cred_nonce;

  // 1. Persistent Store First (MongoDB)
  if (isMongoConnected()) {
    const mongoRes = await revokeAccountBindingInMongo(discordUserId, nonce);
    if (!mongoRes.success) {
      if (mongoRes.reason === 'unavailable') {
        return { success: false, error: 'database_unavailable' };
      }
      if (mongoRes.reason === 'generation_mismatch') {
        return { success: false, error: 'generation_mismatch' };
      }
    }
  }

  // 2. Runtime Cache (SQLite)
  let changes = 0;
  if (nonce) {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'revoked', cred_ciphertext = 'PURGED', cred_nonce = 'PURGED', cred_tag = 'PURGED', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND cred_nonce = ? AND status = 'active'",
      )
      .run(discordUserId, nonce);
    changes = result.changes;
  } else {
    const result = database
      .prepare(
        "UPDATE df_account_bindings SET status = 'revoked', cred_ciphertext = 'PURGED', cred_nonce = 'PURGED', cred_tag = 'PURGED', updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = ? AND status = 'active'",
      )
      .run(discordUserId);
    changes = result.changes;
  }

  // 1. Khi SQLite conditional UPDATE trả về changes > 0:
  //    - Xóa token legacy
  //    - Trả về success
  if (changes > 0) {
    deleteDfToken(database, discordUserId);
    return { success: true };
  }

  // 2. Khi changes === 0:
  //    - Không tự động trả về success
  //    - Đọc lại bản ghi hiện tại trong SQLite
  const latest = database
    .prepare('SELECT * FROM df_account_bindings WHERE discord_user_id = ?')
    .get(discordUserId) as AccountBindingRow | undefined;

  //    - Nếu tồn tại một active generation mới hơn, trả về generation_mismatch
  //    - Tuyệt đối không xóa legacy token của generation mới
  if (latest && latest.status === 'active') {
    return { success: false, error: 'generation_mismatch' };
  }

  //    - Nếu bản ghi đã ở trạng thái inactive (revoked/expired) hoặc không tồn tại (chỉ có legacy token):
  //      xử lý theo hợp đồng idempotent unlink (xóa token legacy nếu có và trả về success)
  deleteDfToken(database, discordUserId);
  return { success: true };
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

  if (isMongoConnected()) {
    void touchLastOkInMongo(discordUserId);
  }
}

/**
 * Đồng bộ active bindings từ MongoDB về SQLite khi bot khởi động trên Railway.
 * Đồng thời chạy reconciliation để dọn các binding active ảo (phantom active).
 */
export async function syncBindingsFromMongoToSqlite(database: Database.Database): Promise<number> {
  if (!isMongoConnected()) return 0;
  const mongoBindings = await loadAllActiveBindingsFromMongo();

  // Nếu Mongo query thất bại hoặc trả về null: tuyệt đối KHÔNG dùng mảng rỗng để reconcile SQLite
  if (mongoBindings === null) {
    logger.warn('Bỏ qua startup sync vì không thể tải dữ liệu active bindings từ MongoDB');
    return 0;
  }

  // 1. Upsert các active binding từ MongoDB vào SQLite cache
  const upsertStmt = database.prepare(`
    INSERT INTO df_account_bindings
      (discord_user_id, openid, cred_nonce, cred_ciphertext, cred_tag, key_version, captured_at, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    ON CONFLICT(discord_user_id) DO UPDATE SET
      openid = excluded.openid,
      cred_nonce = excluded.cred_nonce,
      cred_ciphertext = excluded.cred_ciphertext,
      cred_tag = excluded.cred_tag,
      key_version = excluded.key_version,
      status = 'active',
      captured_at = excluded.captured_at,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= df_account_bindings.updated_at
  `);

  let count = 0;
  const mongoActiveUserIds = new Set<string>();

  for (const b of mongoBindings) {
    mongoActiveUserIds.add(b.discord_user_id);
    const capturedAtStr = b.captured_at
      ? b.captured_at instanceof Date
        ? b.captured_at.toISOString()
        : new Date(b.captured_at).toISOString()
      : new Date().toISOString();
    const updatedAtStr = b.updated_at
      ? b.updated_at instanceof Date
        ? b.updated_at.toISOString()
        : new Date(b.updated_at).toISOString()
      : new Date().toISOString();

    const result = upsertStmt.run(
      b.discord_user_id,
      b.openid,
      b.cred_nonce,
      b.cred_ciphertext,
      b.cred_tag,
      b.key_version || 'v1',
      capturedAtStr,
      updatedAtStr,
    );
    if (result.changes > 0) {
      count++;
    }
  }

  // 2. Reconciliation: Dọn dẹp các binding active trong SQLite nhưng không còn active trên MongoDB.
  // Thực hiện cả khi mongoActiveUserIds rỗng (MongoDB không có active binding nào).
  const sqliteActiveBindings = database
    .prepare("SELECT discord_user_id, cred_nonce FROM df_account_bindings WHERE status = 'active'")
    .all() as Array<{ discord_user_id: string; cred_nonce: string }>;

  const reconcileStmt = database.prepare(`
    UPDATE df_account_bindings
    SET status = 'revoked',
        cred_ciphertext = 'PURGED',
        cred_nonce = 'PURGED',
        cred_tag = 'PURGED',
        updated_at = CURRENT_TIMESTAMP
    WHERE discord_user_id = ? AND cred_nonce = ? AND status = 'active'
  `);

  for (const local of sqliteActiveBindings) {
    if (!mongoActiveUserIds.has(local.discord_user_id)) {
      const res = reconcileStmt.run(local.discord_user_id, local.cred_nonce);
      if (res.changes > 0) {
        deleteDfToken(database, local.discord_user_id);
      }
    }
  }

  return count;
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

/**
 * Migration dọn sạch dữ liệu credential trên các bản ghi đã revoked cũ (Backfill Remediation).
 * Đảm bảo 100% tuân thủ PRIVACY.md và tiêu chí bảo mật của LEGAL.md.
 */
export function purgeRevokedCredentialsMigration(database: Database.Database): number {
  if (!database || ('open' in database && !database.open)) return 0;

  // 1. Tẩy sạch ciphertext của các bản ghi revoked
  const result = database
    .prepare(
      `UPDATE df_account_bindings 
       SET cred_ciphertext = 'PURGED', 
           cred_nonce = 'PURGED', 
           cred_tag = 'PURGED', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE status = 'revoked' AND cred_ciphertext != 'PURGED'`,
    )
    .run();

  // 2. Dọn sạch token legacy của người dùng đã hủy liên kết (status = 'revoked')
  // Tuyệt đối BẢO LƯU token của người dùng legacy hợp lệ (chưa từng chuyển đổi sang df_account_bindings)
  const legacyCleaned = database
    .prepare(
      `DELETE FROM df_tokens 
       WHERE discord_id IN (
         SELECT discord_user_id FROM df_account_bindings WHERE status = 'revoked'
       )`,
    )
    .run();

  if (result.changes > 0 || legacyCleaned.changes > 0) {
    logger.info(
      `[SecurityMigration] Đã tẩy sạch credential của ${result.changes} bản ghi revoked và xóa ${legacyCleaned.changes} token legacy mồ côi`,
    );
  }
  return result.changes;
}
