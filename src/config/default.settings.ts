import { GuildSettings } from '../types/settings.types.js';
import { WELCOME_CONTAINER_DEFAULTS, LEAVE_CONTAINER_DEFAULTS } from './container.variables.js';

/**
 * Default settings cho mọi guild mới.
 * Khi guild chưa có row trong DB, SettingsService sẽ fallback về đây.
 *
 * Thêm/sửa default → chỉ cần chỉnh file container.variables.js, không động vào file này.
 */
export const defaultGuildSettings: GuildSettings = {
  welcome: {
    enabled: true,
    channelId: null,
    roleId: null,
    container: {
      accentColor: WELCOME_CONTAINER_DEFAULTS.ACCENT_COLOR,
      contentLines: [...WELCOME_CONTAINER_DEFAULTS.CONTENT_LINES],
      mediaUrl: WELCOME_CONTAINER_DEFAULTS.MEDIA_URL,
      mediaDescription: WELCOME_CONTAINER_DEFAULTS.MEDIA_DESCRIPTION,
      showSeparator: WELCOME_CONTAINER_DEFAULTS.SHOW_SEPARATOR,
      files: [...WELCOME_CONTAINER_DEFAULTS.FILES],
    },
  },
  leave: {
    enabled: false,
    channelId: null,
    container: {
      accentColor: LEAVE_CONTAINER_DEFAULTS.ACCENT_COLOR,
      contentLines: [...LEAVE_CONTAINER_DEFAULTS.CONTENT_LINES],
      mediaUrl: LEAVE_CONTAINER_DEFAULTS.MEDIA_URL,
      mediaDescription: LEAVE_CONTAINER_DEFAULTS.MEDIA_DESCRIPTION,
      showSeparator: LEAVE_CONTAINER_DEFAULTS.SHOW_SEPARATOR,
      files: [...LEAVE_CONTAINER_DEFAULTS.FILES],
    },
  },
};

/**
 * Deep clone default settings de tranh mutate.
 */
export function cloneDefaultSettings(): GuildSettings {
  return JSON.parse(JSON.stringify(defaultGuildSettings));
}
