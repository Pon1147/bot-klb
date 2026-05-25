/**
 * Tests cho deepMerge function trong guild.settings.db.
 * Test recursive merge behavior, array replacement, undefined handling.
 *
 * WHY: deepMerge là private function nên cần test qua updateGuildSettings public API.
 */

// ─── Mocks ──────────────────────────────────────────────────────

jest.mock('../src/config/default.settings.js', () => ({
  cloneDefaultSettings: () => ({
    welcome: {
      enabled: true,
      channelId: '#welcome',
      container: {
        accentColor: 0x5865f2,
        contentLines: ['Default welcome'],
        mediaUrl: null,
        showSeparator: true,
      },
    },
    leave: {
      enabled: false,
      channelId: '#logs',
      container: {
        accentColor: 0xed4245,
        contentLines: ['Default leave'],
        mediaUrl: null,
        showSeparator: false,
      },
    },
  }),
}));

jest.mock('../src/config/bot.config.js', () => ({
  botConfig: { databasePath: ':memory:' },
}));

// ─── Import under-test modules ──────────────────────────────────

import Database from 'better-sqlite3';
import {
  initializeSettingsTable,
  loadGuildSettings,
  updateGuildSettings,
  saveGuildSettings,
} from '../src/database/guild.settings.db.js';

// ─── Tests ──────────────────────────────────────────────────────

describe('Guild Settings DB - deepMerge', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSettingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  // ─── updateGuildSettings (deepMerge) ─────────────────────────

  describe('updateGuildSettings (deepMerge)', () => {
    it('should merge partial settings into existing settings', () => {
      // Load default settings first
      const defaults = loadGuildSettings(db, 'guild_1');
      expect(defaults.welcome.enabled).toBe(true);

      // Update only welcome.channelId
      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: { channelId: '#new-welcome' },
      });

      // ChannelId should be updated
      expect(updated.welcome.channelId).toBe('#new-welcome');
      // Other fields should be preserved
      expect(updated.welcome.enabled).toBe(true);
      expect(updated.welcome.container.accentColor).toBe(0x5865f2);
    });

    it('should deep merge nested objects (recursive)', () => {
      loadGuildSettings(db, 'guild_1');

      // Update only container.accentColor (nested 2 levels deep)
      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: {
          container: { accentColor: 0xff0000 },
        },
      });

      // Nested field should be updated
      expect(updated.welcome.container.accentColor).toBe(0xff0000);
      // Other nested fields should be preserved
      expect(updated.welcome.container.contentLines).toEqual(['Default welcome']);
      expect(updated.welcome.container.showSeparator).toBe(true);
    });

    it('should replace arrays completely (not merge element-by-element)', () => {
      loadGuildSettings(db, 'guild_1');

      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: {
          container: { contentLines: ['New line 1', 'New line 2'] },
        },
      });

      // Array should be replaced, not merged
      expect(updated.welcome.container.contentLines).toEqual(['New line 1', 'New line 2']);
      expect(updated.welcome.container.contentLines).toHaveLength(2);
    });

    it('should handle undefined values (skip them)', () => {
      loadGuildSettings(db, 'guild_1');

      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: {
          channelId: '#test',
          // enabled is undefined → should keep original value
        },
      });

      expect(updated.welcome.channelId).toBe('#test');
      expect(updated.welcome.enabled).toBe(true); // preserved
    });

    it('should handle null values (overwrite with null)', () => {
      loadGuildSettings(db, 'guild_1');

      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: {
          container: { mediaUrl: 'https://example.com/img.png' },
        },
      });
      expect(updated.welcome.container.mediaUrl).toBe('https://example.com/img.png');

      // Now set to null
      const updated2 = updateGuildSettings(db, 'guild_1', {
        welcome: {
          container: { mediaUrl: null },
        },
      });
      expect(updated2.welcome.container.mediaUrl).toBeNull();
    });

    it('should preserve unrelated guild settings', () => {
      loadGuildSettings(db, 'guild_1');

      // Update only welcome settings
      updateGuildSettings(db, 'guild_1', {
        welcome: { enabled: false },
      });

      const loaded = loadGuildSettings(db, 'guild_1');
      // Welcome should be updated
      expect(loaded.welcome.enabled).toBe(false);
      // Leave should be untouched
      expect(loaded.leave.enabled).toBe(false);
      expect(loaded.leave.channelId).toBe('#logs');
    });

    it('should support deep nested updates (3+ levels)', () => {
      loadGuildSettings(db, 'guild_1');

      // Test recursive merge with multiple levels
      const updated = updateGuildSettings(db, 'guild_1', {
        welcome: {
          container: {
            accentColor: 0x00ff00,
            showSeparator: false,
          },
        },
      });

      expect(updated.welcome.container.accentColor).toBe(0x00ff00);
      expect(updated.welcome.container.showSeparator).toBe(false);
      // contentLines should still be preserved
      expect(updated.welcome.container.contentLines).toEqual(['Default welcome']);
    });
  });

  // ─── loadGuildSettings ───────────────────────────────────────

  describe('loadGuildSettings', () => {
    it('should return default settings for new guild', () => {
      const settings = loadGuildSettings(db, 'new_guild');
      expect(settings.welcome.enabled).toBe(true);
      expect(settings.leave.enabled).toBe(false);
    });

    it('should return saved settings for existing guild', () => {
      loadGuildSettings(db, 'guild_1');
      updateGuildSettings(db, 'guild_1', { welcome: { enabled: false } });

      const loaded = loadGuildSettings(db, 'guild_1');
      expect(loaded.welcome.enabled).toBe(false);
    });
  });

  // ─── saveGuildSettings ───────────────────────────────────────

  describe('saveGuildSettings', () => {
    it('should save and load settings correctly', () => {
      const settings = loadGuildSettings(db, 'guild_1');
      settings.welcome.enabled = false;
      saveGuildSettings(db, 'guild_1', settings);

      const loaded = loadGuildSettings(db, 'guild_1');
      expect(loaded.welcome.enabled).toBe(false);
    });
  });
});

describe('Guild Settings DB - JSON corruption handling', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSettingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should fallback to defaults when JSON is corrupted', () => {
    // Insert corrupted JSON directly
    db.prepare(
      'INSERT OR REPLACE INTO guild_settings (guild_id, settings_json) VALUES (?, ?)'
    ).run('corrupt_guild', '{ invalid json }');

    // Load should not throw and should return defaults
    const settings = loadGuildSettings(db, 'corrupt_guild');
    expect(settings.welcome.enabled).toBe(true); // default value
  });
});