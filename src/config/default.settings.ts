import { GuildSettings } from '../types/settings.types.js';
import { embedColors } from '../utils/embed.utils.js';

/**
 * Default settings cho mọi guild mới.
 * Khi guild chưa có row trong DB, SettingsService sẽ fallback về đây.
 *
 * Thêm/sửa default → chỉ cần chỉnh file này, không động vào DB schema.
 */
export const defaultGuildSettings: GuildSettings = {
  welcome: {
    enabled: true,
    channelId: null,
    roleId: null,
    embed: {
      title: 'Welcome {member}!',
      description:
        'Chào mừng đến với {guild}!\n\nVui lòng đọc quy tắc và tận hưởng!',
      color: embedColors.welcome,
      thumbnail: true,
      footer: 'Welcome Bot',
      fields: [
        { name: 'Tài khoản tạo', value: '{accountCreationDate}', inline: true },
        { name: 'Ngày tham gia', value: '{serverJoiningDate}', inline: true },
        { name: 'So member', value: '{memberCount}', inline: true },
      ],
    },
  },
  leave: {
    enabled: false,
    channelId: null,
    embed: {
      title: '{member} da ri server.',
      description: 'Chuc {member} tot lanh!',
      color: embedColors.leave,
      thumbnail: true,
      footer: 'Leave Bot',
      fields: [],
    },
  },
};

/**
 * Deep clone default settings de tranh mutate.
 */
export function cloneDefaultSettings(): GuildSettings {
  return JSON.parse(JSON.stringify(defaultGuildSettings));
}