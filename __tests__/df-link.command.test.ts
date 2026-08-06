/**
 * Unit tests cho df-link.command.ts — /df-link slash command.
 *
 * Subcommands: start, status, unlink, manual.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  ActionRowBuilder: class {
    constructor() { this._components = []; }
    addComponents(...c: any[]) { this._components = c; return this; }
    toJSON() { return { type: 1, components: this._components.map((c: any) => c.toJSON()) }; }
  },
  ButtonBuilder: class {
    constructor() { this._data = {}; }
    setCustomId(v: string) { this._data.customId = v; return this; }
    setLabel(v: string) { this._data.label = v; return this; }
    setStyle(v: any) { this._data.style = v; return this; }
    toJSON() { return { type: 2, custom_id: this._data.customId, label: this._data.label, style: this._data.style }; }
  },
  ButtonStyle: { Primary: 1, Secondary: 2 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addSubcommand(fn: (sub: any) => any) {
      const sub: any = {
        setName() { return this; },
        setDescription() { return this; },
        addStringOption(cb: any) {
          const opt: any = {
            setName() { return this; },
            setDescription() { return this; },
            setRequired() { return this; },
          };
          cb(opt);
          return this;
        },
      };
      fn(sub);
      return this;
    }
  },
}));

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn(() => ({
      get: jest.fn(),
      run: jest.fn().mockReturnValue({ changes: 0, lastInsertRowid: 1 }),
    })),
    exec: jest.fn(),
    close: jest.fn(),
  }));
});

jest.mock('../src/services/df-claim-store.js', () => ({
  generateCode: jest.fn(() => 'ABC123'),
}));

jest.mock('../src/database/df.token.db.js', () => ({
  saveDfToken: jest.fn(),
  getDfToken: jest.fn(),
}));

jest.mock('../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
  revokeBinding: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  buildInfoContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  buildSuccessContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
}));

import { execute } from '../src/commands/df/link.command.js';
import { generateCode } from '../src/services/df-claim-store.js';
import { saveDfToken } from '../src/database/df.token.db.js';
import { getActiveBinding } from '../src/database/df-binding.db.js';
import { MessageFlags } from 'discord.js';

describe('df-link.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);
  const mockDmSend = jest.fn().mockResolvedValue(undefined);
  const mockCreateDm = jest.fn().mockResolvedValue({ send: mockDmSend });

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222', createDM: mockCreateDm },
      reply: mockReply,
      editReply: jest.fn().mockResolvedValue(undefined),
      deferReply: mockDeferReply,
      options: {
        getSubcommand: jest.fn(() => 'start'),
        getString: jest.fn(),
      },
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_URL = 'https://test.trycloudflare.com';
    (generateCode as jest.Mock).mockReturnValue('ABC123');
    (getActiveBinding as jest.Mock).mockReturnValue(undefined);
    (saveDfToken as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.WEBHOOK_URL;
  });

  describe('guild check', () => {
    it('nên trả về error khi không có guild', async () => {
      const interaction = createMockInteraction({ guild: null });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('server'), flags: MessageFlags.Ephemeral }),
      );
    });
  });

  describe('subcommand: start', () => {
    it('nên sinh claim code và reply in-channel với button', async () => {
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(generateCode).toHaveBeenCalledWith(mockDb, '222');
      expect(mockCreateDm).not.toHaveBeenCalled();
      expect(mockDmSend).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên reply chứa claim code + button components', async () => {
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      const replyCall = mockReply.mock.calls[0];
      expect(replyCall[0].content).toContain('ABC123');
      expect(replyCall[0].components).toBeDefined();
      expect(replyCall[0].components).toHaveLength(1);
    });
  });

  describe('subcommand: status', () => {
    it('nên hiển thị binding khi đã link', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        openid: 'abcdef1234567890',
        status: 'active',
        last_ok_at: '2026-08-03 10:00:00',
      });

      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'status') },
      });
      await execute(interaction, mockDb);

      expect(mockReply).toHaveBeenCalled();
      const replyCall = mockReply.mock.calls[0];
      expect(replyCall[0].components).toBeDefined();
    });

    it('nên hiển thị thông báo chưa link', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'status') },
      });
      await execute(interaction, mockDb);

      expect(mockReply).toHaveBeenCalled();
    });

    it('nên fallback legacy token khi không có binding', async () => {
      const { getDfToken } = require('../src/database/df.token.db.js');
      (getDfToken as jest.Mock).mockReturnValue({
        openid: 'legacy123',
        linked_at: '2026-08-01 00:00:00',
      });

      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'status') },
      });
      await execute(interaction, mockDb);

      expect(mockReply).toHaveBeenCalled();
    });
  });

  describe('subcommand: unlink', () => {
    it('nên revoke binding và trả về success', async () => {
      const { revokeBinding } = require('../src/database/df-binding.db.js');
      (getActiveBinding as jest.Mock).mockReturnValue({
        id: 1,
        openid: 'test',
        status: 'active',
      });

      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'unlink') },
      });
      await execute(interaction, mockDb);

      expect(revokeBinding).toHaveBeenCalledWith(mockDb, '222');
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên xóa legacy token khi không có binding', async () => {
      const { getDfToken, saveDfToken: _ } = require('../src/database/df.token.db.js');
      (getDfToken as jest.Mock).mockReturnValue({
        openid: 'legacy',
        token: 'abc',
      });

      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'unlink') },
      });
      await execute(interaction, mockDb);

      expect(mockReply).toHaveBeenCalled();
    });

    it('nên hiển thị thông báo chưa link khi không có gì để unlink', async () => {
      const { getDfToken } = require('../src/database/df.token.db.js');
      (getDfToken as jest.Mock).mockReturnValue(undefined);

      const interaction = createMockInteraction({
        options: { getSubcommand: jest.fn(() => 'unlink') },
      });
      await execute(interaction, mockDb);

      expect(mockReply).toHaveBeenCalled();
    });
  });

  describe('subcommand: manual', () => {
    it('nên lưu token và trả về success khi validate thành công', async () => {
      const mockEditReply = jest.fn().mockResolvedValue(undefined);
      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123456789';
            if (name === 'token') return 'abcdef1234567890abcdef1234567890abcdef1234567890';
            return undefined;
          }),
        },
        editReply: mockEditReply,
      });

      await execute(interaction, mockDb);

      expect(saveDfToken).toHaveBeenCalledWith(
        mockDb,
        '222',
        '123456789',
        'abcdef1234567890abcdef1234567890abcdef1234567890',
      );
      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalled();
    });

    it('nên từ chối token không đúng format hex', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123';
            if (name === 'token') return 'not-a-hex-token!!';
            return undefined;
          }),
        },
      });

      await execute(interaction, mockDb);

      expect(saveDfToken).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number) }),
      );
    });

    it('nửa từ chối token quá ngắn', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123';
            if (name === 'token') return 'abcdef1234';
            return undefined;
          }),
        },
      });

      await execute(interaction, mockDb);

      expect(saveDfToken).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về error khi saveDfToken throw', async () => {
      const mockEditReply = jest.fn().mockResolvedValue(undefined);
      (saveDfToken as jest.Mock).mockImplementation(() => {
        throw new Error('DB write failed');
      });

      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123456789';
            if (name === 'token') return 'abcdef1234567890abcdef1234567890abcdef1234567890';
            return undefined;
          }),
        },
        editReply: mockEditReply,
        deferred: true,
      });

      await execute(interaction, mockDb);

      expect(mockEditReply).toHaveBeenCalled();
      const editCall = mockEditReply.mock.calls[0][0];
      expect(editCall.components).toBeDefined();
    });
  });
});
