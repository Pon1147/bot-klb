/// <reference types="jest" />
/**
 * Unit tests cho booster.event.ts — xử lý sự kiện Server Boost và gán role booster.
 */

import { GuildMember, Role, TextChannel } from 'discord.js';
import { assignBoosterRole, handleBoosterMemberUpdate } from '../../src/features/booster/booster.event.js';
import { getSettingsService } from '../../src/services/settings.service.js';

jest.mock('../../src/services/settings.service.js', () => ({
  getSettingsService: jest.fn(),
}));

describe('features/booster/booster.event', () => {
  let mockMember: any;
  let mockRole: any;
  let mockSettingsService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRole = {
      id: 'booster-role-123',
      name: 'Server Booster Role',
    };

    mockMember = {
      guild: {
        id: 'guild-111',
        roles: {
          cache: new Map([['booster-role-123', mockRole]]),
        },
        channels: {
          cache: new Map(),
        },
      },
      user: {
        id: 'user-222',
        tag: 'TestUser#1234',
        bot: false,
      },
      roles: {
        add: jest.fn().mockResolvedValue(undefined),
      },
      premiumSince: null,
    };

    mockSettingsService = {
      getBooster: jest.fn().mockReturnValue({
        enabled: true,
        channelId: 'booster-ch-999',
        roleId: 'booster-role-123',
      }),
      buildBoosterContainer: jest.fn().mockReturnValue({
        toJSON: () => [{ type: 17, components: [] }],
        flags: 65536,
        files: [],
      }),
    };
    (getSettingsService as jest.Mock).mockReturnValue(mockSettingsService);
  });

  describe('assignBoosterRole', () => {
    it('gán role thành công khi role tồn tại trong guild', async () => {
      await assignBoosterRole(mockMember as unknown as GuildMember, 'booster-role-123');
      expect(mockMember.roles.add).toHaveBeenCalledWith(mockRole);
    });

    it('bỏ qua nếu role không tồn tại trong cache của guild', async () => {
      await assignBoosterRole(mockMember as unknown as GuildMember, 'non-existent-role');
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('bắt ngoại lệ và log lỗi gracefully nếu roles.add ném ra Error instance', async () => {
      mockMember.roles.add.mockRejectedValueOnce(new Error('Missing Permissions'));
      await expect(
        assignBoosterRole(mockMember as unknown as GuildMember, 'booster-role-123'),
      ).resolves.toBeUndefined();
    });

    it('bắt ngoại lệ và log lỗi gracefully nếu roles.add ném ra string/non-error', async () => {
      mockMember.roles.add.mockRejectedValueOnce('Network failure');
      await expect(
        assignBoosterRole(mockMember as unknown as GuildMember, 'booster-role-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleBoosterMemberUpdate', () => {
    it('bỏ qua nếu newMember là bot', async () => {
      const oldMember = { ...mockMember, user: { bot: true } };
      const newMember = { ...mockMember, user: { bot: true }, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(getSettingsService).not.toHaveBeenCalled();
    });

    it('bỏ qua nếu member đã boost từ trước (wasBoosting = true)', async () => {
      const oldMember = { ...mockMember, premiumSince: new Date(Date.now() - 10000) };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(getSettingsService).not.toHaveBeenCalled();
    });

    it('bỏ qua nếu member không boost (cả oldMember và newMember đều có premiumSince = null)', async () => {
      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: null };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(getSettingsService).not.toHaveBeenCalled();
    });

    it('gửi thông báo cảm ơn và gán role khi member vừa mới boost', async () => {
      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue(undefined),
      };
      mockMember.guild.channels.cache.set('booster-ch-999', mockChannel);

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockSettingsService.getBooster).toHaveBeenCalledWith('guild-111');
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: 65536,
          files: [],
        }),
      );
      expect(mockMember.roles.add).toHaveBeenCalledWith(mockRole);
    });

    it('không gửi gì nếu booster feature bị disabled trong settings', async () => {
      mockSettingsService.getBooster.mockReturnValueOnce({
        enabled: false,
        channelId: 'booster-ch-999',
        roleId: 'booster-role-123',
      });

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('không gửi gì nếu booster channelId chưa được cấu hình (null/empty)', async () => {
      mockSettingsService.getBooster.mockReturnValueOnce({
        enabled: true,
        channelId: null,
        roleId: 'booster-role-123',
      });

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('không gửi nếu channel không tồn tại trong cache của guild', async () => {
      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('không gửi nếu channel không phải text-based channel', async () => {
      const mockVoiceChannel = {
        isTextBased: () => false,
        send: jest.fn(),
      };
      mockMember.guild.channels.cache.set('booster-ch-999', mockVoiceChannel);

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockVoiceChannel.send).not.toHaveBeenCalled();
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('gửi thông báo nhưng không gán role nếu booster settings không cấu hình roleId', async () => {
      mockSettingsService.getBooster.mockReturnValueOnce({
        enabled: true,
        channelId: 'booster-ch-999',
        roleId: null,
      });

      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue(undefined),
      };
      mockMember.guild.channels.cache.set('booster-ch-999', mockChannel);

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await handleBoosterMemberUpdate(
        oldMember as unknown as GuildMember,
        newMember as unknown as GuildMember,
      );

      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('bắt ngoại lệ và log lỗi gracefully nếu gửi message ném ra Error instance', async () => {
      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockRejectedValueOnce(new Error('Discord API unavailable')),
      };
      mockMember.guild.channels.cache.set('booster-ch-999', mockChannel);

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await expect(
        handleBoosterMemberUpdate(
          oldMember as unknown as GuildMember,
          newMember as unknown as GuildMember,
        ),
      ).resolves.toBeUndefined();
    });

    it('bắt ngoại lệ và log lỗi gracefully nếu gửi message ném ra non-error object', async () => {
      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockRejectedValueOnce('Socket closed unexpectedly'),
      };
      mockMember.guild.channels.cache.set('booster-ch-999', mockChannel);

      const oldMember = { ...mockMember, premiumSince: null };
      const newMember = { ...mockMember, premiumSince: new Date() };

      await expect(
        handleBoosterMemberUpdate(
          oldMember as unknown as GuildMember,
          newMember as unknown as GuildMember,
        ),
      ).resolves.toBeUndefined();
    });
  });
});

