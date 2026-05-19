import Database from 'better-sqlite3';
import { EmbedBuilder } from 'discord.js';
import {
  GuildSettings,
  WelcomeSettings,
  TemplateContext,
  EmbedSettings,
} from '../types/settings.types.js';
import {
  loadGuildSettings,
  saveGuildSettings,
  updateGuildSettings,
} from '../database/guild.settings.db.js';
import { resolveTemplate } from '../utils/template.utils.js';

/**
 * DeepPartial - làm optional tất cả cấp độ nested.
 * Cho phép update chỉ 1 field con mà không cần pass toàn bộ object.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * SettingsService - Single Source of Truth cho tất cả settings của guilds.
 *
 * Trách nhiệm:
 * - Load settings từ DB (fallback default)
 * - In-memory cache để giảm query DB
 * - Update partial settings
 * - Build embed từ settings + context
 */
export class SettingsService {
  private cache = new Map<string, GuildSettings>();
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  /**
   * Lấy settings của guild.
   * Ưu tiên cache → nếu không có → load từ DB → lưu cache.
   */
  get(guildId: string): GuildSettings {
    const cached = this.cache.get(guildId);
    if (cached) {
      return cached;
    }

    const settings = loadGuildSettings(this.database, guildId);
    this.cache.set(guildId, settings);
    return settings;
  }

  /**
   * Lấy welcome settings cụ thể.
   */
  getWelcome(guildId: string): WelcomeSettings {
    return this.get(guildId).welcome;
  }

  /**
   * Cập nhật partial settings cho guild.
   * Tự động invalidate cache sau khi lưu.
   * Accept DeepPartial → chỉ cần pass các field muốn thay đổi.
   */
  update(guildId: string, partial: DeepPartial<GuildSettings>): GuildSettings {
    const merged = updateGuildSettings(this.database, guildId, partial);
    this.cache.set(guildId, merged);
    return merged;
  }

  /**
   * Lưu toàn bộ settings (thay thế hoàn toàn).
   */
  set(guildId: string, settings: GuildSettings): void {
    saveGuildSettings(this.database, guildId, settings);
    this.cache.set(guildId, settings);
  }

  /**
   * Invalidate cache của guild (dùng khi muốn reload từ DB).
   */
  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  /**
   * Build EmbedBuilder từ embed settings + template context.
   * Đây là hàm chính thay thế buildWelcomeEmbed cũ.
   * Hỗ trợ đầy đủ Rich Embed: image, footerIcon, url, timestamp.
   */
  buildEmbed(embedSettings: EmbedSettings, context: TemplateContext): EmbedBuilder {
    const { member } = context;

    const embed = new EmbedBuilder()
      .setTitle(resolveTemplate(embedSettings.title, context))
      .setDescription(resolveTemplate(embedSettings.description, context))
      .setColor(this.parseColor(embedSettings.color));

    // Timestamp (tùy chọn, mặc định false)
    if (embedSettings.timestamp) {
      embed.setTimestamp();
    }

    // Footer (với icon tùy chọn)
    if (embedSettings.footer) {
      const footerText = resolveTemplate(embedSettings.footer, context);
      const footerIconUrl = embedSettings.footerIcon
        ? resolveTemplate(embedSettings.footerIcon, context)
        : undefined;
      embed.setFooter({ text: footerText, iconURL: footerIconUrl });
    }

    // Thumbnail: true = avatar member, string = URL custom
    if (embedSettings.thumbnail) {
      const thumbnailUrl = typeof embedSettings.thumbnail === 'string'
        ? resolveTemplate(embedSettings.thumbnail, context)
        : member.user.displayAvatarURL({ size: 256 });
      embed.setThumbnail(thumbnailUrl);
    }

    // Image: URL ảnh lớn hiển thị trong embed
    if (embedSettings.image) {
      embed.setImage(resolveTemplate(embedSettings.image, context));
    }

    // URL: link cho embed title
    if (embedSettings.url) {
      embed.setURL(resolveTemplate(embedSettings.url, context));
    }

    // Fields
    for (const field of embedSettings.fields) {
      embed.addFields({
        name: resolveTemplate(field.name, context),
        value: resolveTemplate(field.value, context),
        inline: field.inline,
      });
    }

    return embed;
  }

  /**
   * Build welcome embed cho guild + member cụ thể.
   * Shortcut kết hợp getWelcome + buildEmbed.
   */
  buildWelcomeEmbed(guildId: string, context: TemplateContext): EmbedBuilder {
    const welcome = this.getWelcome(guildId);
    return this.buildEmbed(welcome.embed, context);
  }

  /**
   * Parse color từ number hoặc hex string.
   */
  private parseColor(color: number | string): number {
    if (typeof color === 'number') {
      return color;
    }
    // Hex string: "#00FF00" → 0x00FF00
    const hex = color.replace('#', '');
    return parseInt(hex, 16);
  }
}

/**
 * Singleton instance (được set khi bootstrap).
 */
let _instance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!_instance) {
    throw new Error('SettingsService chưa được khởi tạo. Kiểm tra index.ts bootstrap.');
  }
  return _instance;
}

export function setSettingsService(instance: SettingsService): void {
  _instance = instance;
}