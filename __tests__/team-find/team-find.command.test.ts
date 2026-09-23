/**
 * Unit tests cho team-find.command.ts — /team-find slash command (select menu flow).
 */

jest.mock('discord.js', () => {
  class SlashCommandBuilder {
    name = '';
    description = '';

    setName(n: string) { this.name = n; return this; }
    setDescription(d: string) { this.description = d; return this; }
  }

  return {
    MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
    SlashCommandBuilder,
  };
});

jest.mock('../../src/utils/df-guards.js', () => ({
  requireGuild: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../src/utils/df-voice.utils.js', () => ({
  checkVoiceForTeamFind: jest.fn(),
}));

jest.mock('../../src/commands/df/team-find.menu.js', () => ({
  buildSelectMenuMessage: jest.fn().mockReturnValue({
    content: 'Select menu content',
    components: [],
  }),
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn().mockReturnValue({
    toJSON() { return []; },
    flags: 0,
  }),
}));

jest.mock('../../src/services/team-find-session.js', () => ({
  createSession: jest.fn(),
}));

import { data, execute } from '../../src/commands/df/team-find.command.js';
import { requireGuild } from '../../src/utils/df-guards.js';
import { checkVoiceForTeamFind } from '../../src/utils/df-voice.utils.js';
import { buildSelectMenuMessage } from '../../src/commands/df/team-find.menu.js';
import { createSession } from '../../src/services/team-find-session.js';

describe('team-find.command — data', () => {
  it('nên có tên team-find', () => {
    expect(data.name).toBe('team-find');
  });

  it('không nên có options (select menu flow)', () => {
    expect((data as any).options).toBeUndefined();
  });
});

describe('team-find.command — execute', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue({ id: 'msg-123' });

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: 'guild-1', members: { me: { id: 'bot-1' } } },
      user: {
        id: 'user-1',
        username: 'PlayerOne',
        displayAvatarURL: () => 'https://example.com/avatar.png',
      },
      member: {
        roles: {},
        voice: { channel: { id: 'vc-123', name: 'Gaming Room' }, deaf: false, mute: false },
      },
      options: {},
      channel: { id: 'channel-1', messages: { fetch: jest.fn().mockResolvedValue(null) } },
      reply: mockReply,
      fetchReply: jest.fn().mockResolvedValue({ id: 'msg-123' }),
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên return khi không có guild', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(true);
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(buildSelectMenuMessage).not.toHaveBeenCalled();
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('nên return error khi user không trong VC', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: false,
      errorMessage: 'Bạn phải đang trong phòng thoại để sử dụng lệnh này.',
    });
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalled();
  });

  it('nên send select menu message khi pass voice check', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: true,
      channelId: 'vc-123',
      channelName: 'Gaming Room',
    });

    const interaction = createMockInteraction();
    await execute(interaction, mockDb);

    expect(buildSelectMenuMessage).toHaveBeenCalledWith(
      'user-1',
      'PlayerOne',
      { map: null, mode: null, rank: null },
    );
    expect(mockReply).toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith('user-1', 'guild-1', 'msg-123', 'channel-1');
  });
});
