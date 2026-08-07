/**
 * Unit tests cho df-voice.utils.ts — voice channel guard cho /team-find.
 * Test 8 edge cases chính (cases 1-8 trong spec).
 */

import { checkVoiceForTeamFind, getUserVoiceState } from '../../src/utils/df-voice.utils.js';

// --- Helpers ---

function makeVoiceChannel(overrides: Record<string, any> = {}): any {
  return {
    id: 'vc-123',
    name: 'Gaming Room',
    full: false,
    members: new Map(),
    permissionsFor: jest.fn().mockReturnValue({
      has: jest.fn().mockReturnValue(true),
    }),
    ...overrides,
  };
}

function makeInteraction(overrides: Record<string, any> = {}): any {
  return {
    guild: { id: 'guild-1', members: { me: { id: 'bot-1' } } },
    user: { id: 'user-1' },
    member: {
      roles: {}, // 'roles' property marks it as GuildMember (not APIInteractionGuildMember)
      voice: {
        channel: null,
        deaf: false,
        mute: false,
        selfDeaf: false,
        selfMute: false,
        streaming: false,
        suppressed: false,
      },
    },
    ...overrides,
  };
}

describe('df-voice.utils — getUserVoiceState', () => {
  it('case 1: trả về null khi user không trong voice channel', () => {
    const interaction = makeInteraction();
    const result = getUserVoiceState(interaction);
    expect(result).toBeNull();
  });

  it('trả về VoiceStateResult khi user trong VC mở', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: false } },
    });
    const result = getUserVoiceState(interaction);
    expect(result).not.toBeNull();
    expect(result?.channelId).toBe('vc-123');
    expect(result?.channelName).toBe('Gaming Room');
  });

  it('detect user bị server deaf', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: true, mute: false } },
    });
    const result = getUserVoiceState(interaction);
    expect(result?.isUserDeafened).toBe(true);
  });

  it('detect user bị server mute', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: true } },
    });
    const result = getUserVoiceState(interaction);
    expect(result?.isUserMuted).toBe(true);
  });
});

describe('df-voice.utils — checkVoiceForTeamFind', () => {
  it('case 1: block khi user không trong VC', () => {
    const interaction = makeInteraction();
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('phòng thoại');
  });

  it('case 2: pass khi user trong VC mở', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: false } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(true);
    expect(result.channelId).toBe('vc-123');
  });

  it('case 4: pass + warning khi user bị deaf', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: true, mute: false } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringContaining('điếc'));
  });

  it('case 5: pass + warning khi user bị mute', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: true } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringContaining('micro'));
  });

  it('case 7: block khi VC đầy', () => {
    const vc = makeVoiceChannel({ full: true });
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: false } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('đầy');
  });

  it('case 8: block khi bot không có quyền Connect', () => {
    const vc = makeVoiceChannel({
      permissionsFor: jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(false),
      }),
    });
    const interaction = makeInteraction({
      guild: { id: 'guild-1', members: { me: { id: 'bot-1' } } },
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: false } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('quyền');
  });

  it('case 6: pass khi user bình thường — không warning', () => {
    const vc = makeVoiceChannel();
    const interaction = makeInteraction({
      member: { roles: {}, voice: { channel: vc, deaf: false, mute: false } },
    });
    const result = checkVoiceForTeamFind(interaction);
    expect(result.success).toBe(true);
    expect(result.warnings?.length).toBe(0);
  });
});
