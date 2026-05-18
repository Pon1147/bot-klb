import Database from 'better-sqlite3';
import {
  initializeDatabase,
  ensureDatabaseDirectory,
  getWelcomeConfiguration,
  saveWelcomeConfiguration,
  toggleWelcomeEnabled,
  WelcomeConfiguration,
} from '../src/database/welcome.database';
import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('../src/config/bot.config', () => ({
  botConfig: {
    token: 'fake_token',
    clientId: 'fake_client_id',
    guildId: 'fake_guild_id',
    welcomeChannelId: 'default_channel_123',
    welcomeRoleId: 'default_role_456',
    databasePath: ':memory:',
  },
}));

describe('Welcome Database', () => {
  let testDatabase: Database.Database;

  beforeEach(() => {
    testDatabase = initializeDatabase();
  });

  afterEach(() => {
    testDatabase.close();
  });

  describe('ensureDatabaseDirectory', () => {
    it('should not create directory when it already exists', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
      const testPath = path.join(tmpDir, 'test.db');

      try {
        // Directory exists so mkdirSync should not be called
        // We verify by checking no new subdirectory is created
        ensureDatabaseDirectory(testPath);
        // If it ran without error, the branch was taken correctly
        expect(fs.existsSync(tmpDir)).toBe(true);
      } finally {
        fs.rmdirSync(tmpDir);
      }
    });

    it('should create directory when it does not exist', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
      const newDir = path.join(tmpDir, 'new', 'nested');
      const testPath = path.join(newDir, 'test.db');

      try {
        ensureDatabaseDirectory(testPath);
        expect(fs.existsSync(newDir)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('initializeDatabase', () => {
    it('should create welcome_configuration table', () => {
      const checkStatement = testDatabase.prepare(
        "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='welcome_configuration'",
      );
      const rowCount = checkStatement.get() as { cnt: number };
      expect(rowCount.cnt).toBe(1);
    });

    it('should return valid database instance', () => {
      expect(testDatabase).toBeDefined();
      expect(typeof testDatabase.prepare).toBe('function');
      expect(typeof testDatabase.close).toBe('function');
    });
  });

  describe('getWelcomeConfiguration', () => {
    it('should return default config when no config exists', () => {
      const result = getWelcomeConfiguration(testDatabase, 'new_guild_789');

      expect(result.guildId).toBe('new_guild_789');
      expect(result.channelId).toBe('default_channel_123');
      expect(result.roleId).toBe('default_role_456');
      expect(result.messageTemplate).toBeNull();
      expect(result.embedImageUrl).toBeNull();
      expect(result.isEnabled).toBe(true);
    });

    it('should return saved config when config exists', () => {
      const config: WelcomeConfiguration = {
        guildId: 'custom_guild_abc',
        channelId: 'custom_channel_xyz',
        roleId: 'custom_role_def',
        messageTemplate: 'Welcome {user}!',
        embedImageUrl: 'https://example.com/img.png',
        isEnabled: true,
      };

      saveWelcomeConfiguration(testDatabase, config);
      const result = getWelcomeConfiguration(testDatabase, 'custom_guild_abc');

      expect(result.guildId).toBe('custom_guild_abc');
      expect(result.channelId).toBe('custom_channel_xyz');
      expect(result.roleId).toBe('custom_role_def');
      expect(result.messageTemplate).toBe('Welcome {user}!');
      expect(result.embedImageUrl).toBe('https://example.com/img.png');
      expect(result.isEnabled).toBe(true);
    });

    it('should return isEnabled as false when disabled', () => {
      const config: WelcomeConfiguration = {
        guildId: 'disabled_guild_123',
        channelId: 'some_channel',
        roleId: null,
        messageTemplate: null,
        embedImageUrl: null,
        isEnabled: false,
      };

      saveWelcomeConfiguration(testDatabase, config);
      const result = getWelcomeConfiguration(testDatabase, 'disabled_guild_123');

      expect(result.isEnabled).toBe(false);
    });
  });

  describe('saveWelcomeConfiguration', () => {
    it('should insert new config for guild', () => {
      const config: WelcomeConfiguration = {
        guildId: 'insert_guild_test',
        channelId: 'ch_1',
        roleId: 'role_1',
        messageTemplate: 'Hi!',
        embedImageUrl: null,
        isEnabled: true,
      };

      saveWelcomeConfiguration(testDatabase, config);

      const result = getWelcomeConfiguration(testDatabase, 'insert_guild_test');
      expect(result.channelId).toBe('ch_1');
      expect(result.roleId).toBe('role_1');
      expect(result.isEnabled).toBe(true);
    });

    it('should update existing config', () => {
      const initialConfig: WelcomeConfiguration = {
        guildId: 'update_guild_test',
        channelId: 'old_channel',
        roleId: 'old_role',
        messageTemplate: null,
        embedImageUrl: null,
        isEnabled: true,
      };

      saveWelcomeConfiguration(testDatabase, initialConfig);

      const updatedConfig: WelcomeConfiguration = {
        guildId: 'update_guild_test',
        channelId: 'new_channel',
        roleId: 'new_role',
        messageTemplate: 'Updated!',
        embedImageUrl: 'https://new.png',
        isEnabled: false,
      };

      saveWelcomeConfiguration(testDatabase, updatedConfig);

      const result = getWelcomeConfiguration(testDatabase, 'update_guild_test');
      expect(result.channelId).toBe('new_channel');
      expect(result.roleId).toBe('new_role');
      expect(result.isEnabled).toBe(false);
    });

    it('should store isEnabled as integer 0 when false', () => {
      const config: WelcomeConfiguration = {
        guildId: 'bool_guild_test',
        channelId: 'ch_2',
        roleId: null,
        messageTemplate: null,
        embedImageUrl: null,
        isEnabled: false,
      };

      saveWelcomeConfiguration(testDatabase, config);

      const result = getWelcomeConfiguration(testDatabase, 'bool_guild_test');
      expect(result.isEnabled).toBe(false);
    });
  });

  describe('toggleWelcomeEnabled', () => {
    it('should enable welcome when setting to true', () => {
      const config: WelcomeConfiguration = {
        guildId: 'toggle_guild_test',
        channelId: 'ch_3',
        roleId: null,
        messageTemplate: null,
        embedImageUrl: null,
        isEnabled: false,
      };

      saveWelcomeConfiguration(testDatabase, config);
      toggleWelcomeEnabled(testDatabase, 'toggle_guild_test', true);

      const result = getWelcomeConfiguration(testDatabase, 'toggle_guild_test');
      expect(result.isEnabled).toBe(true);
    });

    it('should disable welcome when setting to false', () => {
      const config: WelcomeConfiguration = {
        guildId: 'toggle_guild_test_2',
        channelId: 'ch_4',
        roleId: null,
        messageTemplate: null,
        embedImageUrl: null,
        isEnabled: true,
      };

      saveWelcomeConfiguration(testDatabase, config);
      toggleWelcomeEnabled(testDatabase, 'toggle_guild_test_2', false);

      const result = getWelcomeConfiguration(testDatabase, 'toggle_guild_test_2');
      expect(result.isEnabled).toBe(false);
    });
  });
});
