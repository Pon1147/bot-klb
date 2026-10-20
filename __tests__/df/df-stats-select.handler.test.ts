/**
 * Unit tests cho stats-select.handler.ts — handleDfStatsSelect.
 * Kiểm tra RBAC guard, Ownership check và Season switching.
 */

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, Section: 9, Thumbnail: 11 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 0x8 },
  ActionRowBuilder: class {
    components: any[] = [];
    addComponents(...c: any[]) { this.components.push(...c); return this; }
    toJSON() { return { type: 1, components: this.components }; }
  },
  StringSelectMenuBuilder: class {
    customId: string = '';
    placeholder: string = '';
    disabled: boolean = false;
    options: any[] = [];
    setCustomId(id: string) { this.customId = id; return this; }
    setPlaceholder(p: string) { this.placeholder = p; return this; }
    setDisabled(d: boolean) { this.disabled = d; return this; }
    addOptions(opts: any[]) { this.options.push(...opts); return this; }
  },
  StringSelectMenuOptionBuilder: class {
    label: string = '';
    value: string = '';
    setLabel(l: string) { this.label = l; return this; }
    setValue(v: string) { this.value = v; return this; }
  },
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
}));

jest.mock('../../src/services/deltaforce.api.js', () => ({
  getOverviewData: jest.fn(),
  getSeasonData: jest.fn(),
}));

jest.mock('../../src/utils/df-token.utils.js', () => ({
  buildDfApiToken: jest.fn((t) => t),
}));

jest.mock('../../src/utils/df-rank.utils.js', () => ({
  resolveRankFromScore: jest.fn(() => ({
    rankId: 30,
    name: 'Vàng I',
    imageUrl: 'https://example.com/gold.png',
  })),
}));

const mockSettingsService = {
  get: jest.fn(() => ({
    rbac: { memberRoleId: null },
  })),
};

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(() => mockSettingsService),
}));

import { handleDfStatsSelect } from '../../src/features/delta-force/stats-select.handler.js';
import { getDfToken } from '../../src/database/df.token.db.js';
import { getOverviewData } from '../../src/services/deltaforce.api.js';

describe('df-stats-select.handler', () => {
  const mockDb: any = {};
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferUpdate = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);

  function createMockSelectInteraction(overrides: any = {}): any {
    return {
      customId: 'df_stats_season_select:user-A',
      values: ['overview'],
      user: { id: 'user-A' },
      guild: { id: 'guild-1', ownerId: 'owner-999' },
      guildId: 'guild-1',
      member: { roles: [] },
      memberPermissions: { has: () => false },
      message: {
        interactionMetadata: { user: { id: 'user-A' } },
        interaction: { user: { id: 'user-A' } },
      },
      reply: mockReply,
      deferUpdate: mockDeferUpdate,
      editReply: mockEditReply,
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bỏ qua nếu customId không bắt đầu bằng df_stats_season_select', async () => {
    const interaction = createMockSelectInteraction({ customId: 'other_custom_id' });
    const result = await handleDfStatsSelect(interaction, mockDb);
    expect(result.handled).toBe(false);
  });

  it('chặn User B khi User B không phải người tạo lệnh (Ownership check)', async () => {
    const interaction = createMockSelectInteraction({
      customId: 'df_stats_season_select:user-A',
      user: { id: 'user-B' }, // User B click vào card của User A
    });

    const result = await handleDfStatsSelect(interaction, mockDb);

    expect(result.handled).toBe(true);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('không thể thao tác trên bảng thống kê của người khác'),
        flags: 64,
      }),
    );
    expect(mockDeferUpdate).not.toHaveBeenCalled();
    expect(getDfToken).not.toHaveBeenCalled();
  });

  it('chặn khi người dùng không có quyền DF_ACCESS (RBAC check)', async () => {
    // Giả lập server cấu hình memberRoleId nhưng user không có role
    mockSettingsService.get.mockReturnValueOnce({
      rbac: { memberRoleId: 'role-member' },
    });

    const interaction = createMockSelectInteraction({
      user: { id: 'user-A' },
      member: { roles: ['role-other'] },
    });

    const result = await handleDfStatsSelect(interaction, mockDb);

    expect(result.handled).toBe(true);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('role <@&role-member>'),
        flags: 64,
      }),
    );
    expect(mockDeferUpdate).not.toHaveBeenCalled();
  });

  it('cho phép User A chuyển season và tải đúng data của User A', async () => {
    (getDfToken as jest.Mock).mockReturnValue({
      openid: 'openid-A',
      token: 'token-A',
      discord_id: 'user-A',
    });

    (getOverviewData as jest.Mock).mockResolvedValue({
      player_info: { avatar: '', level: 20, nickname: 'PlayerA', play_duration: '10', register_time: '1609459200' },
      rank_data: { current_rank: 'Vàng I', current_rank_score: 2200 },
      summary_data: {
        total_match_count: 50,
        combat: null,
        economy: null,
        team: null,
      },
    });

    const interaction = createMockSelectInteraction({
      customId: 'df_stats_season_select:user-A',
      values: ['overview'],
      user: { id: 'user-A' },
    });

    const result = await handleDfStatsSelect(interaction, mockDb);

    expect(result.handled).toBe(true);
    expect(mockDeferUpdate).toHaveBeenCalled();
    expect(getDfToken).toHaveBeenCalledWith(mockDb, 'user-A');
    expect(getOverviewData).toHaveBeenCalled();
    expect(mockEditReply).toHaveBeenCalled();
  });
});
