/**
 * VietQR Service: Tương tác với VietQR API v2, tạo ảnh VietQR động & quản lý danh sách ngân hàng.
 */

import axios from 'axios';
import { VietQrBank, VietQrGenerateOptions } from '../types/seller.types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('VietQrService');

export const BANK_LIST_URL = 'https://api.vietqr.io/v2/banks';
export const VIETQR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

let cachedBanks: VietQrBank[] = [];
let cachedAt = 0;

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa text cho nội dung chuyển khoản / tên chủ tài khoản.
 */
export function normalizeVietQrText(value: string | undefined | null, uppercase = false): string {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^0-9A-Za-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return uppercase ? text.toUpperCase() : text;
}

/**
 * Chuẩn hóa đối tượng ngân hàng trả về từ VietQR API.
 */
export function normalizeBank(raw: Record<string, unknown>): VietQrBank {
  return {
    id: Number(raw.id) || 0,
    name: String(raw.name || '').trim(),
    shortName: String(raw.shortName || raw.code || raw.name || '').trim(),
    code: String(raw.code || '').trim(),
    bin: String(raw.bin || '').trim(),
    logo: String(raw.logo || '').trim(),
    transferSupported: Number(raw.transferSupported || 0),
    lookupSupported: Number(raw.lookupSupported || 0),
  };
}

/**
 * Lấy danh sách ngân hàng trực tiếp từ API VietQR.
 */
export async function fetchBankList(): Promise<VietQrBank[]> {
  const response = await axios.get(BANK_LIST_URL, {
    timeout: 10000,
    headers: { Accept: 'application/json' },
  });

  const data = response.data;
  if (data?.code !== '00' || !Array.isArray(data?.data)) {
    throw new Error(data?.desc || 'Không thể tải danh sách ngân hàng từ VietQR.');
  }

  return (data.data as Record<string, unknown>[])
    .map(normalizeBank)
    .filter((bank) => Boolean(bank.bin));
}

/**
 * Lấy danh sách ngân hàng (có bộ nhớ đệm cache 24h).
 */
export async function getBankList(forceRefresh = false): Promise<VietQrBank[]> {
  const isValid = cachedBanks.length > 0 && Date.now() - cachedAt < VIETQR_CACHE_TTL_MS;
  if (!forceRefresh && isValid) {
    return cachedBanks;
  }

  try {
    cachedBanks = await fetchBankList();
    cachedAt = Date.now();
    logger.info(`Đã cập nhật danh sách ${cachedBanks.length} ngân hàng VietQR.`);
  } catch (error) {
    logger.warn(
      `Lỗi khi tải danh sách ngân hàng: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (cachedBanks.length === 0) {
      throw error;
    }
  }

  return cachedBanks;
}

/**
 * Xóa cache danh sách ngân hàng (phục vụ test).
 */
export function clearBankCache(): void {
  cachedBanks = [];
  cachedAt = 0;
}

/**
 * Tìm ngân hàng theo mã BIN, Code hoặc ShortName.
 */
export async function findBank(query: string): Promise<VietQrBank | null> {
  const banks = await getBankList();
  const q = query.trim().toLowerCase();

  return (
    banks.find(
      (b) =>
        b.bin.toLowerCase() === q || b.code.toLowerCase() === q || b.shortName.toLowerCase() === q,
    ) || null
  );
}

/**
 * Tạo URL ảnh VietQR chuẩn NAPAS 24/7 thông qua img.vietqr.io.
 */
export function buildVietQrImageUrl(options: VietQrGenerateOptions): string {
  const bankCode = String(options.bankCode || '').trim();
  const accountNumber = String(options.accountNumber || '').trim();
  const template = options.template || 'compact2';
  const amount = Math.max(0, Math.floor(Number(options.amount) || 0));
  const addInfo = encodeURIComponent(normalizeVietQrText(options.addInfo));
  const accountName = encodeURIComponent(normalizeVietQrText(options.accountName, true));

  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-${template}.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}

/**
 * Sinh Buffer ảnh VietQR từ img.vietqr.io để gửi dạng đính kèm (Attachment) trong Discord.
 */
export async function generateVietQrBuffer(options: VietQrGenerateOptions): Promise<Buffer> {
  const imageUrl = buildVietQrImageUrl(options);

  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 10000,
  });

  return Buffer.from(response.data);
}
