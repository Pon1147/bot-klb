/**
 * In-memory store cho claim codes (dùng 1 lần, hết hạn sau 10 phút).
 * Dùng TTLStore generic abstraction cho Map + TTL + cleanup.
 */

import { randomBytes } from 'crypto';
import Database from 'better-sqlite3';
import { TTLStore } from '../utils/ttl-store.js';
import {
  createClaimSession,
  invalidateUserClaims,
  cleanupExpiredClaimSessions,
} from '../database/df-claim.db.js';
import {
  CLAIM_CODE_TTL_MS,
  CLAIM_CODE_CLEANUP_INTERVAL_MS,
  MAX_CODE_GENERATION_ATTEMPTS,
} from '../config/app.constants.js';

const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // loại trừ ký tự dễ nhầm (I/1, O/0)

interface ClaimEntry {
  discordId: string;
  expiresAt: number;
}

let claimDb: Database.Database | null = null;
let dbCleanupInterval: NodeJS.Timeout | null = null;
let cleanupInProgress: Promise<number> | null = null;

/**
 * Thiết lập kết nối SQLite database phục vụ dọn dẹp các session claim hết hạn.
 */
export function setClaimDatabase(database: Database.Database): void {
  claimDb = database;
}

// TTLStore quản lý pure in-memory RAM
const store = new TTLStore<string, ClaimEntry>({
  ttlMs: CLAIM_CODE_TTL_MS,
  cleanupIntervalMs: CLAIM_CODE_CLEANUP_INTERVAL_MS,
  name: 'ClaimCodes',
});

/**
 * Chạy dọn dẹp database nền có tracking in-flight operation để shutdown an toàn.
 */
async function runDbCleanup(): Promise<number> {
  if (!claimDb || ('open' in claimDb && !claimDb.open)) return 0;
  if (cleanupInProgress) return cleanupInProgress;

  let currentCleanup: Promise<number> | null = null;
  currentCleanup = (async () => {
    await Promise.resolve();
    try {
      return cleanupExpiredClaimSessions(claimDb, 7);
    } catch {
      return 0;
    } finally {
      if (cleanupInProgress === currentCleanup) {
        cleanupInProgress = null;
      }
    }
  })();

  cleanupInProgress = currentCleanup;
  return currentCleanup;
}

/**
 * Sinh mã claim 6 ký tự. Nếu trùng -> sinh lại (max 10 lần).
 */
function makeCode(): string {
  let attempts = 0;
  while (attempts < MAX_CODE_GENERATION_ATTEMPTS) {
    const chars: string[] = [];
    const buf = randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      chars.push(CODE_CHARS[buf[i] % CODE_CHARS.length]);
    }
    const code = chars.join('');
    if (!store.get(code as string)) {
      return code;
    }
    attempts++;
  }
  // fallback: dùng timestamp hash
  return randomBytes(4).toString('hex').toUpperCase().slice(0, CODE_LENGTH);
}

/**
 * Tạo mã claim mới cho user Discord.
 */
export function generateCode(database: Database.Database, discordId: string): string {
  if (!claimDb) {
    claimDb = database;
  }

  // Invalidate old claim sessions trong DB (tránh dùng code cũ sau khi start mới)
  invalidateUserClaims(database, discordId);

  // Xóa mã cũ của user nếu còn (1 user = 1 mã tại 1 thời điểm)
  for (const [code, entry] of store.entries()) {
    if (entry.discordId === discordId) {
      store.delete(code);
    }
  }

  const code = makeCode();
  const expiresAt = Date.now() + CLAIM_CODE_TTL_MS;
  store.set(code as string, {
    discordId,
    expiresAt,
  });

  // Lưu vào DB để atomicConsumeClaim tìm thấy
  createClaimSession(database, code, discordId, expiresAt);

  return code;
}

/**
 * Bắt đầu cleanup tự động mỗi 5 phút (RAM qua TTLStore và SQLite qua interval riêng).
 */
export function startCleanup(database?: Database.Database): void {
  if (database) {
    claimDb = database;
  }
  store.startCleanup();
  if (!dbCleanupInterval) {
    dbCleanupInterval = setInterval(() => {
      void runDbCleanup();
    }, CLAIM_CODE_CLEANUP_INTERVAL_MS);
  }
}

/**
 * Dùng mã claim. Trả về discordId nếu thành công, null nếu mã sai/hết hạn/đã dùng.
 */
export function consumeCode(code: string): string | null {
  const entry = store.get(code);
  if (!entry) {
    return null;
  }
  // Single-use: xóa ngay sau khi consume
  store.delete(code);
  return entry.discordId;
}

/**
 * Xóa các mã hết hạn (dọn RAM và SQLite đúng 1 lần với maxAgeDays chỉ định).
 */
export function cleanupExpired(database?: Database.Database, maxAgeDays?: number): void {
  if (database) {
    claimDb = database;
  }
  store.cleanupExpired();
  if (claimDb && (!('open' in claimDb) || claimDb.open)) {
    try {
      cleanupExpiredClaimSessions(claimDb, maxAgeDays);
    } catch {
      // Bỏ qua lỗi DB trong cleanup
    }
  }
}

/**
 * Dừng cleanup timer và chờ callback đang chạy hoàn tất (Graceful shutdown coordination).
 */
export async function stopCleanup(): Promise<void> {
  store.stopCleanup();
  if (dbCleanupInterval) {
    clearInterval(dbCleanupInterval);
    dbCleanupInterval = null;
  }
  if (cleanupInProgress) {
    await cleanupInProgress;
    cleanupInProgress = null;
  }
}

/**
 * Dọn sạch toàn bộ store (dùng cho test).
 */
export async function resetStore(): Promise<void> {
  store.clear();
  claimDb = null;
  cleanupInProgress = null;
  await stopCleanup();
}

export { cleanupExpiredClaimSessions } from '../database/df-claim.db.js';
