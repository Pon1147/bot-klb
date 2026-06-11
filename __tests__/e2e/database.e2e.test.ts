/**
 * Database E2E tests — real better-sqlite3 with :memory: database.
 * Tests all three tables: welcome_configuration, guild_settings, df_tokens.
 * No mocking — pure SQLite operations.
 */

import Database from 'better-sqlite3';
import { createTestDb, seedDfToken, seedGuildSettings, seedWelcomeConfig } from './setup.js';
import type { GuildSettings } from '../../src/types/settings.types.js';

type DbRow = Record<string, unknown>;

/* ==================== df_tokens ==================== */

describe('Database E2E — df_tokens', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('saveDfToken / getDfToken', () => {
    it('phải roundtrip lưu và lấy token', () => {
      seedDfToken(db, 'discord-123', 'openid-1', 'token-abc', '123', 'sig-1', 'user-1');

      const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-123');
      expect(row).toBeDefined();
      expect((row as DbRow).discord_id).toBe('discord-123');
      expect((row as DbRow).openid).toBe('openid-1');
      expect((row as DbRow).token).toBe('token-abc');
      expect((row as DbRow).ts).toBe('123');
      expect((row as DbRow).s).toBe('sig-1');
      expect((row as DbRow).u).toBe('user-1');
      expect((row as DbRow).linked_at).toBeDefined();
    });

    it('phải lưu token mà không có ts/s/u', () => {
      seedDfToken(db, 'discord-456', 'openid-2', 'token-xyz');

      const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-456');
      expect(row).toBeDefined();
      expect((row as DbRow).ts).toBeNull();
      expect((row as DbRow).s).toBeNull();
      expect((row as DbRow).u).toBeNull();
    });

    it('phải UPSERT khi discord_id trùng', () => {
      seedDfToken(db, 'discord-123', 'openid-old', 'token-old');
      seedDfToken(db, 'discord-123', 'openid-new', 'token-new', '999', 'sig-new', 'u-new');

      const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-123');
      expect((row as DbRow).openid).toBe('openid-new');
      expect((row as DbRow).token).toBe('token-new');
      expect((row as DbRow).ts).toBe('999');

      const count = db.prepare('SELECT COUNT(*) as c FROM df_tokens').get() as { c: number };
      expect(count.c).toBe(1);
    });
  });

  describe('touchDfToken', () => {
    it('phải cập nhật last_used_at', () => {
      seedDfToken(db, 'discord-123', 'openid-1', 'token-1');

      const before = db.prepare('SELECT last_used_at FROM df_tokens WHERE discord_id = ?').get('discord-123');
      expect((before as DbRow).last_used_at).toBeNull();

      db.prepare('UPDATE df_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE discord_id = ?').run('discord-123');

      const after = db.prepare('SELECT last_used_at FROM df_tokens WHERE discord_id = ?').get('discord-123');
      expect((after as DbRow).last_used_at).toBeDefined();
      expect((after as DbRow).last_used_at).not.toBeNull();
    });
  });

  describe('deleteDfToken', () => {
    it('phải xóa row theo discord_id', () => {
      seedDfToken(db, 'discord-123', 'openid-1', 'token-1');
      seedDfToken(db, 'discord-456', 'openid-2', 'token-2');

      db.prepare('DELETE FROM df_tokens WHERE discord_id = ?').run('discord-123');

      expect(db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-123')).toBeUndefined();
      expect(db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('discord-456')).toBeDefined();
    });
  });
});

/* ==================== welcome_configuration ==================== */

describe('Database E2E — welcome_configuration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('save / get welcome config', () => {
    it('phải lưu và lấy cấu hình welcome', () => {
      seedWelcomeConfig(db, 'guild-1', 'ch-welcome', 'role-welcome', true);

      const row = db.prepare('SELECT * FROM welcome_configuration WHERE guild_id = ?').get('guild-1');
      expect((row as DbRow).guild_id).toBe('guild-1');
      expect((row as DbRow).channel_id).toBe('ch-welcome');
      expect((row as DbRow).role_id).toBe('role-welcome');
      expect((row as DbRow).is_enabled).toBe(1);
    });

    it('phải UPSERT khi guild_id trùng', () => {
      seedWelcomeConfig(db, 'guild-1', 'ch-old', 'role-old', true);
      seedWelcomeConfig(db, 'guild-1', 'ch-new', 'role-new', false);

      const row = db.prepare('SELECT * FROM welcome_configuration WHERE guild_id = ?').get('guild-1');
      expect((row as DbRow).channel_id).toBe('ch-new');
      expect((row as DbRow).is_enabled).toBe(0);
    });
  });

  describe('toggle welcome enabled', () => {
    it('phải flip is_enabled', () => {
      seedWelcomeConfig(db, 'guild-1', 'ch-1', null, true);

      db.prepare('UPDATE welcome_configuration SET is_enabled = ? WHERE guild_id = ?').run(0, 'guild-1');

      const row = db.prepare('SELECT is_enabled FROM welcome_configuration WHERE guild_id = ?').get('guild-1');
      expect((row as DbRow).is_enabled).toBe(0);
    });
  });

  describe('default config fallback', () => {
    it('phải trả về undefined khi chưa có cấu hình', () => {
      const row = db.prepare('SELECT * FROM welcome_configuration WHERE guild_id = ?').get('guild-new');
      expect(row).toBeUndefined();
    });
  });
});

