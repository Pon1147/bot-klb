/**
 * Shared formatting utilities cho Delta Force & Bot KLB.
 * Chuẩn hóa múi giờ Việt Nam (Asia/Ho_Chi_Minh), tiền tệ Coin, và thời lượng trận đấu.
 */

/** Múi giờ chuẩn Việt Nam (UTC+07:00) */
export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Chuyển đổi timestamp (number | string giây/ms, ISO string, Date) sang Date object hợp lệ.
 */
function toDate(timestamp: number | string | Date): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp;
  const num = Number(timestamp);
  if (!isNaN(num)) {
    if (num <= 0) return null;
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Định dạng mốc thời gian đầy đủ theo múi giờ Việt Nam (mặc định: HH:mm DD/MM/YYYY).
 */
export function formatVietnamDateTime(
  timestamp: number | string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(timestamp);
  if (!date) return 'Không xác định';

  return date.toLocaleString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  });
}

/**
 * Định dạng ngày theo múi giờ Việt Nam (DD/MM/YYYY).
 */
export function formatVietnamDate(
  timestamp: number | string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(timestamp);
  if (!date) return 'Không xác định';

  return date.toLocaleDateString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

/**
 * Định dạng giờ phút theo múi giờ Việt Nam (HH:mm).
 */
export function formatVietnamTime(
  timestamp: number | string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(timestamp);
  if (!date) return '';

  return date.toLocaleTimeString('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  });
}

/**
 * Định dạng số tiền / Coin chuẩn tiếng Việt (dấu chấm phân cách hàng nghìn).
 * @param amount Giá trị tiền
 * @param withUnit Có kèm theo chữ ' Coin' phía sau hay không (mặc định: true)
 */
export function formatCoin(amount: number | string | undefined | null, withUnit = true): string {
  if (amount === undefined || amount === null) return withUnit ? '0 Coin' : '0';
  const num = Number(amount);
  const formatted = isNaN(num) ? '0' : num.toLocaleString('vi-VN');
  return withUnit ? `${formatted} Coin` : formatted;
}

/**
 * Định dạng thời lượng trận đấu:
 * - Nếu < 60: API Delta Force trả về số phút (vd: 12 = 12 phút)
 * - Nếu >= 60: giá trị tính theo giây (vd: 720 = 12 phút, 1200 = 20 phút)
 */
export function formatMatchDuration(rawDuration: number | string | undefined | null): string {
  if (rawDuration === undefined || rawDuration === null) return 'N/A';
  const val = Number(rawDuration);
  if (isNaN(val) || val <= 0) return 'N/A';

  const totalSecs = val < 60 ? val * 60 : val;
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.round(totalSecs % 60);
  return mins > 0 ? (secs > 0 ? `${mins} phút ${secs}s` : `${mins} phút`) : `${secs} giây`;
}
