/**
 * Text fit utility — xử lý text overflow trong SVG.
 * SVG text không wrap tự động, cần tính toán chiều dài.
 */

/**
 * Cắt text cho vừa chiều rộng max (ước lượng dựa trên font size).
 * Thêm ellipsis (...) nếu text quá dài.
 */
export function fitText(text: string, maxWidth: number, fontSize: number): string {
  // Ước lượng: mỗi ký tự chiếm ~fontSize * 0.6px trong monospace
  const charsPerPixel = 0.6;
  const maxChars = Math.floor(maxWidth / (fontSize * charsPerPixel));

  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars - 1) + '…';
}

/**
 * Format số với dấu phân cách hàng nghìn.
 * Fallback về '0' nếu không parse được.
 */
export function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('vi-VN');
}

/**
 * Format play duration sang string "Xh Ym".
 */
export function formatDuration(hours: number, minutes: number): string {
  return `${hours}h ${minutes}m`;
}
