/**
 * Config Loading E2E — bot.config.ts.
 * Tests environment variable loading with real code.
 * Mocks dotenv to prevent .env file from overriding test env vars.
 */

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Config Loading E2E — bot.config.ts', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...savedEnv };
  });

  afterEach(() => {
    delete process.env.BOT_TOKEN;
    delete process.env.CLIENT_ID;
    delete process.env.GUILD_ID;
    delete process.env.WELCOME_CHANNEL_ID;
    delete process.env.WELCOME_ROLE_ID;
    delete process.env.DATABASE_PATH;
    process.env = { ...savedEnv };
  });

  describe('Required env vars', () => {
    it('phải load botConfig thành công khi có đủ biến môi trường', () => {
      process.env.BOT_TOKEN = 'test-token-123';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';

      const { botConfig } = require('../../src/config/bot.config');

      expect(botConfig.token).toBe('test-token-123');
      expect(botConfig.clientId).toBe('test-client-id');
      expect(botConfig.guildId).toBe('test-guild-id');
    });

    it('phải throw khi thiếu BOT_TOKEN', () => {
      delete process.env.BOT_TOKEN;
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';

      expect(() => {
        require('../../src/config/bot.config');
      }).toThrow('Missing required environment variable: BOT_TOKEN');
    });

    it('phải throw khi thiếu CLIENT_ID', () => {
      process.env.BOT_TOKEN = 'test-token-123';
      delete process.env.CLIENT_ID;
      process.env.GUILD_ID = 'test-guild-id';

      expect(() => {
        require('../../src/config/bot.config');
      }).toThrow('Missing required environment variable: CLIENT_ID');
    });

    it('phải throw khi thiếu GUILD_ID', () => {
      process.env.BOT_TOKEN = 'test-token-123';
      process.env.CLIENT_ID = 'test-client-id';
      delete process.env.GUILD_ID;

      expect(() => {
        require('../../src/config/bot.config');
      }).toThrow('Missing required environment variable: GUILD_ID');
    });
  });

  describe('Optional env vars', () => {
    beforeEach(() => {
      process.env.BOT_TOKEN = 'test-token-123';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
    });

    it('phải áp dụng defaults khi biến tùy chọn chưa set', () => {
      delete process.env.WELCOME_CHANNEL_ID;
      delete process.env.WELCOME_ROLE_ID;
      delete process.env.DATABASE_PATH;

      const { botConfig } = require('../../src/config/bot.config');

      expect(botConfig.welcomeChannelId).toBeNull();
      expect(botConfig.welcomeRoleId).toBeNull();
      expect(botConfig.databasePath).toBe('./data/bot.db');
    });

    it('phải tôn trọng giá trị tùy chọn khi được set', () => {
      process.env.WELCOME_CHANNEL_ID = 'custom-channel';
      process.env.WELCOME_ROLE_ID = 'custom-role';
      process.env.DATABASE_PATH = './custom/path/bot.db';

      const { botConfig } = require('../../src/config/bot.config');

      expect(botConfig.welcomeChannelId).toBe('custom-channel');
      expect(botConfig.welcomeRoleId).toBe('custom-role');
      expect(botConfig.databasePath).toBe('./custom/path/bot.db');
    });
  });
});
