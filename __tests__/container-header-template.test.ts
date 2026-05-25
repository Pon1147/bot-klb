import { describe, expect, it, beforeEach } from '@jest/globals';
import { ComponentType, MessageFlags } from 'discord.js';

// Mock template.utils
jest.mock('../src/utils/template.utils.js', () => ({
  resolveTemplate: jest.fn((template: string, context: unknown) => {
    if (typeof template !== 'string') return template;
    return template.replace('{user}', '@TestUser').replace('{guild}', 'TestGuild');
  }),
}));

import { buildContainer } from '../src/utils/container.utils.js';
import { ContainerSettings, TemplateContext } from '../src/types/settings.types.js';

// Mock member & guild
const mockMember = {
  user: {
    displayAvatarURL: () => 'https://avatar.png',
    username: 'TestUser',
  },
  toString: () => '@TestUser',
} as any;

const mockGuild = {
  name: 'TestGuild',
  id: '123456',
} as any;

const baseContext: TemplateContext = {
  member: mockMember,
  guild: mockGuild,
};

describe('buildContainer - headerTemplate', () => {
  let baseSettings: ContainerSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    baseSettings = {
      accentColor: 0x5865f2,
      contentLines: ['Line 1', 'Line 2'],
      mediaUrl: null,
      mediaDescription: null,
      showSeparator: false,
      files: [],
    };
  });

  describe('headerTemplate resolve', () => {
    it('nên resolve template variables trong headerTemplate', () => {
      const settings = {
        ...baseSettings,
        headerTemplate: '**Chào mừng {user} đến với {guild}**',
      };

      const result = buildContainer(settings, baseContext);

      // Container phải có Section component với header resolved
      const container = result.components[0] as any;
      expect(container.type).toBe(ComponentType.Container);
      expect(container.components).toBeDefined();
      expect(container.components.length).toBeGreaterThan(0);

      // Header Section (component đầu tiên)
      const headerSection = container.components[0];
      expect(headerSection.type).toBe(ComponentType.Section);
      expect(headerSection.components[0].type).toBe(ComponentType.TextDisplay);
      expect(headerSection.components[0].content).toBe('**Chào mừng @TestUser đến với TestGuild**');
    });

    it('nên hỗ trợ headerTemplate khác nhau cho từng feature', () => {
      // Welcome header
      const welcomeSettings = {
        ...baseSettings,
        headerTemplate: '**👋 Chào mừng {user}!**',
      };

      // Booster header
      const boosterSettings = {
        ...baseSettings,
        headerTemplate: '**🚀 Cảm ơn {user} đã boost {guild}!**',
      };

      const welcomeResult = buildContainer(welcomeSettings, baseContext);
      const boosterResult = buildContainer(boosterSettings, baseContext);

      const welcomeHeader = (welcomeResult.components[0] as any).components[0].components[0]
        .content;
      const boosterHeader = (boosterResult.components[0] as any).components[0].components[0]
        .content;

      // Hai header phải khác nhau
      expect(welcomeHeader).not.toBe(boosterHeader);
      expect(welcomeHeader).toBe('**👋 Chào mừng @TestUser!**');
      expect(boosterHeader).toBe('**🚀 Cảm ơn @TestUser đã boost TestGuild!**');
    });

    it('nên fallback header rỗng khi headerTemplate = null', () => {
      const settings = {
        ...baseSettings,
        headerTemplate: null,
      };

      const result = buildContainer(settings, baseContext);

      const container = result.components[0] as any;
      // Khi headerTemplate = null, không có Section header, component đầu = TextDisplay content
      expect(container.components[0].type).toBe(ComponentType.TextDisplay);
      expect(container.components[0].content).toContain('Line 1');
    });

    it('nên fallback header rỗng khi headerTemplate = empty string', () => {
      const settings = {
        ...baseSettings,
        headerTemplate: '',
      };

      const result = buildContainer(settings, baseContext);

      const container = result.components[0] as any;
      // Khi headerTemplate = '', không có Section header
      expect(container.components[0].type).toBe(ComponentType.TextDisplay);
    });
  });

  describe('backward compatibility', () => {
    it('nên hoạt động khi headerTemplate không được cung cấp (undefined)', () => {
      // Settings cũ không có headerTemplate
      const settings = {
        ...baseSettings,
        // headerTemplate không có
      };

      const result = buildContainer(settings, baseContext);

      // Phải không throw error
      expect(result.components).toBeDefined();
      expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    });
  });
});
