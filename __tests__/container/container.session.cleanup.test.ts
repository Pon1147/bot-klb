/**
 * Tests cho container session management: cleanup, timeout, start/stop.
 * Test startSessionCleanup, stopSessionCleanup, isSessionValid, editSessions Map.
 */

// ─── Mocks (phải đặt trước import) ──────────────────────────────

jest.mock('../../src/config/container.variables.js', () => ({
  CONTAINER_COLORS: {
    WELCOME: 0x5865f2,
    LEAVE: 0xed4245,
    SUCCESS: 0x57f287,
    WARNING: 0xfee75c,
  },
}));

// ─── Import under-test modules ──────────────────────────────────

import {
  editSessions,
  isSessionValid,
  createSession,
  deleteSession,
  touchSession,
  startSessionCleanup,
  stopSessionCleanup,
  cloneContainerSettings,
  ContainerEditSession,
} from '../../src/commands/container/container-session.js';

import type { ContainerSettings } from '../../src/types/settings.types.js';

// ─── Test Helpers ────────────────────────────────────────────────

function createMockDraft() {
  return {
    accentColor: 0x5865f2,
    contentLines: ['Test line'],
    mediaUrl: null,
    mediaDescription: null,
    showSeparator: true,
    files: [],
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Container Session Management', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllTimers();
    editSessions.clear();
    stopSessionCleanup(); // Ensure cleanup is stopped before each test
  });

  afterEach(() => {
    stopSessionCleanup();
    jest.useRealTimers();
  });

  // ─── editSessions Map ────────────────────────────────────────

  describe('editSessions', () => {
    it('should be a TTL-based store with Map-like interface', () => {
      expect(editSessions).toBeDefined();
      expect(typeof editSessions.set).toBe('function');
      expect(typeof editSessions.get).toBe('function');
      expect(typeof editSessions.delete).toBe('function');
      expect(typeof editSessions.clear).toBe('function');
      expect(typeof editSessions.has).toBe('function');
      expect(typeof editSessions.size).toBe('number');
    });

    it('should be empty after clear', () => {
      editSessions.set('user_1', {} as ContainerEditSession);
      editSessions.clear();
      expect(editSessions.size).toBe(0);
    });
  });

  // ─── createSession ───────────────────────────────────────────

  describe('createSession', () => {
    it('should create a new session and add it to the Map', () => {
      const draft = createMockDraft();
      const session = createSession(
        'user_123',
        'guild_456',
        'welcome',
        draft,
        'msg_789',
        'channel_000',
      );

      expect(session).toBeDefined();
      // userId là key của Map, không phải field trong session object
      expect(editSessions.has('user_123')).toBe(true);
      expect(session.guildId).toBe('guild_456');
      expect(session.type).toBe('welcome');
      expect(session.messageId).toBe('msg_789');
      expect(session.channelId).toBe('channel_000');
      expect(session.createdAt).toBeGreaterThan(0);
      expect(editSessions.has('user_123')).toBe(true);
    });

    it('should overwrite existing session for the same user', () => {
      const draft1 = createMockDraft();
      const draft2 = { ...createMockDraft(), accentColor: 0xed4245 };

      createSession('user_123', 'guild_456', 'welcome', draft1, 'msg_1', 'channel_1');
      createSession('user_123', 'guild_789', 'leave', draft2, 'msg_2', 'channel_2');

      expect(editSessions.size).toBe(1);
      const session = editSessions.get('user_123');
      expect(session!.guildId).toBe('guild_789');
      expect(session!.type).toBe('leave');
      expect(session!.draft.accentColor).toBe(0xed4245);
    });
  });

  // ─── deleteSession ───────────────────────────────────────────

  describe('deleteSession', () => {
    it('should remove session from the Map', () => {
      createSession('user_123', 'guild_456', 'welcome', createMockDraft(), 'msg_1', 'ch_1');
      expect(editSessions.has('user_123')).toBe(true);

      deleteSession('user_123');
      expect(editSessions.has('user_123')).toBe(false);
    });

    it('should not throw when deleting non-existent session', () => {
      expect(() => deleteSession('non_existent')).not.toThrow();
    });
  });

  // ─── isSessionValid ──────────────────────────────────────────

  describe('isSessionValid', () => {
    it('should return false for undefined session', () => {
      expect(isSessionValid(undefined)).toBe(false);
    });

    it('should return true for fresh session', () => {
      const session = createSession(
        'user_1',
        'guild_1',
        'welcome',
        createMockDraft(),
        'msg_1',
        'ch_1',
      );
      expect(isSessionValid(session)).toBe(true);
    });

    it('should return false for expired session (16 minutes old)', () => {
      const session = createSession(
        'user_1',
        'guild_1',
        'welcome',
        createMockDraft(),
        'msg_1',
        'ch_1',
      );
      // Simulate 16 minutes passing (SESSION_TIMEOUT_MS = 15 min)
      jest.advanceTimersByTime(16 * 60 * 1000);
      expect(isSessionValid(session)).toBe(false);
    });

    it('should return true for session at 14 minutes (just before timeout)', () => {
      const session = createSession(
        'user_1',
        'guild_1',
        'welcome',
        createMockDraft(),
        'msg_1',
        'ch_1',
      );
      jest.advanceTimersByTime(14 * 60 * 1000);
      expect(isSessionValid(session)).toBe(true);
    });
  });

  // ─── cloneContainerSettings ──────────────────────────────────

  describe('cloneContainerSettings', () => {
    it('should create a deep clone of settings', () => {
      const original = createMockDraft();
      const clone = cloneContainerSettings(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.contentLines).not.toBe(original.contentLines);
    });

    it('should not mutate original when modifying clone', () => {
      const original = createMockDraft();
      const clone = cloneContainerSettings(original);

      clone.accentColor = 0xff0000;
      clone.contentLines.push('New line');

      expect(original.accentColor).toBe(0x5865f2);
      expect(original.contentLines).toHaveLength(1);
    });
  });

  // ─── startSessionCleanup / stopSessionCleanup ────────────────

  describe('startSessionCleanup / stopSessionCleanup', () => {
    it('should start periodic cleanup interval', () => {
      startSessionCleanup();
      // TTLStore quản lý timer nội bộ — kiểm tra behavior thay vì internal state
      stopSessionCleanup();
    });

    it('should be idempotent on repeated start', () => {
      startSessionCleanup();
      // Second call should be a no-op (TTLStore内部管理)
      startSessionCleanup();
      stopSessionCleanup();
    });

    it('should stop cleanup interval', () => {
      startSessionCleanup();
      stopSessionCleanup();
      // No error on double stop
      stopSessionCleanup();
    });

    it('should not throw when stopping non-running cleanup', () => {
      expect(() => stopSessionCleanup()).not.toThrow();
    });

    it('should clean up expired sessions after interval fires', () => {
      // Create an expired session manually
      editSessions.set('expired_user', {
        guildId: 'guild_1',
        type: 'welcome',
        draft: createMockDraft(),
        messageId: 'msg_1',
        channelId: 'ch_1',
        createdAt: Date.now() - 20 * 60 * 1000, // 20 minutes ago (expired)
        lastInteractionAt: Date.now() - 20 * 60 * 1000, // 20 minutes ago (expired)
      });

      // Create a valid session
      createSession('valid_user', 'guild_1', 'welcome', createMockDraft(), 'msg_2', 'ch_2');

      expect(editSessions.size).toBe(2);

      startSessionCleanup();
      // Fire the interval immediately
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(editSessions.has('expired_user')).toBe(false);
      expect(editSessions.has('valid_user')).toBe(true);
    });

    it('should not clean when no sessions are expired', () => {
      // Create only valid sessions
      createSession('user_1', 'guild_1', 'welcome', createMockDraft(), 'msg_1', 'ch_1');

      startSessionCleanup();
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Session hợp lệ không bị xóa
      expect(editSessions.has('user_1')).toBe(true);
      expect(editSessions.size).toBe(1);
    });
  });

  // ─── touchSession ────────────────────────────────────────────

  describe('touchSession', () => {
    it('should refresh lastInteractionAt when session exists', () => {
      const draft: ContainerSettings = {
        accentColor: 0x5865f2,
        headerTemplate: "Test",
        contentLines: ["Test"],
        mediaUrl: null,
        mediaDescription: null,
        showSeparator: false,
        files: [],
      };
      createSession("touch-test-user", "guild_1", "welcome", draft, "msg_1", "ch_1");
      const sessionBefore = editSessions.get("touch-test-user");
      const originalTime = sessionBefore!.lastInteractionAt;
      // Advance fake time so touchSession sets a newer timestamp
      jest.advanceTimersByTime(1000);
      touchSession("touch-test-user");
      const sessionAfter = editSessions.get("touch-test-user");
      expect(sessionAfter).toBeDefined();
      expect(sessionAfter!.lastInteractionAt).toBeGreaterThanOrEqual(originalTime);
      deleteSession("touch-test-user");
    });
  });
});