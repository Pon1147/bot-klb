/// <reference types="jest" />
/**
 * Unit tests cho formatNumber và formatDuration trong text-fit.ts.
 */

import { formatNumber, formatDuration } from '../../../src/renderers/df-stats/utils/text-fit.js';

describe('renderers/df-stats/utils/text-fit', () => {
  describe('formatNumber', () => {
    it('format số nguyên hợp lệ với dấu phân cách hàng nghìn vi-VN', () => {
      expect(formatNumber(1250000)).toBe('1.250.000');
    });

    it('format chuỗi số hợp lệ với dấu phân cách hàng nghìn vi-VN', () => {
      expect(formatNumber('9876543')).toBe('9.876.543');
    });

    it('trả về fallback "0" khi chuỗi không thể parse thành số (NaN)', () => {
      expect(formatNumber('invalid-number')).toBe('0');
      expect(formatNumber('abc')).toBe('0');
    });

    it('trả về "0" khi giá trị là số 0', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber('0')).toBe('0');
    });
  });

  describe('formatDuration', () => {
    it('format thời gian chơi hợp lệ sang định dạng "Xh Ym"', () => {
      expect(formatDuration(12, 45)).toBe('12h 45m');
      expect(formatDuration(1, 5)).toBe('1h 5m');
    });

    it('format thời gian với các giá trị 0', () => {
      expect(formatDuration(0, 0)).toBe('0h 0m');
      expect(formatDuration(5, 0)).toBe('5h 0m');
      expect(formatDuration(0, 30)).toBe('0h 30m');
    });
  });
});

