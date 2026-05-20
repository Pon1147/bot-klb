import { ContainerSettings } from '../../types/settings.types.js';
import { CONTAINER_COLORS } from '../../config/container.variables.js';

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
  type: 'welcome' | 'leave';
  draft: ContainerSettings;
  messageId: string;
  channelId: string;
  createdAt: number;
}

/**
 * In-memory cache lưu draft container settings đang edit.
 * Key = userId để mỗi user có session riêng.
 *
 * WHY: Discord button interactions không lưu state giữa các nhấn,
 * nên cần cache tạm để giữ draft cho đến khi Save hoặc Cancel.
 */
export const editSessions = new Map<string, ContainerEditSession>();

/**
 * Thời gian sống tối đa của 1 session (15 phút = 900000ms).
 * Discord giới hạn interaction timeout là 15 phút.
 */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

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
  return Date.now() - session.createdAt < SESSION_TIMEOUT_MS;
}

/**
 * Tạo và lưu session edit mới.
 */
export function createSession(
  userId: string,
  guildId: string,
  type: 'welcome' | 'leave',
  draft: ContainerSettings,
  messageId: string,
  channelId: string,
): ContainerEditSession {
  const session: ContainerEditSession = {
    guildId,
    type,
    draft,
    messageId,
    channelId,
    createdAt: Date.now(),
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
