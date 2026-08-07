/**
 * Test cho Container Edit System - Booster support.
 * Verify rằng booster type được chấp nhận trong toàn bộ edit flow.
 */
import {
  ContainerEditSession,
  createSession,
  deleteSession,
  editSessions,
  isSessionValid,
  cloneContainerSettings,
} from '../../src/commands/container/container-session.js';
import { buildEditTypeOptionCallback, buildResetTypeOptionCallback } from '../../src/commands/container/container.command.js';
import { defaultGuildSettings } from '../../src/config/default.settings.js';

// Mock ContainerSettings cho test
const mockContainerSettings = {
  accentColor: 0xfb663a,
  headerTemplate: '**🚀 Cảm ơn {user} đã Server Boost {guild}!**',
  contentLines: ['Cảm ơn bạn đã boost!'],
  mediaUrl: null,
  mediaDescription: null,
  showSeparator: true,
};

describe('Container Edit System - Booster Support', () => {
  beforeEach(() => {
    editSessions.clear();
  });

  afterEach(() => {
    editSessions.clear();
  });

  describe('ContainerEditSession type', () => {
    it('phải chấp nhận type="booster"', () => {
      const session: ContainerEditSession = {
        guildId: '123',
        type: 'booster',
        draft: mockContainerSettings,
        messageId: 'msg-123',
        channelId: 'ch-123',
        createdAt: Date.now(),
      };

      expect(session.type).toBe('booster');
    });

    it('phải chấp nhận type="welcome"', () => {
      const session: ContainerEditSession = {
        guildId: '123',
        type: 'welcome',
        draft: mockContainerSettings,
        messageId: 'msg-123',
        channelId: 'ch-123',
        createdAt: Date.now(),
      };

      expect(session.type).toBe('welcome');
    });

    it('phải chấp nhận type="leave"', () => {
      const session: ContainerEditSession = {
        guildId: '123',
        type: 'leave',
        draft: mockContainerSettings,
        messageId: 'msg-123',
        channelId: 'ch-123',
        createdAt: Date.now(),
      };

      expect(session.type).toBe('leave');
    });
  });

  describe('createSession với booster type', () => {
    it('phải tạo session booster thành công', () => {
      const session = createSession(
        'user-1',
        'guild-1',
        'booster',
        mockContainerSettings,
        'msg-1',
        'ch-1',
      );

      expect(session).toBeDefined();
      expect(session.type).toBe('booster');
      expect(session.guildId).toBe('guild-1');
      expect(session.messageId).toBe('msg-1');
      expect(session.channelId).toBe('ch-1');
    });

    it('phải lưu session vào editSessions map', () => {
      createSession(
        'user-2',
        'guild-2',
        'booster',
        mockContainerSettings,
        'msg-2',
        'ch-2',
      );

      expect(editSessions.size).toBe(1);
      expect(editSessions.has('user-2')).toBe(true);
    });

    it('phải có draft đúng với container settings', () => {
      const session = createSession(
        'user-3',
        'guild-3',
        'booster',
        mockContainerSettings,
        'msg-3',
        'ch-3',
      );

      expect(session.draft.accentColor).toBe(0xfb663a);
      expect(session.draft.contentLines).toEqual(['Cảm ơn bạn đã boost!']);
      expect(session.draft.headerTemplate).toContain('Server Boost');
    });
  });

  describe('isSessionValid với booster session', () => {
    it('phải trả về true cho session booster mới tạo', () => {
      const session = createSession(
        'user-4',
        'guild-4',
        'booster',
        mockContainerSettings,
        'msg-4',
        'ch-4',
      );

      expect(isSessionValid(session)).toBe(true);
    });

    it('phải trả về false cho session booster đã hết hạn', () => {
      const session: ContainerEditSession = {
        guildId: 'guild-5',
        type: 'booster',
        draft: mockContainerSettings,
        messageId: 'msg-5',
        channelId: 'ch-5',
        createdAt: Date.now() - 20 * 60 * 1000, // 20 phút trước
      };

      expect(isSessionValid(session)).toBe(false);
    });
  });

  describe('deleteSession với booster session', () => {
    it('phải xóa session booster khỏi map', () => {
      createSession(
        'user-5',
        'guild-5',
        'booster',
        mockContainerSettings,
        'msg-5',
        'ch-5',
      );

      expect(editSessions.has('user-5')).toBe(true);
      deleteSession('user-5');
      expect(editSessions.has('user-5')).toBe(false);
    });
  });

  describe('cloneContainerSettings', () => {
    it('phải tạo bản copy độc lập (không mutate gốc)', () => {
      const original = {
        ...mockContainerSettings,
        contentLines: ['Line 1', 'Line 2'],
      };
      const cloned = cloneContainerSettings(original);

      cloned.contentLines[0] = 'Modified';
      expect(original.contentLines[0]).toBe('Line 1');
      expect(cloned.contentLines[0]).toBe('Modified');
    });
  });

  describe('buildEditTypeOptionCallback - booster choice', () => {
    it('phải bao gồm choice "Booster" với value="booster"', () => {
      // Mock option object với chainable methods
      const capturedChoices: any[] = [];
      const mockOpt = {
        setName: (_name: string) => mockOpt,
        setDescription: (_desc: string) => mockOpt,
        setRequired: () => mockOpt,
        addChoices: (...choices: any[]) => {
          capturedChoices.push(...choices);
          return mockOpt;
        },
      };

      buildEditTypeOptionCallback(mockOpt);

      expect(capturedChoices).toContainEqual({ name: 'Booster', value: 'booster' });
      expect(capturedChoices).toContainEqual({ name: 'Welcome', value: 'welcome' });
      expect(capturedChoices).toContainEqual({ name: 'Leave', value: 'leave' });
    });
  });

  describe('buildResetTypeOptionCallback - booster choice', () => {
    it('phải bao gồm choice "Booster" với value="booster"', () => {
      const capturedChoices: any[] = [];
      const mockOpt = {
        setName: (_name: string) => mockOpt,
        setDescription: (_desc: string) => mockOpt,
        setRequired: () => mockOpt,
        addChoices: (...choices: any[]) => {
          capturedChoices.push(...choices);
          return mockOpt;
        },
      };

      buildResetTypeOptionCallback(mockOpt);

      expect(capturedChoices).toContainEqual({ name: 'Booster', value: 'booster' });
      expect(capturedChoices).toContainEqual({ name: 'Welcome', value: 'welcome' });
      expect(capturedChoices).toContainEqual({ name: 'Leave', value: 'leave' });
    });
  });

  describe('defaultGuildSettings.booster', () => {
    it('phải có container settings hợp lệ', () => {
      expect(defaultGuildSettings.booster).toBeDefined();
      expect(defaultGuildSettings.booster.container).toBeDefined();
      expect(defaultGuildSettings.booster.container.accentColor).toBeDefined();
      expect(Array.isArray(defaultGuildSettings.booster.container.contentLines)).toBe(true);
    });
  });
});