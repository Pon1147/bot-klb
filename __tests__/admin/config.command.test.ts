/// <reference types="jest" />
/**
 * Unit tests cho /config command (Command Tree Phase 2).
 * Verify builders, toJSON structure, options, và execute dispatch.
 */

import { data, execute } from '../../src/features/admin/config.command.js';
import { executeSectionCommand } from '../../src/utils/section-config.handlers.js';
import { startInteractiveEdit } from '../../src/features/container/container-edit.handler.js';
import { handleContainerReset } from '../../src/features/container/container-reset.handler.js';
import { getSettingsService } from '../../src/services/settings.service.js';

const mockSettingsService = {
  update: jest.fn(),
  get: jest.fn().mockReturnValue({
    rbac: {
      botAdminRoleId: 'role-admin',
      moderatorRoleId: 'role-mod',
      memberRoleId: 'role-mem',
    },
  }),
};

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
  SettingsService: jest.fn().mockImplementation(() => mockSettingsService),
}));

jest.mock('../../src/utils/section-config.handlers.js', () => {
  const actual = jest.requireActual('../../src/utils/section-config.handlers.js');
  return {
    ...actual,
    executeSectionCommand: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../../src/features/container/container-edit.handler.js', () => ({
  startInteractiveEdit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/container/container-reset.handler.js', () => ({
  handleContainerReset: jest.fn().mockResolvedValue(undefined),
}));

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123' },
    guildId: 'guild-123',
    user: { id: 'user-123' },
    channel: { id: 'channel-123' },
    replied: false,
    deferred: false,
    client: { database: {} },
    options: {
      getSubcommandGroup: jest.fn().mockReturnValue('roles'),
      getSubcommand: jest.fn().mockReturnValue('view'),
      getString: jest.fn().mockReturnValue('bot_admin'),
      getRole: jest.fn().mockReturnValue({ id: 'role-123', name: 'Bot Admin Role' }),
      getChannel: jest.fn().mockReturnValue({ id: 'channel-123' }),
      getBoolean: jest.fn().mockReturnValue(true),
    },
    reply: jest.fn().mockResolvedValue({}),
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
  };

  return { ...base, ...overrides };
}

describe('/config command — Structure & Builder', () => {
  const json = data.toJSON();

  it('phải có root name là "config"', () => {
    expect(json.name).toBe('config');
  });

  it('không giới hạn default_member_permissions trên UI (để Router Policy kiểm soát ở runtime)', () => {
    expect(json.default_member_permissions).toBeUndefined();
  });

  it('phải có đúng 5 SubcommandGroups: roles, welcome, booster, container, bot', () => {
    const groupNames = json.options?.map((opt: any) => opt.name);
    expect(groupNames).toEqual(['roles', 'welcome', 'booster', 'container', 'bot']);
    json.options?.forEach((opt: any) => {
      expect(opt.type).toBe(2); // 2 = SUB_COMMAND_GROUP
    });
  });

  describe('roles group structure', () => {
    const rolesGroup = json.options?.find((o: any) => o.name === 'roles');

    it('phải chứa subcommands: set, view', () => {
      const subNames = rolesGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['set', 'view']);
    });

    it('subcommand "set" phải có options: role_type (STRING) và role (ROLE)', () => {
      const setSub = rolesGroup?.options?.find((s: any) => s.name === 'set');
      expect(setSub.options).toHaveLength(2);

      const roleTypeOpt = setSub.options.find((o: any) => o.name === 'role_type');
      expect(roleTypeOpt.type).toBe(3); // STRING
      expect(roleTypeOpt.required).toBe(true);
      expect(roleTypeOpt.choices?.map((c: any) => c.value)).toEqual([
        'bot_admin',
        'moderator',
        'member',
      ]);

      const roleOpt = setSub.options.find((o: any) => o.name === 'role');
      expect(roleOpt.type).toBe(8); // ROLE
      expect(roleOpt.required).toBe(true);
    });
  });

  describe('welcome group structure', () => {
    const welcomeGroup = json.options?.find((o: any) => o.name === 'welcome');

    it('phải chứa subcommands: setchannel, setrole, toggle, status', () => {
      const subNames = welcomeGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['setchannel', 'setrole', 'toggle', 'status']);
    });
  });

  describe('booster group structure', () => {
    const boosterGroup = json.options?.find((o: any) => o.name === 'booster');

    it('phải chứa subcommands: setchannel, setrole, toggle, status', () => {
      const subNames = boosterGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['setchannel', 'setrole', 'toggle', 'status']);
    });
  });

  describe('container group structure', () => {
    const containerGroup = json.options?.find((o: any) => o.name === 'container');

    it('phải chứa subcommands: edit, reset', () => {
      const subNames = containerGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['edit', 'reset']);
    });

    it('subcommand "edit" và "reset" phải có option "type" (STRING, required)', () => {
      const editSub = containerGroup?.options?.find((s: any) => s.name === 'edit');
      const resetSub = containerGroup?.options?.find((s: any) => s.name === 'reset');

      const editTypeOpt = editSub.options.find((o: any) => o.name === 'type');
      expect(editTypeOpt.type).toBe(3);
      expect(editTypeOpt.required).toBe(true);

      const resetTypeOpt = resetSub.options.find((o: any) => o.name === 'type');
      expect(resetTypeOpt.type).toBe(3);
      expect(resetTypeOpt.required).toBe(true);
    });
  });

  describe('bot group structure', () => {
    const botGroup = json.options?.find((o: any) => o.name === 'bot');

    it('phải chứa subcommands: guilds, setannouncechannel, announce', () => {
      const subNames = botGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['guilds', 'setannouncechannel', 'announce']);
    });

    it('subcommand "setannouncechannel" phải có option "channel" (CHANNEL, required)', () => {
      const setSub = botGroup?.options?.find((s: any) => s.name === 'setannouncechannel');
      expect(setSub.options).toHaveLength(1);
      const chanOpt = setSub.options[0];
      expect(chanOpt.name).toBe('channel');
      expect(chanOpt.type).toBe(7); // CHANNEL
      expect(chanOpt.required).toBe(true);
    });
  });
});

