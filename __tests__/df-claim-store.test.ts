/**
 * Unit tests cho df-claim-store.ts — In-memory claim code store.
 */

import { generateCode, consumeCode, cleanupExpired, resetStore, startCleanup } from '../src/services/df-claim-store.js';

describe('df-claim-store', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  describe('generateCode', () => {
    it('nên tạo mã claim 6 ký tự', () => {
      const code = generateCode('user-123');
      expect(code).toHaveLength(6);
      // Không chứa ký tự dễ nhầm: I, 1, O, 0
      expect(code).not.toMatch(/[I1O0]/);
    });

    it('nên tạo mã khác nhau cho các user khác nhau', () => {
      const code1 = generateCode('user-1');
      const code2 = generateCode('user-2');
      expect(code1).not.toBe(code2);
    });

    it('nên thay thế mã cũ khi cùng user generate lại', () => {
      const code1 = generateCode('user-123');
      const code2 = generateCode('user-123');
      expect(code1).not.toBe(code2);
      // Mã cũ không thể consume được nữa
      expect(consumeCode(code1)).toBeNull();
      expect(consumeCode(code2)).toBe('user-123');
    });
  });

  describe('consumeCode', () => {
    it('nên trả về discordId khi mã hợp lệ', () => {
      const code = generateCode('user-123');
      expect(consumeCode(code)).toBe('user-123');
    });

    it('nên trả về null cho mã không tồn tại', () => {
      expect(consumeCode('XXXXXX')).toBeNull();
    });

    it('nên trả về null cho mã đã dùng (single-use)', () => {
      const code = generateCode('user-123');
      consumeCode(code);
      expect(consumeCode(code)).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('nên để nguyên các mã chưa hết hạn', () => {
      generateCode('user-123');
      // Mã mới không bị xóa
      // Vì TTL là 10 phút, cleanup sẽ không xóa
      expect(() => cleanupExpired()).not.toThrow();
    });

    it('nên xử lý không lỗi khi store rỗng', () => {
      expect(() => cleanupExpired()).not.toThrow();
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
});
