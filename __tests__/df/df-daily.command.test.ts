/**
 * Unit tests cho df-daily.command.ts â€” /df-daily slash command (battle stats only).
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, MediaGallery: 12 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../../src/services/deltaforce.api.js', () => ({
  getDailyReport: jest.fn(),
}));

jest.mock('../../src/utils/df-token.utils.js', () => ({
  buildDfApiToken: jest.fn((t) => t),
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
}));

import { execute, data } from '../../src/commands/df/daily.command.js';
import { getDfToken, touchDfToken } from '../../src/database/df.token.db.js';
import { getDailyReport } from '../../src/services/deltaforce.api.js';
import { MessageFlags } from 'discord.js';

describe('df-daily.command', () => {
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

  it('nen tra ve error khi chua lien ket tai khoan', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalled();
    expect(mockDeferReply).not.toHaveBeenCalled();
    expect(getDailyReport).not.toHaveBeenCalled();
  });

  it('nen hien thi battle stats khi co token + API thanh cong', async () => {
    const mockToken = { openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getDailyReport as jest.Mock).mockResolvedValue({
      battlefield_battle: { kd_ratio: '1.5', kill_count: 10, match_count: 5, retreat_rate: '20%', revenue: '50000' },
      beacon_battle: null,
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockDeferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(getDailyReport).toHaveBeenCalledWith(
      expect.objectContaining({ openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1' }),
    );
    // touchDfToken được gọi trong runner, không trong command
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen fallback sang beacon_battle khi battlefield_battle la null', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getDailyReport as jest.Mock).mockResolvedValue({
      battlefield_battle: null,
      beacon_battle: { kd_ratio: '0.8', kill_count: 3, match_count: 2, retreat_rate: '50%', revenue: '10000' },
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen hien thi "Chua co du lieu" khi khong co battle data', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getDailyReport as jest.Mock).mockResolvedValue({
      battlefield_battle: null,
      beacon_battle: null,
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen handle API error gracefully', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getDailyReport as jest.Mock).mockRejectedValue(new Error('Token expired'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nen handle unexpected error in try block', async () => {
    (getDfToken as jest.Mock).mockReturnValue({ openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null });
    (getDailyReport as jest.Mock).mockImplementation(() => {
      throw new Error('Unexpected DB crash');
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });
});
