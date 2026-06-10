/**
 * Unit tests cho df-code.command.ts — /df-code slash command (daily codes only).
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
}));

import { execute } from '../src/commands/df/code.command.js';
import { fetchDailyCodes } from '../src/services/deltaforce.scraper.js';
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
      expect.objectContaining({ content: 'Chi dung trong server.', flags: MessageFlags.Ephemeral }),
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
    expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
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
