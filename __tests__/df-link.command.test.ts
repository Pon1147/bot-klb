/**
 * Unit tests cho df-link.command.ts — /df-link slash command.
 * Version: có subcommand `start` (webhook) và `link` (manual input).
 */

jest.mock('discord.js', () => ({
  AttachmentBuilder: class {
    constructor(public pathOrBuffer: any, public opts?: any) {}
  },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addSubcommand(fn: (sub: any) => any) {
      const sub = {
        setName() { return this; },
        setDescription() { return this; },
        addStringOption() { return this; },
      };
      fn(sub);
      return this;
    }
  },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => '/* Delta Force HQ — Webhook userscript */ var WEBHOOK_URL = "@@WEBHOOK_URL@@"; var CODE = "@@CLAIM_CODE@@";'),
}));

jest.mock('path', () => ({
  join: jest.fn(() => '/mock/path/df-webhook.js'),
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
  generateCode: jest.fn(),
}));

jest.mock('../src/services/deltaforce.api.js', () => ({
  getMyData: jest.fn(),
}));

jest.mock('../src/database/df.token.db.js', () => ({
  saveDfToken: jest.fn(),
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

jest.mock('../src/services/webhook-tunnel.js', () => ({
  setupTunnel: jest.fn().mockResolvedValue('https://test.trycloudflare.com'),
  getTunnelUrl: jest.fn(() => 'https://test.trycloudflare.com'),
  isTunnelAlive: jest.fn(() => true),
  stopTunnel: jest.fn(),
}));

import { execute } from '../src/commands/df/link.command.js';
import { generateCode } from '../src/services/df-claim-store.js';
import { setupTunnel, isTunnelAlive, stopTunnel } from '../src/services/webhook-tunnel.js';
import { getMyData } from '../src/services/deltaforce.api.js';
import { saveDfToken } from '../src/database/df.token.db.js';
import { MessageFlags } from 'discord.js';

describe('df-link.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);
  const mockDmSend = jest.fn().mockResolvedValue(undefined);
  const mockCreateDm = jest.fn().mockResolvedValue({ send: mockDmSend });

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222', createDM: mockCreateDm },
      reply: mockReply,
      editReply: mockEditReply,
      deferReply: mockDeferReply,
      options: {
        getSubcommand: jest.fn(() => 'start'), // default: webhook flow
        getString: jest.fn(),
      },
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate tunnel already set up by main() boot sequence
    process.env.WEBHOOK_URL = 'https://test.trycloudflare.com';
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

  describe('subcommand: start (webhook flow)', () => {
    it('nên sinh claim code và gửi script qua DM', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(mockDeferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(generateCode).toHaveBeenCalledWith('222');
      expect(mockCreateDm).toHaveBeenCalled();
      expect(mockDmSend).toHaveBeenCalled();
    });

    it('nên trả về xác nhận với claim code', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ABC123'),
        }),
      );
    });

    it('nên gửi script file có đúng tên và chứa claim code', async () => {
      (generateCode as jest.Mock).mockReturnValue('XYZ789');
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      const dmCall = mockDmSend.mock.calls[0];
      const files = dmCall[0].files;
      expect(files).toHaveLength(1);
      expect(files[0].opts.name).toBe('df-link-script.js');
      const content = files[0].pathOrBuffer.toString();
      expect(content).toContain('XYZ789');
    });

    it('nên gửi script có thay thế WEBHOOK_URL', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      const dmCall = mockDmSend.mock.calls[0];
      const content = dmCall[0].files[0].pathOrBuffer.toString();
      expect(content).not.toContain('@@WEBHOOK_URL@@');
      expect(content).not.toContain('@@CLAIM_CODE@@');
    });

    it('nên handle DM error gracefully', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const mockConsoleError = console.error;
      console.error = jest.fn();
      try {
        const interaction = createMockInteraction({
          user: { id: '222', createDM: jest.fn().mockRejectedValue(new Error('DM blocked')) },
        });
        await execute(interaction, mockDb);

        const responded = mockReply.mock.calls.length > 0 || mockEditReply.mock.calls.length > 0;
        expect(responded).toBe(true);
      } finally {
        console.error = mockConsoleError;
      }
    });

    it('nên handle editReply error sau khi deferReply', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const mockConsoleError = console.error;
      console.error = jest.fn();

      try {
        const mockEditReplyThrows = jest.fn().mockRejectedValue(new Error('already replied'));
        const interaction = createMockInteraction({
          deferred: true,
          user: { id: '222', createDM: jest.fn().mockRejectedValue(new Error('DM blocked')) },
        });
        interaction.editReply = mockEditReplyThrows;

        await expect(execute(interaction, mockDb)).resolves.not.toThrow();
        expect(mockEditReplyThrows).toHaveBeenCalled();
      } finally {
        console.error = mockConsoleError;
      }
    });

    it('nên restart tunnel khi tunnel chết', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      (isTunnelAlive as jest.Mock).mockReturnValue(false);
      process.env.WEBHOOK_URL = 'https://old-dead.trycloudflare.com';

      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(stopTunnel).toHaveBeenCalled();
      expect(setupTunnel).toHaveBeenCalled();
      expect(mockDmSend).toHaveBeenCalled();
    });

    it('nên skip tunnel setup khi dùng localhost', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      (isTunnelAlive as jest.Mock).mockReturnValue(false);
      process.env.WEBHOOK_URL = 'http://localhost:3500';

      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(setupTunnel).not.toHaveBeenCalled();
      expect(mockDmSend).toHaveBeenCalled();
      const content = mockDmSend.mock.calls[0][0].files[0].pathOrBuffer.toString();
      expect(content).toContain('localhost:3500');
    });

    it('nên fallback localhost khi setup tunnel thất bại', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      (isTunnelAlive as jest.Mock).mockReturnValue(false);
      delete process.env.WEBHOOK_URL;
      (setupTunnel as jest.Mock).mockRejectedValueOnce(new Error('cloudflared not found'));

      const mockConsoleError = console.error;
      console.error = jest.fn();
      try {
        const interaction = createMockInteraction();
        await execute(interaction, mockDb);

        expect(setupTunnel).toHaveBeenCalled();
        expect(mockDmSend).toHaveBeenCalled();
        const content = mockDmSend.mock.calls[0][0].files[0].pathOrBuffer.toString();
        expect(content).toContain('localhost:3500');
      } finally {
        console.error = mockConsoleError;
      }
    });
  });

  describe('subcommand: manual (manual input)', () => {
    it('nên lưu token và trả về success khi validate thành công', async () => {
      (getMyData as jest.Mock).mockResolvedValue({ nickname: 'TestPlayer' });
      (saveDfToken as jest.Mock).mockReturnValue(true);

      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123456789';
            if (name === 'token') return 'abcdef1234567890abcdef1234567890abcdef1234567890';
            return undefined;
          }),
        },
      });

      await execute(interaction, mockDb);

      expect(getMyData).toHaveBeenCalledWith({
        openid: '123456789',
        token: 'abcdef1234567890abcdef1234567890abcdef1234567890',
      });
      expect(saveDfToken).toHaveBeenCalledWith(
        mockDb,
        '222',
        '123456789',
        'abcdef1234567890abcdef1234567890abcdef1234567890',
      );
      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã liên kết'),
        }),
      );
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

      expect(getMyData).not.toHaveBeenCalled();
      expect(saveDfToken).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.any(Number),
        }),
      );
    });

    it('nên từ chối token quá ngắn (< 20 ký tự)', async () => {
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

      expect(getMyData).not.toHaveBeenCalled();
      expect(saveDfToken).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về error khi API validation thất bại', async () => {
      (getMyData as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123';
            if (name === 'token') return 'abcdef1234567890abcdef1234567890abcdef1234567890';
            return undefined;
          }),
        },
      });

      await execute(interaction, mockDb);

      expect(getMyData).toHaveBeenCalled();
      expect(saveDfToken).not.toHaveBeenCalled();
      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalled();
    });

    it('nên handle API error trả về lỗi chi tiết', async () => {
      (getMyData as jest.Mock).mockRejectedValue(new Error('GetMyData failed: code=1 msg=Invalid token'));

      const interaction = createMockInteraction({
        options: {
          getSubcommand: jest.fn(() => 'manual'),
          getString: jest.fn((name: string) => {
            if (name === 'openid') return '123';
            if (name === 'token') return 'abcdef1234567890abcdef1234567890abcdef1234567890';
            return undefined;
          }),
        },
      });

      const mockConsoleError = console.error;
      console.error = jest.fn();
      try {
        await execute(interaction, mockDb);
        expect(mockDeferReply).toHaveBeenCalled();
        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            flags: expect.any(Number),
          }),
        );
      } finally {
        console.error = mockConsoleError;
      }
    });
  });
});
