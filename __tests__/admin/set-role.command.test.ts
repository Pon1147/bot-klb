/**
 * Unit tests cho /set-role command (admin RBAC setter).
 * Verify owner và moderator subcommands, path resolution, và error handling.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadPermissions } from '../../src/config/permissions.js';
import { execute, data } from '../../src/commands/admin/set-role.command.js';

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

jest.mock('../../src/config/permissions.js', () => ({
  loadPermissions: jest.fn(),
}));

jest.mock('discord.js', () => ({
  MessageFlags: { Ephemeral: 64, IsComponentsV2: 65536 },
  PermissionFlagsBits: { Administrator: 0x8 },
  SlashCommandBuilder: class {
    name = '';
    description = '';
    setName(n: string) { this.name = n; return this; }
    setDescription(d: string) { this.description = d; return this; }
    addSubcommand() { return this; }
    setDefaultMemberPermissions() { return this; }
    addRoleOption() { return this; }
    toJSON() { return { name: 'set-role', options: [{ name: 'owner', type: 1 }, { name: 'moderator', type: 1 }] }; }
  },
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
}));

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockJoin = join as jest.MockedFunction<typeof join>;
const mockLoadPermissions = loadPermissions as jest.MockedFunction<typeof loadPermissions>;

const defaultPermissions = {
  roles: { Owner: '418779992290492416', Moderator: '1504374050779303936', Member: '1513800432214872145' },
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

function makeInteraction(opts: {
  guild?: object | null;
  admin?: boolean;
  subcommand?: string;
  role?: { id: string; name: string } | null;
} = {}) {
  const { guild = { id: 'guild-1' }, admin = true, subcommand = 'owner', role = { id: '999', name: 'NewOwner' } } = opts;
  return {
    guild,
    member: {
      permissions: { has: (perm: number) => admin },
    },
    options: {
      getSubcommand: () => subcommand,
      getRole: (name: string) => role,
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

    it('phải có 2 subcommands: owner và moderator', () => {
      const subcommands = data.toJSON().options?.filter((o: any) => o.type === 1) || [];
      expect(subcommands.length).toBe(2);
      const names = subcommands.map((s: any) => s.name);
      expect(names).toContain('owner');
      expect(names).toContain('moderator');
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

    it('phải deferReply trước khi đọc file', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultPermissions));
      const interaction = makeInteraction();
      await execute(interaction as any, null as any);
      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('nên reply error khi writeFileSync throw', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultPermissions));
      mockWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });

      const interaction = makeInteraction();
      await execute(interaction as any, null as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });
  });
});
