/**
 * In-memory store cho claim codes (dùng 1 lần, hết hạn sau 10 phút).
 */

import { randomBytes } from 'crypto';

const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // loại trừ ký tự dễ nhầm (I/1, O/0)
const TTL_MS = 10 * 60 * 1000; // 10 phút
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

const store = new Map<string, { discordId: string; expiresAt: number }>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Sinh mã claim 6 ký tự. Nếu trùng → sinh lại (max 10 lần).
 */
function makeCode(): string {
  let attempts = 0;
  while (attempts < 10) {
    const chars = [];
    const buf = randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      chars.push(CODE_CHARS[buf[i] % CODE_CHARS.length]);
    }
    const code = chars.join('');
    if (!store.has(code)) {
      return code;
    }
    attempts++;
  }
  // fallback: dùng timestamp hash (rất hiếm khi đến đây)
  return randomBytes(4).toString('hex').toUpperCase().slice(0, CODE_LENGTH);
}

/**
 * Tạo mã claim mới cho user Discord.
 */
export function generateCode(discordId: string): string {
  // Xóa mã cũ của user nếu còn (1 user = 1 mã tại 1 thời điểm)
  for (const [code, entry] of store.entries()) {
    if (entry.discordId === discordId) {
      store.delete(code);
    }
  }

  const code = makeCode();
  store.set(code, {
    discordId,
    expiresAt: Date.now() + TTL_MS,
  });
  return code;
}

/**
 * Dùng mã claim. Trả về discordId nếu thành công, null nếu mã sai/hết hạn/đã dùng.
 */
export function consumeCode(code: string): string | null {
  const entry = store.get(code);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(code);
    return null;
  }
  // Single-use: xóa ngay sau khi consume
  store.delete(code);
  return entry.discordId;
}

/**
 * Xóa các mã hết hạn.
 */
export function cleanupExpired(): void {
  const now = Date.now();
  for (const [code, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(code);
    }
  }
}

/**
 * Bắt đầu cleanup tự động mỗi 5 phút.
 */
export function startCleanup(): void {
  if (cleanupTimer) {
    return; // đã đang chạy
  }
  cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
}

/**
 * Dừng cleanup timer.
 */
export function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Dọn sạch toàn bộ store (dùng cho test).
 */
export function resetStore(): void {
  stopCleanup();
  store.clear();
}
