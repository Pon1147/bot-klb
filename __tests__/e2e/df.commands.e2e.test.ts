/**
 * DF Commands E2E — /df-stats, /df-daily, /df-code, /df-unlink, /df-history.
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
  PermissionFlagsBits: { Administrator: 0x8 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addSubcommand() { return this; }
    addSubcommandGroup() { return this; }
    addIntegerOption = (cb: (opt: any) => any) => { cb({ setName() { return this; }, setDescription() { return this; }, setMinValue() { return this; }, setMaxValue() { return this; } }); return this; };
  },
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
  ActionRowBuilder: class { addComponents() { return this; } toJSON() { return {}; } },
  ButtonBuilder: class {
    setCustomId() { return this; }
    setLabel() { return this; }
    setStyle() { return this; }
    toJSON() { return {}; }
  },
  ButtonStyle: { Secondary: 2 },
}));

jest.mock('../../src/services/settings.service', () => ({
  getSettingsService: jest.fn(() => ({
    get: jest.fn(() => ({
      dfCodes: { enabled: true, channelId: null },
    })),
  })),
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

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
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

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    db.close();
  });

  it('phải trả về error khi chưa liên kết tài khoản', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    expect(mockDeltaForceApi).not.toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị battle stats khi có token + API thành công', async () => {
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

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
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

  it('phải xử lý khi battle data là null', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: { battlefield_battle: null, beacon_battle: null },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });
});

// ── /df-code ─────────────────────────────────────────────────────

describe('DF Commands E2E — /df-code', () => {
  let execute: (interaction: any, db: any) => Promise<void>;
  let createTestDb: () => any;
  let createMockInteraction: (overrides?: any) => any;

  beforeEach(() => {
    jest.resetModules();

    ({ execute } = require('../../src/commands/df/code.command'));
    ({ createTestDb } = require('./setup'));
    ({ createMockInteraction } = require('./fixtures'));
  });

  it('phải trả về error khi không có guild', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();
    interaction.guild = null;

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị codes khi scraper trả về data (không cần token)', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });

  it('phải xử lý scraper trả về null gracefully', async () => {
    const db = createTestDb();
    const { fetchDailyCodes } = require('../../src/services/deltaforce.scraper');
    (fetchDailyCodes as jest.Mock).mockResolvedValue(null);

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });
});

// ── /df-unlink ───────────────────────────────────────────────────

describe('DF Commands E2E — /df-unlink', () => {
  let execute: (interaction: any, db: any) => Promise<void>;
  let createTestDb: () => any;
  let seedDfToken: (db: any, ...args: any[]) => void;
  let createMockInteraction: (overrides?: any) => any;

  beforeEach(() => {
    jest.resetModules();

    ({ createTestDb, seedDfToken } = require('./setup'));
    ({ createMockInteraction } = require('./fixtures'));
    ({ execute } = require('../../src/commands/df/unlink.command'));
  });

  it('phải trả về error khi không có guild', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction({ guild: null });

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    db.close();
  });

  it('phải trả về info khi chưa liên kết tài khoản', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('user-123');
    expect(row).toBeUndefined();
    db.close();
  });

  it('phải xóa token khi có tài khoản liên kết', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const row = db.prepare('SELECT * FROM df_tokens WHERE discord_id = ?').get('user-123');
    expect(row).toBeUndefined();
    db.close();
  });
});

// ── /df-history ──────────────────────────────────────────────────

describe('DF Commands E2E — /df-history', () => {
  let execute: (interaction: any, db: any) => Promise<void>;
  let createTestDb: () => any;
  let seedDfToken: (db: any, ...args: any[]) => void;
  let createMockInteraction: (overrides?: any) => any;

  beforeEach(() => {
    jest.resetModules();
    mockDeltaForceApi.mockReset();

    ({ createTestDb, seedDfToken } = require('./setup'));
    ({ createMockInteraction } = require('./fixtures'));
    ({ execute } = require('../../src/commands/df/history.command'));
  });

  it('phải trả về error khi không có guild', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction({ guild: null });

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    db.close();
  });

  it('phải trả về error khi chưa liên kết tài khoản', async () => {
    const db = createTestDb();
    const interaction = createMockInteraction();

    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    expect(mockDeltaForceApi).not.toHaveBeenCalled();
    db.close();
  });

  it('phải hiển thị match list khi có token + API thành công', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc', '123', 'sig-1', 'user-1');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: {
          commonly_used_operators_id: '1',
          list: [
            { carry_out_value: '50000', is_leave: 0, kill_count: 5, map_id: 2201, match_time: '1609459200', net_income: '10000', operator_icon: '', operator_id: '1', result: 1, room_id: '1', score: 1000 },
          ],
        },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });

  it('phải trả về error khi không có match nào', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockResolvedValue({
      data: {
        code: 0,
        msg: 'ok',
        data: { commonly_used_operators_id: '1', list: [] },
      },
    });

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });

  it('phải xử lý API error gracefully', async () => {
    const db = createTestDb();
    seedDfToken(db, 'user-123', 'openid-1', 'token-abc');

    mockDeltaForceApi.mockRejectedValue(new Error('Network error'));

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.editReply).toHaveBeenCalled();
    db.close();
  });
});
