/**
 * Test suite cho feature Booster Server.
 * Coverage:
 * - Event: detect boost, send message, assign role, edge cases, error handling
 * - Command: router logic, permission checks, guild check
 * - Handlers: setchannel, setrole, toggle, status
 */

// ─── Mocks (phải đặt trước import) ──────────────────────────────

const mockBuildBoosterContainer = {
  components: [{ type: 17, components: [] }],
  flags: 0,
  files: undefined,
  toJSON() { return this.components; },
};

const mockBuildSuccessContainer = {
  components: [{ type: 17, components: [{ type: 10, content: '' }] }],
  flags: 64,
  files: undefined,
  toJSON() { return this.components; },
};

const mockBuildTextOnlyContainer = {
  components: [{ type: 17, components: [{ type: 10, content: '' }] }],
  flags: 64,
  files: undefined,
  toJSON() { return this.components; },
};

const mockGetBooster = jest.fn();
const mockBuildBoosterContainerFn = jest.fn(() => mockBuildBoosterContainer);
const mockUpdate = jest.fn();
const mockGetSettings = jest.fn().mockReturnValue({
  booster: {
    enabled: true,
    channelId: 'channel-789',
    roleId: 'role-111',
    container: { contentLines: [], accentColor: 0xfb663a },
  },
});

jest.mock('../src/services/settings.service.js', () => ({
  getSettingsService: () => ({
    getBooster: mockGetBooster,
    buildBoosterContainer: mockBuildBoosterContainerFn,
    update: mockUpdate,
    getSettings: mockGetSettings,
  }),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildSuccessContainer: jest.fn(() => mockBuildSuccessContainer),
  buildTextOnlyContainer: jest.fn(() => mockBuildTextOnlyContainer),
  buildErrorContainer: jest.fn(() => ({ components: [], flags: 64, toJSON() { return []; } })),
}));

// ─── Import under-test modules ──────────────────────────────────

import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { execute as executeEvent } from '../src/events/guildMemberUpdate.event.js';

// ─── Mock Interfaces ─────────────────────────────────────────────

interface MockChannel {
  isTextBased: jest.Mock;
  send: jest.Mock;
}

interface MockMember {
  user: { bot: boolean; id: string; tag: string; username: string };
  guild: { id: string; channels: { cache: { get: jest.Mock } }; roles: { cache: { get: jest.Mock } } };
  roles: { add: jest.Mock };
  premiumSince: string | null;
  _channelMock: MockChannel;
  _roleMock: { name: string };
}

interface MockInteraction {
  guild: { id: string; channels: { cache: { get: jest.Mock } } };
  member: { permissions: { has: jest.Mock } };
  options: {
    getSubcommand: jest.Mock;
    getChannel: jest.Mock;
    getRole: jest.Mock;
    getBoolean: jest.Mock;
  };
  reply: jest.Mock;
}

// ─── Test Helpers ────────────────────────────────────────────────

function createMockMember(
  overrides: {
    bot?: boolean;
    premiumSince?: string | null;
    guildId?: string;
    userId?: string;
    username?: string;
  } = {},
): MockMember {
  const channelMock: MockChannel = {
    isTextBased: jest.fn(() => true),
    send: jest.fn().mockResolvedValue({}),
  };

  const roleMock = {
    name: 'Booster',
  };

  const guild = {
    id: overrides.guildId || 'guild-123',
    channels: {
      cache: {
        get: jest.fn(() => channelMock),
      },
    },
    roles: {
      cache: {
        get: jest.fn(() => roleMock),
      },
    },
  };

  const user = {
    bot: overrides.bot ?? false,
    id: overrides.userId || 'user-456',
    tag: (overrides.username ?? 'TestUser') + '#0001',
    username: overrides.username ?? 'TestUser',
  };

  const roles = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  return {
    user,
    guild,
    roles,
    premiumSince: overrides.premiumSince ?? null,
    _channelMock: channelMock,
    _roleMock: roleMock,
  };
}

