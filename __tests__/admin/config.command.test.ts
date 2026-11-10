/// <reference types="jest" />
/**
 * Unit tests cho /config command (Command Tree Phase 2).
 * Verify builders, toJSON structure, options, và execute dispatch.
 */

import { data, execute, buildAnnouncementContainer } from '../../src/features/admin/config.command.js';
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

const mockIsQrServerEnabled = jest.fn().mockReturnValue(true);

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
  SettingsService: jest.fn().mockImplementation(() => mockSettingsService),
  isQrServerEnabled: (...args: any[]) => mockIsQrServerEnabled(...args),
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

jest.mock('../../src/config/bot.config.js', () => {
  const actual = jest.requireActual('../../src/config/bot.config.js');
  return {
    ...actual,
    botConfig: {
      ...actual.botConfig,
      botOwnerId: '418779992290492416',
    },
  };
});

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123', name: 'Test Guild', ownerId: 'user-123' },
    guildId: 'guild-123',
    user: { id: 'user-123' },
    member: { roles: ['role-admin'] },
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

  it('phải có đúng 8 SubcommandGroups: roles, welcome, leave, booster, container, bot, qr-server, vietqr', () => {
    const groupNames = json.options?.map((opt: any) => opt.name);
    expect(groupNames).toEqual([
      'roles',
      'welcome',
      'leave',
      'booster',
      'container',
      'bot',
      'qr-server',
      'vietqr',
    ]);
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

    it('phải chứa subcommands: setchannel, setrole, toggle, status, test', () => {
      const subNames = welcomeGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['setchannel', 'setrole', 'toggle', 'status', 'test']);
    });
  });

  describe('leave group structure', () => {
    const leaveGroup = json.options?.find((o: any) => o.name === 'leave');

    it('phải chứa subcommands: setchannel, toggle, status, test', () => {
      const subNames = leaveGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['setchannel', 'toggle', 'status', 'test']);
    });
  });

  describe('booster group structure', () => {
    const boosterGroup = json.options?.find((o: any) => o.name === 'booster');

    it('phải chứa subcommands: setchannel, setrole, toggle, status, test', () => {
      const subNames = boosterGroup?.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['setchannel', 'setrole', 'toggle', 'status', 'test']);
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

  it('leave group: phải dispatch tới executeSectionCommand với leave config', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('leave'),
        getSubcommand: jest.fn().mockReturnValue('status'),
      },
    });

    await execute(interaction);

    expect(executeSectionCommand).toHaveBeenCalledWith(
      interaction,
      expect.anything(),
      expect.objectContaining({ sectionKey: 'leave' }),
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
        id: 'chan-1',
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
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<#chan-1> (#thông-báo)'),
        }),
      );
    });

    describe('buildAnnouncementContainer', () => {
      it('khi có message tùy biến, bot CHỈ phát nội dung tùy biến và KHÔNG chèn changelog cũ', () => {
        const customMsg = 'Gửi các admin server, vui lòng cấp quyền gửi tin nhắn daily cho bot nhé!';
        const result = buildAnnouncementContainer({ message: customMsg });
        const jsonStr = JSON.stringify(result);

        expect(jsonStr).toContain(customMsg);
        expect(jsonStr).toContain('📢 THÔNG BÁO TỪ BAN QUẢN TRỊ BOT DELTA');
        // Không chứa changelog cũ
        expect(jsonStr).not.toContain('Trình Mô Phỏng Bản Đồ 3D Tương Tác');
        expect(jsonStr).not.toContain('Thư Viện Build Súng Chuẩn Meta Garena');
      });

      it('hỗ trợ tiêu đề tùy biến qua title option', () => {
        const result = buildAnnouncementContainer({
          title: '⚠️ BẢO TRÌ HỆ THỐNG KHẨN CẤP',
          message: 'Hệ thống bảo trì 30 phút.',
        });
        const jsonStr = JSON.stringify(result);

        expect(jsonStr).toContain('# ⚠️ BẢO TRÌ HỆ THỐNG KHẨN CẤP');
        expect(jsonStr).toContain('Hệ thống bảo trì 30 phút.');
      });

      it('khi không truyền message, bot phát changelog giới thiệu chuẩn của Bot Delta', () => {
        const result = buildAnnouncementContainer();
        const jsonStr = JSON.stringify(result);

        expect(jsonStr).toContain('BẢN CẬP NHẬT TÍNH NĂNG MỚI — BOT DELTA');
        expect(jsonStr).toContain('Bot Delta vừa được cập nhật');
        expect(jsonStr).not.toContain('BOT KLB');
      });
    });
  });

  describe('group: qr-server', () => {
    it('SlashCommandBuilder nên có nhóm qr-server với subcommands toggle và status', () => {
      const json = data.toJSON();
      const qrGroup = json.options?.find((opt: any) => opt.name === 'qr-server') as any;
      expect(qrGroup).toBeDefined();

      const toggleSub = qrGroup.options?.find((opt: any) => opt.name === 'toggle');
      expect(toggleSub).toBeDefined();
      expect(toggleSub.options?.some((o: any) => o.name === 'enabled')).toBe(true);
      expect(toggleSub.options?.some((o: any) => o.name === 'server_id')).toBe(true);

      const statusSub = qrGroup.options?.find((opt: any) => opt.name === 'status');
      expect(statusSub).toBeDefined();
    });

    describe('subcommand: toggle', () => {
      it('nên từ chối khi người dùng không phải Bot Owner', async () => {
        const interaction = createMockInteraction({
          user: { id: 'imposter-user-id' },
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('qr-server'),
            getSubcommand: jest.fn().mockReturnValue('toggle'),
            getBoolean: jest.fn().mockReturnValue(true),
            getString: jest.fn().mockReturnValue(null),
          },
        });

        await execute(interaction);

        expect(mockSettingsService.update).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            flags: expect.anything(),
          }),
        );
        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Chỉ duy nhất Chủ sở hữu Bot (Bot Owner)');
      });

      it('nên bật tính năng QR thành công khi gọi bởi Bot Owner (server hiện tại)', async () => {
        const interaction = createMockInteraction({
          guildId: 'guild-abc',
          user: { id: '418779992290492416' }, // Bot Owner ID trong mock botConfig
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('qr-server'),
            getSubcommand: jest.fn().mockReturnValue('toggle'),
            getBoolean: jest.fn().mockReturnValue(true),
            getString: jest.fn().mockReturnValue(null),
          },
          client: {
            guilds: {
              cache: new Map([['guild-abc', { id: 'guild-abc', name: 'Server Test QR' }]]),
            },
          },
        });

        await execute(interaction);

        expect(mockSettingsService.update).toHaveBeenCalledWith(
          'guild-abc',
          expect.objectContaining({
            qrServer: expect.objectContaining({
              enabled: true,
              updatedBy: '418779992290492416',
            }),
          }),
        );

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('ĐÃ KÍCH HOẠT (OPEN)');
        expect(jsonStr).toContain('Server Test QR');
      });

      it('nên bật/tắt cho server khác qua option server_id', async () => {
        const interaction = createMockInteraction({
          guildId: 'guild-current',
          user: { id: '418779992290492416' },
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('qr-server'),
            getSubcommand: jest.fn().mockReturnValue('toggle'),
            getBoolean: jest.fn().mockReturnValue(false),
            getString: jest.fn().mockImplementation((name: string) => {
              if (name === 'server_id') return 'guild-remote-999';
              return null;
            }),
          },
          client: {
            guilds: {
              cache: new Map([['guild-remote-999', { id: 'guild-remote-999', name: 'Server VIP Từ Xa' }]]),
            },
          },
        });

        await execute(interaction);

        expect(mockSettingsService.update).toHaveBeenCalledWith(
          'guild-remote-999',
          expect.objectContaining({
            qrServer: expect.objectContaining({
              enabled: false,
            }),
          }),
        );

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('ĐÃ KHÓA (DISABLED)');
        expect(jsonStr).toContain('Server VIP Từ Xa');
      });
    });

    describe('subcommand: status', () => {
      it('nên từ chối khi không phải Bot Owner', async () => {
        const interaction = createMockInteraction({
          user: { id: 'random-user' },
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('qr-server'),
            getSubcommand: jest.fn().mockReturnValue('status'),
            getString: jest.fn().mockReturnValue(null),
          },
        });

        await execute(interaction);

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Chỉ duy nhất Chủ sở hữu Bot (Bot Owner)');
      });

      it('nên hiển thị trạng thái chính xác khi gọi bởi Bot Owner', async () => {
        mockSettingsService.get.mockReturnValueOnce({
          qrServer: {
            enabled: true,
            updatedAt: 1710000000000,
            updatedBy: '418779992290492416',
          },
        });

        const interaction = createMockInteraction({
          guildId: 'guild-abc',
          user: { id: '418779992290492416' },
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('qr-server'),
            getSubcommand: jest.fn().mockReturnValue('status'),
            getString: jest.fn().mockReturnValue(null),
          },
          client: {
            guilds: {
              cache: new Map([['guild-abc', { id: 'guild-abc', name: 'Server Test QR' }]]),
            },
          },
        });

        await execute(interaction);

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Trạng Thái Cấp Phép QR Server');
        expect(jsonStr).toContain('ĐÃ KÍCH HOẠT (OPEN)');
      });
    });

    describe('group: vietqr', () => {
      it('SlashCommandBuilder nên có nhóm vietqr với subcommands set, workflow và status', () => {
        const cmdJson = data.toJSON();
        const qrGroup = cmdJson.options?.find((opt: any) => opt.name === 'vietqr') as any;
        expect(qrGroup).toBeDefined();
        const subNames = qrGroup.options?.map((opt: any) => opt.name);
        expect(subNames).toEqual(['set', 'workflow', 'status', 'preview']);
      });

      it('vietqr set: từ chối khi server chưa được Bot Owner mở tính năng QR', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(false);

        const interaction = createMockInteraction({
          guildId: 'guild-unauthorized',
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('set'),
            getString: jest.fn((key: string) => {
              if (key === 'bank') return 'MB';
              if (key === 'account_no') return '123456';
              if (key === 'account_name') return 'NGUYEN VAN A';
              return null;
            }),
          },
        });

        await execute(interaction);

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Tính năng QR Thanh toán tự động chưa được mở');
      });

      it('vietqr set: cập nhật thông tin ngân hàng thành công khi server đã mở QR', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(true);

        const interaction = createMockInteraction({
          guildId: 'guild-authorized',
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('set'),
            getString: jest.fn((key: string) => {
              if (key === 'bank') return 'MB';
              if (key === 'account_no') return '0987654321';
              if (key === 'account_name') return 'NGUYEN VAN A';
              if (key === 'prefix') return 'NAP';
              return null;
            }),
          },
        });

        await execute(interaction);

        expect(mockSettingsService.update).toHaveBeenCalledWith('guild-authorized', {
          vietqr: {
            enabled: true,
            mode: 'server_wallet',
            bankId: 'MB',
            accountNo: '0987654321',
            accountName: 'NGUYEN VAN A',
            prefix: 'NAP',
            template: 'compact2',
          },
        });

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Cấu Hình VietQR Thanh Toán Đã Được Cập Nhật');
        expect(jsonStr).toContain('MBBank (Quân Đội)');
      });

      it('vietqr set: từ chối khi user không phải Guild Owner, Bot Owner, hoặc Bot Admin', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(true);

        const interaction = createMockInteraction({
          guildId: 'guild-authorized',
          guild: { id: 'guild-authorized', ownerId: 'other-owner-999' },
          user: { id: 'regular-mod-123' },
          member: { roles: ['role-mod'] },
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('set'),
            getString: jest.fn((key: string) => {
              if (key === 'bank') return 'MB';
              if (key === 'account_no') return '0987654321';
              if (key === 'account_name') return 'NGUYEN VAN A';
              return null;
            }),
          },
        });

        await execute(interaction);

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Bạn không có quyền thay đổi thông tin ngân hàng');
      });

      it('vietqr status: xem trạng thái cấu hình hiện tại', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(true);
        mockSettingsService.get.mockReturnValueOnce({
          vietqr: {
            enabled: true,
            bankId: 'MB',
            accountNo: '0987654321',
            accountName: 'NGUYEN VAN A',
            prefix: 'NAP',
            template: 'compact2',
          },
        });

        const interaction = createMockInteraction({
          guildId: 'guild-authorized',
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('status'),
          },
        });

        await execute(interaction);

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Cấu Hình VietQR Máy Chủ');
        expect(jsonStr).toContain('MBBank (Quân Đội)');
      });

      it('vietqr workflow: cấu hình workflow nhân viên và feedback thành công', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(true);
        mockSettingsService.get.mockReturnValueOnce({
          vietqr: {
            enabled: true,
            bankId: 'MB',
            accountNo: '0987654321',
            accountName: 'NGUYEN VAN A',
            prefix: 'NAP',
            template: 'compact2',
          },
        });

        const interaction = createMockInteraction({
          guildId: 'guild-authorized',
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('workflow'),
            getRole: jest.fn().mockReturnValue({ id: 'staff-role-999' }),
            getChannel: jest.fn().mockReturnValue({ id: 'feedback-ch-888' }),
            getBoolean: jest.fn().mockReturnValue(true),
            getString: jest.fn().mockReturnValue('Cảm ơn bạn yêu quý!'),
          },
        });

        await execute(interaction);

        expect(mockSettingsService.update).toHaveBeenCalledWith(
          'guild-authorized',
          expect.objectContaining({
            vietqr: expect.objectContaining({
              staffRoleId: 'staff-role-999',
              feedbackChannelId: 'feedback-ch-888',
              enableRating: true,
              thanksMessage: 'Cảm ơn bạn yêu quý!',
            }),
          }),
        );

        const replyPayload = interaction.reply.mock.calls[0][0];
        const jsonStr = JSON.stringify(replyPayload);
        expect(jsonStr).toContain('Quy Trình Workflow VietQR Đã Được Cập Nhật');
        expect(jsonStr).toContain('staff-role-999');
      });

      it('vietqr preview: tạo mã QR thử nghiệm và trả về container xem trước', async () => {
        mockIsQrServerEnabled.mockReturnValueOnce(true);
        mockSettingsService.get.mockReturnValueOnce({
          vietqr: {
            enabled: true,
            bankId: 'MB',
            accountNo: '0987654321',
            accountName: 'NGUYEN VAN A',
            prefix: 'TEST',
          },
        });

        const interaction = createMockInteraction({
          guildId: 'guild-authorized',
          options: {
            getSubcommandGroup: jest.fn().mockReturnValue('vietqr'),
            getSubcommand: jest.fn().mockReturnValue('preview'),
            getInteger: jest.fn().mockReturnValue(50000),
          },
        });

        await execute(interaction);

        expect(interaction.reply).toHaveBeenCalled();
        const callArgs = interaction.reply.mock.calls[0][0];
        expect(callArgs.content).toContain('CHẾ ĐỘ XEM TRƯỚC (PREVIEW)');
      });
    });
  });
});

