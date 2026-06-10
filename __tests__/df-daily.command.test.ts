/**
 * Unit tests cho df-daily.command.ts — /df-daily slash command.
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, MediaGallery: 12 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../src/services/deltaforce.scraper.js', () => ({
  fetchDailyCodes: jest.fn(),
}));

jest.mock('../src/services/deltaforce.api.js', () => ({
  getDailyReport: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
  })),
}));

import { execute, data } from '../src/commands/df/daily.command.js';
import { getDfToken, touchDfToken } from '../src/database/df.token.db.js';
import { fetchDailyCodes } from '../src/services/deltaforce.scraper.js';
import { getDailyReport } from '../src/services/deltaforce.api.js';
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

  it('nên trả về error khi không có guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral }),
    );
  });

  it('nên defer reply khi có guild', async () => {
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);
    expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('nên hiển thị daily codes khi scraper trả về codes', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    (fetchDailyCodes as jest.Mock).mockResolvedValue({
      'Đập Nước Zero': '1234',
      'Thung lũng Layali': '5678',
      'Phố Cổ Brakkesh': '9012',
      'Trạm Không Gian': '3456',
      'Ngục Giam Thủy Triều': '7890',
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it("nên hiển thị 'Chưa có' cho codes null", async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
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

  it('nên xử lý khi scraper trả về null', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên gọi API daily report khi có token liên kết', async () => {
    const mockToken = { openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    (getDailyReport as jest.Mock).mockResolvedValue({
      battlefield_battle: { kd_ratio: '1.5', kill_count: 10, match_count: 5, retreat_rate: '20%', revenue: '50000' },
      beacon_battle: null,
    });
    await execute(createMockInteraction(), mockDb);
    expect(getDailyReport).toHaveBeenCalledWith({
      openid: '123',
      token: 'abc',
      ts: '42',
      s: 'sig1',
      u: 'dev1',
    });
    expect(touchDfToken).toHaveBeenCalledWith(mockDb, '222');
  });

  it('nên hiển thị "Chưa có dữ liệu" khi chưa liên kết', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên handle scraper error gracefully', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    (fetchDailyCodes as jest.Mock).mockRejectedValue(new Error('Network error'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên handle API error gracefully', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    (getDailyReport as jest.Mock).mockRejectedValue(new Error('Token expired'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it("should handle unexpected error in try block", async () => {
    (getDfToken as jest.Mock).mockImplementation(() => {
      throw new Error("Unexpected DB crash");
    });
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });
});
