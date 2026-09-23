/**
 * Text fit utility — xử lý text overflow trong SVG.
 * SVG text không wrap tự động, cần tính toán chiều dài.
 */

/**
 * Cắt text cho vừa chiều rộng max (ước lượng dựa trên font size).
 * Thêm ellipsis (...) nếu text quá dài.
 */
export function fitText(text: string, maxWidth: number, fontSize: number): string {
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

/**
 * Format assets value với suffix K/M/B.
 * 112670000 → "112.67M", 1070000 → "1.07M", 9999 → "9.9K"
 */
export function formatAssets(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num) || num === 0) return '0';

  const abs = Math.abs(num);

  if (abs >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  }
  if (abs >= 1_000_000) {
    return (num / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  }
  if (abs >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  }
  return num.toLocaleString('vi-VN');
}

/**
 * Format hours với 1 chữ số thập phân.
 * 1018.3 → "1018.3h"
 */
export function formatHoursDecimal(totalHours: number): string {
  return `${totalHours.toFixed(1)}h`;
}
