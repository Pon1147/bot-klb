/// <reference types="jest" />
/**
 * Unit tests cho voiceStateUpdate.event.ts:
 * - Cleanup team-find embed và session khi rời/chuyển voice channel
 * - Không thực hiện REST fetch trên ephemeral message (tránh 404)
 */

import { VoiceState } from 'discord.js';
import { execute } from '../../src/events/voiceStateUpdate.event.js';
import { getMessageRef, deleteMessageRef } from '../../src/services/team-find-message-store.js';
import { deleteSession } from '../../src/services/team-find-session.js';

jest.mock('../../src/services/team-find-message-store.js', () => ({
  getMessageRef: jest.fn(),
  deleteMessageRef: jest.fn(),
}));

jest.mock('../../src/services/team-find-session.js', () => ({
  deleteSession: jest.fn(),
}));

describe('events/voiceStateUpdate.event', () => {
  let mockOldState: any;
  let mockNewState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockGuild = {
      id: 'guild-111',
      channels: {
        fetch: jest.fn(),
      },
    };

    mockOldState = {
      id: 'user-222',
      guild: mockGuild,
      channelId: null,
      member: {
        id: 'user-222',
        user: { id: 'user-222', bot: false },
      },
    };

    mockNewState = {
      id: 'user-222',
      guild: mockGuild,
      channelId: null,
      member: mockOldState.member,
    };
  });

  it('bỏ qua nếu member là bot', async () => {
    mockNewState.member.user.bot = true;
    mockOldState.channelId = 'vc-1';

    await execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState);

    expect(getMessageRef).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('không làm gì nếu user chưa từng ở trong voice channel (oldChannelId == null)', async () => {
    mockOldState.channelId = null;
    mockNewState.channelId = 'vc-1';

    await execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState);

    expect(getMessageRef).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('không làm gì nếu channelId không đổi (oldChannelId === newChannelId)', async () => {
    mockOldState.channelId = 'vc-1';
    mockNewState.channelId = 'vc-1';

    await execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState);

    expect(getMessageRef).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('cleanup embed và session khi user rời voice channel (newChannelId == null)', async () => {
    mockOldState.channelId = 'vc-1';
    mockNewState.channelId = null;

    (getMessageRef as jest.Mock).mockReturnValue({
      channelId: 'text-ch-1',
      messageId: 'msg-1',
    });

    const mockMsg = { delete: jest.fn().mockResolvedValue(undefined) };
    const mockTextChannel = {
      isTextBased: () => true,
      messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
    };
    mockOldState.guild.channels.fetch.mockResolvedValueOnce(mockTextChannel);

    await execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState);

    expect(mockMsg.delete).toHaveBeenCalled();
    expect(deleteMessageRef).toHaveBeenCalledWith('guild-111', 'user-222');
    expect(deleteSession).toHaveBeenCalledWith('user-222');
  });

  it('cleanup khi user chuyển sang voice channel khác (oldChannelId !== newChannelId)', async () => {
    mockOldState.channelId = 'vc-1';
    mockNewState.channelId = 'vc-2';

    (getMessageRef as jest.Mock).mockReturnValue(null);

    await execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState);

    expect(deleteMessageRef).not.toHaveBeenCalled();
    expect(deleteSession).toHaveBeenCalledWith('user-222');
  });

  it('xử lý an toàn khi channel fetch lỗi hoặc message đã bị xóa', async () => {
    mockOldState.channelId = 'vc-1';
    mockNewState.channelId = null;

    (getMessageRef as jest.Mock).mockReturnValue({
      channelId: 'text-ch-1',
      messageId: 'msg-1',
    });

    mockOldState.guild.channels.fetch.mockRejectedValueOnce(new Error('Channel not found'));

    await expect(
      execute(null, mockOldState as unknown as VoiceState, mockNewState as unknown as VoiceState),
    ).resolves.toBeUndefined();

    expect(deleteMessageRef).toHaveBeenCalledWith('guild-111', 'user-222');
    expect(deleteSession).toHaveBeenCalledWith('user-222');
  });
});
