/**
 * Test cho container-edit.handler.ts vÃ  container-reset.handler.ts.
 * Verify startInteractiveEdit vÃ  handleContainerReset Ä‘áº¡t 100% coverage.
 */
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

// Mock settings service trÆ°á»›c khi import handlers
jest.mock('../src/services/settings.service.js', () => {
  const mockSettingsService: any = {
    get: jest.fn(),
    update: jest.fn(),
    getWelcome: jest.fn(),
    getBooster: jest.fn(),
  };

  return {
    getSettingsService: jest.fn(() => mockSettingsService),
    mockSettingsService,
  };
});

// Mock container.utils
jest.mock('../src/utils/container.utils.js', () => ({
  buildContainer: jest.fn(() => ({
    components: [{ type: 17, components: [] }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
    toJSON() { return this.components; },
  })),
  buildErrorContainer: jest.fn((message: string) => ({
    components: [{ type: 17, components: [{ type: 10, content: message }] }],
    flags: MessageFlags.IsComponentsV2,
    toJSON() { return this.components; },
  })),
  buildSuccessContainer: jest.fn((message: string) => ({
    components: [{ type: 17, components: [{ type: 10, content: message }] }],
    flags: MessageFlags.IsComponentsV2,
    toJSON() { return this.components; },
  })),
}));

// Mock default.settings
jest.mock('../src/config/default.settings.js', () => ({
  cloneDefaultSettings: jest.fn(() => ({
    welcome: { container: { accentColor: 0x5865f2, headerTemplate: 'Welcome', contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: true } },
    leave: { container: { accentColor: 0xed4245, headerTemplate: 'Leave', contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: true } },
    booster: { container: { accentColor: 0xfb663a, headerTemplate: 'Booster', contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: true } },
  })),
}));

// Mock container-session
jest.mock('../src/commands/container/container-session.js', () => ({
  cloneContainerSettings: jest.fn((s: any) => JSON.parse(JSON.stringify(s))),
  createSession: jest.fn(),
  CONTAINER_COLOR_PRESETS: [],
}));

// Mock container-builders
jest.mock('../src/commands/container/container-builders.js', () => ({
  buildLivePreviewContainer: jest.fn(() => ({
    components: [{ type: 17, components: [] }],
    flags: MessageFlags.IsComponentsV2,
    files: [],
    toJSON() { return this.components; },
  })),
  buildAllEditorRows: jest.fn(() => []),
}));

import { startInteractiveEdit } from '../src/commands/container/container-edit.handler.js';
import { handleContainerReset } from '../src/commands/container/container-reset.handler.js';

// Access mock via jest.requireMock
const { mockSettingsService } = jest.requireMock('../src/services/settings.service.js');

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123' },
    user: { id: 'user-123' },
    member: {},
    channel: { id: 'channel-123' },
    replied: false,
    options: {
      getString: jest.fn(),
      getSubcommand: jest.fn(),
    },
    reply: jest.fn().mockResolvedValue({}),
    fetchReply: jest.fn().mockResolvedValue({ id: 'msg-123' }),
    deferReply: jest.fn().mockResolvedValue({}),
  };

  return { ...base, ...overrides };
}

describe('container-edit.handler - startInteractiveEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    mockSettingsService.get.mockReturnValue({
      welcome: {
        enabled: true,
        container: {
          accentColor: 0x5865f2,
          headerTemplate: '**Welcome {user}!**',
          contentLines: ['Line 1'],
          mediaUrl: null,
          mediaDescription: null,
          showSeparator: true,
        },
      },
      leave: {
        enabled: true,
        container: {
          accentColor: 0xed4245,
          headerTemplate: '**Goodbye {user}!**',
          contentLines: [],
          mediaUrl: null,
          mediaDescription: null,
          showSeparator: true,
        },
      },
      booster: {
        enabled: true,
        container: {
          accentColor: 0xfb663a,
          headerTemplate: '**Boost {user}!**',
          contentLines: [],
          mediaUrl: null,
          mediaDescription: null,
          showSeparator: true,
        },
      },
    });
  });

  describe('happy path', () => {
    it('pháº£i gá»i settingsService.get vá»›i guildId Ä‘Ãºng', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(mockSettingsService.get).toHaveBeenCalledWith('guild-123');
    });

    it('pháº£i gá»i interaction.reply', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('pháº£i gá»i interaction.fetchReply', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.fetchReply).toHaveBeenCalled();
    });

    it('pháº£i hoáº¡t Ä‘á»™ng vá»›i type=welcome', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('pháº£i hoáº¡t Ä‘á»™ng vá»›i type=leave', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'leave');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('pháº£i hoáº¡t Ä‘á»™ng vá»›i type=booster', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'booster');

      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('pháº£i catch lá»—i tá»« settingsService.get', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      // Must not throw, must reply with error
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('pháº£i reply error container khi cÃ³ lá»—i vÃ  interaction chÆ°a replied', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('Test Error');
      });

      const interaction = createMockInteraction({ replied: false });
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('pháº£i khÃ´ng reply láº¡i náº¿u interaction Ä‘Ã£ replied khi cÃ³ lá»—i', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('Test Error');
      });

      const interaction = createMockInteraction({
        replied: true,
        reply: jest.fn().mockResolvedValue({}),
      });
      await startInteractiveEdit(interaction, 'welcome');

      // interaction.replied = true nÃªn khÃ´ng gá»i reply ná»¯a
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('pháº£i xá»­ lÃ½ fetchReply fail (fallback messageId)', async () => {
      const interaction = createMockInteraction({
        fetchReply: jest.fn().mockRejectedValue(new Error('Fetch failed')),
      });
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.fetchReply).toHaveBeenCalled();
      // Must not throw even if fetchReply fails
    });
  });
});

describe('container-reset.handler - handleContainerReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSettingsService.update.mockImplementation((guildId: string, partial: any) => {
      return { ...partial };
    });
  });

  describe('happy path', () => {
    it('pháº£i gá»i options.getString("type")', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(getStringMock).toHaveBeenCalledWith('type');
    });

    it('pháº£i gá»i settingsService.update vá»›i Ä‘Ãºng guildId', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.any(Object));
    });

    it('pháº£i reset container settings cho type=welcome', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        welcome: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('pháº£i reset container settings cho type=leave', async () => {
      const getStringMock = jest.fn().mockReturnValue('leave');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        leave: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('pháº£i reset container settings cho type=booster', async () => {
      const getStringMock = jest.fn().mockReturnValue('booster');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        booster: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('pháº£i reply success container', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});