/* ==================== guild_settings ==================== */

describe('Database E2E — guild_settings', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('save / load guild settings', () => {
    it('phải lưu và lấy settings JSON', () => {
      const settings: GuildSettings = {
        welcome: {
          enabled: true,
          channelId: 'ch-welcome',
          roleId: 'role-welcome',
          container: {
            accentColor: 0x5865f2,
            headerTemplate: '## Xin chào {username}!',
            contentLines: ['Dòng 1', 'Dòng 2'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: true,
          },
        },
        leave: {
          enabled: false,
          channelId: null,
          container: {
            accentColor: 0xff0000,
            headerTemplate: null,
            contentLines: [],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: false,
          },
        },
        booster: {
          enabled: false,
          channelId: null,
          roleId: null,
          container: {
            accentColor: 0xfb663a,
            headerTemplate: null,
            contentLines: [],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: false,
          },
        },
      };

      seedGuildSettings(db, 'guild-1', settings);

      const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-1');
      expect(row).toBeDefined();
      const parsed = JSON.parse((row as DbRow).settings_json) as GuildSettings;
      expect(parsed.welcome.channelId).toBe('ch-welcome');
      expect(parsed.welcome.container.accentColor).toBe(0x5865f2);
      expect(parsed.welcome.container.contentLines).toEqual(['Dòng 1', 'Dòng 2']);
    });

    it('phải trả về undefined khi guild chưa có settings', () => {
      const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-nonexistent');
      expect(row).toBeUndefined();
    });
  });

  describe('corrupt JSON handling', () => {
    it('phải lưu JSON bị hỏng vào DB', () => {
      db.prepare(`
        INSERT INTO guild_settings (guild_id, settings_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run('guild-corrupt', 'NOT VALID JSON{{{');

      const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-corrupt');
      expect((row as DbRow).settings_json).toBe('NOT VALID JSON{{{');

      let parseError = false;
      try {
        JSON.parse((row as DbRow).settings_json);
      } catch {
        parseError = true;
      }
      expect(parseError).toBe(true);
    });
  });
});

/* ==================== Multiple tables in one DB ==================== */

describe('Database E2E — integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('phải hỗ trợ nhiều bảng cùng lúc', () => {
    seedDfToken(db, 'user-1', 'openid-1', 'token-1');
    seedWelcomeConfig(db, 'guild-1', 'ch-1', 'role-1');

    const settings: GuildSettings = {
      welcome: { enabled: true, channelId: 'ch-1', roleId: 'role-1', container: { accentColor: 0x5865f2, headerTemplate: '## Hello', contentLines: ['Line'], mediaUrl: null, mediaDescription: null, showSeparator: true } },
      leave: { enabled: false, channelId: null, container: { accentColor: 0xff0000, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false } },
      booster: { enabled: false, channelId: null, roleId: null, container: { accentColor: 0xfb663a, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false } },
    };
    seedGuildSettings(db, 'guild-1', settings);

    const dfCount = db.prepare('SELECT COUNT(*) as c FROM df_tokens').get() as { c: number };
    const wcCount = db.prepare('SELECT COUNT(*) as c FROM welcome_configuration').get() as { c: number };
    const gsCount = db.prepare('SELECT COUNT(*) as c FROM guild_settings').get() as { c: number };

    expect(dfCount.c).toBe(1);
    expect(wcCount.c).toBe(1);
    expect(gsCount.c).toBe(1);
  });

  it('phải hỗ trợ truy vấn đồng bộ (better-sqlite3 là sync)', () => {
    seedDfToken(db, 'user-1', 'o1', 't1');
    seedDfToken(db, 'user-2', 'o2', 't2');
    seedDfToken(db, 'user-3', 'o3', 't3');

    const rows = db.prepare('SELECT * FROM df_tokens').all() as Array<DbRow>;
    expect(rows.length).toBe(3);

    db.prepare('UPDATE df_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE discord_id = ?').run('user-2');

    const updated = db.prepare('SELECT last_used_at FROM df_tokens WHERE discord_id = ?').get('user-2');
    expect((updated as DbRow).last_used_at).toBeDefined();
  });
});
