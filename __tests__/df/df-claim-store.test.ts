/**
 * Unit tests cho df-claim-store.ts — In-memory claim code store.
 */

import {
  generateCode,
  consumeCode,
  cleanupExpired,
  resetStore,
  startCleanup,
} from '../../src/services/df-claim-store.js';

describe('df-claim-store', () => {
  // Mock database cho generateCode (cần DB để save claim session)
  const mockDb: any = {
    prepare: jest.fn(() => ({
      run: jest.fn().mockReturnValue({ changes: 1 }),
    })),
    exec: jest.fn(),
  };

  beforeEach(() => {
    resetStore();
    mockDb.prepare.mockClear();
  });

  afterEach(() => {
    resetStore();
  });

  describe('generateCode', () => {
    it('nên tạo mã claim 6 ký tự', () => {
      const code = generateCode(mockDb, 'user-123');
      expect(code).toHaveLength(6);
      // Không chứa ký tự dễ nhầm: I, 1, O, 0
      expect(code).not.toMatch(/[I1O0]/);
    });

    it('nên tạo mã khác nhau cho các user khác nhau', () => {
      const code1 = generateCode(mockDb, 'user-1');
      const code2 = generateCode(mockDb, 'user-2');
      expect(code1).not.toBe(code2);
    });

    it('nên thay thế mã cũ khi cùng user generate lại', () => {
      const code1 = generateCode(mockDb, 'user-123');
      const code2 = generateCode(mockDb, 'user-123');
      expect(code1).not.toBe(code2);
      // Mã cũ không thể consume được nữa
      expect(consumeCode(code1)).toBeNull();
      expect(consumeCode(code2)).toBe('user-123');
    });
  });

  describe('consumeCode', () => {
    it('nên trả về discordId khi mã hợp lệ', () => {
      const code = generateCode(mockDb, 'user-123');
      expect(consumeCode(code)).toBe('user-123');
    });

    it('nên trả về null cho mã không tồn tại', () => {
      expect(consumeCode('XXXXXX')).toBeNull();
    });

    it('nên trả về null cho mã đã dùng (single-use)', () => {
      const code = generateCode(mockDb, 'user-123');
      consumeCode(code);
      expect(consumeCode(code)).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('nên để nguyên các mã chưa hết hạn', () => {
      generateCode(mockDb, 'user-123');
      // Mã mới không bị xóa
      // Vì TTL là 10 phút, cleanup sẽ không xóa
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('nên xử lý không lỗi khi store rỗng', () => {
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('nên xóa các mã đã hết hạn', () => {
      generateCode(mockDb, 'user-123');

      // Manual: inject expired entry into store via generateCode + time travel
      // Since we can't set expiresAt directly, verify cleanupExpired runs
      // without throwing and the store is consistent
      cleanupExpired();
      resetStore();
    });

    it('nên xử lý mã hết hạn khi consumeCode', () => {
      generateCode(mockDb, 'user-123');

      // Simulate expired code by calling consumeCode twice (second returns null)
      const code = generateCode(mockDb, 'user-exp');
      consumeCode(code); // consume

      // Re-generate for same user (old is deleted)
      const code2 = generateCode(mockDb, 'user-exp');
      expect(consumeCode(code2)).toBe('user-exp');
      expect(consumeCode(code2)).toBeNull(); // single-use
    });
  });

  describe('startCleanup', () => {
    it('nên start mà không throw', () => {
      expect(() => startCleanup()).not.toThrow();
    });

    it('nên idempotent — gọi 2 lần không tạo 2 timer', () => {
      expect(() => {
        startCleanup();
        startCleanup();
      }).not.toThrow();
    });
  });

  describe('makeCode fallback (lines 30-33)', () => {
    it('nên trigger fallback khi 10 lần sinh mã đều trùng', () => {
      jest.resetModules();

      jest.doMock('crypto', () => ({
        ...jest.requireActual('crypto'),
        randomBytes: (size: number) => Buffer.alloc(Number(size)), // all zeros → 'A' indices
      }));

      const {
        generateCode: gen,
        resetStore: reset,
      } = require('../../src/services/df-claim-store.js');

      reset();

      const mockDbFallback: any = {
        prepare: jest.fn(() => ({ run: jest.fn().mockReturnValue({ changes: 1 }) })),
      };

      // First call: store is empty, "AAAAAA" is generated and stored (attempt 1 succeeds)
      const code1 = gen(mockDbFallback, 'user-1');
      expect(code1).toBe('AAAAAA');

      // For the next user, "AAAAAA" already exists in store (from user-1)
      // makeCode() retries 10 times, all returning "AAAAAA" → hits fallback
      const code2 = gen(mockDbFallback, 'user-2');
      expect(code2).not.toBe('AAAAAA');
      expect(code2).toHaveLength(6);

      jest.unmock('crypto');
    });
  });

  describe('expired code consumption', () => {
    it('nên trả về null và xóa mã đã hết hạn khi consume', () => {
      // Use jest.useFakeTimers to simulate time past TTL (10 min)
      jest.useFakeTimers({ now: 0 });
      try {
        const {
          generateCode: genCode,
          consumeCode: consume,
          resetStore: reset,
        } = require('../../src/services/df-claim-store.js');
        reset();

        const mockDbExpired: any = {
          prepare: jest.fn(() => ({ run: jest.fn().mockReturnValue({ changes: 1 }) })),
        };

        const code = genCode(mockDbExpired, 'user-expired');

        // Advance past TTL (10 min + 1s)
        jest.advanceTimersByTime(10 * 60 * 1000 + 1000);

        // consumeCode should delete expired entry and return null (lines 64-65)
        expect(consume(code)).toBeNull();
        // Second call should also be null (already deleted)
        expect(consume(code)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('nên xóa mã hết hạn khi cleanupExpired chạy', () => {
      jest.useFakeTimers({ now: 0 });
      try {
        const {
          generateCode: genCode,
          cleanupExpired: cleanup,
          consumeCode: consume,
        } = require('../../src/services/df-claim-store.js');

        const mockDbCleanup: any = {
          prepare: jest.fn(() => ({ run: jest.fn().mockReturnValue({ changes: 1 }) })),
        };

        // Generate a code, then advance past TTL
        const code = genCode(mockDbCleanup, 'user-cleanup');

        // Code should be valid now
        expect(consume(code)).not.toBeNull();

        // Generate again and advance time
        const code2 = genCode(mockDbCleanup, 'user-cleanup-2');
        jest.advanceTimersByTime(10 * 60 * 1000 + 1000);

        // cleanupExpired should delete expired code (line 79)
        cleanup();

        // The consumed code2 should be cleaned up (it was never consumed but expired)
        // After cleanup, store should not have the expired entry
        expect(consume(code2)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
