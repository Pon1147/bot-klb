/**
 * Unit tests cho df-history.command.ts — /df-history slash command.
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addIntegerOption() { return this; }
  },
}));

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../src/services/deltaforce.api.js', () => ({
  getMatchList: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
  buildTextOnlyContainer: jest.fn((content) => ({
    components: [{ type: 17, components: [{ type: 10, content }] }],
    flags: 65536,
    files: [],
  })),
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

  it('nên trả về error khi không có guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral }),
    );
  });

  it('nên trả về error khi chưa liên kết tài khoản', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    await execute(createMockInteraction(), mockDb);
    expect(mockReply).toHaveBeenCalled();
    expect(getMatchList).not.toHaveBeenCalled();
  });

  it('nên hiển thị match list khi có data', async () => {
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

  it('nên limit số trận theo option', async () => {
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

  it('nên trả về error khi không có match nào', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockResolvedValue({ commonly_used_operators_id: '1', list: [] });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên handle API error', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getMatchList as jest.Mock).mockRejectedValue(new Error('Network error'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
    expect(touchDfToken).not.toHaveBeenCalled();
  });
});
