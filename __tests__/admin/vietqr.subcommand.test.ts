import { PermissionFlagsBits } from 'discord.js';
import { handleVietQrWorkflow, handleVietQrStatus } from '../../src/features/admin/subcommands/vietqr.subcommand.js';
import * as settingsModule from '../../src/services/settings.service.js';

describe('vietqr.subcommand: handleVietQrWorkflow', () => {
  const guildId = 'guild-test-123';
  let mockSettingsUpdate: jest.Mock;
  let mockSettingsGet: jest.Mock;

  beforeEach(() => {
    mockSettingsUpdate = jest.fn();
    mockSettingsGet = jest.fn().mockReturnValue({
      vietqr: {
        enabled: true,
        bankId: 'MB',
        accountNo: '123456789',
        accountName: 'TEST OWNER',
        prefix: 'NAP',
        template: 'compact2',
      },
    });

    jest.spyOn(settingsModule, 'isQrServerEnabled').mockReturnValue(true);
    jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
      get: mockSettingsGet,
      update: mockSettingsUpdate,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('từ chối nếu người thực thi không phải Guild Owner và không có quyền Administrator', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'other-owner-id' },
      user: { id: 'regular-user-id' },
      member: { permissions: { has: () => false } },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    const replyArg = mockReply.mock.calls[0][0];
    const stringified = JSON.stringify(replyArg);
    expect(stringified).toContain('Bạn không có quyền cấu hình quy trình thanh toán VietQR');
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
  });

  it('từ chối nếu staff_role được chỉ định là role @everyone (id === guildId)', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'owner-user-id' },
      user: { id: 'owner-user-id' },
      member: { permissions: { has: () => true } },
      options: {
        getRole: jest.fn().mockReturnValue({
          id: guildId, // @everyone có ID trùng với guildId
          name: '@everyone',
          managed: false,
        }),
        getChannel: jest.fn().mockReturnValue(null),
        getBoolean: jest.fn().mockReturnValue(null),
        getString: jest.fn().mockReturnValue(null),
      },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    const replyArg = mockReply.mock.calls[0][0];
    const stringified = JSON.stringify(replyArg);
    expect(stringified).toContain('Không thể sử dụng role @everyone hoặc role tích hợp/bot');
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
  });

  it('toàn bộ lệnh bị từ chối và KHÔNG lưu một phần nếu staff_role sai dù gửi kèm feedback_channel và thanks_message', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'owner-user-id' },
      user: { id: 'owner-user-id' },
      member: { permissions: { has: () => true } },
      options: {
        getRole: jest.fn().mockReturnValue({
          id: guildId, // sai: @everyone
          managed: false,
        }),
        getChannel: jest.fn().mockReturnValue({ id: 'channel-feedback-999' }),
        getBoolean: jest.fn().mockReturnValue(true),
        getString: jest.fn().mockReturnValue('Tin nhắn cảm ơn'),
      },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    expect(mockSettingsUpdate).not.toHaveBeenCalled(); // Không được lưu một phần
  });

  it('từ chối nếu staff_role được chỉ định là role managed (role bot / tích hợp)', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'owner-user-id' },
      user: { id: 'owner-user-id' },
      member: { permissions: { has: () => true } },
      options: {
        getRole: jest.fn().mockReturnValue({
          id: 'bot-role-789',
          name: 'BotRole',
          managed: true, // Role do Discord hoặc bot tự động quản lý
        }),
        getChannel: jest.fn().mockReturnValue(null),
        getBoolean: jest.fn().mockReturnValue(null),
        getString: jest.fn().mockReturnValue(null),
      },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    const replyArg = mockReply.mock.calls[0][0];
    const stringified = JSON.stringify(replyArg);
    expect(stringified).toContain('Không thể sử dụng role @everyone hoặc role tích hợp/bot');
    expect(mockSettingsUpdate).not.toHaveBeenCalled();
  });

  it('lưu thành công khi chọn staff_role hợp lệ (không phải @everyone và không managed)', async () => {
    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'owner-user-id' },
      user: { id: 'owner-user-id' },
      member: { permissions: { has: () => true } },
      options: {
        getRole: jest.fn().mockReturnValue({
          id: 'staff-role-valid-999',
          name: 'Staff Duyệt Đơn',
          managed: false,
        }),
        getChannel: jest.fn().mockReturnValue({ id: 'channel-feedback-123' }),
        getBoolean: jest.fn().mockReturnValue(true),
        getString: jest.fn().mockReturnValue('Cảm ơn bạn đã mua hàng!'),
      },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    expect(mockSettingsUpdate).toHaveBeenCalledWith(guildId, {
      vietqr: expect.objectContaining({
        staffRoleId: 'staff-role-valid-999',
        feedbackChannelId: 'channel-feedback-123',
        enableRating: true,
        thanksMessage: 'Cảm ơn bạn đã mua hàng!',
      }),
    });
  });

  it('tự động làm sạch staffRoleId thành null nếu dữ liệu cũ từng lưu @everyone khi người dùng chạy lại workflow cập nhật channel khác', async () => {
    mockSettingsGet.mockReturnValue({
      vietqr: {
        enabled: true,
        bankId: 'MB',
        accountNo: '123456789',
        accountName: 'TEST OWNER',
        prefix: 'NAP',
        template: 'compact2',
        staffRoleId: guildId, // Dữ liệu cũ bị dính @everyone
      },
    });

    const mockReply = jest.fn();
    const interaction: any = {
      guildId,
      guild: { ownerId: 'owner-user-id' },
      user: { id: 'owner-user-id' },
      member: { permissions: { has: () => true } },
      options: {
        getRole: jest.fn().mockReturnValue(null), // Không chọn role mới
        getChannel: jest.fn().mockReturnValue({ id: 'channel-feedback-new' }),
        getBoolean: jest.fn().mockReturnValue(null),
        getString: jest.fn().mockReturnValue(null),
      },
      reply: mockReply,
      replied: false,
      deferred: false,
    };

    await handleVietQrWorkflow(interaction);

    expect(mockReply).toHaveBeenCalled();
    expect(mockSettingsUpdate).toHaveBeenCalledWith(guildId, {
      vietqr: expect.objectContaining({
        staffRoleId: null, // Đã tự động dọn sạch @everyone
        feedbackChannelId: 'channel-feedback-new',
      }),
    });
  });

  describe('handleVietQrStatus', () => {
    it('hiển thị cảnh báo vô hiệu hóa nếu trong database tồn tại dữ liệu cũ lưu staffRoleId là @everyone', async () => {
      mockSettingsGet.mockReturnValue({
        vietqr: {
          enabled: true,
          bankId: 'MB',
          accountNo: '123456789',
          accountName: 'TEST OWNER',
          prefix: 'NAP',
          template: 'compact2',
          staffRoleId: guildId, // Dữ liệu cũ lưu nhầm @everyone
        },
      });

      const mockReply = jest.fn();
      const interaction: any = {
        guildId,
        guild: { ownerId: 'owner-user-id' },
        user: { id: 'owner-user-id' },
        member: { permissions: { has: () => true } },
        reply: mockReply,
        replied: false,
        deferred: false,
      };

      await handleVietQrStatus(interaction);

      expect(mockReply).toHaveBeenCalled();
      const replyArg = mockReply.mock.calls[0][0];
      const stringified = JSON.stringify(replyArg);
      expect(stringified).toContain('@everyone');
      expect(stringified).toContain('Không hợp lệ — hệ thống đã vô hiệu hóa để bảo vệ');
    });
  });
});
