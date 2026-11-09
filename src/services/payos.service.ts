import crypto from 'node:crypto';
import { botConfig } from '../config/bot.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PayOS');

export interface CreatePayosPaymentParams {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl?: string;
  returnUrl?: string;
}

export interface PayosPaymentData {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface PayosWebhookData {
  orderCode: number;
  amount: number;
  description: string;
  accountNumber: string;
  reference: string;
  transactionDateTime: string;
  currency: string;
  paymentLinkId: string;
  code: string;
  desc: string;
  [key: string]: unknown;
}

export interface PayosWebhookPayload {
  code: string;
  desc: string;
  data: PayosWebhookData;
  signature: string;
}

/**
 * Kiểm tra xem bot đã được cấu hình đầy đủ thông tin kết nối PayOS chưa.
 */
export function isPayosConfigured(): boolean {
  return Boolean(botConfig.payosClientId && botConfig.payosApiKey && botConfig.payosChecksumKey);
}

/**
 * Sắp xếp các key theo alphabet và tạo chuỗi query key=value&key=value...
 * Sau đó tính HMAC SHA-256 bằng checksumKey.
 */
export function generatePayosSignature(data: Record<string, unknown>, checksumKey: string): string {
  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys
    .filter((k) => data[k] !== undefined && data[k] !== null)
    .map((k) => `${k}=${data[k]}`);
  const dataStr = pairs.join('&');
  return crypto.createHmac('sha256', checksumKey).update(dataStr).digest('hex');
}

/**
 * Xác thực tính hợp lệ của Webhook nhận từ PayOS theo tài liệu chính thức:
 * https://payos.vn/docs/du-lieu-tra-ve/webhook/
 */
export function verifyPayosWebhook(
  payload: PayosWebhookPayload,
  checksumKey: string = botConfig.payosChecksumKey,
): boolean {
  if (!payload || !payload.data || !payload.signature || !checksumKey) {
    return false;
  }

  const expectedSignature = generatePayosSignature(
    payload.data as unknown as Record<string, unknown>,
    checksumKey,
  );

  if (Buffer.byteLength(expectedSignature) !== Buffer.byteLength(payload.signature)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf-8'),
    Buffer.from(payload.signature, 'utf-8'),
  );
}

/**
 * Chuẩn hóa description theo quy định PayOS: chữ cái không dấu, số, khoảng trắng, tối đa 25 ký tự.
 */
export function sanitizePayosDescription(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  return normalized.slice(0, 25) || 'Donate';
}

/**
 * Tạo link thanh toán / donate qua PayOS API:
 * POST https://api-merchant.payos.vn/v2/payment-requests
 */
export async function createPayosPaymentLink(
  params: CreatePayosPaymentParams,
): Promise<{ success: boolean; data?: PayosPaymentData; error?: string }> {
  if (!isPayosConfigured()) {
    return {
      success: false,
      error: 'PayOS chưa được cấu hình đầy đủ trong biến môi trường (.env).',
    };
  }

  // PayOS giới hạn độ dài mô tả tối đa 25 ký tự, không dấu, không ký tự đặc biệt
  const sanitizedDescription = sanitizePayosDescription(params.description);
  const cancelUrl = params.cancelUrl || botConfig.payosWebhookUrl || 'https://discord.com';
  const returnUrl = params.returnUrl || botConfig.payosWebhookUrl || 'https://discord.com';

  // Chữ ký cho payment request theo chuẩn PayOS:
  // Chuỗi: amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}
  const signString = `amount=${params.amount}&cancelUrl=${cancelUrl}&description=${sanitizedDescription}&orderCode=${params.orderCode}&returnUrl=${returnUrl}`;
  const signature = crypto
    .createHmac('sha256', botConfig.payosChecksumKey)
    .update(signString)
    .digest('hex');

  const requestBody = {
    orderCode: params.orderCode,
    amount: params.amount,
    description: sanitizedDescription,
    cancelUrl,
    returnUrl,
    signature,
  };

  try {
    const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: {
        'x-client-id': botConfig.payosClientId,
        'x-api-key': botConfig.payosApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = (await response.json()) as {
      code: string;
      desc: string;
      data?: PayosPaymentData;
    };

    if (result.code === '00' && result.data) {
      return {
        success: true,
        data: result.data,
      };
    }

    logger.warn('PayOS API trả về lỗi:', { code: result.code, desc: result.desc });
    return {
      success: false,
      error: result.desc || `Lỗi PayOS mã: ${result.code}`,
    };
  } catch (error) {
    logger.error('Lỗi khi gọi API tạo link PayOS:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể kết nối đến PayOS API.',
    };
  }
}