function createMockInteraction(
  overrides: {
    guildId?: string;
    subcommand?: string;
    channelId?: string;
    roleId?: string;
    enabled?: boolean;
    hasAdmin?: boolean;
  } = {},
): MockInteraction {
  const channel = {
    id: overrides.channelId || 'channel-999',
    toString: () => '<#channel-999>',
  };

  const role = {
    id: overrides.roleId || 'role-999',
    toString: () => '<@&role-999>',
  };

  const member = {
    permissions: {
      has: jest.fn(() => overrides.hasAdmin ?? true),
    },
  };

  return {
    guild: {
      id: overrides.guildId || 'guild-123',
      channels: {
        cache: {
          get: jest.fn(() => undefined),
        },
      },
    },
    member,
    options: {
      getSubcommand: jest.fn(() => overrides.subcommand || 'status'),
      getChannel: jest.fn(() => channel),
      getRole: jest.fn(() => role),
      getBoolean: jest.fn(() => overrides.enabled ?? true),
    },
    reply: jest.fn().mockResolvedValue({}),
  };
}

// ─── Tests: Event ────────────────────────────────────────────────

describe('Booster Feature - guildMemberUpdate.event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happyPath', () => {
    it('phải gửi booster message khi member vừa boost server', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockGetBooster).toHaveBeenCalledWith('guild-123');
      expect(mockBuildBoosterContainerFn).toHaveBeenCalled();
      expect(newMember._channelMock.send).toHaveBeenCalled();
    });

    it('phải cấp role khi member boost và roleId được cấu hình', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: 'role-111',
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(newMember.roles.add).toHaveBeenCalled();
    });
  });

  describe('edgeCases', () => {
    it('phải bỏ qua khi member là bot', async () => {
      const oldMember = createMockMember({ bot: true, premiumSince: null });
      const newMember = createMockMember({ bot: true, premiumSince: '2026-01-01T00:00:00.000Z' });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockGetBooster).not.toHaveBeenCalled();
    });

    it('phải bỏ qua khi booster bị tắt', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });

      mockGetBooster.mockReturnValue({
        enabled: false,
        channelId: 'channel-789',
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockBuildBoosterContainerFn).not.toHaveBeenCalled();
    });

    it('phải bỏ qua khi channelId = null', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: null,
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockBuildBoosterContainerFn).not.toHaveBeenCalled();
    });

    it('phải bỏ qua khi member đã đang boost (premiumSince không đổi)', async () => {
      const oldMember = createMockMember({ premiumSince: '2025-01-01T00:00:00.000Z' });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockGetBooster).not.toHaveBeenCalled();
    });

    it('phải bỏ qua khi channel không phải text channel', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
      newMember._channelMock.isTextBased.mockReturnValue(false);

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockBuildBoosterContainerFn).not.toHaveBeenCalled();
    });

    it('phải bỏ qua khi channel không tồn tại', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
      newMember.guild.channels.cache.get.mockReturnValue(undefined);

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember);

      expect(mockBuildBoosterContainerFn).not.toHaveBeenCalled();
    });
  });

  describe('errorHandling', () => {
    it('phải handle lỗi khi channel.send throw error', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
      newMember._channelMock.send.mockRejectedValue(new Error('Discord API Error'));

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: null,
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await expect(executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember)).resolves.not.toThrow();
    });

    it('phải handle lỗi khi role không tồn tại', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
      newMember.guild.roles.cache.get.mockReturnValue(undefined);

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: 'role-not-exist',
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      await expect(executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember)).resolves.not.toThrow();
    });

    it('phải handle lỗi khi roles.add() throw error (line 91)', async () => {
      const oldMember = createMockMember({ premiumSince: null });
      const newMember = createMockMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
      // Role exists but roles.add() fails
      newMember.roles.add.mockRejectedValue(new Error('Permissions Error'));

      mockGetBooster.mockReturnValue({
        enabled: true,
        channelId: 'channel-789',
        roleId: 'role-111',
        container: { contentLines: [], accentColor: 0xfb663a },
      });

      // Should not throw — roles.add error is caught internally
      await expect(executeEvent(null, oldMember as unknown as GuildMember, newMember as unknown as GuildMember)).resolves.not.toThrow();
    });
  });
});

// ─── Tests: Command Router ───────────────────────────────────────

