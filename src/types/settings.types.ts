import { GuildMember, Guild } from 'discord.js';

/**
 * Container V2 settings - sử dụng Components V2 (Section, TextDisplay, MediaGallery, Separator).
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
 * Welcome feature settings - chỉ dùng Container V2.
 */
export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
  container: ContainerSettings;
}

/**
 * Leave feature settings - chỉ dùng Container V2.
 */
export interface LeaveSettings {
  enabled: boolean;
  channelId: string | null;
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
