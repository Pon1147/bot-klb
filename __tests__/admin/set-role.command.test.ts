/// <reference types="jest" />
/**
 * Unit tests cho /set-role command (admin RBAC per-guild setter).
 * Verify owner, moderator và member subcommands, SettingsService update, và error handling.
 */

import { execute, data } from '../../src/features/admin/set-role.command.js';
import { getSettingsService } from '../../src/services/settings.service.js';

const mockSettingsService = {
  update: jest.fn(),
  get: jest.fn(),
};

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
  SettingsService: jest.fn().mockImplementation(() => mockSettingsService),
}));

jest.mock('discord.js', () => ({
  MessageFlags: { Ephemeral: 64, IsComponentsV2: 65536 },
  PermissionFlagsBits: { Administrator: 0x8 },
  SlashCommandBuilder: class {
    name = '';
    description = '';
    options: any[] = [];
    setName(n: string) {
      this.name = n;
      return this;
    }
    setDescription(d: string) {
      this.description = d;
      return this;
    }
    addSubcommand(fn: (sub: any) => any) {
      if (typeof fn === 'function') {
        const sub = {
          name: '',
          description: '',
          setName: (n: string) => {
            sub.name = n;
            return sub;
          },
          setDescription: (d: string) => {
            sub.description = d;
            return sub;
          },
          addRoleOption: (optFn: (opt: any) => any) => {
            optFn({
              setName: jest.fn().mockReturnThis(),
              setDescription: jest.fn().mockReturnThis(),
              setRequired: jest.fn().mockReturnThis(),
            });
            return sub;
          },
        };
        fn(sub);
        this.options.push({ name: sub.name, type: 1 });
      }
      return this;
    }
    setDefaultMemberPermissions() {
      return this;
    }
    addRoleOption() {
      return this;
    }
    toJSON() {
      return { name: this.name, options: this.options };
    }
  },
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((_msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: _msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
}));

function makeInteraction(
  opts: {
    guild?: object | null;
    admin?: boolean;
    subcommand?: string;
    role?: { id: string; name: string } | null;
  } = {},
) {
  const {
    guild = { id: 'guild-1' },
    admin = true,
    subcommand = 'owner',
    role = { id: '999', name: 'NewOwner' },
  } = opts;
  return {
    guild,
    member: {
      permissions: { has: (_perm: number) => admin },
    },
    options: {
      getSubcommand: () => subcommand,
      getRole: (_name: string) => role,
    },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}

describe('/set-role command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('data', () => {
    it('phải có name là set-role', () => {
      expect(data.name).toBe('set-role');
    });

    it('phải có 3 subcommands: owner, moderator và member', () => {
      const subcommands = data.toJSON().options?.filter((o: any) => o.type === 1) || [];
      expect(subcommands.length).toBe(3);
      const names = subcommands.map((s: any) => s.name);
      expect(names).toContain('owner');
      expect(names).toContain('moderator');
      expect(names).toContain('member');
    });
  });

  describe('execute — validation', () => {
    it('nên reply ephemeral khi không có guild', async () => {
      const interaction = makeInteraction({ guild: null });
      await execute(interaction as any, null as any);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('server') }),
      );
    });

    it('nên reply ephemeral khi không có Administrator permission', async () => {
      const interaction = makeInteraction({ admin: false });
      await execute(interaction as any, null as any);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Administrator') }),
      );
    });

    it('nên reply error container khi role không tìm thấy', async () => {
      const interaction = makeInteraction({ role: null });
      await execute(interaction as any, null as any);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });

    it('nên từ chối khi role là @everyone (id trùng guild id)', async () => {
      const interaction = makeInteraction({
        guild: { id: 'guild-1' },
        role: { id: 'guild-1', name: '@everyone' },
      });
      await execute(interaction as any, null as any);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });

    it('nên từ chối khi role có name rỗng', async () => {
      const interaction = makeInteraction({
        role: { id: '888', name: '   ' },
      });
      await execute(interaction as any, null as any);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });
  });

  describe('execute — flow', () => {
    it('phải cập nhật ownerRoleId cho guild qua SettingsService', async () => {
      const interaction = makeInteraction({ subcommand: 'owner' });
      await execute(interaction as any, null as any);

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
        rbac: {
          ownerRoleId: '999',
        },
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Owner') }),
      );
    });

    it('phải cập nhật moderatorRoleId cho guild qua SettingsService', async () => {
      const interaction = makeInteraction({ subcommand: 'moderator' });
      await execute(interaction as any, null as any);

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
        rbac: {
          moderatorRoleId: '999',
        },
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Moderator') }),
      );
    });

    it('phải cập nhật memberRoleId cho guild qua SettingsService', async () => {
      const interaction = makeInteraction({ subcommand: 'member' });
      await execute(interaction as any, null as any);

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
        rbac: {
          memberRoleId: '999',
        },
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Member') }),
      );
    });

    it('phải deferReply trước khi update settings', async () => {
      const interaction = makeInteraction();
      await execute(interaction as any, null as any);
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    });

    it('nên fallback tạo new SettingsService(database) khi getSettingsService() throw', async () => {
      (getSettingsService as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Not initialized');
      });

      const mockDb = {} as any;
      const interaction = makeInteraction({ subcommand: 'owner' });
      await execute(interaction as any, mockDb);

      expect(mockSettingsService.update).toHaveBeenCalledWith('guild-1', {
        rbac: {
          ownerRoleId: '999',
        },
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Owner') }),
      );
    });

    it('nên reply error khi settingsService.update throw', async () => {
      mockSettingsService.update.mockImplementationOnce(() => {
        throw new Error('Database write error');
      });

      const interaction = makeInteraction();
      await execute(interaction as any, null as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });
  });
});
