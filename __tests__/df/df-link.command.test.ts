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

import { execute } from '../../src/features/delta-force/link.handler.js';
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

    it('nên reply chứa claim code trong container và 3 buttons trực quan, không spam file zip followUp', async () => {
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(interaction.followUp).not.toHaveBeenCalled();

      const replyCall = mockReply.mock.calls[0];
      expect(replyCall[0].components).toBeDefined();
      expect(replyCall[0].components).toHaveLength(2);
      // component đầu tiên là container với TextDisplay chứa claim code, component thứ 2 là ActionRow chứa buttons
      const infoComp = replyCall[0].components[0];
      expect(infoComp.type).toBe(17); // Container
      expect(replyCall[0].components[1].type).toBe(1); // ActionRow

      // Tìm TextDisplay trong nested components
      const textDisplay = infoComp.components?.find((c: any) => c.content?.includes('ABC123'));
      expect(textDisplay).toBeDefined();
      expect(textDisplay?.content).toContain('ABC123');
      expect(textDisplay?.content).toContain('cần thực hiện trên máy tính (PC/Laptop)');

      // ActionRow chứa đúng 3 nút: Garena link, nút tải tiện ích on-demand, nút hỗ trợ
      const buttons = replyCall[0].components[1].components;
      expect(buttons).toHaveLength(3);
      expect(buttons[0].url).toContain('playdeltaforce.com');
      expect(buttons[1].custom_id).toBe('df_help:dl:222:vi');
      expect(buttons[2].url).toContain('discord.gg');
    });

    it('hỗ trợ song ngữ English khi interaction có locale en-US', async () => {
      const interaction = createMockInteraction({ locale: 'en-US' });
      await execute(interaction, mockDb);

      const replyCall = mockReply.mock.calls[0];
      const infoComp = replyCall[0].components[0];
      const textDisplay = infoComp.components?.find((c: any) => c.content?.includes('ABC123'));
      expect(textDisplay?.content).toContain('Your Link Code');
      expect(textDisplay?.content).toContain('requires a computer (PC/Laptop)');

      const buttons = replyCall[0].components[1].components;
      expect(buttons[1].custom_id).toBe('df_help:dl:222:en');
      expect(buttons[1].label).toBe('📥 2. Download Extension');
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
});
