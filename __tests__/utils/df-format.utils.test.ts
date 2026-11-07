import {
  formatCoin,
  formatVietnamDateTime,
  formatVietnamDate,
  formatVietnamTime,
  formatMatchDuration,
  VIETNAM_TIMEZONE,
} from '../../src/utils/df-format.utils.js';

describe('df-format.utils', () => {
  describe('VIETNAM_TIMEZONE', () => {
    it('đúng timezone Asia/Ho_Chi_Minh', () => {
      expect(VIETNAM_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    });
  });

  describe('formatCoin', () => {
    it('định dạng số kèm chữ Coin', () => {
      expect(formatCoin(2079074)).toBe('2.079.074 Coin');
      expect(formatCoin('1000000')).toBe('1.000.000 Coin');
      expect(formatCoin(0)).toBe('0 Coin');
    });

    it('định dạng số không kèm Coin khi includeSuffix = false', () => {
      expect(formatCoin(2079074, false)).toBe('2.079.074');
      expect(formatCoin(0, false)).toBe('0');
    });

    it('fallback an toàn khi null / undefined', () => {
      expect(formatCoin(null)).toBe('0 Coin');
      expect(formatCoin(undefined)).toBe('0 Coin');
      expect(formatCoin(null, false)).toBe('0');
    });
  });

  describe('formatMatchDuration', () => {
    it('xử lý thời lượng < 60 phút (API trả về phút)', () => {
      expect(formatMatchDuration(12)).toBe('12 phút');
      expect(formatMatchDuration(1)).toBe('1 phút');
    });

    it('xử lý thời lượng >= 60 giây (API trả về giây)', () => {
      expect(formatMatchDuration(720)).toBe('12 phút');
      expect(formatMatchDuration(750)).toBe('12 phút 30s');
      expect(formatMatchDuration(59)).toBe('59 phút');
    });

    it('fallback khi null, undefined, âm hoặc 0', () => {
      expect(formatMatchDuration(null)).toBe('N/A');
      expect(formatMatchDuration(undefined)).toBe('N/A');
      expect(formatMatchDuration(0)).toBe('N/A');
      expect(formatMatchDuration(-5)).toBe('N/A');
      expect(formatMatchDuration('invalid')).toBe('N/A');
    });
  });

  describe('formatVietnamDateTime / Date / Time', () => {
    // 06/11/2026 17:40:00 UTC+7 tương đương 06/11/2026 10:40:00 UTC
    const fixedDate = new Date('2026-11-06T10:40:00.000Z');
    const fixedTimestampSec = Math.floor(fixedDate.getTime() / 1000);

    it('formatVietnamDateTime xuất đầy đủ giờ và ngày theo múi giờ VN', () => {
      const formatted = formatVietnamDateTime(fixedTimestampSec);
      expect(formatted).toBe('17:40 06/11/2026');
    });

    it('formatVietnamDate xuất ngày tháng năm theo múi giờ VN', () => {
      const formatted = formatVietnamDate(fixedTimestampSec);
      expect(formatted).toBe('06/11/2026');
    });

    it('formatVietnamTime xuất giờ phút theo múi giờ VN', () => {
      const formatted = formatVietnamTime(fixedTimestampSec);
      expect(formatted).toBe('17:40');
    });

    it('hỗ trợ cả Date instance', () => {
      expect(formatVietnamDateTime(fixedDate)).toBe('17:40 06/11/2026');
    });

    it('hỗ trợ timestamp dạng chuỗi giây từ API (tránh bug năm 1970)', () => {
      const stringTimestampSec = String(fixedTimestampSec);
      expect(formatVietnamDateTime(stringTimestampSec)).toBe('17:40 06/11/2026');
      expect(formatVietnamDate(stringTimestampSec)).toBe('06/11/2026');
      expect(formatVietnamTime(stringTimestampSec)).toBe('17:40');
    });

    it('hỗ trợ ISO date string', () => {
      expect(formatVietnamDateTime('2026-11-06T10:40:00.000Z')).toBe('17:40 06/11/2026');
    });

    it('fallback an toàn khi dữ liệu không hợp lệ', () => {
      expect(formatVietnamDateTime('')).toBe('Không xác định');
      expect(formatVietnamDateTime('invalid')).toBe('Không xác định');
      expect(formatVietnamDate('')).toBe('Không xác định');
      expect(formatVietnamTime('')).toBe('');
    });
  });
});
