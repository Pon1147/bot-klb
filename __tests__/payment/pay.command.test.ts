/// <reference types="jest" />
import { MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { data, execute } from '../../src/features/payment/pay.command.js';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import * as settingsModule from '../../src/services/settings.service.js';

describe('pay.command', () => {
  const expectedFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;

  it('cấu trúc command builder phải đúng root name và subcommand create', () => {
    expect(data.name).toBe('pay');
    const json = data.toJSON();
    const createSub = json.options?.find((opt: any) => opt.name === 'create') as any;
    expect(createSub).toBeDefined();
    expect(createSub.options?.find((opt: any) => opt.name === 'amount')).toBeDefined();
    expect(createSub.options?.find((opt: any) => opt.name === 'customer')).toBeDefined();
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
        flags: expectedFlags,
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
        flags: expectedFlags,
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
        flags: expectedFlags,
      }),
    );
  });

  it('báo lỗi khi không thể kết nối cơ sở dữ liệu để tạo hóa đơn', async () => {
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
        getSubcommand: () => 'create',
      },
      reply: mockReply,
      client: { database: null },
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: expectedFlags,
      }),
    );
  });

  it('sinh mã VietQR thành công khi máy chủ đã kích hoạt và cấu hình đầy đủ', async () => {
    const db = new Database(':memory:');
    initializePaymentTables(db);

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

    const mockDeferReply = jest.fn();
    const mockEditReply = jest.fn();
    const interaction: any = {
      guildId: 'guild-authorized',
      guild: { name: 'VIP Server' },
      user: { id: '1475517632848592918' },
      client: { database: db },
      options: {
        getSubcommand: () => 'create',
        getInteger: jest.fn().mockReturnValue(100000),
        getUser: jest.fn().mockReturnValue({ id: '998877665544332211' }),
        getString: jest.fn().mockReturnValue('Mua goi Premium'),
      },
      deferReply: mockDeferReply,
      editReply: mockEditReply,
    };

    await execute(interaction, db);

    expect(mockDeferReply).toHaveBeenCalled();
    expect(mockEditReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('<@998877665544332211>'),
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
