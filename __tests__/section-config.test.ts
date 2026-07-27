/**
 * Unit tests cho section-config.handlers.ts — getConfig, getBoosterConfig, getWelcomeConfig.
 */

// Shared mock instance
const mockSettingsService = {
  get: jest.fn((guildId: string) => ({
    welcome: { enabled: true, channelId: 'ch-1', roleId: 'role-1' },
    booster: { enabled: false, channelId: null, roleId: null },
  })),
  update: jest.fn(),
  getWelcome: jest.fn(),
  getBooster: jest.fn(),
};

jest.mock('../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildSuccessContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
  buildTextOnlyContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
  buildErrorContainer: jest.fn(() => ({ toJSON: () => ({}), flags: 65536 })),
}));

jest.mock('discord.js', () => {
  class SlashCommandBuilder {
    constructor() { this._name = ''; this._desc = ''; this._options = []; }
    setName(n) { this._name = n; return this; }
    setDescription(d) { this._desc = d; return this; }
    addSubcommand(fn) { fn({ setName() { return this; }, setDescription() { return this; }, addStringOption() { return this; }, addChannelOption() { return this; }, addRoleOption() { return this; }, addBooleanOption() { return this; } }); this._options.push({ type: 1 }); return this; }
    toJSON() { return { name: this._name, description: this._desc, options: this._options }; }
  }
  return {
    MessageFlags: { Ephemeral: 64 },
    PermissionFlagsBits: { Administrator: 0x8 },
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder: class {},
  };
});

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

// ─── Handler tests ────────────────────────────────────────────────

const mockReply = jest.fn();
const mockInteraction = {
  guild: { id: 'guild-1' },
  options: {
    getChannel: jest.fn(),
    getRole: jest.fn(),
    getBoolean: jest.fn(),
    getSubcommand: jest.fn(),
  },
  reply: mockReply,
  replied: false,
  deferred: false,
};

describe('section-config — handleSectionSetChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInteraction.options.getChannel.mockReturnValue({ id: 'channel-123', name: 'test-channel' });
  });

  it('nên gọi settingsService.update với channelId', async () => {
    const { handleSectionSetChannel, getWelcomeConfig } = require('../src/utils/section-config.handlers.js');
    await handleSectionSetChannel(mockInteraction, 'guild-1', getWelcomeConfig());
    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
      welcome: { channelId: 'channel-123' },
    });
    expect(mockReply).toHaveBeenCalled();
  });
});

describe('section-config — handleSectionSetRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInteraction.options.getRole.mockReturnValue({ id: 'role-123', name: 'TestRole' });
  });

  it('nên gọi settingsService.update với roleId', async () => {
    const { handleSectionSetRole, getBoosterConfig } = require('../src/utils/section-config.handlers.js');
    await handleSectionSetRole(mockInteraction, 'guild-1', getBoosterConfig());
    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
      booster: { roleId: 'role-123' },
    });
    expect(mockReply).toHaveBeenCalled();
  });
});

describe('section-config — handleSectionToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInteraction.options.getBoolean.mockReturnValue(true);
  });

  it('nên gọi settingsService.update với enabled=true', async () => {
    const { handleSectionToggle, getWelcomeConfig } = require('../src/utils/section-config.handlers.js');
    await handleSectionToggle(mockInteraction, 'guild-1', getWelcomeConfig());
    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
      welcome: { enabled: true },
    });
    expect(mockReply).toHaveBeenCalled();
  });

  it('nên gọi settingsService.update với enabled=false', async () => {
    mockInteraction.options.getBoolean.mockReturnValue(false);
    const { handleSectionToggle, getWelcomeConfig } = require('../src/utils/section-config.handlers.js');
    await handleSectionToggle(mockInteraction, 'guild-1', getWelcomeConfig());
    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
      welcome: { enabled: false },
    });
  });
});

describe('section-config — handleSectionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên reply với status content', async () => {
    const { handleSectionStatus, getBoosterConfig } = require('../src/utils/section-config.handlers.js');
    await handleSectionStatus(mockInteraction, 'guild-1', getBoosterConfig());
    expect(mockReply).toHaveBeenCalled();
    const replyArgs = mockReply.mock.calls[0][0];
    expect(replyArgs.components).toBeDefined();
  });
});

describe('section-config — executeSectionCommand', () => {
  it('nên reply error khi không có guild', async () => {
    const { executeSectionCommand, getBoosterConfig } = require('../src/utils/section-config.handlers.js');
    const noGuildInteraction = { ...mockInteraction, guild: null };
    await executeSectionCommand(noGuildInteraction, null, getBoosterConfig());
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server'), flags: 64 }),
    );
  });

  it('nên reply error khi thiếu Administrator permission', async () => {
    const { executeSectionCommand, getBoosterConfig } = require('../src/utils/section-config.handlers.js');
    const noPermInteraction = {
      ...mockInteraction,
      member: { permissions: { has: jest.fn(() => false) } },
    };
    await executeSectionCommand(noPermInteraction, null, getBoosterConfig());
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Administrator'), flags: 64 }),
    );
  });
});

describe('section-config — buildSectionSubcommands', () => {
  it('nên tạo subcommand builder với 4 subcommands', () => {
    const { buildSectionSubcommands } = require('../src/utils/section-config.handlers.js');
    const builder = buildSectionSubcommands('test', {
      main: 'Main desc',
      setChannel: 'Channel desc',
      setRole: 'Role desc',
      toggle: 'Toggle desc',
      status: 'Status desc',
    });
    expect(builder).toBeDefined();
    // Subcommand builder có toJSON để export lên Discord
    const json = builder.toJSON();
    expect(json).toBeDefined();
    expect(json.name).toBe('test');
    expect(json.options).toHaveLength(4);
  });
});
