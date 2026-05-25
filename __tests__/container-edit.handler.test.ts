/**
 * Test cho container-edit.handler.ts và container-reset.handler.ts.
 * Verify startInteractiveEdit và handleContainerReset đạt 100% coverage.
 */
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

// Mock settings service trước khi import handlers
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
  })),
  buildErrorContainer: jest.fn((message: string) => ({
    components: [{ type: 17, components: [{ type: 10, content: message }] }],
    flags: MessageFlags.IsComponentsV2,
  })),
  buildSuccessContainer: jest.fn((message: string) => ({
    components: [{ type: 17, components: [{ type: 10, content: message }] }],
    flags: MessageFlags.IsComponentsV2,
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
  })),
  buildAllEditorRows: jest.fn(() => []),
}));

import { startInteractiveEdit } from '../src/commands/container/container-edit.handler.js';
import { handleContainerReset } from '../src/commands/container/container-reset.handler.js';

// Access mock via jest.requireMock
const { mockSettingsService } = jest.requireMock('../src/services/settings.service.js');

// ─── Helpers ──────────────────────────────────────────────────

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
    it('phải gọi settingsService.get với guildId đúng', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(mockSettingsService.get).toHaveBeenCalledWith('guild-123');
    });

    it('phải gọi interaction.reply', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('phải gọi interaction.fetchReply', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.fetchReply).toHaveBeenCalled();
    });

    it('phải hoạt động với type=welcome', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('phải hoạt động với type=leave', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'leave');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('phải hoạt động với type=booster', async () => {
      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'booster');

      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('phải catch lỗi từ settingsService.get', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const interaction = createMockInteraction();
      await startInteractiveEdit(interaction, 'welcome');

      // Must not throw, must reply with error
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('phải reply error container khi có lỗi và interaction chưa replied', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('Test Error');
      });

      const interaction = createMockInteraction({ replied: false });
      await startInteractiveEdit(interaction, 'welcome');

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('phải không reply lại nếu interaction đã replied khi có lỗi', async () => {
      mockSettingsService.get.mockImplementation(() => {
        throw new Error('Test Error');
      });

      const interaction = createMockInteraction({
        replied: true,
        reply: jest.fn().mockResolvedValue({}),
      });
      await startInteractiveEdit(interaction, 'welcome');

      // interaction.replied = true nên không gọi reply nữa
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('phải xử lý fetchReply fail (fallback messageId)', async () => {
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
    it('phải gọi options.getString("type")', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(getStringMock).toHaveBeenCalledWith('type');
    });

    it('phải gọi settingsService.update với đúng guildId', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.any(Object));
    });

    it('phải reset container settings cho type=welcome', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        welcome: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('phải reset container settings cho type=leave', async () => {
      const getStringMock = jest.fn().mockReturnValue('leave');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        leave: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('phải reset container settings cho type=booster', async () => {
      const getStringMock = jest.fn().mockReturnValue('booster');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-456', expect.objectContaining({
        booster: expect.objectContaining({ container: expect.any(Object) }),
      }));
    });

    it('phải reply success container', async () => {
      const getStringMock = jest.fn().mockReturnValue('welcome');
      const interaction = createMockInteraction({
        options: { getString: getStringMock, getSubcommand: jest.fn() },
      });

      await handleContainerReset(interaction, 'guild-456');

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});