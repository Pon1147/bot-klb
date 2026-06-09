/**
 * Unit tests cho df-link.command.ts — /df-link slash command.
 * Test các subcommands: paste, unlink, get-script, status.
 */

jest.mock('discord.js', () => ({
  AttachmentBuilder: class {
    constructor(public pathOrBuffer: any, public opts?: any) {}
  },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addSubcommand() { return this; }
    addStringOption() { return this; }
  },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn((path: string) => {
    if (String(path).includes('df-webhook') || String(path).includes('dfStable')) {
      return String(path).includes('df-webhook')
        ? 'var WEBHOOK_URL = "@@WEBHOOK_URL@@"; var CODE = "@@CLAIM_CODE@@";'
        : 'console.log("test script")';
    }
    return 'console.log("test script")';
  }),
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => {
    const last = args[args.length - 1];
    if (last && last.includes('df-webhook')) {
      return '/mock/path/df-webhook.js';
    }
    return '/mock/path/dfStable.js';
  }),
}));

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  saveDfToken: jest.fn(),
  deleteDfToken: jest.fn(),
}));

jest.mock('../src/services/deltaforce.api.js', () => ({
  getMyData: jest.fn(),
}));

jest.mock('../src/services/df-claim-store.js', () => ({
  generateCode: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
  buildSuccessContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
  buildInfoContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
}));

import { execute } from '../src/commands/df/df-link.command.js';
import { getDfToken, saveDfToken, deleteDfToken } from '../src/database/df.token.db.js';
import { getMyData } from '../src/services/deltaforce.api.js';
import { generateCode } from '../src/services/df-claim-store.js';
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
      options: { getSubcommand: jest.fn(), getString: jest.fn() },
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên trả về error khi không có guild', async () => {
    const interaction = createMockInteraction({ guild: null, options: { getSubcommand: () => 'status' } });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral }),
    );
  });

  describe('subcommand: paste', () => {
    it('nên liên kết tài khoản khi JSON hợp lệ', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: () => 'paste',
          getString: () => JSON.stringify({ openid: '123456789012345', token: 'abc123' }),
        },
      });
      (getMyData as jest.Mock).mockResolvedValue({ player_info: { nickname: 'TestPlayer', level: 50 } });
      await execute(interaction, mockDb);
      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(getMyData).toHaveBeenCalledWith({ openid: '123456789012345', token: 'abc123' });
      expect(saveDfToken).toHaveBeenCalledWith(mockDb, '222', '123456789012345', 'abc123');
      expect(mockEditReply).toHaveBeenCalled();
    });

    it('nên trả về error khi JSON không parse được', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'paste', getString: () => 'not-json' },
      });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalled();
      expect(getMyData).not.toHaveBeenCalled();
    });

    it('nên trả về error khi JSON thiếu openid hoặc token', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'paste', getString: () => JSON.stringify({ openid: '123' }) },
      });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalled();
      expect(getMyData).not.toHaveBeenCalled();
    });

    it('nên handle API error khi token không hợp lệ', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'paste', getString: () => JSON.stringify({ openid: '123', token: 'abc' }) },
      });
      (getMyData as jest.Mock).mockRejectedValue(new Error('Invalid token'));
      await execute(interaction, mockDb);
      expect(mockEditReply).toHaveBeenCalled();
      expect(saveDfToken).not.toHaveBeenCalled();
    });
  });

  describe('subcommand: unlink', () => {
    it('nên hủy liên kết khi có token', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'unlink' },
      });
      (getDfToken as jest.Mock).mockReturnValue({ openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null });
      await execute(interaction, mockDb);
      expect(deleteDfToken).toHaveBeenCalledWith(mockDb, '222');
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về info khi chưa liên kết', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'unlink' },
      });
      (getDfToken as jest.Mock).mockReturnValue(undefined);
      await execute(interaction, mockDb);
      expect(deleteDfToken).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalled();
    });
  });

  describe('subcommand: status', () => {
    it('nên hiển thị thông tin khi đã liên kết', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'status' },
      });
      (getDfToken as jest.Mock).mockReturnValue({ openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: '2026-06-10' });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về info khi chưa liên kết', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'status' },
      });
      (getDfToken as jest.Mock).mockReturnValue(undefined);
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalled();
    });
  });

  describe('subcommand: get-script', () => {
    it('nên gửi script qua DM', async () => {
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'get-script' },
      });
      await execute(interaction, mockDb);
      expect(mockCreateDm).toHaveBeenCalled();
      expect(mockDmSend).toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Script đã được gửi qua DM.', flags: MessageFlags.Ephemeral }),
      );
    });
  });

  describe('subcommand: start', () => {
    it('nên sinh claim code và gửi script qua DM', async () => {
      (generateCode as jest.Mock).mockReturnValue('ABC123');
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'start' },
      });
      await execute(interaction, mockDb);
      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(generateCode).toHaveBeenCalledWith('222');
      expect(mockCreateDm).toHaveBeenCalled();
      expect(mockDmSend).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ABC123'),
        }),
      );
    });

    it('nên gửi script có chứa claim code và webhook URL', async () => {
      (generateCode as jest.Mock).mockReturnValue('XYZ789');
      const interaction = createMockInteraction({
        options: { getSubcommand: () => 'start' },
      });
      await execute(interaction, mockDb);
      const dmCall = mockDmSend.mock.calls[0];
      const files = dmCall[0].files;
      expect(files).toHaveLength(1);
      expect(files[0].opts.name).toBe('df-link-script.js');
      // Script content là Buffer — đọc ra string để kiểm tra
      const content = files[0].pathOrBuffer.toString();
      expect(content).toContain('XYZ789');
    });
  });
});
