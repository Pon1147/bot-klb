/// <reference types="jest" />
import { data, execute } from '../../src/features/payment/pay.command.js';
import * as settingsModule from '../../src/services/settings.service.js';

describe('pay.command', () => {
  it('cấu trúc command builder phải đúng root name và subcommand create', () => {
    expect(data.name).toBe('pay');
    const json = data.toJSON();
    const createSub = json.options?.find((opt: any) => opt.name === 'create') as any;
    expect(createSub).toBeDefined();
    expect(createSub.options?.find((opt: any) => opt.name === 'amount')).toBeDefined();
    expect(createSub.options?.find((opt: any) => opt.name === 'memo')).toBeDefined();
  });

  it('từ chối khi interaction không nằm trong máy chủ', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId: null,
      guild: null,
      reply: mockReply,
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: 64, // Ephemeral
      }),
    );
  });

  it('từ chối khi máy chủ chưa được Bot Owner kích hoạt QR Premium', async () => {
    jest.spyOn(settingsModule, 'isQrServerEnabled').mockReturnValue(false);

    const mockReply = jest.fn();
    const interaction: any = {
      guildId: 'guild-unauthorized',
      guild: { name: 'Free Server' },
      reply: mockReply,
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: 64,
      }),
    );
  });

  it('báo lỗi khi máy chủ đã mở QR nhưng chưa cấu hình tài khoản ngân hàng', async () => {
    jest.spyOn(settingsModule, 'isQrServerEnabled').mockReturnValue(true);
    jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
      get: jest.fn().mockReturnValue({
        vietqr: { enabled: true, bankId: null, accountNo: null },
      }),
    } as any);

    const mockReply = jest.fn();
    const interaction: any = {
      guildId: 'guild-authorized',
      guild: { name: 'VIP Server' },
      reply: mockReply,
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: 64,
      }),
    );
  });

  it('sinh mã VietQR thành công khi máy chủ đã kích hoạt và cấu hình đầy đủ', async () => {
    jest.spyOn(settingsModule, 'isQrServerEnabled').mockReturnValue(true);
    jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
      get: jest.fn().mockReturnValue({
        vietqr: {
          enabled: true,
          bankId: 'MB',
          accountNo: '0987654321',
          accountName: 'NGUYEN VAN A',
          prefix: 'NAP',
          template: 'compact2',
        },
      }),
    } as any);

    const mockReply = jest.fn();
    const interaction: any = {
      guildId: 'guild-authorized',
      guild: { name: 'VIP Server' },
      user: { id: '1475517632848592918' },
      options: {
        getInteger: jest.fn().mockReturnValue(100000),
        getString: jest.fn().mockReturnValue('Mua goi Premium'),
      },
      reply: mockReply,
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: 64,
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('100.000 đ'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