describe('Booster Command - execute router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockReturnValue({
      booster: {
        enabled: true,
        channelId: 'channel-789',
        roleId: 'role-111',
        container: { contentLines: [], accentColor: 0xfb663a },
      },
    });
  });

  it('phải reply error khi không có guild', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = {
      guild: null,
      reply: jest.fn().mockResolvedValue({}),
    };

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server') }),
    );
  });

  it('phải reply error khi không có Administrator permission', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ hasAdmin: false });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Administrator') }),
    );
  });

  it('phải route đến handleStatus khi subcommand = status', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'status' });

    mockGetBooster.mockReturnValue({
      enabled: true,
      channelId: 'ch-1',
      roleId: 'role-1',
      container: { contentLines: [], accentColor: 0xfb663a },
    });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalled();
  });

  it('phải route đến handleToggle khi subcommand = toggle', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'toggle', enabled: true });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(mockUpdate).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('phải route đến handleSetChannel khi subcommand = setchannel', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'setchannel' });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(mockUpdate).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('phải route đến handleSetRole khi subcommand = setrole', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'setrole' });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(mockUpdate).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('phải catch lỗi khi handler throw error (cover catch block)', async () => {
    // Make mockUpdate throw synchronously to trigger the catch block in execute
    mockUpdate.mockImplementationOnce(() => { throw new Error('DB Error'); });
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'setchannel' });

    // The execute function has a try-catch that should handle the error
    // and call interaction.reply with an error container
    await expect(execute(interaction as unknown as ChatInputCommandInteraction, null)).resolves.not.toThrow();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('phải reply error khi subcommand không xác định (cover default case lines 103-104)', async () => {
    const { execute } = require('../src/commands/booster/booster.command.js');
    const interaction = createMockInteraction({ subcommand: 'unknown' });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    // buildErrorContainer returns { components, flags }, not content
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array), flags: expect.any(Number) }),
    );
  });
});

// ─── Tests: /test-booster Command ────────────────────────────────

describe('Booster Command - /test-booster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phải reply error khi không có guild', async () => {
    const { execute } = require('../src/commands/booster/test.command.js');
    const interaction = {
      guild: null,
      reply: jest.fn().mockResolvedValue({}),
    };

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server') }),
    );
  });

  it('phải reply error khi không có Administrator permission', async () => {
    const { execute } = require('../src/commands/booster/test.command.js');
    const interaction = createMockInteraction({ hasAdmin: false });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Administrator') }),
    );
  });

  it('phải gửi container vào channel đã cấu hình', async () => {
    const { execute } = require('../src/commands/booster/test.command.js');

    const channelMock: MockChannel & { toString: () => string } = {
      isTextBased: jest.fn(() => true),
      send: jest.fn().mockResolvedValue({}),
      toString: () => '<#channel-789>',
    };

    const interaction = createMockInteraction({ hasAdmin: true });
    // Add channels.cache to the guild mock
    interaction.guild.channels = {
      cache: {
        get: jest.fn(() => channelMock),
      },
    };

    mockGetBooster.mockReturnValue({
      enabled: true,
      channelId: 'channel-789',
      roleId: null,
      container: { contentLines: [], accentColor: 0xfb663a },
    });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(channelMock.send).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('✅') }),
    );
  });

  it('phải reply ephemeral khi chưa cấu hình channel', async () => {
    const { execute } = require('../src/commands/booster/test.command.js');
    const interaction = createMockInteraction({ hasAdmin: true });

    mockGetBooster.mockReturnValue({
      enabled: true,
      channelId: null,
      roleId: null,
      container: { contentLines: [], accentColor: 0xfb663a },
    });

    await execute(interaction as unknown as ChatInputCommandInteraction, null);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array), flags: expect.any(Number) }),
    );
  });

  it('phải catch lỗi khi buildBoosterContainer throw error', async () => {
    const { execute } = require('../src/commands/booster/test.command.js');
    const interaction = createMockInteraction({ hasAdmin: true });

    mockGetBooster.mockImplementation(() => {
      throw new Error('Settings Error');
    });

    await expect(execute(interaction as unknown as ChatInputCommandInteraction, null)).resolves.not.toThrow();
    expect(interaction.reply).toHaveBeenCalled();
  });
});

// ─── Tests: Command Structure ────────────────────────────────────

describe('Booster Commands - structure', () => {
  it('phải có đúng 4 subcommands', () => {
    const { data } = require('../src/commands/booster/booster.command.js');
    const json = data.toJSON();
    expect(json.options).toHaveLength(4);
    expect(json.options.map((o: { name: string }) => o.name)).toEqual(
      expect.arrayContaining(['setchannel', 'setrole', 'toggle', 'status']),
    );
  });

  it('phải có tên command là "booster"', () => {
    const { data } = require('../src/commands/booster/booster.command.js');
    expect(data.name).toBe('booster');
  });

  it('phải có tên command là "test-booster"', () => {
    const { data } = require('../src/commands/booster/test.command.js');
    expect(data.name).toBe('test-booster');
  });
});
