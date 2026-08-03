/**
 * Unit tests cho df-code.command.ts — /df-code slash command (daily codes + subcommands).
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 0x8 },
  SlashCommandBuilder: class {
    constructor() { this._subcommands = []; }
    setName() { return this; }
    setDescription() { return this; }
    addSubcommand(cmd: any) {
      const mockSub: any = {
        setName() { return this; },
        setDescription() { return this; },
        addChannelOption(cb: any) {
          const mockOpt: any = {
            setName() { return this; },
            setDescription() { return this; },
            setRequired() { return this; },
          };
          cb(mockOpt);
          return this;
        },
      };
      cmd(mockSub);
      this._subcommands.push(mockSub);
      return this;
    }
    addSubcommandGroup() { return this; }
    toJSON() { return { subcommands: this._subcommands }; }
  },
  AttachmentBuilder: class {
    constructor(public pathOrBuffer: any, public opts?: any) {
      this.name = opts?.name ?? 'file.png';
    }
  },
}));

jest.mock('../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg: any) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  buildSuccessContainer: jest.fn((msg: any) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  buildTextOnlyContainer: jest.fn((content: any, color: any) => ({
    components: [{ type: 17, components: [{ type: 10, content }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  makeResult: jest.fn((components: any, flags: any, files: any) => ({
    components, flags, files, toJSON() { return components; },
  })),
}));

jest.mock('../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => ({
    get: jest.fn(() => ({
      dfCodes: { enabled: true, channelId: null },
    })),
  })),
}));

jest.mock('../src/utils/section-config.handlers.js', () => ({
  handleSectionSetChannel: jest.fn(async (interaction: any) => {
    // Interaction đã defer → dùng editReply
    await interaction.editReply({
      components: [{ type: 17, components: [{ type: 10, content: 'success' }] }],
    });
  }),
  handleSectionStatus: jest.fn(async (interaction: any) => {
    // Interaction đã defer → dùng editReply
    await interaction.editReply({
      components: [{ type: 17, components: [{ type: 10, content: 'status' }] }],
    });
  }),
  buildSectionSubcommands: jest.fn(() => ({
    setName: () => ({ setDescription: () => ({ addSubcommand: () => ({ addSubcommandGroup: () => ({}) }) }) }),
  })),
}));

import { execute, hasAnyCodes, MAP_DISPLAY } from '../src/commands/df/code.command.js';
import { fetchDailyCodes } from '../src/services/deltaforce.scraper.js';
import type { DailyCodes } from '../src/services/deltaforce.scraper.js';
import { MessageFlags } from 'discord.js';
import { randomUUID } from 'crypto';

describe('df-code.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue({ id: 'msg-123' });
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222' },
      channel: { id: `ch-${randomUUID()}` },
      reply: mockReply,
      editReply: mockEditReply,
      deferReply: mockDeferReply,
      options: { getSubcommand: () => 'show' },
      replied: false,
      deferred: false,
      member: { permissions: { has: () => true } },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nen tra ve error khi khong co guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server'), flags: MessageFlags.Ephemeral }),
    );
  });

  it('nen hien thi mat khau khi scraper tra ve codes', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockDeferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi "Chua co" cho codes null', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': null,
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': null,
      'Ngục Giam Thủy Triều': '7890',
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi fallback khi tat ca code deu null', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': null,
      'Thung lũng Layali': null,
      'Phố Cổ Brakkesh': null,
      AZ3: null,
      'Trạm Không Gian': null,
      'Ngục Giam Thủy Triều': null,
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi fallback khi scraper tra ve null', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen handle scraper error gracefully', async () => {
    (fetchDailyCodes as jest.Mock).mockRejectedValue(new Error('Network error'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi error container khi editReply throw', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
    let callCount = 0;
    const interaction = createMockInteraction({
      editReply: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('Edit failed'));
        return Promise.resolve({ id: 'replied' });
      }),
    });
    await execute(interaction, mockDb);
    // editReply throw → catch block → buildErrorContainer + editReply lại
    expect(callCount).toBe(2);
  });

  it('data co subcommand setchannel va status', () => {
    const { data } = require('../src/commands/df/code.command.js');
    expect(data).toBeDefined();
    // Data được xây dựng với 2 subcommands: setchannel và status
    expect(data.toJSON).toBeDefined();
  });

  it('data co du 2 subcommand (setchannel + status)', () => {
    const { data } = require('../src/commands/df/code.command.js');
    const json = data.toJSON();
    // SlashCommandBuilder.toJSON() trả về array có 2 subcommands
    expect(json).toHaveProperty('subcommands');
    expect(json.subcommands).toHaveLength(2);
  });

  it('nen reject khi khong co admin permission', async () => {
    const interaction = createMockInteraction({
      member: { permissions: { has: () => false } },
    });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Administrator'),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it('nen call setchannel subcommand', async () => {
    const interaction = createMockInteraction({
      options: { getSubcommand: () => 'setchannel' },
    });
    await execute(interaction, mockDb);
    // Interaction đã defer → handler gọi editReply
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen call status subcommand', async () => {
    const interaction = createMockInteraction({
      options: { getSubcommand: () => 'status' },
    });
    await execute(interaction, mockDb);
    // Interaction đã defer → handler gọi editReply
    expect(mockEditReply).toHaveBeenCalled();
  });
});

describe('df-code.command — hasAnyCodes', () => {
  function makeCodes(): DailyCodes {
    return {
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      AZ3: 'AB12',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    };
  }

  it('tra ve true khi tat ca code deu co gia tri', () => {
    expect(hasAnyCodes(makeCodes())).toBe(true);
  });

  it('tra ve true khi chis mot code co gia tri', () => {
    const codes: DailyCodes = {
      'Đập Nước Zero': null,
      'Thung lũng Layali': null,
      'Phố Cổ Brakkesh': '9012',
      AZ3: null,
      'Trạm Không Gian': null,
      'Ngục Giam Thủy Triều': null,
    };
    expect(hasAnyCodes(codes)).toBe(true);
  });

  it('tra ve false khi tat ca code deu null', () => {
    const codes: DailyCodes = {
      'Đập Nước Zero': null,
      'Thung lũng Layali': null,
      'Phố Cổ Brakkesh': null,
      AZ3: null,
      'Trạm Không Gian': null,
      'Ngục Giam Thủy Triều': null,
    };
    expect(hasAnyCodes(codes)).toBe(false);
  });

  it('tra ve false khi codes la null', () => {
    expect(hasAnyCodes(null)).toBe(false);
  });
});

describe('df-code.command — MAP_DISPLAY', () => {
  it('co 6 map', () => {
    expect(Object.keys(MAP_DISPLAY)).toHaveLength(6);
  });

  it('moi map co name va image', () => {
    for (const map of Object.values(MAP_DISPLAY)) {
      expect(typeof map.name).toBe('string');
      expect(typeof map.image).toBe('string');
      expect(map.image).toMatch(/\.png$/);
    }
  });
});
