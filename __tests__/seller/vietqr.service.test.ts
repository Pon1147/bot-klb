import axios from 'axios';
import {
  normalizeVietQrText,
  normalizeBank,
  fetchBankList,
  getBankList,
  findBank,
  buildVietQrImageUrl,
  generateVietQrBuffer,
  clearBankCache,
} from '../../src/features/seller/services/vietqr.service.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VietQrService', () => {
  beforeEach(() => {
    clearBankCache();
    jest.clearAllMocks();
  });

  describe('normalizeVietQrText', () => {
    it('chuẩn hóa tiếng Việt có dấu thành không dấu', () => {
      expect(normalizeVietQrText('Nguyễn Văn Đức')).toBe('Nguyen Van Duc');
      expect(normalizeVietQrText('Đập Nước Zero')).toBe('Dap Nuoc Zero');
    });

    it('loại bỏ ký tự đặc biệt lạ và khoảng trắng thừa', () => {
      expect(normalizeVietQrText('  Kéo #123 @$$%  game   ')).toBe('Keo 123 game');
    });

    it('hỗ trợ uppercase nếu truyền true', () => {
      expect(normalizeVietQrText('nguyễn văn an', true)).toBe('NGUYEN VAN AN');
    });

    it('xử lý chuỗi rỗng / null / undefined an toàn', () => {
      expect(normalizeVietQrText('')).toBe('');
      expect(normalizeVietQrText(null)).toBe('');
      expect(normalizeVietQrText(undefined)).toBe('');
    });
  });

  describe('normalizeBank', () => {
    it('chuẩn hóa đúng các thuộc tính từ API thô', () => {
      const raw = {
        id: 17,
        name: 'Ngân hàng TMCP Quân Đội',
        code: 'MB',
        bin: '970422',
        shortName: 'MBBank',
        logo: 'https://api.vietqr.io/img/MB.png',
        transferSupported: 1,
        lookupSupported: 1,
      };

      const result = normalizeBank(raw);
      expect(result.bin).toBe('970422');
      expect(result.shortName).toBe('MBBank');
      expect(result.code).toBe('MB');
      expect(result.transferSupported).toBe(1);
    });
  });

  describe('fetchBankList & getBankList', () => {
    const mockBanksData = {
      code: '00',
      desc: 'success',
      data: [
        {
          id: 1,
          name: 'Ngân hàng Ngoại Thương Việt Nam',
          code: 'VCB',
          bin: '970436',
          shortName: 'Vietcombank',
        },
        {
          id: 2,
          name: 'Ngân hàng TMCP Quân Đội',
          code: 'MB',
          bin: '970422',
          shortName: 'MBBank',
        },
      ],
    };

    it('tải danh sách ngân hàng thành công', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockBanksData });

      const list = await fetchBankList();
      expect(list).toHaveLength(2);
      expect(list[0].bin).toBe('970436');
      expect(list[1].bin).toBe('970422');
    });

    it('ném lỗi nếu API VietQR trả về code khác 00', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { code: '99', desc: 'Internal error' },
      });

      await expect(fetchBankList()).rejects.toThrow('Internal error');
    });

    it('cache danh sách ngân hàng cho các lần gọi tiếp theo', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockBanksData });

      const list1 = await getBankList();
      const list2 = await getBankList();

      expect(list1).toHaveLength(2);
      expect(list2).toHaveLength(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('forceRefresh sẽ gọi lại API bất kể cache', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockBanksData });

      await getBankList();
      await getBankList(true);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('findBank', () => {
    beforeEach(() => {
      mockedAxios.get.mockResolvedValue({
        data: {
          code: '00',
          data: [
            { bin: '970436', code: 'VCB', shortName: 'Vietcombank' },
            { bin: '970422', code: 'MB', shortName: 'MBBank' },
          ],
        },
      });
    });

    it('tìm được ngân hàng theo BIN', async () => {
      const bank = await findBank('970422');
      expect(bank?.shortName).toBe('MBBank');
    });

    it('tìm được ngân hàng theo Code', async () => {
      const bank = await findBank('vcb');
      expect(bank?.bin).toBe('970436');
    });

    it('tìm được ngân hàng theo ShortName', async () => {
      const bank = await findBank('mbbank');
      expect(bank?.bin).toBe('970422');
    });

    it('trả về null nếu không tìm thấy', async () => {
      const bank = await findBank('NONEXISTENT');
      expect(bank).toBeNull();
    });
  });

  describe('buildVietQrImageUrl', () => {
    it('sinh đúng link ảnh VietQR với các tham số', () => {
      const url = buildVietQrImageUrl({
        bankCode: '970422',
        accountNumber: '0987654321',
        accountName: 'Nguyễn Văn A',
        amount: 150000,
        addInfo: 'TX123456',
        template: 'compact2',
      });

      expect(url).toContain('https://img.vietqr.io/image/970422-0987654321-compact2.png');
      expect(url).toContain('amount=150000');
      expect(url).toContain('addInfo=TX123456');
      expect(url).toContain('accountName=NGUYEN%20VAN%20A');
    });
  });

  describe('generateVietQrBuffer', () => {
    it('fetch ảnh thành buffer thành công', async () => {
      const fakeBuffer = Buffer.from('fake-png-data');
      mockedAxios.get.mockResolvedValueOnce({
        data: fakeBuffer,
      });

      const buffer = await generateVietQrBuffer({
        bankCode: '970422',
        accountNumber: '0987654321',
        accountName: 'NGUYEN VAN A',
        amount: 150000,
        addInfo: 'TX123',
      });

      expect(buffer).toEqual(fakeBuffer);
    });
  });
});

