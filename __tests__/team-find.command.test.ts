/**
 * Unit tests cho team-find.command.ts — /team-find slash command.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
}));

jest.mock('../src/utils/df-guards.js', () => ({
  requireGuild: jest.fn().mockResolvedValue(false),
}));

jest.mock('../src/utils/df-voice.utils.js', () => ({
  checkVoiceForTeamFind: jest.fn(),
}));

jest.mock('../src/commands/df/team-find.embed.js', () => ({
  buildTeamFindEmbed: jest.fn().mockReturnValue({
    components: [{ type: 17, components: [] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  }),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn().mockReturnValue({
    toJSON() { return []; },
    flags: 0,
  }),
}));

jest.mock('../src/services/team-find-message-store.js', () => ({
  storeMessage: jest.fn(),
  getMessageRef: jest.fn().mockReturnValue(null),
  deleteMessageRef: jest.fn(),
}));

jest.mock('../src/config/team-find.config.js', () => ({
  DIFFICULTY_CONFIG: {
    easy: { id: 'easy', label: 'Dễ', color: 0x57f287 },
    normal: { id: 'normal', label: 'Thường', color: 0xfee75c },
    hard: { id: 'hard', label: 'Khó', color: 0xed4245 },
  },
  MAP_MODES: {
    'Đập Nước Zero': ['easy', 'normal'],
    'Thung lũng Layali': ['easy'],
    'Phố Cổ Brakkesh': ['normal', 'hard'],
    'Trạm Không Gian': ['normal', 'hard'],
    'Ngục Giam Thủy Triều': ['hard'],
  },
  TEAM_FIND_RANKS: [
    { name: 'Đồng III', value: 'Đồng III' },
    { name: 'Thách Đấu DF', value: 'Thách Đấu DF' },
  ],
}));

import { data, execute } from '../src/commands/df/team-find.command.js';
import { requireGuild } from '../src/utils/df-guards.js';
import { checkVoiceForTeamFind } from '../src/utils/df-voice.utils.js';
import { buildTeamFindEmbed } from '../src/commands/df/team-find.embed.js';

describe('team-find.command — data', () => {
  it('nên có tên team-find', () => {
    expect(data.name).toBe('team-find');
  });

  it('nên có 3 options: map, mode, rank', () => {
    expect(data.options.length).toBe(3);
  });

  it('map và mode nên required, rank optional', () => {
    const mapOpt = data.options.find((o: any) => o.name === 'map');
    const rankOpt = data.options.find((o: any) => o.name === 'rank');
    const modeOpt = data.options.find((o: any) => o.name === 'mode');
    expect(mapOpt.required).toBe(true);
    expect(rankOpt.required).toBe(false);
    expect(modeOpt.required).toBe(true);
  });

  it('rank nên có choices', () => {
    const rankOpt = data.options.find((o: any) => o.name === 'rank');
    expect(rankOpt.choices.length).toBeGreaterThan(0);
  });

  it('nên có behavior_dependencies cho mode → map', () => {
    expect(data.behavior_dependencies).toBeDefined();
    expect(data.behavior_dependencies.length).toBe(1);
    const dep = data.behavior_dependencies[0];
    expect(dep.depending_on).toBe('mode');
    expect(dep.requiring).toBe('map');
  });

  it('mode choices nên conditional theo MAP_MODES mapping', () => {
    const dep = data.behavior_dependencies[0];
    const values = dep.values;
    expect(values['Thung lũng Layali']).toEqual(['Dễ']);
    expect(values['Đập Nước Zero']).toEqual(['Dễ', 'Thường']);
    expect(values['Ngục Giam Thủy Triều']).toEqual(['Khó']);
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
      options: {
        getString: jest.fn(),
      },
      channel: { id: 'channel-1', messages: { fetch: jest.fn().mockResolvedValue(null) } },
      reply: mockReply,
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
    expect(buildTeamFindEmbed).not.toHaveBeenCalled();
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

  it('nên reply embed khi mọi thứ pass', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: true,
      channelId: 'vc-123',
      channelName: 'Gaming Room',
    });

    const interaction = createMockInteraction({
      options: {
        getString: jest.fn((name: string) => {
          if (name === 'map') return 'Đập Nước Zero';
          if (name === 'mode') return 'Dễ';
          if (name === 'rank') return null;
          return null;
        }),
      },
    });

    await execute(interaction, mockDb);
    expect(buildTeamFindEmbed).toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalled();
  });

  it('nên embed với rank string khi có rank option', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: true,
      channelId: 'vc-123',
      channelName: 'Gaming Room',
    });

    const interaction = createMockInteraction({
      options: {
        getString: jest.fn((name: string) => {
          if (name === 'map') return 'Phố Cổ Brakkesh';
          if (name === 'mode') return 'Thường';
          if (name === 'rank') return 'Vàng III';
          return null;
        }),
      },
    });

    await execute(interaction, mockDb);
    const embedCall = (buildTeamFindEmbed as jest.Mock).mock.calls[0][0];
    expect(embedCall.rank).toBe('Vàng III');
    expect(embedCall.difficulty).toBe('normal');
  });

  it('nên resolve difficulty từ mode label Khó', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: true,
      channelId: 'vc-123',
      channelName: 'Gaming Room',
    });

    const interaction = createMockInteraction({
      options: {
        getString: jest.fn((name: string) => {
          if (name === 'map') return 'Ngục Giam Thủy Triều';
          if (name === 'mode') return 'Khó';
          return null;
        }),
      },
    });

    await execute(interaction, mockDb);
    const embedCall = (buildTeamFindEmbed as jest.Mock).mock.calls[0][0];
    expect(embedCall.difficulty).toBe('hard');
  });
});
