/**
 * Unit tests cho section-config.handlers.ts — getConfig, getBoosterConfig, getWelcomeConfig.
 */

jest.mock('../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => ({
    getSettings: jest.fn(() => ({
      welcome: { enabled: true, channelId: 'ch-1', roleId: 'role-1' },
      booster: { enabled: false, channelId: null, roleId: null },
    })),
    update: jest.fn(),
    getWelcome: jest.fn(),
    getBooster: jest.fn(),
  })),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildSuccessContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
  buildTextOnlyContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
  buildErrorContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
}));

jest.mock('discord.js', () => ({
  MessageFlags: { Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 0x8 },
}));

describe('section-config — getConfig', () => {
  it('nên trả về config không đổi', () => {
    const { getConfig } = require('../src/utils/section-config.handlers.js');
    const config = {
      sectionKey: 'welcome',
      displayName: 'Welcome',
      statusEmoji: '✅',
      statusColor: 0x5865f2,
    };
    const result = getConfig(config);
    expect(result).toBe(config);
  });
});

describe('section-config — getBoosterConfig, getWelcomeConfig', () => {
  it('nên trả về booster config (line 43)', () => {
    const { getBoosterConfig } = require('../src/utils/section-config.handlers.js');
    const config = getBoosterConfig();
    expect(config.sectionKey).toBe('booster');
    expect(config.displayName).toBe('Booster');
  });

  it('nên trả về welcome config (line 47)', () => {
    const { getWelcomeConfig } = require('../src/utils/section-config.handlers.js');
    const config = getWelcomeConfig();
    expect(config.sectionKey).toBe('welcome');
    expect(config.displayName).toBe('Welcome');
  });
});
