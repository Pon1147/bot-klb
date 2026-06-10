/**
 * Shared E2E test setup — real better-sqlite3, no mocking of DB.
 * Creates in-memory databases with all tables initialized.
 */

import Database from 'better-sqlite3';
import type { GuildSettings } from '../../src/types/settings.types.js';

/**
 * Create a fresh in-memory SQLite database with all tables.
 * Avoids importing bot.config.ts (which throws on missing env vars).
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  // welcome_configuration table
  db.exec(`
    CREATE TABLE welcome_configuration (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      role_id TEXT,
      message_template TEXT,
      embed_image_url TEXT,
      is_enabled INTEGER DEFAULT 1
    )
  `);

  // guild_settings table
  db.exec(`
    CREATE TABLE guild_settings (
      guild_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // df_tokens table
  db.exec(`
    CREATE TABLE df_tokens (
      discord_id TEXT PRIMARY KEY,
      openid TEXT NOT NULL,
      token TEXT NOT NULL,
      ts TEXT,
      s TEXT,
      u TEXT,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME
    )
  `);

  return db;
}

/**
 * Seed a df_tokens row for testing.
 */
export function seedDfToken(
  db: Database.Database,
  discordId: string,
  openid: string = 'test-openid',
  token: string = 'test-token',
  ts?: string,
  s?: string,
  u?: string,
): void {
  db.prepare(
    'INSERT OR REPLACE INTO df_tokens (discord_id, openid, token, ts, s, u, linked_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)',
  ).run(discordId, openid, token, ts ?? null, s ?? null, u ?? null);
}

/**
 * Seed a guild_settings row for testing.
 */
export function seedGuildSettings(
  db: Database.Database,
  guildId: string,
  settings: GuildSettings,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO guild_settings (guild_id, settings_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(guildId, JSON.stringify(settings));
}

/**
 * Seed a welcome_configuration row for testing.
 */
export function seedWelcomeConfig(
  db: Database.Database,
  guildId: string,
  channelId: string | null = 'channel-welcome',
  roleId: string | null = 'role-welcome',
  isEnabled: boolean = true,
): void {
  db.prepare(
    'INSERT OR REPLACE INTO welcome_configuration (guild_id, channel_id, role_id, message_template, embed_image_url, is_enabled) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(guildId, channelId, roleId, null, null, isEnabled ? 1 : 0);
}
