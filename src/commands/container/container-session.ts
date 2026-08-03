import { ContainerSettings } from '../../types/settings.types.js';
import { CONTAINER_COLORS } from '../../config/container.variables.js';
import {
  CONTAINER_SESSION_TIMEOUT_MS,
  CONTAINER_SESSION_CLEANUP_INTERVAL_MS,
} from '../../config/app.constants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ContainerSession');

/**
 * Color presets cho container accent color picker.
 * Dựa trên CONTAINER_COLORS palette.
 */
export const CONTAINER_COLOR_PRESETS = [
  { label: '🟣 Blurple', value: CONTAINER_COLORS.WELCOME },
  { label: '🔴 Red', value: CONTAINER_COLORS.LEAVE },
  { label: '🟢 Green', value: CONTAINER_COLORS.SUCCESS },
  { label: '🟡 Yellow', value: CONTAINER_COLORS.WARNING },
];

/**
 * Interface cho session edit container tạm thời.
 * Mỗi user có 1 session riêng để tránh conflict.
 */
export interface ContainerEditSession {
  guildId: string;
  type: 'welcome' | 'leave' | 'booster';
  draft: ContainerSettings;
  messageId: string;
  channelId: string;
  createdAt: number;
  lastInteractionAt: number;
}

/**
 * In-memory cache lưu draft container settings đang edit.
 * Key = userId để mỗi user có session riêng.
 *
 * WHY: Discord button interactions không lưu state giữa các nhấn,
 * nên cần cache tạm để giữ draft cho đến khi Save hoặc Cancel.
 */
export const editSessions = new Map<string, ContainerEditSession>();

// Timeout và cleanup interval được định nghĩa tại app.constants.js

/**
 * Deep clone ContainerSettings để tránh mutate object gốc.
 */
export function cloneContainerSettings(settings: ContainerSettings): ContainerSettings {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Kiểm tra session có còn sống không (chưa quá timeout).
 */
export function isSessionValid(
  session: ContainerEditSession | undefined,
): session is ContainerEditSession {
  if (!session) return false;
  const lastActive = session.lastInteractionAt;
  return Date.now() - lastActive < CONTAINER_SESSION_TIMEOUT_MS;
}

/**
 * Tạo và lưu session edit mới.
 */
export function createSession(
  userId: string,
  guildId: string,
  type: 'welcome' | 'leave' | 'booster',
  draft: ContainerSettings,
  messageId: string,
  channelId: string,
): ContainerEditSession {
  const now = Date.now();
  const session: ContainerEditSession = {
    guildId,
    type,
    draft,
    messageId,
    channelId,
    createdAt: now,
    lastInteractionAt: now,
  };
  editSessions.set(userId, session);
  return session;
}

/**
 * Xóa session edit của user.
 */
export function deleteSession(userId: string): void {
  editSessions.delete(userId);
}

/**
 * Refresh session timeout khi user tương tác.
 */
export function touchSession(userId: string): void {
  const session = editSessions.get(userId);
  if (session) {
    session.lastInteractionAt = Date.now();
  }
}

/**
 * Periodic cleanup: xóa các session đã hết hạn khỏi Map.
 * WHY: Prevent memory leak - Map tích lũy sessions cũ mãi mãi nếu không cleanup.
 * Chạy mỗi 5 phút, xóa sessions quá 15 phút không tương tác.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startSessionCleanup(): void {
  if (cleanupInterval) {
    logger.warn('Session cleanup already running, skipping start.');
    return;
  }
  cleanupInterval = setInterval(() => {
    let cleaned = 0;
    for (const [userId, session] of editSessions.entries()) {
      const expired = Date.now() - session.lastInteractionAt >= CONTAINER_SESSION_TIMEOUT_MS;
      if (expired) {
        editSessions.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info('Cleaned up ' + cleaned + ' expired session(s).');
    }
  }, CONTAINER_SESSION_CLEANUP_INTERVAL_MS);
  logger.info('Started periodic cleanup (every 5 minutes).');
}

/**
 * Dừng periodic cleanup (dùng khi bot shutdown graceful).
 * WHY: Tránh memory leak từ interval timer khi bot restart.
 */
export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Stopped periodic cleanup.');
  }
}
