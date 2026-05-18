import { GuildMember, Guild } from 'discord.js';

/**
 * Cấu trúc embed settings có thể custom từ DB.
 * Mỗi field hỗ trợ template variables như {member}, {guild}...
 */
export interface EmbedFieldSettings {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedSettings {
  title: string;
  description: string;
  color: number | string;
  thumbnail: boolean;
  footer: string;
  fields: EmbedFieldSettings[];
}

/**
 * Welcome feature settings.
 */
export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  embed: EmbedSettings;
}

/**
 * Leave feature settings (mở rộng tương lai).
 */
export interface LeaveSettings {
  enabled: boolean;
  channelId: string | null;
  embed: EmbedSettings;
}

/**
 * Toàn bộ settings của 1 guild.
 * Thêm feature mới chỉ cần add key vào interface này + default.
 */
export interface GuildSettings {
  welcome: WelcomeSettings;
  leave: LeaveSettings;
}

/**
 * Context dùng để resolve template variables.
 */
export interface TemplateContext {
  member: GuildMember;
  guild: Guild;
}

/**
 * Shape trả về từ DB (raw row).
 */
export interface RawGuildSettingsRow {
  guild_id: string;
  settings_json: string;
  updated_at: string;
}