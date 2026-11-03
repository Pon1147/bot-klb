/**
 * Unit tests cho df-unlink.command.ts — /df-unlink slash command.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() {
      return this;
    }
    setDescription() {
      return this;
    }
  },
}));

jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  deleteDfToken: jest.fn(),
}));

jest.mock('../../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
  revokeBinding: jest.fn(),
  revokeBindingAsync: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildSuccessContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
  buildInfoContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
  buildErrorContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() {
      return this.components;
    },
  })),
}));

import { execute } from '../../src/features/delta-force/unlink.handler.js';
import { getActiveBinding, revokeBindingAsync } from '../../src/database/df-binding.db.js';
import { MessageFlags } from 'discord.js';

describe('df-unlink.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222' },
      reply: mockReply,
      options: {},
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (revokeBindingAsync as jest.Mock).mockResolvedValue({ success: true });
  });

  describe('guild check', () => {
    it('nên trả về error khi không có guild', async () => {
      const interaction = createMockInteraction({ guild: null });
      await execute(interaction, mockDb);
      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('server'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });

  describe('unlink flow', () => {
    it('nên revoke binding khi có active binding', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        id: 1,
        discord_user_id: '222',
        openid: 'garena123',
        status: 'active',
      });
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(revokeBindingAsync).toHaveBeenCalledWith(mockDb, '222');
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên revoke binding khi chỉ có legacy token (không có binding)', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue(undefined);
      const { getDfToken } = require('../../src/database/df.token.db.js');
      (getDfToken as jest.Mock).mockReturnValue({
        openid: 'legacy123',
        token: 'abc',
        linked_at: '2026-06-09',
      });
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      // requireDfBinding trả về false (có token) → execute tiếp tục → revokeBindingAsync được gọi
      expect(revokeBindingAsync).toHaveBeenCalledWith(mockDb, '222');
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về error khi không có binding và không có token', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue(undefined);
      const { getDfToken } = require('../../src/database/df.token.db.js');
      (getDfToken as jest.Mock).mockReturnValue(undefined);
      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(revokeBindingAsync).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalled();
    });

    it('nên trả về thông báo lỗi khi MongoDB gặp sự cố (database_unavailable)', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        id: 1,
        discord_user_id: '222',
        openid: 'garena123',
        status: 'active',
      });
      (revokeBindingAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'database_unavailable',
      });

      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(revokeBindingAsync).toHaveBeenCalledWith(mockDb, '222');
      const { buildErrorContainer } = require('../../src/utils/container.utils.js');
      expect(buildErrorContainer).toHaveBeenCalledWith(
        expect.stringContaining('Cơ sở dữ liệu tạm thời không khả dụng'),
      );
    });

    it('khi generation_mismatch: trả về error container và không vô tình báo thành công', async () => {
      (getActiveBinding as jest.Mock).mockReturnValue({
        id: 1,
        discord_user_id: '222',
        openid: 'garena123',
        status: 'active',
      });
      (revokeBindingAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'generation_mismatch',
      });

      const interaction = createMockInteraction();
      await execute(interaction, mockDb);

      expect(revokeBindingAsync).toHaveBeenCalledWith(mockDb, '222');
      const {
        buildErrorContainer,
        buildSuccessContainer,
      } = require('../../src/utils/container.utils.js');
      expect(buildErrorContainer).toHaveBeenCalledWith(
        expect.stringContaining('Phiên liên kết đã thay đổi hoặc đã được cập nhật mới'),
      );
      expect(buildSuccessContainer).not.toHaveBeenCalled();
    });
  });
});
