/// <reference types="jest" />
/**
 * Unit tests cho interaction-router.ts.
 * Kiểm tra phân luồng interaction và RBAC per-guild cho ChatInputCommand.
 */

import { routeInteraction } from '../../src/infrastructure/discord/interaction-router.js';
import { COMMAND_PERMISSIONS } from '../../src/config/permissions.js';
import { PermissionFlagsBits } from 'discord.js';

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
    commandName: 'df-stats',
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

describe('interaction-router — handleChatInputCommand RBAC', () => {
  let mockClient: any;
  let mockExecute: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExecute = jest.fn().mockResolvedValue(undefined);
    mockClient = {
      commands: new Map([
        ['df-stats', { execute: mockExecute }],
        ['welcome', { execute: mockExecute }],
      ]),
      database: {},
    };

    COMMAND_PERMISSIONS['df-stats'] = { requiredRoles: ['Member'] };
    COMMAND_PERMISSIONS['welcome'] = { requiredRoles: ['Owner', 'Moderator'] };
  });

  it('phải cho phép chạy lệnh Member khi guild chưa cấu hình memberRoleId (mặc định mở)', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: null,
        moderatorRoleId: null,
        memberRoleId: null,
      },
    });

    const interaction = createMockInteraction({
      commandName: 'df-stats',
      user: { id: 'random-user' },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).toHaveBeenCalledWith(interaction, mockClient.database);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('phải chặn lệnh Member khi guild đã cấu hình memberRoleId nhưng user không có role', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: null,
        moderatorRoleId: null,
        memberRoleId: 'member-role-123',
      },
    });

    const interaction = createMockInteraction({
      commandName: 'df-stats',
      user: { id: 'random-user' },
      member: {
        roles: { cache: new Map([['other-role', { id: 'other-role' }]]) },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('member-role-123'),
        flags: 64, // Ephemeral
      }),
    );
  });

  it('phải cho phép lệnh Member khi user có đúng memberRoleId đã cấu hình', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: null,
        moderatorRoleId: null,
        memberRoleId: 'member-role-123',
      },
    });

    const interaction = createMockInteraction({
      commandName: 'df-stats',
      user: { id: 'member-user' },
      member: {
        roles: { cache: new Map([['member-role-123', { id: 'member-role-123' }]]) },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('phải bypass RBAC cho Server Owner ngay cả khi không có role', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: 'owner-role',
        moderatorRoleId: 'mod-role',
        memberRoleId: 'member-role',
      },
    });

    const interaction = createMockInteraction({
      commandName: 'welcome',
      user: { id: 'guild-owner-id' },
      guild: { id: 'guild-1', ownerId: 'guild-owner-id' },
      member: {
        roles: { cache: new Map() },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('phải bypass RBAC cho Discord Administrator', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: 'owner-role',
        moderatorRoleId: 'mod-role',
        memberRoleId: 'member-role',
      },
    });

    const interaction = createMockInteraction({
      commandName: 'welcome',
      user: { id: 'admin-user' },
      memberPermissions: {
        has: jest.fn(() => true),
      },
      member: {
        roles: { cache: new Map() },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('phải cho phép lệnh [Owner, Moderator] khi user có Moderator role cấu hình', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: 'owner-role',
        moderatorRoleId: 'mod-role',
        memberRoleId: null,
      },
    });

    const interaction = createMockInteraction({
      commandName: 'welcome',
      user: { id: 'mod-user' },
      member: {
        roles: { cache: new Map([['mod-role', { id: 'mod-role' }]]) },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).toHaveBeenCalledWith(interaction, mockClient.database);
  });

  it('phải chặn lệnh [Owner, Moderator] khi user chỉ có Member role', async () => {
    mockSettingsService.get.mockReturnValue({
      rbac: {
        ownerRoleId: 'owner-role',
        moderatorRoleId: 'mod-role',
        memberRoleId: 'member-role',
      },
    });

    const interaction = createMockInteraction({
      commandName: 'welcome',
      user: { id: 'member-user' },
      member: {
        roles: { cache: new Map([['member-role', { id: 'member-role' }]]) },
      },
    });

    await routeInteraction(mockClient, interaction as any);

    expect(mockExecute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Quản trị viên'),
        flags: 64,
      }),
    );
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
      commandName: 'df-stats',
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
      commandName: 'df-stats',
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
