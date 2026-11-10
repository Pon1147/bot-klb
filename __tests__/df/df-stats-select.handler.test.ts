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

jest.mock('../../src/services/df-crypto.js', () => ({
  decryptCredential: jest.fn(),
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
import { getActiveBinding } from '../../src/database/df-binding.db.js';
import { decryptCredential } from '../../src/services/df-crypto.js';
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

  describe('Key-version handling & Decryption Verification (Task 2)', () => {
    it('giải mã thành công với binding key_version v2 và truyền đúng key_version', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        discord_user_id: 'user-A',
        openid: 'openid-v2',
        cred_nonce: 'nonce-123',
        cred_ciphertext: 'cipher-123',
        cred_tag: 'tag-123',
        key_version: 'v2',
        captured_at: '2026-11-10T00:00:00Z',
      });

      (decryptCredential as jest.Mock).mockReturnValue(
        JSON.stringify({ token: 'decrypted-v2-token', ts: '123', s: '456', u: '789' }),
      );

      (getOverviewData as jest.Mock).mockResolvedValue({
        player_info: { avatar: '', level: 30, nickname: 'V2Player', play_duration: '50', register_time: '1609459200' },
        rank_data: { current_rank: 'Bạch Kim', current_rank_score: 3100 },
        summary_data: { total_match_count: 100, combat: null, economy: null, team: null },
      });

      const interaction = createMockSelectInteraction({
        customId: 'df_stats_season_select:user-A',
        values: ['overview'],
        user: { id: 'user-A' },
      });

      const result = await handleDfStatsSelect(interaction, mockDb);

      expect(result.handled).toBe(true);
      expect(getActiveBinding).toHaveBeenCalledWith(mockDb, 'user-A');
      expect(decryptCredential).toHaveBeenCalledWith(
        'nonce-123',
        'cipher-123',
        'tag-123',
        'user-A',
        'openid-v2',
        'v2',
      );
      expect(mockEditReply).toHaveBeenCalled();
      // Không fallback sang getDfToken khi binding active giải mã thành công
      expect(getDfToken).not.toHaveBeenCalled();
    });

    it('báo lỗi rõ ràng và TUYỆT ĐỐI không âm thầm fallback sang legacy df_tokens khi giải mã binding thất bại', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        discord_user_id: 'user-A',
        openid: 'openid-corrupt',
        cred_nonce: 'nonce-bad',
        cred_ciphertext: 'cipher-bad',
        cred_tag: 'tag-bad',
        key_version: 'v2',
      });

      // Giả lập decryptCredential ném lỗi do sai key hoặc hỏng auth tag
      (decryptCredential as jest.Mock).mockImplementation(() => {
        throw new Error('Unsupported state or unable to authenticate data');
      });

      // Dù trong bảng legacy df_tokens vẫn còn token cũ:
      (getDfToken as jest.Mock).mockReturnValue({
        openid: 'openid-stale',
        token: 'token-stale-legacy',
        discord_id: 'user-A',
      });

      const interaction = createMockSelectInteraction({
        customId: 'df_stats_season_select:user-A',
        values: ['overview'],
        user: { id: 'user-A' },
      });

      const result = await handleDfStatsSelect(interaction, mockDb);

      expect(result.handled).toBe(true);
      // Kiểm tra phản hồi thông báo lỗi binding corrupt, yêu cầu link lại
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Binding tài khoản bị lỗi hoặc khóa không hợp lệ'),
          flags: 64,
        }),
      );
      // Không gọi deferUpdate hoặc getOverviewData
      expect(mockDeferUpdate).not.toHaveBeenCalled();
      expect(getOverviewData).not.toHaveBeenCalled();
      // Không được đọc getDfToken khi binding đang active bị lỗi
      expect(getDfToken).not.toHaveBeenCalled();
    });

    it('thông báo chưa liên kết khi không có cả binding lẫn legacy token', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue(undefined);
      (getDfToken as jest.Mock).mockReturnValue(undefined);

      const interaction = createMockSelectInteraction({
        customId: 'df_stats_season_select:user-A',
        values: ['overview'],
        user: { id: 'user-A' },
      });

      const result = await handleDfStatsSelect(interaction, mockDb);

      expect(result.handled).toBe(true);
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chưa liên kết tài khoản'),
          flags: 64,
        }),
      );
      expect(mockDeferUpdate).not.toHaveBeenCalled();
    });
  });
});
