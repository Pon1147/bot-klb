/**
 * Unit tests cho workshop.command.ts — /df-workshop slash command.
 */

jest.mock('discord.js', () => ({
  AttachmentBuilder: class {
    constructor() { this.name = 'test-attachment.png'; }
    setName(n: string) { this.name = n; return this; }
  },
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, MediaGallery: 12 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  touchDfToken: jest.fn(),
}));

jest.mock('../../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
  touchLastOk: jest.fn(),
}));

jest.mock('../../src/services/deltaforce.api.js', () => ({
  getWorkbenchList: jest.fn(),
  getWorkshopRecommendations: jest.fn(),
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
  makeResult: jest.fn((components, flags, files) => ({
    components,
    flags,
    files,
    toJSON() { return this.components; },
  })),
}));

jest.mock('../../src/utils/reply.utils.js', () => ({
  sendReply: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/workshop-data.service.js', () => ({
  getWorkshopItemName: jest.fn(),
  getWorkshopItemImage: jest.fn(),
}));

import { execute } from '../../src/commands/df/workshop.command.js';
import { getDfToken, touchDfToken } from '../../src/database/df.token.db.js';
import { getActiveBinding, touchLastOk } from '../../src/database/df-binding.db.js';
import { getWorkbenchList, getWorkshopRecommendations } from '../../src/services/deltaforce.api.js';
import { buildDfApiToken } from '../../src/utils/df-token.utils.js';
import { buildErrorContainer } from '../../src/utils/container.utils.js';
import { sendReply } from '../../src/utils/reply.utils.js';
import { getWorkshopItemName, getWorkshopItemImage } from '../../src/services/workshop-data.service.js';
import { MessageFlags } from 'discord.js'; // eslint-disable-line

