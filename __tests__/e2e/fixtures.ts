/**
 * E2E test mock factories — Discord objects only.
 * DB, Express, and business logic run real code.
 */

import type {
  ChatInputCommandInteraction,
  GuildMember,
  Guild,
  User,
  CommandInteractionOption,
} from 'discord.js';

/* ==================== Mock interaction options ==================== */

interface MockInteractionOptions {
  getSubcommand?: jest.Mock<string, []>;
  getMember?: jest.Mock<GuildMember | null, [string]>;
  getChannel?: jest.Mock<any, [string]>;
  getRole?: jest.Mock<any, [string]>;
  getBoolean?: jest.Mock<boolean | null, [string]>;
  getString?: jest.Mock<string | null, [string]>;
}

/* ==================== Mock interaction ==================== */

interface MockInteractionOverrides {
  guild?: Guild | null;
  user?: Partial<User>;
  member?: Partial<GuildMember>;
  options?: MockInteractionOptions;
  replied?: boolean;
  deferred?: boolean;
}

export function createMockInteraction(overrides: MockInteractionOverrides = {}): any {
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);

  const guild = overrides.guild ?? createMockGuild();
  const user = {
    id: 'user-123',
    username: 'TestUser',
    tag: 'TestUser#0001',
    bot: false,
    displayAvatarURL: () => 'https://example.com/avatar.png',
    ...overrides.user,
  };

  const member = {
    permissions: {
      has: () => true,
    },
    roles: {
      add: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides.member,
  };

  return {
    guild,
    user,
    member,
    options: {
      getSubcommand: overrides.options?.getSubcommand ?? jest.fn(() => 'status'),
      getMember: overrides.options?.getMember ?? jest.fn(() => null),
      getChannel: overrides.options?.getChannel ?? jest.fn(() => null),
      getRole: overrides.options?.getRole ?? jest.fn(() => null),
      getBoolean: overrides.options?.getBoolean ?? jest.fn(() => null),
      getString: overrides.options?.getString ?? jest.fn(() => null),
    },
    reply: mockReply,
    editReply: mockEditReply,
    deferReply: mockDeferReply,
    replied: overrides.replied ?? false,
    deferred: overrides.deferred ?? false,
    deferReplyWith: mockDeferReply,
  };
}

/* ==================== Mock guild ==================== */

interface MockGuildOverrides {
  id?: string;
  channels?: Map<string, any>;
  roles?: Map<string, any>;
}

export function createMockGuild(overrides: MockGuildOverrides = {}): any {
  const guildId = overrides.id ?? 'guild-123';

  const channelCache = new Map(overrides.channels ?? []);
  const roleCache = new Map(overrides.roles ?? []);

  return {
    id: guildId,
    name: 'Test Guild',
    channels: {
      cache: {
        get: (id: string) => channelCache.get(id) ?? undefined,
        forEach: channelCache.forEach.bind(channelCache),
      },
    },
    roles: {
      cache: {
        get: (id: string) => roleCache.get(id) ?? undefined,
      },
    },
    members: {
      cache: {
        get: () => undefined,
      },
    },
  };
}

/* ==================== Mock text channel ==================== */

export function createMockTextChannel(overrides: { id?: string; name?: string; isTextBased?: () => boolean; send?: jest.Mock; toString?: () => string } = {}): any {
  return {
    id: overrides.id ?? 'channel-999',
    name: 'test-channel',
    isTextBased: () => true,
    send: jest.fn().mockResolvedValue({}),
    toString: () => `<#${overrides.id ?? 'channel-999'}`,
    ...overrides,
  };
}

/* ==================== Mock role ==================== */

export function createMockRole(overrides: { id?: string; name?: string; color?: { toHex: () => string } } = {}): any {
  return {
    id: overrides.id ?? 'role-999',
    name: 'TestRole',
    color: { toHex: () => '#5865F2' },
    ...overrides,
  };
}

/* ==================== Mock guild member ==================== */

interface MockMemberOverrides {
  userId?: string;
  username?: string;
  bot?: boolean;
  premiumSince?: string | null;
  guildId?: string;
  channelId?: string;
  roleId?: string;
  channelIdExists?: boolean;
  roleIdExists?: boolean;
}

export function createMockGuildMember(overrides: MockMemberOverrides = {}): any {
  const channelId = overrides.channelId ?? 'channel-welcome';
  const roleId = overrides.roleId ?? 'role-booster';

  const channel = overrides.channelIdExists ? createMockTextChannel({ id: channelId }) : null;

  const role = overrides.roleIdExists ? createMockRole({ id: roleId }) : null;

  const guild: any = {
    id: overrides.guildId ?? 'guild-123',
    channels: {
      cache: {
        get: jest.fn((id: string) => {
          if (id === channelId && channel) return channel;
          return undefined;
        }),
      },
    },
    roles: {
      cache: {
        get: jest.fn((id: string) => {
          if (id === roleId && role) return role;
          return undefined;
        }),
      },
    },
  };

  const user: any = {
    id: overrides.userId ?? 'user-456',
    username: overrides.username ?? 'TestUser',
    tag: (overrides.username ?? 'TestUser') + '#0001',
    bot: overrides.bot ?? false,
    displayAvatarURL: () => 'https://example.com/avatar.png',
  };

  const roles: any = {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  return {
    user,
    guild,
    roles,
    premiumSince: overrides.premiumSince ?? null,
    _channelMock: channel,
    _roleMock: role,
  };
}

/* ==================== Mock Discord client (DM only) ==================== */

export function createMockDiscordClient(
  options: { dmBlocked?: boolean; userNotFound?: boolean } = {},
): any {
  const dm = {
    send: options.dmBlocked
      ? jest.fn().mockRejectedValue(new Error('Cannot send messages to this user'))
      : jest.fn().mockResolvedValue({}),
  };

  const user = {
    createDM: options.dmBlocked
      ? jest.fn().mockRejectedValue(new Error('DM blocked'))
      : jest.fn().mockResolvedValue(dm),
  };

  return {
    users: {
      fetch: options.userNotFound
        ? jest.fn().mockRejectedValue(new Error('User not found'))
        : jest.fn().mockResolvedValue(user),
    },
  };
}

/* ==================== Mock axios responses ==================== */

/**
 * Build a mock axios response for the Delta Force API.
 * Used by df-stats and df-daily E2E tests.
 */
export function mockDfApiSuccess(data: any) {
  return {
    data: {
      code: 0,
      msg: 'ok',
      data,
    },
  };
}

/**
 * Build a mock axios error for the Delta Force API.
 */
export function mockDfApiError(code: number, msg: string) {
  return {
    data: {
      code,
      msg,
    },
  };
}
