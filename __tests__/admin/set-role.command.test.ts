/// <reference types="jest" />
/**
 * Unit tests cho /set-role command (admin RBAC setter).
 * Verify owner và moderator subcommands, path resolution, và error handling.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadPermissions } from '../../src/config/permissions.js';
import { execute, data } from '../../src/features/admin/set-role.command.js';

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

jest.mock('../../src/config/permissions.js', () => ({
  loadPermissions: jest.fn(),
  getPermissionsFilePath: jest.fn(() => 'src/config/permissions.json'),
  DEFAULT_PERMISSIONS: {
    roles: {
      Owner: '418779992290492416',
      Moderator: '1504374050779303936',
      Member: '1513800432214872145',
    },
    commands: {},
  },
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

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockJoin = join as jest.MockedFunction<typeof join>;
const mockLoadPermissions = loadPermissions as jest.MockedFunction<typeof loadPermissions>;

const defaultPermissions = {
  roles: {
    Owner: '418779992290492416',
    Moderator: '1504374050779303936',
    Member: '1513800432214872145',
  },
  commands: {
    container: { requiredRoles: ['418779992290492416', '1504374050779303936'] },
    'df-link': { requiredRoles: ['1513800432214872145'] },
    'df-unlink': { requiredRoles: ['1513800432214872145'] },
    'df-daily': { requiredRoles: ['1513800432214872145'] },
    'df-stats': { requiredRoles: ['1513800432214872145'] },
    'df-history': { requiredRoles: ['1513800432214872145'] },
    'df-code': { requiredRoles: ['1513800432214872145'] },
    'team-find': { requiredRoles: ['1513800432214872145'] },
    booster: { requiredRoles: ['418779992290492416', '1504374050779303936'] },
    welcome: { requiredRoles: ['418779992290492416', '1504374050779303936'] },
  },
};

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
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));
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
      // Khi role null, code reply ngay (không deferReply)
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
    it('phải đọc permissions.json và update role Owner', async () => {
      const permCopy = JSON.parse(JSON.stringify(defaultPermissions));
      mockReadFileSync.mockReturnValue(JSON.stringify(permCopy));

      const interaction = makeInteraction({ subcommand: 'owner' });
      await execute(interaction as any, null as any);

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('999'),
        'utf8',
      );
      expect(mockLoadPermissions).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Owner') }),
      );
    });

    it('phải đọc permissions.json và update role Moderator', async () => {
      const permCopy = JSON.parse(JSON.stringify(defaultPermissions));
      mockReadFileSync.mockReturnValue(JSON.stringify(permCopy));

      const interaction = makeInteraction({ subcommand: 'moderator' });
      await execute(interaction as any, null as any);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('999'),
        'utf8',
      );
      expect(mockLoadPermissions).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Moderator') }),
      );
    });

    it('phải đọc permissions.json và update role Member', async () => {
      const permCopy = JSON.parse(JSON.stringify(defaultPermissions));
      mockReadFileSync.mockReturnValue(JSON.stringify(permCopy));

      const interaction = makeInteraction({ subcommand: 'member' });
      await execute(interaction as any, null as any);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('999'),
        'utf8',
      );
      expect(mockLoadPermissions).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Member') }),
      );
    });

    it('phải fallback DEFAULT_PERMISSIONS khi permissions.json chưa tồn tại hoặc parse lỗi', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const interaction = makeInteraction({ subcommand: 'owner' });
      await execute(interaction as any, null as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockLoadPermissions).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Owner') }),
      );
    });

    it('phải deferReply trước khi đọc file', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultPermissions));
      const interaction = makeInteraction();
      await execute(interaction as any, null as any);
      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('nên reply error khi writeFileSync throw', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultPermissions));
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      const interaction = makeInteraction();
      await execute(interaction as any, null as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });
  });
});