describe('workshop.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);
  const mockEditReply = jest.fn().mockResolvedValue(undefined);
  const mockDeferReply = jest.fn().mockResolvedValue(undefined);

  function createMockInteraction(overrides: any = {}) {
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
    (getWorkshopItemName as jest.Mock).mockImplementation((id: string) => Promise.resolve(`San pham ${id}`));
    (getWorkshopItemImage as jest.Mock).mockResolvedValue('');
  });

  // ── Case 1: Không có guild ──

  it('nen tra ve error khi khong co guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    // requireGuild guard gọi sendReply, không phải mockReply
    expect(sendReply).toHaveBeenCalled();
  });

  // ── Case 2: Chưa liên kết tài khoản ──

  it('nen tra ve error khi chua lien ket tai khoan', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    (getActiveBinding as jest.Mock).mockReturnValue(null);
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);
    // Runner gọi sendReply khi chưa có token
    expect(sendReply).toHaveBeenCalled();
    expect(buildErrorContainer).toHaveBeenCalledWith(
      expect.stringMatching(/lien ket/i),
    );
    expect(getWorkbenchList).not.toHaveBeenCalled();
    expect(getWorkshopRecommendations).not.toHaveBeenCalled();
  });

  // ── Case 3: Thành công — cả workbench + recommendation ──

  it('nen hien thi du lieu khi co ca workbench va recommendation', async () => {
    const mockToken = { openid: '123', token: 'abc', ts: '42', s: 'sig1', u: 'dev1', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1005', item_id: '11050005001', recommended_recipe_id: '371030001', remaining_time: 3600, status: 1, hourly_income: '1000' },
      ],
    });
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1006', item_id: '14020000007', recommended_recipe_id: '371030002', remaining_time: 0, status: 0, hourly_income: '2000' },
      ],
    });

    await execute(createMockInteraction(), mockDb);

    expect(mockDeferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(getWorkbenchList).toHaveBeenCalled();
    expect(getWorkshopRecommendations).toHaveBeenCalled();
    expect(getWorkshopItemName).toHaveBeenCalledTimes(2);
    expect(mockEditReply).toHaveBeenCalled();
    expect(touchDfToken).toHaveBeenCalledWith(mockDb, '222');
  });

  // ── Case 4: Chỉ có recommendation (không sản xuất gì) ──

  it('nen hien thi chi de xuat khi khong co san xuat hien tai', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockResolvedValue({ workbench_list: [] });
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1005', item_id: '11050005001', recommended_recipe_id: '371030001', remaining_time: 0, status: 0, hourly_income: '1000' },
        { workbench_id: '1006', item_id: '14020000007', recommended_recipe_id: '371030002', remaining_time: 0, status: 0, hourly_income: '2000' },
      ],
    });

    await execute(createMockInteraction(), mockDb);

    expect(mockEditReply).toHaveBeenCalled();
    expect(getWorkshopItemName).toHaveBeenCalledTimes(2);
  });

  // ── Case 5: Chỉ có workbench (không có đề xuất) ──

  it('nen hien thi chi tiet san xuat khi khong co de xuat', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1007', item_id: '37120500001', recommended_recipe_id: '371030003', remaining_time: 7200, status: 1, hourly_income: '3000' },
      ],
    });
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({ workbench_list: [] });

    await execute(createMockInteraction(), mockDb);

    expect(mockEditReply).toHaveBeenCalled();
    expect(getWorkshopItemName).toHaveBeenCalledTimes(1);
  });

  // ── Case 6: API error — fallback cho API thất bại ──

  it('nen xu ly API error gracefully — 1 API fail 1 API ok', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockRejectedValue(new Error('API timeout'));
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1005', item_id: '11050005001', recommended_recipe_id: '371030001', remaining_time: 0, status: 0, hourly_income: '1000' },
      ],
    });

    await execute(createMockInteraction(), mockDb);

    expect(mockEditReply).toHaveBeenCalled();
    expect(getWorkshopItemName).toHaveBeenCalledTimes(1);
  });

  // ── Case 7: Cả 2 API đều fail ──

  it('nen hien thi "Khong co du lieu" khi ca 2 API deu fail', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockRejectedValue(new Error('API timeout'));
    (getWorkshopRecommendations as jest.Mock).mockRejectedValue(new Error('API timeout'));

    await execute(createMockInteraction(), mockDb);

    // Khi cả 2 API đều fail → allItems rỗng → hiển thị "Không có dữ liệu sản xuất"
    expect(mockEditReply).toHaveBeenCalled();
  });

  // ── Case 8: API error trong callback ──

  it('nen hien thi error container khi API loi trong callback', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1005', item_id: '11050005001', recommended_recipe_id: '371030001', remaining_time: 3600, status: 1, hourly_income: '1000' },
      ],
    });
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1006', item_id: '14020000007', recommended_recipe_id: '371030002', remaining_time: 0, status: 0, hourly_income: '2000' },
      ],
    });
    (getWorkshopItemName as jest.Mock).mockRejectedValue(new Error('Network error'));

    await execute(createMockInteraction(), mockDb);

    expect(mockEditReply).toHaveBeenCalled();
    expect(buildErrorContainer).toHaveBeenCalledWith(
      expect.stringContaining('Loi khi lay du lieu'),
    );
    expect(touchDfToken).not.toHaveBeenCalled();
  });

  // ── Case 9: getWorkbenchList rejected, getWorkshopRecommendations fulfilled ──

  it('nen dung getWorkbenchList khi rejected va lay du lieu tu recommendation', async () => {
    const mockToken = { openid: '123', token: 'abc', linked_at: '2026-06-09', last_used_at: null };
    (getDfToken as jest.Mock).mockReturnValue(mockToken);
    (getActiveBinding as jest.Mock).mockReturnValue(null);

    (getWorkbenchList as jest.Mock).mockRejectedValue(new Error('Service unavailable'));
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({
      workbench_list: [
        { workbench_id: '1002', item_id: '15200000044', recommended_recipe_id: '371030004', remaining_time: 0, status: 0, hourly_income: '500' },
      ],
    });

    await execute(createMockInteraction(), mockDb);

    expect(mockEditReply).toHaveBeenCalled();
    expect(getWorkshopItemName).toHaveBeenCalledWith('15200000044');
  });

  // ── Case 10: Binding encrypted thay vì legacy token ──

  it('nen xu ly binding flow neu co binding', async () => {
    const mockBinding = {
      cred_nonce: 'nonce1',
      cred_ciphertext: 'cipher1',
      cred_tag: 'tag1',
      discord_user_id: '222',
      openid: 'openid1',
      captured_at: '2026-08-01T00:00:00Z',
    };
    (getActiveBinding as jest.Mock).mockReturnValue(mockBinding);

    // Trong test env, decrypt se bi loi → runner goi sendReply (error container)
    (getWorkbenchList as jest.Mock).mockResolvedValue({ workbench_list: [] });
    (getWorkshopRecommendations as jest.Mock).mockResolvedValue({ workbench_list: [] });

    await execute(createMockInteraction(), mockDb);

    // Decrypt fail → sendReply voi error container, khong goi editReply
    expect(sendReply).toHaveBeenCalled();
    expect(mockEditReply).not.toHaveBeenCalled();
    expect(touchLastOk).not.toHaveBeenCalled();
  });
});
