/// <reference types="jest" />
/**
 * Unit tests cho guildMemberUpdate.event.ts:
 * - Delegate sang feature booster
 * - Cleanup team-find embed và active session khi rời/chuyển voice channel
 */

import { GuildMember } from 'discord.js';
import { execute } from '../../src/events/guildMemberUpdate.event.js';
import { handleBoosterMemberUpdate } from '../../src/features/booster/booster.event.js';
import { getMessageRef, deleteMessageRef } from '../../src/services/team-find-message-store.js';
import { getSession, deleteSession } from '../../src/services/team-find-session.js';

jest.mock('../../src/features/booster/booster.event.js', () => ({
  handleBoosterMemberUpdate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/team-find-message-store.js', () => ({
  getMessageRef: jest.fn(),
  deleteMessageRef: jest.fn(),
}));

jest.mock('../../src/services/team-find-session.js', () => ({
  getSession: jest.fn(),
  deleteSession: jest.fn(),
}));

describe('events/guildMemberUpdate.event', () => {
  let mockOldMember: any;
  let mockNewMember: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOldMember = {
      guild: {
        id: 'guild-111',
        channels: {
          fetch: jest.fn(),
        },
      },
      user: {
        id: 'user-222',
        bot: false,
      },
      voice: {
        channelId: null,
      },
    };

    mockNewMember = {
      guild: mockOldMember.guild,
      user: {
        id: 'user-222',
        bot: false,
      },
      voice: {
        channelId: null,
      },
    };
  });

  it('bỏ qua toàn bộ nếu newMember là bot', async () => {
    mockNewMember.user.bot = true;

    await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

    expect(handleBoosterMemberUpdate).not.toHaveBeenCalled();
    expect(getMessageRef).not.toHaveBeenCalled();
  });

  it('gọi handleBoosterMemberUpdate cho user thường', async () => {
    await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

    expect(handleBoosterMemberUpdate).toHaveBeenCalledWith(mockOldMember, mockNewMember);
  });

  describe('Voice channel change & Team-find cleanup', () => {
    it('không cleanup nếu user trước đó không ở trong voice channel (oldChannelId == null)', async () => {
      mockOldMember.voice = { channelId: null };
      mockNewMember.voice = { channelId: 'vc-123' };

      await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

      expect(getMessageRef).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
    });

    it('không cleanup nếu channelId không đổi (oldChannelId === newChannelId)', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: 'vc-123' };

      await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

      expect(getMessageRef).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
    });

    it('cleanup cả embed message và session khi user rời voice channel hoàn toàn (newChannelId == null)', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: null };

      // Mock cleanupOldEmbed
      (getMessageRef as jest.Mock).mockReturnValue({
        channelId: 'text-ch-456',
        messageId: 'msg-789',
      });
      const mockMsg = { delete: jest.fn().mockResolvedValue(undefined) };
      const mockTextChannel = {
        isTextBased: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
      };
      mockNewMember.guild.channels.fetch.mockResolvedValueOnce(mockTextChannel);

      // Mock cleanup session
      (getSession as jest.Mock).mockReturnValue({
        channelId: 'menu-ch-555',
        messageId: 'menu-msg-666',
      });
      const mockMenuMsg = { delete: jest.fn().mockResolvedValue(undefined) };
      const mockMenuChannel = {
        isTextBased: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(mockMenuMsg) },
      };
      mockNewMember.guild.channels.fetch.mockResolvedValueOnce(mockMenuChannel);

      await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

      expect(mockMsg.delete).toHaveBeenCalled();
      expect(deleteMessageRef).toHaveBeenCalledWith('guild-111', 'user-222');
      expect(mockMenuMsg.delete).toHaveBeenCalled();
      expect(deleteSession).toHaveBeenCalledWith('user-222');
    });

    it('cleanup khi user chuyển sang voice channel khác (oldChannelId !== newChannelId)', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: 'vc-999' };

      (getMessageRef as jest.Mock).mockReturnValue(null);
      (getSession as jest.Mock).mockReturnValue(null);

      await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

      expect(deleteMessageRef).not.toHaveBeenCalled();
      expect(deleteSession).not.toHaveBeenCalled();
    });

    it('xử lý an toàn khi channel của embed không phải text channel hoặc ném lỗi', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: null };

      (getMessageRef as jest.Mock).mockReturnValue({
        channelId: 'voice-as-text',
        messageId: 'msg-111',
      });
      // channel fetch fails
      mockNewMember.guild.channels.fetch.mockRejectedValueOnce(new Error('Unknown Channel'));

      (getSession as jest.Mock).mockReturnValue(null);

      await expect(
        execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember),
      ).resolves.toBeUndefined();

      expect(deleteMessageRef).toHaveBeenCalledWith('guild-111', 'user-222');
    });

    it('xử lý an toàn khi channel của menu session fetch lỗi hoặc message đã bị xóa', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: null };

      (getMessageRef as jest.Mock).mockReturnValue(null);

      (getSession as jest.Mock).mockReturnValue({
        channelId: 'menu-ch-123',
        messageId: 'menu-msg-456',
      });
      const mockMenuChannel = {
        isTextBased: () => true,
        messages: { fetch: jest.fn().mockRejectedValue(new Error('Unknown Message')) },
      };
      mockNewMember.guild.channels.fetch.mockResolvedValueOnce(mockMenuChannel);

      await expect(
        execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember),
      ).resolves.toBeUndefined();

      expect(deleteSession).toHaveBeenCalledWith('user-222');
    });

    it('xử lý khi menuChannel fetch trả về non-text channel', async () => {
      mockOldMember.voice = { channelId: 'vc-123' };
      mockNewMember.voice = { channelId: null };

      (getMessageRef as jest.Mock).mockReturnValue(null);

      (getSession as jest.Mock).mockReturnValue({
        channelId: 'menu-voice-ch',
        messageId: 'menu-msg-456',
      });
      const mockMenuChannel = {
        isTextBased: () => false,
      };
      mockNewMember.guild.channels.fetch.mockResolvedValueOnce(mockMenuChannel);

      await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

      expect(deleteSession).toHaveBeenCalledWith('user-222');
    });
  });
});

