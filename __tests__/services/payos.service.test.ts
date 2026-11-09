import crypto from 'node:crypto';
import {
  generatePayosSignature,
  verifyPayosWebhook,
  createPayosPaymentLink,
  isPayosConfigured,
  sanitizePayosDescription,
  PayosWebhookPayload,
} from '../../src/services/payos.service.js';
import { botConfig } from '../../src/config/bot.config.js';

describe('payos.service', () => {
  const testChecksumKey = 'test_checksum_key_123456789';

  describe('generatePayosSignature & verifyPayosWebhook', () => {
    it('sinh chữ ký đúng chuẩn PayOS (sắp xếp key alphabet và HMAC SHA-256)', () => {
      const data = {
        orderCode: 123456,
        amount: 20000,
        description: 'Donate test',
      };

      // Chuỗi theo alphabet: amount=20000&description=Donate test&orderCode=123456
      const expectedDataStr = 'amount=20000&description=Donate test&orderCode=123456';
      const expectedHmac = crypto
        .createHmac('sha256', testChecksumKey)
        .update(expectedDataStr)
        .digest('hex');

      const signature = generatePayosSignature(data, testChecksumKey);
      expect(signature).toBe(expectedHmac);
    });

    it('xác thực thành công payload webhook PayOS hợp lệ', () => {
      const data = {
        orderCode: 123456,
        amount: 50000,
        description: 'Test Donate',
        accountNumber: '0123456789',
        reference: 'FT12345',
        transactionDateTime: '2026-11-09 17:00:00',
        currency: 'VND',
        paymentLinkId: 'plink_123',
        code: '00',
        desc: 'success',
      };

      const signature = generatePayosSignature(data, testChecksumKey);
      const payload: PayosWebhookPayload = {
        code: '00',
        desc: 'success',
        data,
        signature,
      };

      const isValid = verifyPayosWebhook(payload, testChecksumKey);
      expect(isValid).toBe(true);
    });

    it('từ chối payload webhook khi dữ liệu bị giả mạo hoặc chữ ký sai', () => {
      const data = {
        orderCode: 123456,
        amount: 50000,
        description: 'Test Donate',
        accountNumber: '0123456789',
        reference: 'FT12345',
        transactionDateTime: '2026-11-09 17:00:00',
        currency: 'VND',
        paymentLinkId: 'plink_123',
        code: '00',
        desc: 'success',
      };

      const payload: PayosWebhookPayload = {
        code: '00',
        desc: 'success',
        data,
        signature: 'invalid_forged_signature_abcdef',
      };

      const isValid = verifyPayosWebhook(payload, testChecksumKey);
      expect(isValid).toBe(false);
    });

    it('trả về false khi payload thiếu data hoặc chữ ký', () => {
      expect(verifyPayosWebhook(null as any, testChecksumKey)).toBe(false);
      expect(
        verifyPayosWebhook({ code: '00', desc: 'success' } as any, testChecksumKey),
      ).toBe(false);
    });
  });

  describe('sanitizePayosDescription', () => {
    it('chuẩn hóa bỏ dấu tiếng Việt và ký tự đặc biệt, giới hạn 25 ký tự', () => {
      expect(sanitizePayosDescription('Donate Nguyễn Văn Đạt 🌟')).toBe('Donate Nguyen Van Dat');
      expect(sanitizePayosDescription('Tên Rất Rất Dài Vượt Quá Hai Mươi Lăm Ký Tự')).toHaveLength(25);
      expect(sanitizePayosDescription('✨🎉💥')).toBe('Donate');
    });
  });

  describe('createPayosPaymentLink', () => {
    it('báo lỗi khi chưa cấu hình API credentials trong môi trường', async () => {
      const origKey = botConfig.payosChecksumKey;
      (botConfig as any).payosChecksumKey = '';

      const res = await createPayosPaymentLink({
        orderCode: 111,
        amount: 10000,
        description: 'Donate test',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('PayOS chưa được cấu hình đầy đủ');

      (botConfig as any).payosChecksumKey = origKey;
    });

    it('gọi API PayOS thành công khi có mock fetch', async () => {
      const origClientId = botConfig.payosClientId;
      const origApiKey = botConfig.payosApiKey;
      const origKey = botConfig.payosChecksumKey;

      (botConfig as any).payosClientId = 'client_123';
      (botConfig as any).payosApiKey = 'api_key_123';
      (botConfig as any).payosChecksumKey = 'checksum_123';

      const mockResponse = {
        code: '00',
        desc: 'success',
        data: {
          bin: '970422',
          accountNumber: '123456789',
          accountName: 'TEST BOT',
          amount: 25000,
          description: 'Donate user',
          orderCode: 999,
          currency: 'VND',
          paymentLinkId: 'link_999',
          status: 'PENDING',
          checkoutUrl: 'https://pay.payos.vn/web/123',
          qrCode: 'vietqr_string',
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = mockFetch as any;

      const res = await createPayosPaymentLink({
        orderCode: 999,
        amount: 25000,
        description: 'Donate user',
      });

      expect(res.success).toBe(true);
      expect(res.data?.checkoutUrl).toBe('https://pay.payos.vn/web/123');

      (botConfig as any).payosClientId = origClientId;
      (botConfig as any).payosApiKey = origApiKey;
      (botConfig as any).payosChecksumKey = origKey;
    });
  });
});
