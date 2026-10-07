/// <reference types="jest" />
/**
 * Unit tests cho team-find.handlers.ts — xử lý button và tương thích ngược cho nút join voice.
 */

import { handleTeamFindButton } from '../../src/features/delta-force/team-find.handlers.js';
import { VOICE_CHANNEL_FULL_MESSAGE } from '../../src/config/app.constants.js';
import { GuildMember, MessageFlags } from 'discord.js';

describe('team-find.handlers — handleTeamFindButton', () => {
  let mockReply: jest.Mock;
  let mockSetChannel: jest.Mock;

  function createMockInteraction(overrides: Record<string, any> = {}) {
    mockReply = jest.fn().mockResolvedValue(undefined);
    mockSetChannel = jest.fn().mockResolvedValue(undefined);

    const mockMember = Object.create(GuildMember.prototype);
    Object.defineProperty(mockMember, 'voice', {
      value: {
        channel: overrides.voiceChannel ?? null,
        setChannel: mockSetChannel,
      },
      configurable: true,
    });

    return {
      customId: 'team-find-join:vc-123',
      guild: {
        id: 'guild-1',
        channels: {
          fetch: jest.fn().mockResolvedValue({
            id: 'vc-123',
            type: 2, // ChannelType.GuildVoice
            full: false,
            name: 'Gaming Room',
          }),
        },
      },
      member: mockMember,
      reply: mockReply,
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  it('khi channel không tồn tại hoặc không phải voice channel, thông báo phòng không tồn tại', async () => {
    const interaction = createMockInteraction();
    interaction.guild.channels.fetch.mockResolvedValueOnce(null);

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
    expect(mockReply).toHaveBeenCalledWith({
      content: 'Phòng thoại không còn tồn tại.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('khi user đã ở sẵn trong phòng thoại đó, thông báo đã ở trong phòng', async () => {
    const interaction = createMockInteraction({ voiceChannel: { id: 'vc-123' } });

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
    expect(mockReply).toHaveBeenCalledWith({
      content: 'Bạn đã đang trong phòng thoại này rồi.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('khi phòng thoại đầy, thông báo phòng đã đầy', async () => {
    const interaction = createMockInteraction();
    interaction.guild.channels.fetch.mockResolvedValueOnce({
      id: 'vc-123',
      type: 2,
      full: true,
      name: 'Gaming Room',
    });

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
    expect(mockReply).toHaveBeenCalledWith({
      content: VOICE_CHANNEL_FULL_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  });

  it('khi user đang ở phòng voice khác, bot di chuyển user sang phòng mới', async () => {
    const interaction = createMockInteraction({ voiceChannel: { id: 'vc-other' } });

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
    expect(mockSetChannel).toHaveBeenCalledWith('vc-123');
    expect(mockReply).toHaveBeenCalledWith({
      content: 'Đã di chuyển bạn vào phòng thoại <#vc-123>!',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('khi user chưa ở phòng voice nào, bot hướng dẫn click vào tag kênh', async () => {
    const interaction = createMockInteraction();

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
    expect(mockReply).toHaveBeenCalledWith({
      content: 'Vui lòng bấm vào phòng thoại <#vc-123> để tham gia cùng đội nhé!',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('khi gặp ngoại lệ bất ngờ, không ném lỗi ra ngoài và trả về handled: true', async () => {
    const interaction = createMockInteraction();
    interaction.guild.channels.fetch.mockRejectedValueOnce(new Error('Discord API connection dropped'));

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: true });
  });

  it('khi customId không thuộc team-find, trả về handled: false', async () => {
    const interaction = createMockInteraction({ customId: 'unrelated-button-id' });

    const result = await handleTeamFindButton(interaction as any);

    expect(result).toEqual({ handled: false });
  });
});

