import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { botConfig } from '../config/bot.config.js';

/**
 * Interface cho welcome message configuration lưu trong database.
 */
export interface WelcomeConfiguration {
  guildId: string;
  channelId: string | null;
  roleId: string | null;
  messageTemplate: string | null;
  embedImageUrl: string | null;
  isEnabled: boolean;
}

/**
 * Ensure the directory for the database file exists.
 * Creates the directory recursively if it does not exist.
 */
export function ensureDatabaseDirectory(databaseFilePath: string): void {
  const directoryPath = path.dirname(databaseFilePath);
  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

/**
 * Initialize SQLite database and create tables if they don't exist.
 */
export function initializeDatabase(): Database.Database {
  ensureDatabaseDirectory(botConfig.databasePath);

  const database = new Database(botConfig.databasePath);
  database.pragma('journal_mode = WAL');

  database.exec(`
    CREATE TABLE IF NOT EXISTS welcome_configuration (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      role_id TEXT,
      message_template TEXT,
      embed_image_url TEXT,
      is_enabled INTEGER DEFAULT 1
    )
  `);

  return database;
}

/**
 * Lấy welcome configuration cho guild. Trả về default nếu chưa có.
 */
export function getWelcomeConfiguration(
  database: Database.Database,
  guildIdentifier: string,
): WelcomeConfiguration {
  const result = database
    .prepare('SELECT * FROM welcome_configuration WHERE guild_id = ?')
    .get(guildIdentifier) as
    | {
        guild_id: string;
        channel_id: string | null;
        role_id: string | null;
        message_template: string | null;
        embed_image_url: string | null;
        is_enabled: number;
      }
    | undefined;

  if (result) {
    return {
      guildId: result.guild_id,
      channelId: result.channel_id,
      roleId: result.role_id,
      messageTemplate: result.message_template,
      embedImageUrl: result.embed_image_url,
      isEnabled: Boolean(result.is_enabled),
    };
  }

  return {
    guildId: guildIdentifier,
    channelId: botConfig.welcomeChannelId,
    roleId: botConfig.welcomeRoleId,
    messageTemplate: null,
    embedImageUrl: null,
    isEnabled: true,
  };
}

/**
 * Lưu hoặc cập nhật welcome configuration cho guild.
 */
export function saveWelcomeConfiguration(
  database: Database.Database,
  configuration: WelcomeConfiguration,
): void {
  database
    .prepare(
      'INSERT OR REPLACE INTO welcome_configuration (guild_id, channel_id, role_id, message_template, embed_image_url, is_enabled) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      configuration.guildId,
      configuration.channelId,
      configuration.roleId,
      configuration.messageTemplate,
      configuration.embedImageUrl,
      configuration.isEnabled ? 1 : 0,
    );
}

/**
 * Bật/tắt welcome message cho guild.
 */
export function toggleWelcomeEnabled(
  database: Database.Database,
  guildIdentifier: string,
  enabledStatus: boolean,
): void {
  database
    .prepare('UPDATE welcome_configuration SET is_enabled = ? WHERE guild_id = ?')
    .run(enabledStatus ? 1 : 0, guildIdentifier);
}
