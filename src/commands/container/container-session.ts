/**
 * Session store cho container editor.
 * Dùng TTLStore generic abstraction cho Map + TTL + cleanup.
 */

import { ContainerSettings } from '../../types/settings.types.js';
import { CONTAINER_COLORS } from '../../config/container.variables.js';
import {
  CONTAINER_SESSION_TIMEOUT_MS,
  CONTAINER_SESSION_CLEANUP_INTERVAL_MS,
} from '../../config/app.constants.js';
import { TTLStore, type TouchEntry } from '../../utils/ttl-store.js';

/**
 * Color presets cho container accent color picker.
 * Dua tren CONTAINER_COLORS palette.
 */
export const CONTAINER_COLOR_PRESETS = [
  { label: '🟣 Blurple', value: CONTAINER_COLORS.WELCOME },
  { label: '🔴 Red', value: CONTAINER_COLORS.LEAVE },
  { label: '🟢 Green', value: CONTAINER_COLORS.SUCCESS },
  { label: '🟡 Yellow', value: CONTAINER_COLORS.WARNING },
];

/**
 * Interface cho session edit container tam thoi.
 */
export interface ContainerEditSession extends TouchEntry {
  guildId: string;
  type: 'welcome' | 'leave' | 'booster';
  draft: ContainerSettings;
  messageId: string;
  channelId: string;
  createdAt: number;
}

/**
 * TTL-based session store với interface giống Map<string, ContainerEditSession>
 * để backward compatible với các file đã dùng editSessions.get/set/delete().
 */
class SessionStore {
  private readonly store = new TTLStore<string, ContainerEditSession>({
    ttlMs: CONTAINER_SESSION_TIMEOUT_MS,
    cleanupIntervalMs: CONTAINER_SESSION_CLEANUP_INTERVAL_MS,
    name: 'ContainerSessions',
  });

  get size(): number {
    return this.store.size;
  }

  has(userId: string): boolean {
    return this.store.get(userId) !== undefined;
  }

  get(userId: string): ContainerEditSession | undefined {
    return this.store.get(userId);
  }

  set(userId: string, session: ContainerEditSession): void {
    this.store.set(userId, session);
  }

  delete(userId: string): void {
    this.store.delete(userId);
  }

  entries(): IterableIterator<[string, ContainerEditSession]> {
    return this.store.entries();
  }

  clear(): void {
    this.store.clear();
  }

  touch(userId: string): void {
    this.store.touch(userId);
  }

  cleanupExpired(): number {
    return this.store.cleanupExpired();
  }

  startCleanup(): void {
    this.store.startCleanup();
  }

  stopCleanup(): void {
    this.store.stopCleanup();
  }
}

/**
 * In-memory cache lu draft container settings dang edit.
 * Key = userId de moi user co session rieng.
 */
export const editSessions = new SessionStore();

/**
 * Deep clone ContainerSettings de tranh mutate object goi.
 */
export function cloneContainerSettings(settings: ContainerSettings): ContainerSettings {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Kiem tra session co con song khong (chua qua timeout).
 */
export function isSessionValid(
  session: ContainerEditSession | undefined,
): session is ContainerEditSession {
  if (!session) return false;
  const lastActive = session.lastInteractionAt;
  return Date.now() - lastActive < CONTAINER_SESSION_TIMEOUT_MS;
}

/**
 * Tao va lu session edit moi.
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
 * Xoa session edit cua user.
 */
export function deleteSession(userId: string): void {
  editSessions.delete(userId);
}

/**
 * Refresh session timeout khi user tuong tac.
 */
export function touchSession(userId: string): void {
  editSessions.touch(userId);
}

/**
 * Periodic cleanup: xoa cac session da het han khoi Map.
 * chay moi 5 phut, xoa sessions qua 15 phut khong tuong tac.
 */
export function startSessionCleanup(): void {
  editSessions.startCleanup();
}

/**
 * Dung periodic cleanup (dung khi bot shutdown graceful).
 */
export function stopSessionCleanup(): void {
  editSessions.stopCleanup();
}
