/// <reference types="jest" />
/**
 * Unit tests cho interaction-router.ts.
 * Kiểm tra phân luồng interaction và RBAC per-guild cho ChatInputCommand.
 */

import {
  routeInteraction,
  webhookRevealedUsers,
} from '../../src/infrastructure/discord/interaction-router.js';
import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { botConfig } from '../../src/config/bot.config.js';

const mockSettingsService = {
  get: jest.fn(),
  update: jest.fn(),
};

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
}));

jest.mock('../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

function createMockInteraction(overrides: Record<string, any> = {}) {
  const member = overrides.member ?? {
    roles: { cache: new Map() },
  };

  return {
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    isChatInputCommand: () => true,
    commandName: 'df',
    options: {
      getSubcommandGroup: jest.fn(() => null),
      getSubcommand: jest.fn(() => 'stats'),
    },
    user: { id: 'user-1' },
    guildId: 'guild-1',
    guild: { id: 'guild-1', ownerId: 'guild-owner-id' },
    member,
    memberPermissions: {
      has: jest.fn((perm: bigint) => perm === PermissionFlagsBits.Administrator ? false : false),
    },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('interaction-router — handleChatInputCommand Database & Error Handling', () => {
  let mockClient: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExecute = jest.fn().mockResolvedValue(undefined);
    mockClient = {
      commands: new Map([
        ['df', { execute: mockExecute }],
      ]),
      database: {},
    };
  });

  it('phải báo lỗi khi database không khả dụng', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: null,
        moderatorRoleId: null,
        memberRoleId: null,
      },
    });

    const interaction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'stats'),
      },
    });

    mockClient.database = null;

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Cơ sở dữ liệu không khả dụng'),
        flags: 64,
      }),
    );
  });

  it('phải xử lý graceful error khi command execution ném lỗi', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: null,
        moderatorRoleId: null,
        memberRoleId: null,
      },
    });

    mockExecute.mockRejectedValueOnce(new Error('Unexpected runtime exception'));

    const interaction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'stats'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Đã xảy ra lỗi'),
        flags: 64,
      }),
    );
  });
});

