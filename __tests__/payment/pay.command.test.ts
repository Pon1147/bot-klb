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
      user: { id: '111111111111111111' },
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

    const mockReply = jest.fn();
    const mockEditReply = jest.fn().mockResolvedValue(undefined);
    const mockDeferReply = jest.fn().mockImplementation(async () => {
      interaction.deferred = true;
    });

    // Mock global.fetch để diệt open handle gọi mạng thật và trả về mock QR PNG
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: '00',
        data: { qrDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
      }),
    } as any);

    const interaction: any = {
      guildId: 'guild-authorized',
      guild: { name: 'VIP Server', ownerId: '111111111111111111' },
      user: { id: '111111111111111111' },
      member: { permissions: { has: () => true } },
      client: { database: db },
      options: {
        getSubcommand: () => 'create',
        getInteger: jest.fn().mockReturnValue(100000),
        getUser: jest.fn().mockReturnValue({ id: '998877665544332211' }),
        getString: jest.fn().mockReturnValue('Mua goi Premium'),
      },
      deferReply: mockDeferReply,
      deferred: false,
      replied: false,
      editReply: mockEditReply,
      reply: mockReply,
    };

    try {
      await execute(interaction, db);

      // Khẳng định deferReply được gọi để chống interaction timeout 3s
      expect(mockDeferReply).toHaveBeenCalled();

      // Khi đã deferReply, bot dùng editReply để phản hồi
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  content: expect.stringContaining('<@998877665544332211>'),
                }),
                expect.objectContaining({
                  content: expect.stringContaining('100.000 đ'),
                }),
              ]),
            }),
          ]),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('từ chối thành viên thường tạo hóa đơn khi không có quyền Staff/Admin', async () => {
    const testDb = new Database(':memory:');
    initializePaymentTables(testDb);
    const mockReply = jest.fn();
    const interaction: any = {
      guildId: 'guild-authorized',
      guild: { name: 'VIP Server', ownerId: 'other-owner-id' },
      user: { id: 'regular-user-id' },
      member: { permissions: { has: () => false }, roles: { cache: new Map() } },
      client: { database: testDb },
      options: {
        getSubcommand: () => 'create',
        getInteger: jest.fn().mockReturnValue(50000),
      },
      deferred: false,
      replied: false,
      reply: mockReply,
    };

    await execute(interaction, testDb);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('Bạn không có quyền tạo hóa đơn thanh toán'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
