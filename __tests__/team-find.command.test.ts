/**
 * Unit tests cho team-find.command.ts — /team-find slash command.
 */

jest.mock('discord.js', () => {
  class SlashCommandBuilder {
    name = '';
    description = '';
    options: any[] = [];
    behaviorDependencies: any[] = [];

    setName(n: string) { this.name = n; return this; }
    setDescription(d: string) { this.description = d; return this; }

    addStringOption(cb: (o: any) => any) {
      const opt: any = {
        name: '',
        description: '',
        required: false,
        choices: [],
        setRequired(r: boolean) { this.required = r; return this; },
        setName(n: string) { this.name = n; return this; },
        setDescription(d: string) { this.description = d; return this; },
        addChoices(c: any[]) { this.choices = c; return this; },
      };
      this.options.push(cb(opt));
      return this;
    }
  }

  return {
    ComponentType: { TextDisplay: 10, Separator: 14, Container: 17 },
    MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
    SlashCommandBuilder,
    AttachmentBuilder: class {
      constructor(public pathOrBuffer: any) {
        this.name = 'file.png';
      }
    },
  };
});

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
  TEAM_FIND_RANKS: ['Binh Nhì III', 'Nguyên Soái'],
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

  it('rank nên là string option có choices', () => {
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
    // Layali chỉ có Dễ
    expect(values['Thung lũng Layali']).toEqual(['Dễ']);
    // Zero có Dễ, Thường
    expect(values['Đập Nước Zero']).toEqual(['Dễ', 'Thường']);
    // Tide Prison chỉ có Khó
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
          if (name === 'rank') return 'Trung Úy III';
          return null;
        }),
      },
    });

    await execute(interaction, mockDb);
    const embedCall = (buildTeamFindEmbed as jest.Mock).mock.calls[0][0];
    expect(embedCall.rank).toBe('Trung Úy III');
    expect(embedCall.difficulty).toBe('normal');
  });

  it('nên resolve difficulty từ mode label', async () => {
    (requireGuild as jest.Mock).mockResolvedValue(false);
    (checkVoiceForTeamFind as jest.Mock).mockReturnValue({
      success: true,
      channelId: 'vc-123',
      channelName: 'Gaming Room',
    });

    // Test with 'Khó' → hard
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
