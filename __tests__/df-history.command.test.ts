/**
 * Unit tests cho df-history.command.ts â€” /df-history slash command.
 */

jest.mock('discord.js', () => ({
  ComponentType: {
    TextDisplay: 10,
    Separator: 14,
    Container: 17,
    Section: 9,
    Thumbnail: 11,
  },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addIntegerOption() { return this; }
  },
  ActionRowBuilder: class { addComponents() { return this; } toJSON() { return {}; } },
  ButtonBuilder: class {
    setCustomId() { return this; }
    setLabel() { return this; }
    setStyle() { return this; }
    toJSON() { return {}; }
  },
  ButtonStyle: { Secondary: 2 },
}));

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../src/services/deltaforce.api.js', () => ({
  getMatchList: jest.fn(),
}));

jest.mock('../src/utils/df-token.utils.js', () => ({
  buildDfApiToken: jest.fn((t) => t),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  toComponentsV2: jest.fn((arr) => arr),
}));

import { execute } from '../src/commands/df/history.command.js';
import { getDfToken, touchDfToken } from '../src/database/df.token.db.js';
import { getMatchList } from '../src/services/deltaforce.api.js';
import { MessageFlags } from 'discord.js';

describe('df-history.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);
  const mockGetInteger = jest.fn();

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222' },
      reply: mockReply,
      editReply: mockEditReply,
      deferReply: mockDeferReply,
      options: { getInteger: mockGetInteger },
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nÃªn tráº£ vá» error khi khÃ´ng cÃ³ guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server'), flags: MessageFlags.Ephemeral }),
    );
  });

  it('nÃªn tráº£ vá» error khi chÆ°a liÃªn káº¿t tÃ i khoáº£n', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    await execute(createMockInteraction(), mockDb);
    expect(mockReply).toHaveBeenCalled();
    expect(getMatchList).not.toHaveBeenCalled();
  });

  it('nÃªn hiá»ƒn thá»‹ match list khi cÃ³ data', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockResolvedValue({
      commonly_used_operators_id: '1',
      list: [
        { carry_out_value: '50000', is_leave: 0, kill_count: 5, map_id: 2201, match_time: '1609459200', net_income: '10000', operator_icon: '', operator_id: '1', result: 1, room_id: '1', score: 1000 },
      ],
    });
    mockGetInteger.mockReturnValue(undefined);
    await execute(createMockInteraction(), mockDb);
    expect(getMatchList).toHaveBeenCalled();
    expect(touchDfToken).toHaveBeenCalledWith(mockDb, '222');
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nÃªn limit sá»‘ tráº­n theo option', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockResolvedValue({
      commonly_used_operators_id: '1',
      list: Array.from({ length: 20 }, (_, i) => ({
        carry_out_value: '10000', is_leave: 0, kill_count: i, map_id: 2201,
        match_time: '1609459200', net_income: '5000', operator_icon: '', operator_id: '1',
        result: 1, room_id: String(i), score: 1000,
      })),
    });
    mockGetInteger.mockReturnValue(5);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nÃªn tráº£ vá» error khi khÃ´ng cÃ³ match nÃ o', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockResolvedValue({ commonly_used_operators_id: '1', list: [] });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nÃªn handle API error', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockRejectedValue(new Error('Network error'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
    expect(touchDfToken).not.toHaveBeenCalled();
  });
});