describe('interaction-router — Hierarchical Command Dispatch (Phase 3)', () => {
  let mockClient: any;
  let mockConfigExecute: jest.Mock;
  let mockDfExecute: jest.Mock;
  let mockTeamExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigExecute = jest.fn().mockResolvedValue(undefined);
    mockDfExecute = jest.fn().mockResolvedValue(undefined);
    mockTeamExecute = jest.fn().mockResolvedValue(undefined);

    mockClient = {
      commands: new Map([
        ['config', { execute: mockConfigExecute }],
        ['df', { execute: mockDfExecute }],
        ['team', { execute: mockTeamExecute }],
      ]),
      database: {},
    };
  });

  it('/config roles set → dispatch tới root "config" module', async () => {
    const interaction = createMockInteraction({
      commandName: 'config',
      user: { id: 'guild-owner-id' },
      options: {
        getSubcommandGroup: jest.fn(() => 'roles'),
        getSubcommand: jest.fn(() => 'set'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockConfigExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('/df code show → dispatch tới root "df" module', async () => {
    const interaction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => 'code'),
        getSubcommand: jest.fn(() => 'show'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockDfExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('/df stats → dispatch tới root "df" module', async () => {
    const interaction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'stats'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockDfExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('/team find → dispatch tới root "team" module', async () => {
    const interaction = createMockInteraction({
      commandName: 'team',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'find'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockTeamExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });
});

describe('Phase 4: Policy-based RBAC enforcement for hierarchical commands', () => {
  let mockClient: any;
  let mockConfigExecute: jest.Mock;
  let mockDfExecute: jest.Mock;
  let mockTeamExecute: jest.Mock;

  const rbacConfig = {
    botAdminRoleId: 'role-bot-admin',
    moderatorRoleId: 'role-moderator',
    memberRoleId: 'role-member',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigExecute = jest.fn().mockResolvedValue(undefined);
    mockDfExecute = jest.fn().mockResolvedValue(undefined);
    mockTeamExecute = jest.fn().mockResolvedValue(undefined);

    mockClient = {
      commands: new Map([
        ['config', { execute: mockConfigExecute }],
        ['df', { execute: mockDfExecute }],
        ['team', { execute: mockTeamExecute }],
      ]),
      database: {},
    };

    mockSettingsService.get.mockReturnValue({ rbac: rbacConfig });
  });

  // 1. MANAGE_RBAC: config.roles.set
  describe('MANAGE_RBAC policy (config.roles.set)', () => {
    const makeRolesSetInteraction = (overrides: Record<string, any> = {}) =>
      createMockInteraction({
        commandName: 'config',
        options: {
          getSubcommandGroup: jest.fn(() => 'roles'),
          getSubcommand: jest.fn(() => 'set'),
        },
        ...overrides,
      });

    it('cho phép Guild Owner', async () => {
      const interaction = makeRolesSetInteraction({
        user: { id: 'guild-owner-id' },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('cho phép Discord Administrator', async () => {
      const interaction = makeRolesSetInteraction({
        memberPermissions: {
          has: jest.fn((perm: bigint) => perm === PermissionFlagsBits.Administrator),
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('cho phép BOT_ADMIN role', async () => {
      const interaction = makeRolesSetInteraction({
        member: {
          roles: {
            cache: new Map([['role-bot-admin', { id: 'role-bot-admin' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('từ chối MODERATOR role', async () => {
      const interaction = makeRolesSetInteraction({
        member: {
          roles: {
            cache: new Map([['role-moderator', { id: 'role-moderator' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.anything() }),
      );
    });

    it('từ chối Regular MEMBER', async () => {
      const interaction = makeRolesSetInteraction({
        member: {
          roles: {
            cache: new Map([['role-member', { id: 'role-member' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  // 2. MANAGE_CONFIG: config.welcome.setchannel
  describe('MANAGE_CONFIG policy (config.welcome.setchannel)', () => {
    const makeWelcomeSetChannelInteraction = (overrides: Record<string, any> = {}) =>
      createMockInteraction({
        commandName: 'config',
        options: {
          getSubcommandGroup: jest.fn(() => 'welcome'),
          getSubcommand: jest.fn(() => 'setchannel'),
        },
        ...overrides,
      });

    it('cho phép Guild Owner', async () => {
      const interaction = makeWelcomeSetChannelInteraction({
        user: { id: 'guild-owner-id' },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('cho phép Administrator', async () => {
      const interaction = makeWelcomeSetChannelInteraction({
        memberPermissions: {
          has: jest.fn((perm: bigint) => perm === PermissionFlagsBits.Administrator),
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
    });

    it('cho phép BOT_ADMIN', async () => {
      const interaction = makeWelcomeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-bot-admin', { id: 'role-bot-admin' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
    });

    it('cho phép MODERATOR', async () => {
      const interaction = makeWelcomeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-moderator', { id: 'role-moderator' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('từ chối Regular MEMBER', async () => {
      const interaction = makeWelcomeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-member', { id: 'role-member' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockConfigExecute).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  // 3. MANAGE_DF_CODE: df.code.setchannel
  describe('MANAGE_DF_CODE policy (df.code.setchannel)', () => {
    const makeDfCodeSetChannelInteraction = (overrides: Record<string, any> = {}) =>
      createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => 'code'),
          getSubcommand: jest.fn(() => 'setchannel'),
        },
        ...overrides,
      });

    it('cho phép Moderator và Bot Admin', async () => {
      const modInteraction = makeDfCodeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-moderator', { id: 'role-moderator' }]]),
          },
        },
      });
      await routeInteraction(mockClient, modInteraction as any);
      expect(mockDfExecute).toHaveBeenCalled();

      mockDfExecute.mockClear();
      const adminInteraction = makeDfCodeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-bot-admin', { id: 'role-bot-admin' }]]),
          },
        },
      });
      await routeInteraction(mockClient, adminInteraction as any);
      expect(mockDfExecute).toHaveBeenCalled();
    });

    it('từ chối Member thông thường', async () => {
      const interaction = makeDfCodeSetChannelInteraction({
        member: {
          roles: {
            cache: new Map([['role-member', { id: 'role-member' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  // 4. DF_ACCESS: df.code.show & df.stats
  describe('DF_ACCESS policy (df.code.show & df.stats)', () => {
    it('cho phép Member role truy cập df.code.show', async () => {
      const interaction = createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => 'code'),
          getSubcommand: jest.fn(() => 'show'),
        },
        member: {
          roles: {
            cache: new Map([['role-member', { id: 'role-member' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('cho phép Everyone truy cập df.stats khi memberRoleId = null (chưa cấu hình)', async () => {
      mockSettingsService.get.mockReturnValue({
        rbac: { botAdminRoleId: null, moderatorRoleId: null, memberRoleId: null },
      });
      const interaction = createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => null),
          getSubcommand: jest.fn(() => 'stats'),
        },
        member: { roles: { cache: new Map() } },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('từ chối user không có member role khi guild đã cấu hình memberRoleId', async () => {
      const interaction = createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => null),
          getSubcommand: jest.fn(() => 'stats'),
        },
        member: { roles: { cache: new Map() } },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  // 5. TEAM_ACCESS: team.find
  describe('TEAM_ACCESS policy (team.find)', () => {
    it('cho phép Member role truy cập team.find', async () => {
      const interaction = createMockInteraction({
        commandName: 'team',
        options: {
          getSubcommandGroup: jest.fn(() => null),
          getSubcommand: jest.fn(() => 'find'),
        },
        member: {
          roles: {
            cache: new Map([['role-member', { id: 'role-member' }]]),
          },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockTeamExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });
  });
});

describe('Phase 5: Exhaustive Canonical Paths & Router Hardening', () => {
  let mockClient: any;
  let mockConfigExecute: jest.Mock;
  let mockDfExecute: jest.Mock;
  let mockTeamExecute: jest.Mock;

  const rbacConfig = {
    botAdminRoleId: 'role-bot-admin',
    moderatorRoleId: 'role-moderator',
    memberRoleId: 'role-member',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigExecute = jest.fn().mockResolvedValue(undefined);
    mockDfExecute = jest.fn().mockResolvedValue(undefined);
    mockTeamExecute = jest.fn().mockResolvedValue(undefined);

    mockClient = {
      commands: new Map([
        ['config', { execute: mockConfigExecute }],
        ['df', { execute: mockDfExecute }],
        ['team', { execute: mockTeamExecute }],
      ]),
      database: {},
    };

    mockSettingsService.get.mockReturnValue({ rbac: rbacConfig });
  });

  it('config.roles.view: được bảo vệ bởi MANAGE_RBAC (cho phép BOT_ADMIN, chặn Member)', async () => {
    // BOT_ADMIN
    const adminInteraction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => 'roles'),
        getSubcommand: jest.fn(() => 'view'),
      },
      member: {
        roles: { cache: new Map([['role-bot-admin', { id: 'role-bot-admin' }]]) },
      },
    });
    await routeInteraction(mockClient, adminInteraction as any);
    expect(mockConfigExecute).toHaveBeenCalled();

    mockConfigExecute.mockClear();

    // Regular Member
    const memberInteraction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => 'roles'),
        getSubcommand: jest.fn(() => 'view'),
      },
      member: {
        roles: { cache: new Map([['role-member', { id: 'role-member' }]]) },
      },
    });
    await routeInteraction(mockClient, memberInteraction as any);
    expect(mockConfigExecute).not.toHaveBeenCalled();
    expect(memberInteraction.reply).toHaveBeenCalled();
  });

  it('config.container.edit & reset: được bảo vệ bởi MANAGE_CONFIG (cho phép MODERATOR)', async () => {
    const editInteraction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => 'container'),
        getSubcommand: jest.fn(() => 'edit'),
      },
      member: {
        roles: { cache: new Map([['role-moderator', { id: 'role-moderator' }]]) },
      },
    });
    await routeInteraction(mockClient, editInteraction as any);
    expect(mockConfigExecute).toHaveBeenCalled();

    mockConfigExecute.mockClear();

    const resetInteraction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => 'container'),
        getSubcommand: jest.fn(() => 'reset'),
      },
      member: {
        roles: { cache: new Map([['role-moderator', { id: 'role-moderator' }]]) },
      },
    });
    await routeInteraction(mockClient, resetInteraction as any);
    expect(mockConfigExecute).toHaveBeenCalled();
  });

  it('df.code.settime & setadminchannel: được bảo vệ bởi MANAGE_DF_CODE', async () => {
    const setTimeInteraction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => 'code'),
        getSubcommand: jest.fn(() => 'settime'),
      },
      member: {
        roles: { cache: new Map([['role-moderator', { id: 'role-moderator' }]]) },
      },
    });
    await routeInteraction(mockClient, setTimeInteraction as any);
    expect(mockDfExecute).toHaveBeenCalled();

    mockDfExecute.mockClear();

    const setAdminChannelInteraction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => 'code'),
        getSubcommand: jest.fn(() => 'setadminchannel'),
      },
      member: {
        roles: { cache: new Map([['role-moderator', { id: 'role-moderator' }]]) },
      },
    });
    await routeInteraction(mockClient, setAdminChannelInteraction as any);
    expect(mockDfExecute).toHaveBeenCalled();
  });

  it('df.link subcommands (start, status, manual): được bảo vệ bởi DF_ACCESS', async () => {
    for (const sub of ['start', 'status', 'manual']) {
      mockDfExecute.mockClear();
      const interaction = createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => 'link'),
          getSubcommand: jest.fn(() => sub),
        },
        member: {
          roles: { cache: new Map([['role-member', { id: 'role-member' }]]) },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    }
  });

  it('df user subcommands (daily, history, workshop, unlink): được bảo vệ bởi DF_ACCESS', async () => {
    for (const sub of ['daily', 'history', 'workshop', 'unlink']) {
      mockDfExecute.mockClear();
      const interaction = createMockInteraction({
        commandName: 'df',
        options: {
          getSubcommandGroup: jest.fn(() => null),
          getSubcommand: jest.fn(() => sub),
        },
        member: {
          roles: { cache: new Map([['role-member', { id: 'role-member' }]]) },
        },
      });
      await routeInteraction(mockClient, interaction as any);
      expect(mockDfExecute).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    }
  });

  it('Unknown subcommand an toàn: router áp dụng default-deny ngăn chặn dispatch', async () => {
    const interaction = createMockInteraction({
      commandName: 'df',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'nonexistent'),
      },
    });
    await routeInteraction(mockClient, interaction as any);
    expect(mockDfExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '🔒 Lệnh này chưa được cấu hình phân quyền bảo mật.',
        flags: MessageFlags.Ephemeral,
      }),
    );
  });
});

describe('Phase 7: Router Default-Deny for Unmapped Command Paths (Area D)', () => {
  let mockClient: any;
  let mockConfigExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigExecute = jest.fn().mockResolvedValue(undefined);
    mockClient = {
      commands: new Map([['config', { execute: mockConfigExecute }]]),
      database: {},
    };
  });

  it('từ chối unmapped subcommand và reply ephemeral', async () => {
    const interaction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => null),
        getSubcommand: jest.fn(() => 'unmapped_action'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockConfigExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '🔒 Lệnh này chưa được cấu hình phân quyền bảo mật.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('từ chối unmapped subcommand group và không gọi execute', async () => {
    const interaction = createMockInteraction({
      commandName: 'config',
      options: {
        getSubcommandGroup: jest.fn(() => 'unknown_group'),
        getSubcommand: jest.fn(() => 'unknown_sub'),
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockConfigExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '🔒 Lệnh này chưa được cấu hình phân quyền bảo mật.',
      flags: MessageFlags.Ephemeral,
    });
  });
});

describe('Phase 7: Webhook Reveal Debounce with TTL (Area C)', () => {
  let mockClient: any;
  const originalWebhookUrl = botConfig.dfWebhookUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    webhookRevealedUsers.clear();
    mockClient = { commands: new Map(), database: {} };
    botConfig.dfWebhookUrl = 'https://discord.com/api/webhooks/123/mock-secret';
  });

  afterAll(() => {
    botConfig.dfWebhookUrl = originalWebhookUrl;
    webhookRevealedUsers.clear();
  });

  function createButtonInteraction(overrides: Record<string, any> = {}) {
    return {
      isButton: () => true,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      isChatInputCommand: () => false,
      customId: 'df_link_show_webhook',
      user: { id: 'user-debounce-1' },
      message: { content: 'Link prompt' },
      reply: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      deleteReply: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('lần bấm đầu tiên: reveal thành công webhook URL và set debounce trong store', async () => {
    const interaction = createButtonInteraction();

    await routeInteraction(mockClient, interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(botConfig.dfWebhookUrl),
        flags: MessageFlags.Ephemeral,
      }),
    );
    expect(webhookRevealedUsers.get('user-debounce-1')).toBeDefined();
  });

  it('lần bấm thứ hai trong vòng 60s: bị chặn bởi debounce guard', async () => {
    const interaction1 = createButtonInteraction({ user: { id: 'user-debounce-2' } });
    await routeInteraction(mockClient, interaction1 as any);
    expect(interaction1.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(botConfig.dfWebhookUrl),
      }),
    );

    const interaction2 = createButtonInteraction({ user: { id: 'user-debounce-2' } });
    await routeInteraction(mockClient, interaction2 as any);

    expect(interaction2.reply).toHaveBeenCalledWith({
      content: 'Bạn đã hiện Webhook URL rồi.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('sau khi TTL 60s hết hạn: user được phép reveal lại webhook URL', async () => {
    const userId = 'user-debounce-ttl';
    // Đặt entry đã hết hạn trong quá khứ
    webhookRevealedUsers.set(userId, {
      expiresAt: Date.now() - 1000,
      revealed: true,
    });

    const interaction = createButtonInteraction({ user: { id: userId } });
    await routeInteraction(mockClient, interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(botConfig.dfWebhookUrl),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it('khi webhook URL chưa cấu hình: thông báo lỗi cấu hình', async () => {
    botConfig.dfWebhookUrl = '';
    const interaction = createButtonInteraction({ user: { id: 'user-no-url' } });

    await routeInteraction(mockClient, interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Webhook URL chưa được cấu hình.',
      flags: MessageFlags.Ephemeral,
    });
  });
});



