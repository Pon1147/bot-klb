import { GuildSettings } from '../types/settings.types.js';
import { embedColors, WELCOME_EMBED_DEFAULTS, LEAVE_EMBED_DEFAULTS } from './embed.variables.js';
import { WELCOME_CONTAINER_DEFAULTS, LEAVE_CONTAINER_DEFAULTS } from './container.variables.js';

/**
 * Default settings cho mọi guild mới.
 * Khi guild chưa có row trong DB, SettingsService sẽ fallback về đây.
 *
 * Thêm/sửa default → chỉ cần chỉnh file embed.variables.js, không động vào file này.
 */
export const defaultGuildSettings: GuildSettings = {
  welcome: {
    enabled: true,
    channelId: null,
    roleId: null,
    embed: {
      title: WELCOME_EMBED_DEFAULTS.TITLE,
      description: WELCOME_EMBED_DEFAULTS.DESCRIPTION,
      color: embedColors.welcome,
      thumbnail: WELCOME_EMBED_DEFAULTS.THUMBNAIL,
      image: WELCOME_EMBED_DEFAULTS.IMAGE,
      footer: WELCOME_EMBED_DEFAULTS.FOOTER,
      footerIcon: WELCOME_EMBED_DEFAULTS.FOOTER_ICON,
      url: WELCOME_EMBED_DEFAULTS.URL,
      timestamp: WELCOME_EMBED_DEFAULTS.TIMESTAMP,
      fields: WELCOME_EMBED_DEFAULTS.FIELDS as unknown as Array<{
        name: string;
        value: string;
        inline: boolean;
      }>,
    },
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
    embed: {
      title: LEAVE_EMBED_DEFAULTS.TITLE,
      description: LEAVE_EMBED_DEFAULTS.DESCRIPTION,
      color: embedColors.leave,
      thumbnail: LEAVE_EMBED_DEFAULTS.THUMBNAIL,
      image: LEAVE_EMBED_DEFAULTS.IMAGE,
      footer: LEAVE_EMBED_DEFAULTS.FOOTER,
      footerIcon: LEAVE_EMBED_DEFAULTS.FOOTER_ICON,
      url: LEAVE_EMBED_DEFAULTS.URL,
      timestamp: LEAVE_EMBED_DEFAULTS.TIMESTAMP,
      fields: LEAVE_EMBED_DEFAULTS.FIELDS as unknown as Array<{
        name: string;
        value: string;
        inline: boolean;
      }>,
    },
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
