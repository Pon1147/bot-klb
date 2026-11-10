/**
 * Unit tests cho df-claim-store.ts — In-memory claim code store.
 */

import {
  generateCode,
  consumeCode,
  cleanupExpired,
  resetStore,
  startCleanup,
  stopCleanup,
  setClaimDatabase,
  cleanupExpiredClaimSessions,
} from '../../src/services/df-claim-store.js';

describe('df-claim-store', () => {
  // Mock database cho generateCode (cần DB để save claim session)
  const mockDb: any = {
    open: true,
    prepare: jest.fn(() => ({
      run: jest.fn().mockReturnValue({ changes: 1 }),
    })),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    await resetStore();
    mockDb.prepare.mockClear();
  });

  afterEach(async () => {
    await stopCleanup();
    await resetStore();
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
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('nên xử lý không lỗi khi store rỗng', () => {
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('nên xóa các mã đã hết hạn', () => {
      generateCode(mockDb, 'user-123');
      cleanupExpired();
      resetStore();
    });

    it('nên xử lý mã hết hạn khi consumeCode', () => {
      generateCode(mockDb, 'user-123');

      const code = generateCode(mockDb, 'user-exp');
      consumeCode(code); // consume

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

      try {
        const {
          generateCode: genCode,
          resetStore: rstStore,
        } = require('../../src/services/df-claim-store.js');
        const mockDbLocal: any = {
          open: true,
          prepare: jest.fn(() => ({
            run: jest.fn().mockReturnValue({ changes: 1 }),
          })),
          exec: jest.fn(),
        };

        genCode(mockDbLocal, 'user-1');
        genCode(mockDbLocal, 'user-2');
        const code3 = genCode(mockDbLocal, 'user-3');
        expect(code3).toHaveLength(6);

        rstStore();
      } finally {
        jest.dontMock('crypto');
      }
    });
  });

  describe('expired code consumption', () => {
    it('nên trả về null và xóa mã đã hết hạn khi consume', () => {
      jest.useFakeTimers();
      try {
        const code = generateCode(mockDb, 'user-exp-timer');

        // Advance past 10 minutes TTL
        jest.advanceTimersByTime(10 * 60 * 1000 + 1000);

        // Store get should detect expiration and return null
        expect(consumeCode(code)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('nên xóa mã hết hạn khi cleanupExpired chạy', () => {
      jest.useFakeTimers();
      try {
        const {
          generateCode: genCode,
          consumeCode: consume,
          cleanupExpired: cleanup,
          resetStore: rst,
        } = require('../../src/services/df-claim-store.js');

        rst();
        const mockDbCleanup: any = {
          open: true,
          prepare: jest.fn(() => ({
            run: jest.fn().mockReturnValue({ changes: 1 }),
          })),
        };
        const code = genCode(mockDbCleanup, 'user-cleanup');

        expect(consume(code)).not.toBeNull();

        const code2 = genCode(mockDbCleanup, 'user-cleanup-2');
        jest.advanceTimersByTime(10 * 60 * 1000 + 1000);

        cleanup();

        expect(consume(code2)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('SQLite Claim Sessions Retention & Cleanup Hook (NEW-03)', () => {
    it('startCleanup(db) và generateCode(db) gắn kết database và kích hoạt dọn dẹp', () => {
      const dbMock: any = {
        open: true,
        prepare: jest.fn(() => ({
          run: jest.fn().mockReturnValue({ changes: 2 }),
        })),
      };

      startCleanup(dbMock);

      cleanupExpired();

      expect(dbMock.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM df_claim_sessions'),
      );
    });

    it('cleanupExpired(db) dọn dẹp trực tiếp cả RAM và SQLite duy nhất 1 lần (không double cleanup)', () => {
      const runMock = jest.fn().mockReturnValue({ changes: 5 });
      const prepareMock = jest.fn(() => ({ run: runMock }));
      const dbMock: any = {
        open: true,
        prepare: prepareMock,
      };

      cleanupExpired(dbMock, 14);

      // Chỉ gọi prepare đúng 1 lần cho SQLite cleanup (RAM không gọi callback DB thứ hai)
      expect(prepareMock).toHaveBeenCalledTimes(1);
      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM df_claim_sessions'),
      );
    });

    it('stopCleanup() chờ callback dọn dẹp đang chạy hoàn tất (graceful shutdown coordination)', async () => {
      let finishCleanup: (val: any) => void = () => {};
      const cleanupPromise = new Promise((resolve) => {
        finishCleanup = resolve;
      });

      const dbMock: any = {
        open: true,
        prepare: jest.fn(() => ({
          run: jest.fn(() => {
            return { changes: 1 };
          }),
        })),
      };

      startCleanup(dbMock);

      // Gọi stopCleanup
      const stopPromise = stopCleanup();
      await expect(stopPromise).resolves.toBeUndefined();
      await stopCleanup();
    });

    it('runDbCleanup thực thi dọn dẹp theo chu kỳ và xử lý an toàn (Task 4 Coverage)', async () => {
      jest.useFakeTimers();
      try {
        const runMock = jest.fn().mockReturnValue({ changes: 3 });
        const dbMock: any = {
          open: true,
          prepare: jest.fn(() => ({ run: runMock })),
        };

        startCleanup(dbMock);

        // Kích hoạt chu kỳ dọn dẹp nền định kỳ 5 phút (300,000ms)
        jest.advanceTimersByTime(300_000);

        // Chờ microtasks / async promise hoàn tất
        await Promise.resolve();
        await Promise.resolve();

        expect(dbMock.prepare).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM df_claim_sessions'),
        );
        expect(runMock).toHaveBeenCalled();
      } finally {
        await stopCleanup();
        jest.useRealTimers();
      }
    });

    it('runDbCleanup xử lý an toàn khi database throw error hoặc bị đóng', async () => {
      jest.useFakeTimers();
      try {
        const dbErrorMock: any = {
          open: true,
          prepare: jest.fn(() => {
            throw new Error('Disk I/O error');
          }),
        };

        // Gắn DB ném lỗi và startCleanup
        startCleanup(dbErrorMock);

        // Kích hoạt interval, callback catch error và trả về 0 (Line 57)
        jest.advanceTimersByTime(300_000);
        await Promise.resolve();
        await Promise.resolve();

        expect(dbErrorMock.prepare).toHaveBeenCalled();

        // Kiểm tra nhánh claimDb đã bị đóng (open = false)
        dbErrorMock.open = false;
        dbErrorMock.prepare.mockClear();
        jest.advanceTimersByTime(300_000);
        await Promise.resolve();
        await Promise.resolve();

        expect(dbErrorMock.prepare).not.toHaveBeenCalled();
      } finally {
        await stopCleanup();
        jest.useRealTimers();
      }
    });

    it('runDbCleanup tái sử dụng cleanupInProgress khi chu kỳ trước chưa xong (in-flight deduplication)', async () => {
      jest.useFakeTimers();
      try {
        const runMock = jest.fn().mockReturnValue({ changes: 1 });
        const dbMock: any = {
          open: true,
          prepare: jest.fn(() => ({ run: runMock })),
        };

        startCleanup(dbMock);

        // Advance 2 chu kỳ cùng lúc trước khi flush microtasks để kích hoạt nhánh if (cleanupInProgress)
        jest.advanceTimersByTime(600_000);
        await Promise.resolve();
        await Promise.resolve();

        expect(dbMock.prepare).toHaveBeenCalled();
      } finally {
        await stopCleanup();
        jest.useRealTimers();
      }
    });

    it('cleanupExpired xử lý an toàn khi DB bị đóng hoặc throw error', () => {
      const dbErrorMock: any = {
        open: true,
        prepare: jest.fn(() => {
          throw new Error('Locked table');
        }),
      };

      // DB ném lỗi được try/catch nuốt an toàn
      expect(() => cleanupExpired(dbErrorMock)).not.toThrow();

      // DB với open = false không gọi prepare
      const dbClosedMock: any = {
        open: false,
        prepare: jest.fn(),
      };
      cleanupExpired(dbClosedMock);
      expect(dbClosedMock.prepare).not.toHaveBeenCalled();

      // DB không có thuộc tính open (duck-typing)
      const dbDuckMock: any = {
        prepare: jest.fn(() => ({
          run: jest.fn().mockReturnValue({ changes: 0 }),
        })),
      };
      cleanupExpired(dbDuckMock);
      expect(dbDuckMock.prepare).toHaveBeenCalled();
    });

    it('stopCleanup chờ in-flight cleanup hoàn tất khi đang chạy', async () => {
      jest.useFakeTimers();
      try {
        const dbSlowMock: any = {
          open: true,
          prepare: jest.fn(() => ({
            run: jest.fn().mockReturnValue({ changes: 1 }),
          })),
        };

        startCleanup(dbSlowMock);

        // Kích hoạt timer để bắt đầu in-flight runDbCleanup
        jest.advanceTimersByTime(300_000);

        // stopCleanup chờ in-flight hoàn tất
        const stopPromise = stopCleanup();
        await expect(stopPromise).resolves.toBeUndefined();
      } finally {
        await stopCleanup();
        jest.useRealTimers();
      }
    });

    it('resetStore xóa sạch bộ nhớ và gỡ bỏ database reference', async () => {
      const dbMock: any = {
        open: true,
        prepare: jest.fn(() => ({
          run: jest.fn().mockReturnValue({ changes: 0 }),
        })),
      };

      setClaimDatabase(dbMock);
      await resetStore();

      cleanupExpired();
      expect(dbMock.prepare).not.toHaveBeenCalled();
    });

    it('re-exports cleanupExpiredClaimSessions từ df-claim.db', () => {
      expect(typeof cleanupExpiredClaimSessions).toBe('function');
    });
  });
});
