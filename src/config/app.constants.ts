/**
 * Constants dùng chung cho toàn bộ ứng dụng.
 * Tách riêng từ các magic strings/numbers trong codebase.
 */

// ===== Message Templates =====
export const VOICE_CHANNEL_FULL_MESSAGE = 'Phòng thoại đã đầy (99 người).';
export const INVALID_TOKEN_MESSAGE =
  'Format token không hợp lệ. Token phải là chuỗi hex (40-64 ký tự).';
export const INVALID_CLAIM_MESSAGE =
  'Mã claim không hợp lệ hoặc đã hết hạn. Hãy dùng /df-link start để nhận mã mới.';
export const SESSION_EXPIRED_MESSAGE = 'Session đã hết hạn. Dùng `/team-find` để bắt đầu lại.';
export const CONTAINER_SESSION_EXPIRED_MESSAGE =
  'Session edit đã hết hạn. Vui lòng bắt đầu lại với /container edit.';

// ===== Timeouts (ms) =====
export const CLAIM_CODE_TTL_MS = 10 * 60 * 1000; // 10 phút
export const CLAIM_CODE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

export const TEAM_FIND_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút
export const CONTAINER_SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút
export const CONTAINER_SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
export const TEAM_FIND_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

// ===== Limits =====
export const MAX_HISTORY_PAGE = 20;
export const MAX_HISTORY_LIMIT = 10;
export const MAX_CONTAINER_TEXT_LENGTH = 4_000;
export const MAX_VOICE_MEMBERS = 99;
export const MAX_CODE_GENERATION_ATTEMPTS = 10;

// ===== Avatars =====
export const DEFAULT_AVATAR_SIZE = 128;
export const EMBED_AVATAR_SIZE = 256;

// ===== Mock Data =====
export const MOCK_USER_TAG = 'MockUser#0000';
export const MOCK_USER_NAME = 'MockUser';
export const DEFAULT_DISCORD_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

// ===== Media =====
export const MEDIA_URL_PLACEHOLDER = 'https://example.com/image.gif hoặc attachment://file.gif';
export const ATTACHMENT_PROTOCOL_PREFIX = 'attachment://';

// ===== Token Validation =====
export const TOKEN_REGEX = /^[0-9a-f]{40,64}$/i;
