/// <reference types="jest" />
import {
  buildVietQrImageUrl,
  buildVietQrContainer,
  SUPPORTED_BANKS,
} from '../../src/utils/vietqr.utils.js';
import { ComponentType } from 'discord.js';

describe('vietqr.utils', () => {
  describe('buildVietQrImageUrl', () => {
    it('sinh đúng URL ảnh VietQR với các tham số chuẩn', () => {
      const url = buildVietQrImageUrl({
        bankId: 'mb',
        accountNo: '0987654321',
        accountName: 'Nguyen Van A',
        amount: 50000,
        addInfo: 'NAP 123456 ABCD',
      });

      expect(url).toBe(
        'https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=50000&addInfo=NAP%20123456%20ABCD&accountName=Nguyen%20Van%20A',
      );
    });

    it('hỗ trợ tùy chọn template khác như compact hoặc qr_only', () => {
      const url = buildVietQrImageUrl({
        bankId: 'VCB',
        accountNo: '1122334455',
        accountName: 'LE HOANG',
        amount: 100000,
        addInfo: 'TEST',
        template: 'qr_only',
      });

      expect(url).toContain('VCB-1122334455-qr_only.png');
    });
  });

  describe('buildVietQrContainer', () => {
    it('tạo container V2 với MediaGallery chứa URL ảnh QR và TextDisplay thông tin', () => {
      const result = buildVietQrContainer({
        bankId: 'MB',
        accountNo: '0987654321',
        accountName: 'NGUYEN VAN A',
        amount: 50000,
        transferCode: 'NAP 123456 ABCD',
        memo: 'Mua VIP 1 Thang',
        serverName: 'Delta Force VN',
        creatorId: 'user-123',
        customerId: 'user-456',
        attachmentName: 'vietqr.png',
      });

      expect(result.components).toBeDefined();
      const container = (result.components as any[])[0];
      expect(container.type).toBe(ComponentType.Container);

      const textDisplay = container.components.find(
        (c: any) => c.type === ComponentType.TextDisplay,
      );
      expect(textDisplay.content).toContain('MBBank (Quân Đội)');
      expect(textDisplay.content).toContain('0987654321');
      expect(textDisplay.content).toContain('50.000 đ');
      expect(textDisplay.content).toContain('NAP 123456 ABCD');
      expect(textDisplay.content).toContain('Mua VIP 1 Thang');
      expect(textDisplay.content).toContain('<@user-123>');
      expect(textDisplay.content).toContain('<@user-456>');

      const mediaGallery = container.components.find(
        (c: any) => c.type === ComponentType.MediaGallery,
      );
      expect(mediaGallery.items[0].media.url).toBe('attachment://vietqr.png');
    });
  });

  describe('SUPPORTED_BANKS', () => {
    it('chứa các ngân hàng phổ biến tại Việt Nam', () => {
      expect(SUPPORTED_BANKS['MB']).toBeDefined();
      expect(SUPPORTED_BANKS['VCB']).toBeDefined();
      expect(SUPPORTED_BANKS['TCB']).toBeDefined();
      expect(SUPPORTED_BANKS['ACB']).toBeDefined();
    });
  });
});
