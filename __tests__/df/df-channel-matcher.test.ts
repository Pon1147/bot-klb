/// <reference types="jest" />
/**
 * Unit tests cho df-channel-matcher.ts (Smart Channel Matcher).
 * Kiểm tra các tầng ưu tiên, lọc blacklist, chuẩn hóa font Unicode và an toàn phân quyền.
 */

import { PermissionFlagsBits } from 'discord.js';
import {
  cleanChannelName,
  matchesKeywords,
  findAutoPostTargetChannel,
  AUTOPOST_BLACKLIST_KEYWORDS,
} from '../../src/services/df-channel-matcher.js';

describe('df-channel-matcher — String Normalization & Keyword Matching', () => {
  it('chuẩn hóa chính xác ký tự Unicode nghệ thuật (Mathematical Bold)', () => {
    const cleaned = cleanChannelName('┃𝐆𝐮𝐧-𝐂𝐨𝐝𝐞');
    expect(cleaned.ascii).toContain('gun-code');
    expect(matchesKeywords(cleaned, ['gun', 'build'])).toBe(true);
  });

  it('nhận diện từ khóa tiếng Việt có dấu và không dấu', () => {
    const cleaned = cleanChannelName('share-build-súng');
    expect(matchesKeywords(cleaned, ['súng'])).toBe(true);
    expect(matchesKeywords(cleaned, ['sung'])).toBe(true);
    expect(matchesKeywords(cleaned, ['build'])).toBe(true);
  });

  it('nhận diện chính xác từ khóa trong blacklist', () => {
    const announceCleaned = cleanChannelName('📢┆thông-báo');
    expect(matchesKeywords(announceCleaned, AUTOPOST_BLACKLIST_KEYWORDS)).toBe(true);

    const rulesCleaned = cleanChannelName('luật-server');
    expect(matchesKeywords(rulesCleaned, AUTOPOST_BLACKLIST_KEYWORDS)).toBe(true);

    const modCleaned = cleanChannelName('mod-log');
    expect(matchesKeywords(modCleaned, AUTOPOST_BLACKLIST_KEYWORDS)).toBe(true);
  });
});

describe('df-channel-matcher — findAutoPostTargetChannel Prioritization', () => {
  const createMockChannel = (id: string, name: string, canSend = true) => ({
    id,
    name,
    isTextBased: () => true,
    isDMBased: () => false,
    isVoiceBased: () => false,
    permissionsFor: jest.fn(() => ({
      has: jest.fn((perms: bigint[]) =>
        canSend &&
        perms.includes(PermissionFlagsBits.ViewChannel) &&
        perms.includes(PermissionFlagsBits.SendMessages),
      ),
    })),
  });

  const mockBotMember: any = { id: 'bot-id' };

  it('ưu tiên 1: chọn kênh được cấu hình thủ công (configuredChannelId)', () => {
    const chConfigured = createMockChannel('c-custom', 'my-custom-channel');
    const chGun = createMockChannel('c-gun', 'share-build-súng');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-custom', chConfigured],
          ['c-gun', chGun],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'gun', {
      configuredChannelId: 'c-custom',
    });

    expect(res.channel?.id).toBe('c-custom');
    expect(res.matchTier).toBe('configured');
  });

  it('tuyệt đối loại trừ kênh dfCodesChannelId (kênh mật mã hòm đồ /df code) để tránh spam vào kênh code', () => {
    const chDfCode = createMockChannel('c-dfcode', 'code-daily');
    const chChat = createMockChannel('c-chat', 'chat-chung');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-dfcode', chDfCode],
          ['c-chat', chChat],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'gun', {
      dfCodesChannelId: 'c-dfcode',
    });

    expect(res.channel?.id).toBe('c-chat');
    expect(res.channel?.id).not.toBe('c-dfcode');
  });

  it('Tier A: chọn kênh khớp nội dung "gun" (vd: share-build-súng, ┃𝐆𝐮𝐧-𝐂𝐨𝐝𝐞)', () => {
    const chAnnounce = createMockChannel('c-ann', '📢┆thông-báo');
    const chBuild = createMockChannel('c-build', 'share-build-súng');
    const chGeneral = createMockChannel('c-gen', 'chat-chung');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-ann', chAnnounce],
          ['c-build', chBuild],
          ['c-gen', chGeneral],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'gun');

    expect(res.channel?.id).toBe('c-build');
    expect(res.matchTier).toBe('content');
    expect(res.matchReason).toContain('Build Súng');
  });

  it('Tier A: chọn kênh khớp nội dung "map" (vd: code-map)', () => {
    const chAnnounce = createMockChannel('c-ann', 'thông-báo');
    const chMap = createMockChannel('c-map', 'code-map');
    const chGeneral = createMockChannel('c-gen', 'chat-chung');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-ann', chAnnounce],
          ['c-map', chMap],
          ['c-gen', chGeneral],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'map');

    expect(res.channel?.id).toBe('c-map');
    expect(res.matchTier).toBe('content');
    expect(res.matchReason).toContain('Bản Đồ 3D');
  });

  it('Tier B: chọn kênh game Delta Force nếu không có kênh chuyên đề riêng (vd: 📝┆delta-force)', () => {
    const chAnnounce = createMockChannel('c-ann', '📢┆thông-báo');
    const chDelta = createMockChannel('c-df', '📝┆delta-force');
    const chGeneral = createMockChannel('c-gen', 'chat-chung');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-ann', chAnnounce],
          ['c-df', chDelta],
          ['c-gen', chGeneral],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'gun');

    expect(res.channel?.id).toBe('c-df');
    expect(res.matchTier).toBe('game');
  });

  it('Tier C & D: chọn kênh useful hoặc chat-chung nếu không có kênh game riêng', () => {
    const chAnnounce = createMockChannel('c-ann', 'thông-báo');
    const chUseful = createMockChannel('c-useful', 'useful');
    const chGeneral = createMockChannel('c-gen', 'chat-chung');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-ann', chAnnounce],
          ['c-useful', chUseful],
          ['c-gen', chGeneral],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'map');

    expect(res.channel?.id).toBe('c-useful');
    expect(res.matchTier).toBe('feature');
  });

  it('tuyệt đối không chọn kênh botAnnounceChannelId và kênh thuộc blacklist', () => {
    const chAnnounce = createMockChannel('c-ann', '📢┆thông-báo');
    const chMod = createMockChannel('c-mod', 'mod-log');
    const chRules = createMockChannel('c-rules', 'luật-server');

    const mockGuild: any = {
      members: { me: mockBotMember },
      channels: {
        cache: new Map([
          ['c-ann', chAnnounce],
          ['c-mod', chMod],
          ['c-rules', chRules],
        ]),
      },
    };

    const res = findAutoPostTargetChannel(mockGuild, 'gun', {
      botAnnounceChannelId: 'c-ann',
    });

    expect(res.channel).toBeNull();
    expect(res.matchTier).toBe('none');
    expect(res.reason).toContain('đã loại trừ an toàn');
  });
});
