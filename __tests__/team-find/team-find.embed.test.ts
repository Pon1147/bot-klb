/**
 * Unit tests cho team-find.embed.ts — embed builder cho /team-find.
 */

jest.mock('discord.js', () => ({
  ComponentType: {
    TextDisplay: 10,
    Separator: 14,
    Container: 17,
    Section: 15,
    Thumbnail: 16,
    MediaGallery: 11,
    ActionRow: 1,
  },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  ButtonStyle: { Primary: 1, Link: 5 },
  ButtonBuilder: class {
    label: string = '';
    customId: string = '';
    url: string = '';
    style: number = 1;
    setLabel(l: string) {
      this.label = l;
      return this;
    }
    setCustomId(id: string) {
      this.customId = id;
      return this;
    }
    setURL(u: string) {
      this.url = u;
      return this;
    }
    setStyle(s: number) {
      this.style = s;
      return this;
    }
    toJSON() {
      return { type: 2, label: this.label, custom_id: this.customId, url: this.url, style: this.style };
    }
  },
  ActionRowBuilder: class {
    components: any[] = [];
    addComponents(...c: any[]) {
      this.components.push(...c);
      return this;
    }
    toJSON() {
      return { type: 1, components: this.components.map((c) => (c.toJSON ? c.toJSON() : c)) };
    }
  },
  AttachmentBuilder: class {
    constructor(public pathOrBuffer: any) {
      this.name = 'attachment.png';
    }
    setName(n: string) {
      this.name = n;
      return this;
    }
  },
}));

jest.mock('../../src/utils/container.utils.js', () => ({
  makeResult: jest.fn((components, flags, files) => ({
    components,
    flags,
    files,
    toJSON() {
      return components;
    },
  })),
}));

import { buildTeamFindEmbed } from '../../src/features/delta-force/team-find.embed.js';
import { DIFFICULTY_CONFIG, MAP_DISPLAY } from '../../src/config/team-find.config.js';

describe('team-find.embed — buildTeamFindEmbed', () => {
  const mockParams = {
    mapKey: 'Đập Nước Zero' as const,
    difficulty: 'easy' as const,
    channelName: 'Gaming Room',
    channelId: 'vc-123',
    username: 'PlayerOne',
    avatarUrl: 'https://example.com/avatar.png',
    rank: 'Vàng III',
  };

  it('nên trả về result có components, flags, files', () => {
    const result = buildTeamFindEmbed(mockParams);
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('toJSON');
  });

  it('nên dùng IsComponentsV2 flag', () => {
    const result = buildTeamFindEmbed(mockParams);
    expect(result.flags).toBe(65536); // MessageFlags.IsComponentsV2
  });

  it('nên attach ảnh map', () => {
    const result = buildTeamFindEmbed(mockParams);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('nên chứa Link Button dẫn tới phòng thoại', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('https://discord.com/channels/@me/vc-123');
  });

  it('nên hỗ trợ guildId trong Link Button', () => {
    const result = buildTeamFindEmbed({ ...mockParams, guildId: 'guild-456' });
    const content = JSON.stringify(result.components);
    expect(content).toContain('https://discord.com/channels/guild-456/vc-123');
  });

  it('nên chứa tên map trong content', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('Zero Dam');
  });

  it('nên chứa rank name trong content', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('Vàng III');
  });

  it('nên chứa difficulty label trong content', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('Dễ');
  });

  it('nên chứa tag kênh thoại trong content và tên kênh trong label nút', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('<#vc-123>');
    expect(content).toContain('Gaming Room');
  });

  it('nên chứa username trong content', () => {
    const result = buildTeamFindEmbed(mockParams);
    const content = JSON.stringify(result.components);
    expect(content).toContain('PlayerOne');
  });

  it('nên dùng màu theo difficulty', () => {
    const easyResult = buildTeamFindEmbed(mockParams);
    const hardParams = { ...mockParams, difficulty: 'hard' as const };
    const hardResult = buildTeamFindEmbed(hardParams);

    const easyColor = DIFFICULTY_CONFIG.easy.color;
    const hardColor = DIFFICULTY_CONFIG.hard.color;

    expect(JSON.stringify(easyResult.components)).toContain(easyColor.toString());
    expect(JSON.stringify(hardResult.components)).toContain(hardColor.toString());
  });

  it('nên hoạt động khi rank = null', () => {
    const result = buildTeamFindEmbed({ ...mockParams, rank: null });
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('files');
  });
});
