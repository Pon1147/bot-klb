/**
 * Unit tests cho df-stats.command.ts — /df-stats slash command.
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, Section: 9, Thumbnail: 11 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../../src/services/deltaforce.api.js', () => ({
  getSeasonData: jest.fn(),
}));

jest.mock('../../src/utils/df-rank.utils.js', () => ({
  resolveRankFromScore: jest.fn(),
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
  toComponentsV2: jest.fn((arr) => arr),
}));

import { execute } from '../../src/commands/df/stats.command.js';
import { getDfToken, touchDfToken } from '../../src/database/df.token.db.js';
import { getSeasonData } from '../../src/services/deltaforce.api.js';
import { resolveRankFromScore } from '../../src/utils/df-rank.utils.js';
import { MessageFlags } from 'discord.js';

describe('df-stats.command', () => {
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
      expect.objectContaining({ content: expect.stringContaining('server'), flags: MessageFlags.Ephemeral }),
    );
  });

  it('nên trả về error khi chưa liên kết tài khoản', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    await execute(createMockInteraction(), mockDb);
    expect(mockReply).toHaveBeenCalled();
    expect(getSeasonData).not.toHaveBeenCalled();
  });

  it('nên hiển thị stats khi có token và API trả về data', async () => {
    const mockToken = { openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getSeasonData as jest.Mock).mockResolvedValue({
      player_info: { avatar: '', level: 50, nickname: 'TestPlayer', play_duration: '100.5', register_time: '1609459200' },
      rank_data: { current_rank: 'Vàng', current_rank_score: 2000, highest_rank: 'Bạch Kim', highest_rank_season_id: 8 },
      summary_data: {
        bf_combat: null,
        combat: { headshot_kill_rate: '30%', high_kill_death_ratio: '2.0', hit_rate: '45%', kill_operator_count: 1000, low_kill_death_ratio: '1.5', med_kill_death_ratio: '1.8' },
        economy: { extract_value: '500000', profit_loss_ratio: '+10%', total_mandel_brick: 50, total_reward: '2000000' },
        performance: null,
        team: { rescue_teammate_count: 20, retreat_rate: '15%', revive_teammate_count: 50, teammate_extract_value: '300000' },
        total_match_count: 200,
        vehicle: null,
      },
    });
    (resolveRankFromScore as jest.Mock).mockReturnValue({
      rankId: 32, mode: 'SOL', name: 'Vàng III', minScore: 2100, maxScore: 2299, imageUrl: 'https://example.com/rank.png',
    });
    await execute(createMockInteraction(), mockDb);
    expect(getSeasonData).toHaveBeenCalledWith(
      expect.objectContaining({ openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1' }),
      '10009',
    );
    expect(touchDfToken).toHaveBeenCalledWith(mockDb, '222');
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên xử lý khi combat data là null', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getSeasonData as jest.Mock).mockResolvedValue({
      player_info: { avatar: '', level: 10, nickname: 'NewPlayer', play_duration: '0.5', register_time: '1700000000' },
      rank_data: { current_rank: 'Đồng', current_rank_score: 1050, highest_rank: 'Đồng III', highest_rank_season_id: 9 },
      summary_data: { bf_combat: null, combat: null, economy: null, performance: null, team: null, total_match_count: 0, vehicle: null },
    });
    (resolveRankFromScore as jest.Mock).mockReturnValue({
      rankId: 25, mode: 'SOL', name: 'Đồng III', minScore: 1000, maxScore: 1149, imageUrl: 'https://example.com/rank.png',
    });
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });

  it('nên handle API error', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getSeasonData as jest.Mock).mockRejectedValue(new Error('Token expired'));
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
    expect(touchDfToken).not.toHaveBeenCalled();
  });

  it('nên fallback rank name khi resolveRankFromScore trả về null', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getSeasonData as jest.Mock).mockResolvedValue({
      player_info: { avatar: '', level: 5, nickname: 'Test', play_duration: '1.0', register_time: '1609459200' },
      rank_data: { current_rank: 'Unknown', current_rank_score: 9999, highest_rank: 'Unknown', highest_rank_season_id: 1 },
      summary_data: { bf_combat: null, combat: null, economy: null, performance: null, team: null, total_match_count: 0, vehicle: null },
    });
    (resolveRankFromScore as jest.Mock).mockReturnValue(null);
    await execute(createMockInteraction(), mockDb);
    expect(mockEditReply).toHaveBeenCalled();
  });
});
