/**
 * DF Commands E2E — /df-stats, /df-daily.
 * Real DB token lookup, real container building.
 * Mocked: axios (external API), discord.js (constants), scraper (puppeteer).
 */

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

const mockDeltaForceApi = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: mockDeltaForceApi }),
}), { virtual: true });

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, Section: 9, Thumbnail: 11 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../../src/services/deltaforce.scraper', () => ({
  fetchDailyCodes: jest.fn().mockResolvedValue({
    'Đập Nước Zero': '1234',
    'Thung lũng Layali': '5678',
    'Phố Cổ Brakkesh': null,
    'Trạm Không Gian': null,
    'Ngục Giam Thủy Triều': null,
  }),
}), { virtual: true });

// ── /df-stats ────────────────────────────────────────────────────

describe('DF Commands E2E — /df-stats', () => {
  let execute: (interaction: any, db: any) => Promise<void>;
  let createTestDb: () => any;
  let seedDfToken: (db: any, ...args: any[]) => void;
  let createMockInteraction: (overrides?: any) => any;

  beforeEach(() => {
    jest.resetModules();
    mockDeltaForceApi.mockReset();

    ({ createTestDb, seedDfToken } = require('./setup'));
    ({ createMockInteraction } = require('./fixtures'));
    ({ execute } = require('../../src/commands/df/stats.command'));
  });

  it('phải trả về error khi không có guild', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction({ guild: null });

    await execute(interaction, db);

    // Should call reply (not deferReply) — guild check happens before token check
    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    db.close();
  });

  it('phải trả về error khi chưa liên kết tài khoản', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const call = interaction.reply.mock.calls[0][0];
    expect(call.components).toBeDefined();
    expect(mockDeltaForceApi).not.toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị stats khi có token + API thành công', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc', '123', 'sig-1', 'user-1');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: {
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
        },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalled();

    const row = db.prepare('SELECT last_used_at FROM df_tokens WHERE discord_id = ?').get('user-123');
    expect(row?.last_used_at).toBeDefined();
    db.close();
  });

  it('phải xử lý API error gracefully', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockRejectedValue(new Error('Token expired'));

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });

  it('phải xử lý khi combat/economy/team data là null', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: {
          player_info: { avatar: '', level: 10, nickname: 'NewPlayer', play_duration: '0.5', register_time: '1700000000' },
          rank_data: { current_rank: 'Đồng', current_rank_score: 1050, highest_rank: 'Đồng III', highest_rank_season_id: 9 },
          summary_data: { bf_combat: null, combat: null, economy: null, performance: null, team: null, total_match_count: 0, vehicle: null },
        },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });
});

// ── /df-daily ────────────────────────────────────────────────────

describe('DF Commands E2E — /df-daily', () => {
  let execute: (interaction: any, db: any) => Promise<void>;
  let createTestDb: () => any;
  let seedDfToken: (db: any, ...args: any[]) => void;
  let createMockInteraction: (overrides?: any) => any;

  beforeEach(() => {
    jest.resetModules();
    mockDeltaForceApi.mockReset();

    ({ execute } = require('../../src/commands/df/daily.command'));
    ({ createTestDb, seedDfToken } = require('./setup'));
    ({ createMockInteraction } = require('./fixtures'));
  });

  it('phải trả về error khi không có guild', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction({ guild: null });

    await expect(execute(interaction, db)).resolves.not.toThrow();

    // Should respond (reply or deferReply) without proceeding to API calls
    const responded = interaction.reply.mock.calls.length > 0 || interaction.deferReply.mock.calls.length > 0;
    expect(responded).toBe(true);
    expect(mockDeltaForceApi).not.toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị daily codes khi chưa liên kết tài khoản', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị full data khi có token + API thành công', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc', '123', 'sig-1', 'user-1');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: {
          battlefield_battle: { revenue: '50000', kill_count: 10, match_count: 3, kd_ratio: '2.5', retreat_rate: '10' },
        },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    const row = db.prepare('SELECT last_used_at FROM df_tokens WHERE discord_id = ?').get('user-123');
    expect(row?.last_used_at).toBeDefined();
    db.close();
  });

  it('phải xử lý API failure gracefully', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockRejectedValue(new Error('Network error'));

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });
});
