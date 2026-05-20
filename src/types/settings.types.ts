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
  thumbnail: boolean | string; // true = avatar member, hoặc URL custom
  image: string | null; // URL ảnh lớn hiển thị trong embed
  footer: string;
  footerIcon: string | null; // URL icon cho footer
  url: string | null; // Link cho embed title
  timestamp: boolean; // Hiện/ẩn timestamp
  fields: EmbedFieldSettings[];
}

/**
 * Container V2 settings - sử dụng Components V2 (ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder).
 * Thay thế EmbedBuilder bằng hệ thống Container mới của Discord.
 *
 * - accentColor: màu sidebar container (hex number như 0x5865F2)
 * - contentLines: mảng string markdown cho TextDisplay (hỗ trợ mention, channel link...)
 * - mediaUrl: URL GIF/ảnh cho MediaGallery (hoặc attachment://filename)
 * - mediaDescription: alt text cho media (accessibility)
 * - showSeparator: hiện/ẩn đường ngăn cách giữa TextDisplay và Media
 * - files: mảng local paths hoặc attachment names để gửi kèm
 */
export interface ContainerSettings {
  accentColor: number;
  contentLines: string[];
  mediaUrl: string | null;
  mediaDescription: string | null;
  showSeparator: boolean;
  files?: string[];
}

/**
 * Welcome feature settings.
 */
export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  embed: EmbedSettings;
  /** Container V2 settings (thay thế embed trong tương lai) */
  container: ContainerSettings;
}

/**
 * Leave feature settings (mở rộng tương lai).
 */
export interface LeaveSettings {
  enabled: boolean;
  channelId: string | null;
  embed: EmbedSettings;
  /** Container V2 settings (thay thế embed trong tương lai) */
  container: ContainerSettings;
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
