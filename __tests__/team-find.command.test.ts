/**
 * Unit tests cho team-find.command.ts — /team-find slash command.
 */

jest.mock('discord.js', () => {
  class SlashCommandBuilder {
    name = '';
    description = '';
    options: any[] = [];

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
        setMinValue(v: number) { this.minValue = v; return this; },
        setMaxValue(v: number) { this.maxValue = v; return this; },
      };
      this.options.push(cb(opt));
      return this;
    }

    addIntegerOption(cb: (o: any) => any) {
      const opt: any = {
        name: '',
        description: '',
        required: false,
        setRequired(r: boolean) { this.required = r; return this; },
        setName(n: string) { this.name = n; return this; },
        setDescription(d: string) { this.description = d; return this; },
        setMinValue(v: number) { this.minValue = v; return this; },
        setMaxValue(v: number) { this.maxValue = v; return this; },
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

jest.mock('../src/utils/df-rank.utils.js', () => ({
  resolveRankFromScore: jest.fn().mockReturnValue({
    rankId: 10,
    mode: 'MP',
    name: 'Trung Úy',
    minScore: 5000,
    maxScore: 6000,
    imageUrl: 'https://example.com/rank.png',
  }),
}));

jest.mock('../src/services/team-find-message-store.js', () => ({
  storeMessage: jest.fn(),
  getMessageRef: jest.fn().mockReturnValue(null),
  deleteMessageRef: jest.fn(),
}));

import { data, execute } from '../src/commands/df/team-find.command.js';
import { requireGuild } from '../src/utils/df-guards.js';
import { checkVoiceForTeamFind } from '../src/utils/df-voice.utils.js';
import { buildTeamFindEmbed } from '../src/commands/df/team-find.embed.js';
import { resolveRankFromScore } from '../src/utils/df-rank.utils.js';

describe('team-find.command — data', () => {
  it('nên có tên team-find', () => {
    expect(data.name).toBe('team-find');
  });

  it('nên có 3 options: map, rank, mode', () => {
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
        getInteger: jest.fn(),
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
          if (name === 'mode') return 'easy';
          return null;
        }),
        getInteger: jest.fn().mockReturnValue(undefined),
      },
    });

    await execute(interaction, mockDb);
    expect(buildTeamFindEmbed).toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalled();
  });

  it('nên gọi resolveRankFromScore khi có rank option', async () => {
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
          if (name === 'mode') return 'normal';
          return null;
        }),
        getInteger: jest.fn().mockReturnValue(3500),
      },
    });

    await execute(interaction, mockDb);
    expect(resolveRankFromScore).toHaveBeenCalledWith(3500);
  });
});