describe('/config command — Execute Dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phải từ chối nếu không ở trong guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('chỉ dùng được trong server') }),
    );
  });

  it('roles set: phải cập nhật botAdminRoleId và legacy ownerRoleId cho bot_admin', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('roles'),
        getSubcommand: jest.fn().mockReturnValue('set'),
        getString: jest.fn().mockReturnValue('bot_admin'),
        getRole: jest.fn().mockReturnValue({ id: 'role-999', name: 'Admin Role' }),
      },
    });

    await execute(interaction);

    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-123', {
      rbac: {
        botAdminRoleId: 'role-999',
        ownerRoleId: 'role-999',
      },
    });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('role-999') }),
    );
  });

  it('roles set: phải cập nhật moderatorRoleId cho moderator', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('roles'),
        getSubcommand: jest.fn().mockReturnValue('set'),
        getString: jest.fn().mockReturnValue('moderator'),
        getRole: jest.fn().mockReturnValue({ id: 'role-888', name: 'Mod Role' }),
      },
    });

    await execute(interaction);

    expect(mockSettingsService.update).toHaveBeenCalledWith('guild-123', {
      rbac: {
        moderatorRoleId: 'role-888',
      },
    });
  });

  it('roles set: phải chặn role @everyone', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('roles'),
        getSubcommand: jest.fn().mockReturnValue('set'),
        getString: jest.fn().mockReturnValue('member'),
        getRole: jest.fn().mockReturnValue({ id: 'guild-123', name: '@everyone' }),
      },
    });

    await execute(interaction);

    expect(mockSettingsService.update).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('roles view: phải hiển thị cấu hình hiện tại', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('roles'),
        getSubcommand: jest.fn().mockReturnValue('view'),
      },
    });

    await execute(interaction);

    expect(mockSettingsService.get).toHaveBeenCalledWith('guild-123');
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array) }),
    );
  });

  it('roles view: khi interaction đã deferred trước đó, sendReply gọi editReply', async () => {
    const interaction = createMockInteraction({
      deferred: true,
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('roles'),
        getSubcommand: jest.fn().mockReturnValue('view'),
      },
    });

    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array) }),
    );
  });

  it('welcome group: phải dispatch tới executeSectionCommand với welcome config', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('welcome'),
        getSubcommand: jest.fn().mockReturnValue('status'),
      },
    });

    await execute(interaction);

    expect(executeSectionCommand).toHaveBeenCalledWith(
      interaction,
      expect.anything(),
      expect.objectContaining({ sectionKey: 'welcome' }),
    );
  });

  it('booster group: phải dispatch tới executeSectionCommand với booster config', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('booster'),
        getSubcommand: jest.fn().mockReturnValue('status'),
      },
    });

    await execute(interaction);

    expect(executeSectionCommand).toHaveBeenCalledWith(
      interaction,
      expect.anything(),
      expect.objectContaining({ sectionKey: 'booster' }),
    );
  });

  it('container edit: phải gọi startInteractiveEdit', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('container'),
        getSubcommand: jest.fn().mockReturnValue('edit'),
        getString: jest.fn().mockReturnValue('welcome'),
      },
    });

    await execute(interaction);

    expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'welcome');
  });

  it('container reset: phải gọi handleContainerReset', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('container'),
        getSubcommand: jest.fn().mockReturnValue('reset'),
      },
    });

    await execute(interaction);

    expect(handleContainerReset).toHaveBeenCalledWith(interaction, 'guild-123');
  });

  it('bot guilds: phải reply danh sách guilds với ephemeral flag', async () => {
    const mockGuilds = new Map();
    mockGuilds.set('guild-1', {
      name: 'Server Alpha',
      id: 'guild-1',
      memberCount: 50,
      ownerId: 'owner-1',
    });

    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('bot'),
        getSubcommand: jest.fn().mockReturnValue('guilds'),
      },
      client: {
        guilds: {
          cache: mockGuilds,
        },
      },
      reply: jest.fn().mockResolvedValue(undefined),
    });

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalled();
    const replyCall = interaction.reply.mock.calls[0][0];
    expect(replyCall.flags).toBeDefined();
    expect(replyCall.components).toBeDefined();
  });

  it('bot guilds: phải xử lý khi không có guild nào', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('bot'),
        getSubcommand: jest.fn().mockReturnValue('guilds'),
      },
      client: {
        guilds: {
          cache: new Map(),
        },
      },
      reply: jest.fn().mockResolvedValue(undefined),
    });

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalled();
  });

  describe('bot setannouncechannel', () => {
    it('phải cập nhật kênh thông báo vào settings của guild', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommandGroup: jest.fn().mockReturnValue('bot'),
          getSubcommand: jest.fn().mockReturnValue('setannouncechannel'),
          getChannel: jest.fn().mockReturnValue({ id: 'chan-announce', name: 'thông-báo-chung' }),
        },
      });

      await execute(interaction);

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-123', {
        botAnnounce: {
          channelId: 'chan-announce',
        },
      });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('chan-announce') }),
      );
    });
  });

  describe('bot announce', () => {
    it('phải từ chối nếu user không phải Bot Owner', async () => {
      const interaction = createMockInteraction({
        user: { id: 'random-user-id' },
        options: {
          getSubcommandGroup: jest.fn().mockReturnValue('bot'),
          getSubcommand: jest.fn().mockReturnValue('announce'),
          getBoolean: jest.fn().mockReturnValue(false),
          getString: jest.fn().mockReturnValue(null),
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
      const replyCall = interaction.reply.mock.calls[0][0];
      expect(JSON.stringify(replyCall)).toContain('Chủ sở hữu Bot');
    });

    it('cho phép xem trước (preview: true) nếu là Bot Owner', async () => {
      const interaction = createMockInteraction({
        user: { id: '418779992290492416' },
        options: {
          getSubcommandGroup: jest.fn().mockReturnValue('bot'),
          getSubcommand: jest.fn().mockReturnValue('announce'),
          getBoolean: jest.fn().mockReturnValue(true),
          getString: jest.fn().mockReturnValue('Test custom note'),
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
      const replyCall = interaction.reply.mock.calls[0][0];
      expect(JSON.stringify(replyCall)).toMatch(/xem trước/i);
      expect(JSON.stringify(replyCall)).toContain('Test custom note');
    });

    it('broadcast tới toàn bộ máy chủ (preview: false) nếu là Bot Owner', async () => {
      const mockChannel = {
        name: 'thông-báo',
        isTextBased: () => true,
        isDMBased: () => false,
        isVoiceBased: () => false,
        permissionsFor: jest.fn().mockReturnValue({
          has: jest.fn().mockReturnValue(true),
        }),
        send: jest.fn().mockResolvedValue({}),
      };

      const mockGuilds = new Map();
      mockGuilds.set('guild-1', {
        name: 'Server KLB',
        channels: {
          cache: new Map([['chan-1', mockChannel]]),
        },
        members: {
          me: { id: 'bot-id' },
        },
      });

      const interaction = createMockInteraction({
        user: { id: '418779992290492416' },
        options: {
          getSubcommandGroup: jest.fn().mockReturnValue('bot'),
          getSubcommand: jest.fn().mockReturnValue('announce'),
          getBoolean: jest.fn().mockReturnValue(false),
          getString: jest.fn().mockReturnValue(null),
        },
        client: {
          guilds: {
            cache: mockGuilds,
          },
        },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});

