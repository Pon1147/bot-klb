import Database from 'better-sqlite3';
import {
  GuildSettings,
  WelcomeSettings,
  BoosterSettings,
  TemplateContext,
  ContainerSettings,
} from '../types/settings.types.js';
import {
  loadGuildSettings,
  saveGuildSettings,
  updateGuildSettings,
} from '../database/guild.settings.db.js';
import { buildContainer, BuildContainerResult } from '../utils/container.utils.js';

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
   * Lấy booster settings cụ thể.
   */
  getBooster(guildId: string): BoosterSettings {
    return this.get(guildId).booster;
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
   * Build welcome container V2 cho guild + member cụ thể.
   * Shortcut kết hợp getWelcome + buildContainer.
   */
  buildWelcomeContainer(guildId: string, context: TemplateContext): BuildContainerResult {
    const welcome = this.getWelcome(guildId);
    return this.buildContainer(welcome.container, context, { editType: 'welcome', guildId });
  }

  /**
   * Build booster container V2 cho guild + member cụ thể.
   * Shortcut kết hợp getBooster + buildContainer.
   */
  buildBoosterContainer(guildId: string, context: TemplateContext): BuildContainerResult {
    const booster = this.getBooster(guildId);
    return this.buildContainer(booster.container, context, { editType: 'booster', guildId });
  }

  /**
   * Build Container V2 từ ContainerSettings + TemplateContext.
   * Wrapper cho buildContainer utility.
   */
  buildContainer(
    containerSettings: ContainerSettings,
    context: TemplateContext,
    options?: Parameters<typeof buildContainer>[2],
  ): BuildContainerResult {
    return buildContainer(containerSettings, context, options);
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
