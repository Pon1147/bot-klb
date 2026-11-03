/**
 * In-memory session store for team-find select menu flow.
 * Tracks user's Map/Mode/Rank selections until Done is clicked.
 * Dùng TTLStore generic abstraction cho Map + TTL + cleanup.
 */

import type { MapKey } from '../config/team-find.config.js';
import { TTLStore, type TouchEntry } from '../utils/ttl-store.js';
import { TEAM_FIND_SESSION_TIMEOUT_MS } from '../config/app.constants.js';

export interface TeamFindSession extends TouchEntry {
  guildId: string;
  userId: string;
  messageId: string;
  channelId: string;
  map: MapKey | null;
  mode: string | null;
  rank: string | null;
}

const sessions = new TTLStore<string, TeamFindSession>({
  ttlMs: TEAM_FIND_SESSION_TIMEOUT_MS,
  cleanupIntervalMs: TEAM_FIND_SESSION_TIMEOUT_MS,
  name: 'TeamFindSessions',
});

export function createSession(
  userId: string,
  guildId: string,
  messageId: string,
  channelId: string,
): TeamFindSession {
  const session: TeamFindSession = {
    guildId,
    userId,
    messageId,
    channelId,
    map: null,
    mode: null,
    rank: null,
    lastInteractionAt: Date.now(),
  };
  sessions.set(userId, session);
  return session;
}

export function getSession(userId: string): TeamFindSession | undefined {
  return sessions.get(userId);
}

export function updateSelection(userId: string, field: 'map', value: MapKey): void;
export function updateSelection(userId: string, field: 'mode' | 'rank', value: string): void;
export function updateSelection(
  userId: string,
  field: 'map' | 'mode' | 'rank',
  value: string | MapKey,
): void {
  const s = sessions.get(userId);
  if (s) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any)[field] = value;
    s.lastInteractionAt = Date.now();
    sessions.touch(userId);
  }
}

export function deleteSession(userId: string): void {
  sessions.delete(userId);
}

export function isDone(session: TeamFindSession): boolean {
  return session.map !== null && session.mode !== null;
}

/** Bắt đầu định kỳ dọn dẹp sessions qua TTLStore */
export function startSessionCleanup(): void {
  sessions.startCleanup();
}

/** Dừng định kỳ dọn dẹp sessions */
export function stopSessionCleanup(): void {
  sessions.stopCleanup();
}

/** Xóa tất cả sessions (dùng cho test) */
export function _clearSessionsForTest(): void {
  sessions.clear();
}
