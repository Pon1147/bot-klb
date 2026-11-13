/**
 * Unit tests cho df-link.command.ts — /df-link slash command.
 *
 * Subcommands: start, status, unlink.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  AttachmentBuilder: class {
    constructor(
      public attachment: any,
      public data?: any,
    ) {}
  },
  ActionRowBuilder: class {
    constructor() {
      this._components = [];
    }
    addComponents(...c: any[]) {
      this._components = c;
      return this;
    }
    toJSON() {
      return { type: 1, components: this._components.map((c: any) => c.toJSON()) };
    }
  },
  ButtonBuilder: class {
    constructor() {
      this._data = {};
    }
    setCustomId(v: string) {
      this._data.customId = v;
      return this;
    }
    setLabel(v: string) {
      this._data.label = v;
      return this;
    }
    setStyle(v: any) {
      this._data.style = v;
      return this;
    }
    setURL(v: string) {
      this._data.url = v;
      return this;
    }
    toJSON() {
      return {
        type: 2,
        custom_id: this._data.customId,
        label: this._data.label,
        style: this._data.style,
        url: this._data.url,
      };
    }
  },
  ButtonStyle: { Primary: 1, Secondary: 2, Link: 5 },
  SlashCommandBuilder: class {
    setName() {
      return this;
    }
    setDescription() {
      return this;
    }
    addSubcommand(fn: (sub: any) => any) {
      const sub: any = {
        setName() {
          return this;
        },
        setDescription() {
          return this;
        },
        addStringOption(cb: any) {
          const opt: any = {
            setName() {
              return this;
            },
            setDescription() {
              return this;
            },
            setRequired() {
              return this;
            },
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

jest.mock('../../src/services/df-claim-store.js', () => ({
  generateCode: jest.fn(() => 'ABC123'),
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  saveDfToken: jest.fn(),
  getDfToken: jest.fn(),
}));

jest.mock('../../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
  revokeBinding: jest.fn(),
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
  buildInfoContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
  buildSuccessContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
}));

import { execute, handleLinkButton } from '../../src/features/delta-force/link.handler.js';
import { generateCode } from '../../src/services/df-claim-store.js';
import { saveDfToken } from '../../src/database/df.token.db.js';
import { getActiveBinding } from '../../src/database/df-binding.db.js';
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
      followUp: jest.fn().mockResolvedValue(undefined),
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
    (generateCode as jest.Mock).mockReturnValue('ABC123');
    (getActiveBinding as jest.Mock).mockReturnValue(undefined);
    (saveDfToken as jest.Mock).mockReturnValue(true);
  });

  describe('guild check', () => {
    it('nên trả về error khi không có guild', async () => {
      const interaction = createMockInteraction({ guild: null });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('server'),
          flags: MessageFlags.Ephemeral,
        }),
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

    it('nên reply chứa claim code trong container và 2 action rows buttons trực quan, không spam file zip followUp', async () => {
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(interaction.followUp).not.toHaveBeenCalled();

      const replyCall = mockReply.mock.calls[0];
      expect(replyCall[0].components).toBeDefined();
      expect(replyCall[0].components).toHaveLength(3); // Container + 2 ActionRows

      const infoComp = replyCall[0].components[0];
      expect(infoComp.type).toBe(17); // Container
      expect(replyCall[0].components[1].type).toBe(1); // ActionRow 1
      expect(replyCall[0].components[2].type).toBe(1); // ActionRow 2

      // Tìm TextDisplay trong nested components
      const textDisplay = infoComp.components?.find((c: any) => c.content?.includes('ABC123'));
      expect(textDisplay).toBeDefined();
      expect(textDisplay?.content).toContain('ABC123');
      expect(textDisplay?.content).toContain('Liên kết tài khoản Delta Force');
      expect(textDisplay?.content).toContain('Cài tiện ích **DF Toolbox**');
      expect(textDisplay?.content).toContain('Bot không bao giờ hỏi mật khẩu/OTP');

      // Row 1 chứa 3 nút: Garena link, Download extension, Nút lấy mã mới
      const buttons1 = replyCall[0].components[1].components;
      expect(buttons1).toHaveLength(3);
      expect(buttons1[0].url).toContain('playdeltaforce.com');
      expect(buttons1[1].custom_id).toBe('df_help:dl:222:vi');
      expect(buttons1[2].custom_id).toBe('df_link:refresh:222:vi');

      // Row 2 chứa 3 nút: Hướng dẫn điện thoại, Có an toàn không, Hỗ trợ
      const buttons2 = replyCall[0].components[2].components;
      expect(buttons2).toHaveLength(3);
      expect(buttons2[0].custom_id).toBe('df_link:mobile:222:vi');
      expect(buttons2[1].custom_id).toBe('df_link:safety:222:vi');
      expect(buttons2[2].url).toContain('discord.gg');
    });

    it('hỗ trợ song ngữ English khi interaction có locale en-US', async () => {
      const interaction = createMockInteraction({ locale: 'en-US' });
      await execute(interaction, mockDb);

      const replyCall = mockReply.mock.calls[0];
      const infoComp = replyCall[0].components[0];
      const textDisplay = infoComp.components?.find((c: any) => c.content?.includes('ABC123'));
      expect(textDisplay?.content).toContain('Delta Force Account Linking');
      expect(textDisplay?.content).toContain('Your code:');

      const buttons1 = replyCall[0].components[1].components;
      expect(buttons1[0].label).toBe('🌐 1. Open Garena Page');
      expect(buttons1[1].custom_id).toBe('df_help:dl:222:en');
      expect(buttons1[1].label).toBe('📥 2. Download Extension');
      expect(buttons1[2].label).toBe('🔄 Get New Code');

      const buttons2 = replyCall[0].components[2].components;
      expect(buttons2[0].label).toBe('📱 Mobile Guide');
      expect(buttons2[1].label).toBe('🛡️ Is It Safe?');
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
      const { getDfToken } = require('../../src/database/df.token.db.js');
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

  describe('handleLinkButton', () => {
    it('bỏ qua button không thuộc prefix df_link:', async () => {
      const interaction = { customId: 'other_prefix:test' } as any;
      const res = await handleLinkButton(interaction, mockDb);
      expect(res.handled).toBe(false);
    });

    it('chặn người dùng khác thao tác trên bảng liên kết (User Isolation Guard)', async () => {
      const mockBtnReply = jest.fn();
      const interaction = {
        customId: 'df_link:refresh:otherUser:vi',
        user: { id: 'currentUser' },
        reply: mockBtnReply,
      } as any;

      const res = await handleLinkButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(mockBtnReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('không thể thao tác trên bảng liên kết của người khác'),
          flags: 64,
        }),
      );
    });

    it('xử lý nút refresh: tạo mã mới và cập nhật components', async () => {
      (generateCode as jest.Mock).mockReturnValue('NEW999');
      const mockBtnUpdate = jest.fn();
      const interaction = {
        customId: 'df_link:refresh:freshUser1:vi',
        user: { id: 'freshUser1' },
        update: mockBtnUpdate,
      } as any;

      const res = await handleLinkButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(generateCode).toHaveBeenCalledWith(mockDb, 'freshUser1');
      expect(mockBtnUpdate).toHaveBeenCalled();
      const updateCall = mockBtnUpdate.mock.calls[0];
      expect(updateCall[0].components).toHaveLength(3);
    });

    it('chặn spam nút refresh khi chưa hết cooldown 5 giây (Rate Limit)', async () => {
      const mockBtnUpdate = jest.fn();
      const mockBtnReply = jest.fn();
      const interaction1 = {
        customId: 'df_link:refresh:spamUser:vi',
        user: { id: 'spamUser' },
        update: mockBtnUpdate,
      } as any;

      await handleLinkButton(interaction1, mockDb);

      const interaction2 = {
        customId: 'df_link:refresh:spamUser:vi',
        user: { id: 'spamUser' },
        reply: mockBtnReply,
      } as any;

      const res = await handleLinkButton(interaction2, mockDb);
      expect(res.handled).toBe(true);
      expect(mockBtnReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Vui lòng đợi'),
          flags: 64,
        }),
      );
    });

    it('xử lý nút mobile: reply hướng dẫn điện thoại chứa Orion Browser và Kiwi Browser', async () => {
      const mockBtnReply = jest.fn();
      const interaction = {
        customId: 'df_link:mobile:222:vi',
        user: { id: '222' },
        reply: mockBtnReply,
      } as any;

      const res = await handleLinkButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(mockBtnReply).toHaveBeenCalled();
      const replyCall = mockBtnReply.mock.calls[0];
      expect(replyCall[0].content).toContain('Orion Browser');
      expect(replyCall[0].content).toContain('Kiwi Browser');
      expect(replyCall[0].flags).toBe(64);
    });

    it('xử lý nút safety: reply giải thích an toàn minh bạch', async () => {
      const mockBtnReply = jest.fn();
      const interaction = {
        customId: 'df_link:safety:222:vi',
        user: { id: '222' },
        reply: mockBtnReply,
      } as any;

      const res = await handleLinkButton(interaction, mockDb);
      expect(res.handled).toBe(true);
      expect(mockBtnReply).toHaveBeenCalled();
      const replyCall = mockBtnReply.mock.calls[0];
      expect(replyCall[0].content).toContain('DF Toolbox Có An Toàn Không?');
      expect(replyCall[0].content).toContain('/df unlink');
      expect(replyCall[0].flags).toBe(64);
    });
  });
});
