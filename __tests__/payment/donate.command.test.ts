import { data, execute } from '../../src/features/payment/donate.command.js';
import * as payosService from '../../src/services/payos.service.js';

describe('donate.command', () => {
  it('cấu trúc command builder phải đúng root name donate và options', () => {
    expect(data.name).toBe('donate');
    const json = data.toJSON();
    expect(json.options?.find((opt: any) => opt.name === 'amount')).toBeDefined();
    expect(json.options?.find((opt: any) => opt.name === 'message')).toBeDefined();
  });

  it('báo lỗi khi PayOS chưa được cấu hình API Key', async () => {
    jest.spyOn(payosService, 'isPayosConfigured').mockReturnValue(false);

    const mockReply = jest.fn();
    const interaction: any = {
      reply: mockReply,
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('chưa được kích hoạt hoặc chưa cấu hình'),
        ephemeral: true,
      }),
    );
  });

  it('tạo link quyên góp PayOS thành công và trả về embed cùng link button', async () => {
    jest.spyOn(payosService, 'isPayosConfigured').mockReturnValue(true);
    jest.spyOn(payosService, 'createPayosPaymentLink').mockResolvedValue({
      success: true,
      data: {
        bin: '970422',
        accountNumber: '0987654321',
        accountName: 'BOT OWNER',
        amount: 50000,
        description: 'Donate Friend',
        orderCode: 177000,
        currency: 'VND',
        paymentLinkId: 'plink_1',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/plink_1',
        qrCode: 'vietqr_string',
      },
    });

    const mockDeferReply = jest.fn();
    const mockEditReply = jest.fn();

    const interaction: any = {
      user: {
        id: 'user_123',
        tag: 'User#1234',
        globalName: 'User VIP',
        displayAvatarURL: () => 'https://avatar.url',
      },
      guildId: 'guild_1',
      options: {
        getInteger: jest.fn().mockReturnValue(50000),
        getString: jest.fn().mockReturnValue('Yêu quý bot!'),
      },
      deferReply: mockDeferReply,
      editReply: mockEditReply,
      client: { database: null },
    };

    await execute(interaction);

    expect(mockDeferReply).toHaveBeenCalled();
    expect(mockEditReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Buy Me A Coffee'),
            }),
          }),
        ]),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  label: '☕ Mở Trang Thanh Toán PayOS',
                  url: 'https://pay.payos.vn/web/plink_1',
                }),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
