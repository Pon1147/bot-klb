import { isValidSnowflake } from '../../src/utils/snowflake.util.js';

describe('isValidSnowflake', () => {
  it('hợp lệ với Snowflake chuẩn từ 17 đến 20 số', () => {
    expect(isValidSnowflake('12345678901234567')).toBe(true); // 17 ký tự
    expect(isValidSnowflake('123456789012345678')).toBe(true); // 18 ký tự
    expect(isValidSnowflake('1234567890123456789')).toBe(true); // 19 ký tự
    expect(isValidSnowflake('12345678901234567890')).toBe(true); // 20 ký tự
  });

  it('không hợp lệ với chuỗi rác hoặc sai độ dài', () => {
    expect(isValidSnowflake('')).toBe(false);
    expect(isValidSnowflake('123456')).toBe(false); // Quá ngắn
    expect(isValidSnowflake('123456789012345678901')).toBe(false); // 21 ký tự (quá dài)
    expect(isValidSnowflake('12345678901234567abc')).toBe(false); // Chứa chữ cái
    expect(isValidSnowflake(null)).toBe(false);
    expect(isValidSnowflake(undefined)).toBe(false);
  });
});

