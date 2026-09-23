/**
 * In-memory store cho claim codes (dùng 1 lần, hết hạn sau 10 phút).
 * Dùng TTLStore generic abstraction cho Map + TTL + cleanup.
 */

import { randomBytes } from 'crypto';
import Database from 'better-sqlite3';
import { TTLStore } from '../utils/ttl-store.js';
import { createClaimSession, invalidateUserClaims } from '../database/df-claim.db.js';
import {
  CLAIM_CODE_TTL_MS,
  CLAIM_CODE_CLEANUP_INTERVAL_MS,
  MAX_CODE_GENERATION_ATTEMPTS,
} from '../config/app.constants.js';

const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // loại trừ ky tu de nhuan (I/1, O/0)

interface ClaimEntry {
  discordId: string;
  expiresAt: number;
}

const store = new TTLStore<string, ClaimEntry>({
  ttlMs: CLAIM_CODE_TTL_MS,
  cleanupIntervalMs: CLAIM_CODE_CLEANUP_INTERVAL_MS,
  name: 'ClaimCodes',
});

/**
 * Sinh ma claim 6 ky tu. Neu trung → sinh lai (max 10 lan).
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
  // fallback: dung timestamp hash (rat hiem khi den day)
  return randomBytes(4).toString('hex').toUpperCase().slice(0, CODE_LENGTH);
}

/**
 * Tao ma claim moi cho user Discord.
 */
export function generateCode(database: Database.Database, discordId: string): string {
  // Invalidate old claim sessions trong DB (tránh dùng code cũ sau khi start mới)
  invalidateUserClaims(database, discordId);

  // Xoa ma cuo cua user neu con (1 user = 1 ma tai 1 thoi diem)
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
 * Bat dau cleanup tu dong moi 5 phut.
 */
export function startCleanup(): void {
  store.startCleanup();
}

/**
 * Dung ma claim. Tra ve discordId neu thanh cong, null neu ma sai/het han/da dung.
 */
export function consumeCode(code: string): string | null {
  const entry = store.get(code);
  if (!entry) {
    return null;
  }
  // Single-use: xoa ngay sau khi consume
  store.delete(code);
  return entry.discordId;
}

/**
 * Xoa cac ma het han (de tiep muc de tuong thich voi code cu).
 */
export function cleanupExpired(): void {
  store.cleanupExpired();
}

/**
 * Dung cleanup timer.
 */
export function stopCleanup(): void {
  store.stopCleanup();
}

/**
 * Don sach toan bo store (dung cho test).
 */
export function resetStore(): void {
  stopCleanup();
  store.clear();
}
