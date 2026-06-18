/**
 * In-memory session store for team-find select menu flow.
 * Tracks user's Map/Mode/Rank selections until Done is clicked.
 */

export interface TeamFindSession {
  guildId: string;
  userId: string;
  messageId: string;
  channelId: string;
  map: string | null;
  mode: string | null;
  rank: string | null;
  lastInteractionAt: number;
}

const sessions = new Map<string, TeamFindSession>();
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function key(userId: string): string {
  return userId;
}

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
  sessions.set(key(userId), session);
  return session;
}

export function getSession(userId: string): TeamFindSession | undefined {
  const s = sessions.get(key(userId));
  if (s && Date.now() - s.lastInteractionAt > SESSION_TIMEOUT_MS) {
    sessions.delete(key(userId));
    return undefined;
  }
  return s;
}

export function updateSelection(
  userId: string,
  field: 'map' | 'mode' | 'rank',
  value: string,
): void {
  const s = sessions.get(key(userId));
  if (s) {
    s[field] = value;
    s.lastInteractionAt = Date.now();
  }
}

export function deleteSession(userId: string): void {
  sessions.delete(key(userId));
}

export function isDone(session: TeamFindSession): boolean {
  return session.map !== null && session.mode !== null;
}

/** Cleanup expired sessions */
export function cleanup(): void {
  for (const [k, s] of sessions.entries()) {
    if (Date.now() - s.lastInteractionAt > SESSION_TIMEOUT_MS) {
      sessions.delete(k);
    }
  }
}
