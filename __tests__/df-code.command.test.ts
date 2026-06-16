/**
 * Unit tests cho df-code.command.ts — /df-code slash command (daily codes only).
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
  AttachmentBuilder: class {
    constructor(public pathOrBuffer: any, public opts?: any) {
      this.name = opts?.name ?? 'file.png';
    }
  },
  ContainerBuilder: class {
    components: any[] = [];
    addTextDisplayComponents(c: any) { this.components.push(c); return this; }
    addMediaGalleryComponents(c: any) { this.components.push(c); return this; }
    addSeparatorComponents(c: any) { this.components.push(c); return this; }
  },
  TextDisplayBuilder: class {
    setContent(c: string) { this.content = c; return this; }
    content: string = '';
  },
  SeparatorBuilder: class {},
  MediaGalleryBuilder: class {
    items: any[] = [];
    addItems(...i: any[]) { this.items.push(...i); return this; }
  },
  MediaGalleryItemBuilder: class {
    constructor(public options: any) {}
  },
}));

jest.mock('../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  makeResult: jest.fn((components, flags, files) => ({ components, flags, files, toJSON() { return components; } })),
}));

import { execute, hasAnyCodes, MAP_DISPLAY } from '../src/commands/df/code.command.js';
import { fetchDailyCodes } from '../src/services/deltaforce.scraper.js';
import type { DailyCodes } from '../src/services/deltaforce.scraper.js';
import { MessageFlags } from 'discord.js';

describe('df-code.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222' },
      reply: mockReply,
      editReply: mockEditReply,
      deferReply: mockDeferReply,
      options: {},
      replied: false,
      deferred: false,
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
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockDeferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi "Chua co" cho codes null', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': null,
      'Phố Cổ Brakkesh': '9012',
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
});

describe('df-code.command — hasAnyCodes', () => {
  function makeCodes(): DailyCodes {
    return {
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
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
  it('co 5 map', () => {
    expect(Object.keys(MAP_DISPLAY)).toHaveLength(5);
  });

  it('moi map co name va image', () => {
    for (const map of Object.values(MAP_DISPLAY)) {
      expect(typeof map.name).toBe('string');
      expect(typeof map.image).toBe('string');
      expect(map.image).toMatch(/\.png$/);
    }
  });
});
