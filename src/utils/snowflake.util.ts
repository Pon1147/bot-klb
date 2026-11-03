/**
 * Tiện ích kiểm tra định dạng Discord Snowflake ID.
 * Snowflake ID của Discord là chuỗi số có độ dài từ 17 đến 20 ký tự.
 * Sử dụng TypeScript Type Guard để tự động thu hẹp kiểu thành string.
 */
export function isValidSnowflake(id: unknown): id is string {
  return typeof id === 'string' && /^\d{17,20}$/.test(id);
}
