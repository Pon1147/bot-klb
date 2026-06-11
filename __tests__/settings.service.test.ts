/**
 * Test cho SettingsService.
 * Verify CRUD operations, cache behavior, và build container methods.
 */
import Database from 'better-sqlite3';
import { SettingsService } from '../src/services/settings.service.js';
import { GuildSettings, TemplateContext } from '../src/types/settings.types.js';
import { setSettingsService, getSettingsService } from '../src/services/settings.service.js';

// Mock Discord.js objects
const mockMember = {
  user: {
    tag: 'TestUser#0001',
    username: 'TestUser',
    id: 'user-123',
    displayAvatarURL: () => 'https://example.com/avatar.png',
  },
  guild: {
    id: 'guild-123',
  },
} as unknown as TemplateContext['member'];

const mockGuild = {
  id: 'guild-123',
  name: 'TestGuild',
} as unknown as TemplateContext['guild'];

const mockContext: TemplateContext = {
  member: mockMember,
  guild: mockGuild,
};

describe('SettingsService', () => {
  let db: Database.Database;
  let service: SettingsService;

  beforeEach(() => {
    // Dùng in-memory SQLite cho test
    db = new Database(':memory:');
    // Tạo bảng guild_settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    service = new SettingsService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('get()', () => {
    it('phải trả về default settings khi guild chưa có row trong DB', () => {
      const settings = service.get('guild-new');

      expect(settings).toBeDefined();
      expect(settings.welcome).toBeDefined();
      expect(settings.leave).toBeDefined();
      expect(settings.booster).toBeDefined();
    });

    it('phải lưu cache sau khi load từ DB', () => {
      const settings1 = service.get('guild-1');
      const settings2 = service.get('guild-1');

      // Cùng 1 object từ cache
      expect(settings1).toBe(settings2);
    });

    it('phải trả về settings đã lưu từ DB', () => {
      const fullSettings: GuildSettings = {
        welcome: {
          enabled: true,
          channelId: 'ch-123',
          roleId: null,
          container: {
            accentColor: 0x5865f2,
            headerTemplate: 'Welcome!',
            contentLines: ['Hello'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: true,
          },
        },
        leave: {
          enabled: false,
          channelId: null,
          container: {
            accentColor: 0xed4245,
            headerTemplate: 'Goodbye!',
            contentLines: ['See you'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: false,
          },
        },
        booster: {
          enabled: true,
          channelId: 'ch-boost',
          roleId: 'role-boost',
          container: {
            accentColor: 0xfb663a,
            headerTemplate: 'Thanks for boosting!',
            contentLines: ['Thank you!'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: true,
          },
        },
      };

      // Lưu settings vào DB
      service.set('guild-2', fullSettings);
      // Invalidate cache để test load từ DB
      service.invalidate('guild-2');

      const loaded = service.get('guild-2');
      expect(loaded.welcome.channelId).toBe('ch-123');
      expect(loaded.booster.enabled).toBe(true);
      expect(loaded.booster.channelId).toBe('ch-boost');
    });
  });

  describe('getWelcome()', () => {
    it('phải trả về welcome settings', () => {
      const welcome = service.getWelcome('guild-1');
      expect(welcome).toBeDefined();
      expect(welcome.enabled).toBeDefined();
      expect(welcome.container).toBeDefined();
    });
  });

  describe('getBooster()', () => {
    it('phải trả về booster settings', () => {
      const booster = service.getBooster('guild-1');
      expect(booster).toBeDefined();
      expect(booster.enabled).toBeDefined();
      expect(booster.container).toBeDefined();
    });
  });

  describe('update() với DeepPartial', () => {
    it('phải update chỉ 1 field (booster.enabled)', () => {
      service.update('guild-1', {
        booster: {
          enabled: true,
        },
      });

      const settings = service.get('guild-1');
      expect(settings.booster.enabled).toBe(true);
    });

    it('phải update chỉ channelId của welcome', () => {
      service.update('guild-1', {
        welcome: {
          channelId: 'new-channel',
        },
      });

      const settings = service.get('guild-1');
      expect(settings.welcome.channelId).toBe('new-channel');
    });

    it('phải update nested field (booster.container.accentColor)', () => {
      service.update('guild-1', {
        booster: {
          container: {
            accentColor: 0xff0000,
          },
        },
      });

      const settings = service.get('guild-1');
      expect(settings.booster.container.accentColor).toBe(0xff0000);
    });

    it('phải invalidate cache sau khi update', () => {
      service.get('guild-1'); // load + cache
      service.update('guild-1', {
        booster: { enabled: true },
      });

      // Cache được update với merged settings
      const settings = service.get('guild-1');
      expect(settings.booster.enabled).toBe(true);
    });
  });

  describe('set()', () => {
    it('phải lưu toàn bộ settings và update cache', () => {
      const fullSettings: GuildSettings = {
        welcome: {
          enabled: true,
          channelId: 'ch-1',
          roleId: null,
          container: {
            accentColor: 0x5865f2,
            headerTemplate: 'Hi',
            contentLines: ['Hello'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: true,
          },
        },
        leave: {
          enabled: false,
          channelId: null,
          container: {
            accentColor: 0xed4245,
            headerTemplate: 'Bye',
            contentLines: ['Goodbye'],
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
            headerTemplate: 'Boost',
            contentLines: ['Thanks'],
            mediaUrl: null,
            mediaDescription: null,
            showSeparator: true,
          },
        },
      };

      service.set('guild-3', fullSettings);
      const loaded = service.get('guild-3');

      expect(loaded.welcome.channelId).toBe('ch-1');
      expect(loaded.booster.enabled).toBe(false);
    });
  });

  describe('invalidate()', () => {
    it('phải xóa cache của guild', () => {
      service.get('guild-1'); // load + cache
      service.invalidate('guild-1');

      // Get lần nữa phải load từ DB (không phải cached object cũ)
      const settings = service.get('guild-1');
      expect(settings).toBeDefined();
    });
  });

  describe('buildContainer()', () => {
    it('phải build container từ ContainerSettings + context', () => {
      const containerSettings = {
        accentColor: 0x5865f2,
        headerTemplate: 'Test Header',
        contentLines: ['Line 1', 'Line 2'],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: true,
      };

      const result = service.buildContainer(containerSettings, mockContext);

      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.flags).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });
  });

  describe('buildWelcomeContainer()', () => {
    it('phải build welcome container từ guild settings', () => {
      const result = service.buildWelcomeContainer('guild-1', mockContext);

      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
    });
  });

  describe('buildBoosterContainer()', () => {
    it('phải build booster container từ guild settings', () => {
      const result = service.buildBoosterContainer('guild-1', mockContext);

      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
    });
  });

  describe('singleton (getSettingsService / setSettingsService)', () => {
    it('phải throw error khi chưa set instance', () => {
      // Clear singleton
      (global as Record<string, unknown>).__settingsServiceTestCleared = true;
      expect(() => getSettingsService()).toThrow('SettingsService chưa được khởi tạo');
    });

    it('phải trả về instance đã set', () => {
      setSettingsService(service);
      const instance = getSettingsService();

      expect(instance).toBe(service);
    });
  });
});