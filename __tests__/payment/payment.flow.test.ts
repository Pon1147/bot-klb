import { MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import {
  buildPaymentActionRow,
  buildRatingButtons,
  isPaymentButton,
  isPaymentModal,
  isFeedbackRateButton,
  isFeedbackModal,
  canManagePayment,
  handlePaymentButton,
  handlePaymentModal,
  handleFeedbackRateButton,
  handleFeedbackModal,
} from '../../src/features/payment/payment-flow.js';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import { createPayment, getPaymentById } from '../../src/features/payment/payment.service.js';
import * as settingsModule from '../../src/services/settings.service.js';

describe('payment.flow', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializePaymentTables(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Utility Builders & Matchers', () => {
    it('nhận diện chính xác regex customId của buttons và modals', () => {
      expect(isPaymentButton('pay_confirm_TX123_112233445566778899')).toBe(true);
      expect(isPaymentButton('pay_cancel_TX123_112233445566778899')).toBe(true);
      expect(isPaymentButton('other_button')).toBe(false);

      expect(isPaymentModal('pay_modal_confirm_session123')).toBe(true);
      expect(isPaymentModal('pay_modal_cancel_session123')).toBe(true);
      expect(isPaymentModal('other_modal')).toBe(false);

      expect(isFeedbackRateButton('feedback_rate_5_TX123_112233445566778899')).toBe(true);
      expect(isFeedbackRateButton('feedback_rate_1_TX123_112233445566778899')).toBe(true);
      expect(isFeedbackRateButton('feedback_rate_6_TX123_112233445566778899')).toBe(false);

      expect(isFeedbackModal('feedback_modal_session123')).toBe(true);
      expect(isFeedbackModal('other_modal')).toBe(false);
    });

    it('buildPaymentActionRow và buildRatingButtons sinh đúng components', () => {
      const row = buildPaymentActionRow('TX1', 'buyer1');
      expect(row.components).toHaveLength(2);
      expect(row.components[0].data.label).toContain('Xác nhận');
      expect(row.components[1].data.label).toContain('Hủy');

      const ratingRow = buildRatingButtons('TX1', 'buyer1');
      expect(ratingRow.components).toHaveLength(5);
    });
  });

  describe('canManagePayment Permissions', () => {
    it('cho phép Guild Owner hoặc Admin Discord duyệt thanh toán', () => {
      const ownerInteraction: any = {
        guild: { ownerId: 'user-owner' },
        user: { id: 'user-owner' },
        member: { permissions: { has: () => false }, roles: { cache: new Map() } },
      };
      expect(canManagePayment(ownerInteraction, 'guild-1')).toBe(true);

      const adminInteraction: any = {
        guild: { ownerId: 'user-owner' },
        user: { id: 'user-admin' },
        member: { permissions: { has: () => true }, roles: { cache: new Map() } },
      };
      expect(canManagePayment(adminInteraction, 'guild-1')).toBe(true);
    });

    it('cho phép Staff có role cấu hình trong vietqr.staffRoleId của máy chủ', () => {
      jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
        get: jest.fn().mockReturnValue({
          vietqr: { staffRoleId: 'staff-role-vip' },
          rbac: {},
        }),
      } as any);

      const staffInteraction: any = {
        guild: { ownerId: 'other-owner' },
        user: { id: 'user-staff' },
        member: {
          permissions: { has: () => false },
          roles: { cache: new Map([['staff-role-vip', true]]) },
        },
      };

      expect(canManagePayment(staffInteraction, 'guild-1')).toBe(true);
    });

    it('từ chối member thường không có quyền và không có staff role', () => {
      jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
        get: jest.fn().mockReturnValue({
          vietqr: { staffRoleId: 'staff-role-vip' },
          rbac: {},
        }),
      } as any);

      const regularInteraction: any = {
        guild: { ownerId: 'other-owner' },
        user: { id: 'user-regular' },
        member: {
          permissions: { has: () => false },
          roles: { cache: new Map([['regular-role', true]]) },
        },
      };

      expect(canManagePayment(regularInteraction, 'guild-1')).toBe(false);
    });
  });

  describe('Interactive Handlers', () => {
    it('handlePaymentButton mở Modal khi Staff bấm Xác nhận', async () => {
      createPayment(db, {
        id: 'TX_FLOW_1',
        guild_id: 'guild-1',
        buyer_id: '112233445566778899',
        seller_id: 'seller-1',
        amount: 50000,
        description: 'Test flow',
        status: 'pending',
        created_at: Date.now(),
      });

      const mockShowModal = jest.fn();
      const interaction: any = {
        customId: 'pay_confirm_TX_FLOW_1_112233445566778899',
        guildId: 'guild-1',
        guild: { ownerId: 'user-admin' },
        user: { id: 'user-admin' },
        member: { permissions: { has: () => true }, roles: { cache: new Map() } },
        channelId: 'channel-1',
        message: { id: 'msg-1' },
        client: { database: db },
        showModal: mockShowModal,
      };

      await handlePaymentButton(interaction, db);
      expect(mockShowModal).toHaveBeenCalled();
    });

    it('handlePaymentModal cập nhật trạng thái hóa đơn và gửi lời cảm ơn', async () => {
      createPayment(db, {
        id: 'TX_FLOW_2',
        guild_id: 'guild-1',
        buyer_id: '112233445566778899',
        seller_id: 'seller-1',
        amount: 100000,
        description: 'Đơn hoàn tất',
        status: 'pending',
        created_at: Date.now(),
      });

      // Bấm nút trước để tạo session
      const mockShowModal = jest.fn();
      const btnInteraction: any = {
        customId: 'pay_confirm_TX_FLOW_2_112233445566778899',
        guildId: 'guild-1',
        guild: { ownerId: 'user-admin' },
        user: { id: 'user-admin' },
        member: { permissions: { has: () => true }, roles: { cache: new Map() } },
        channelId: 'channel-1',
        message: { id: 'msg-1' },
        client: { database: db },
        showModal: mockShowModal,
      };
      await handlePaymentButton(btnInteraction, db);

      const modalArg = mockShowModal.mock.calls[0][0];
      const sessionId = modalArg.data.custom_id.replace('pay_modal_confirm_', '');

      // Submit modal
      const mockSourceMsgEdit = jest.fn();
      const mockChannelSend = jest.fn();
      const mockDeferReply = jest.fn();
      const mockEditReply = jest.fn();

      const modalInteraction: any = {
        customId: `pay_modal_confirm_${sessionId}`,
        user: { id: 'user-admin' },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Đã check banking Vietcombank'),
        },
        deferReply: mockDeferReply,
        editReply: mockEditReply,
        client: {
          database: db,
          channels: {
            fetch: jest.fn().mockResolvedValue({
              isTextBased: () => true,
              send: mockChannelSend,
              messages: {
                fetch: jest.fn().mockResolvedValue({
                  edit: mockSourceMsgEdit,
                }),
              },
            }),
          },
        },
      };

      await handlePaymentModal(modalInteraction, db);

      expect(mockDeferReply).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Đã xác nhận thành công') }),
      );

      const tx = getPaymentById(db, 'TX_FLOW_2');
      expect(tx?.status).toBe('confirmed');
      expect(tx?.note).toBe('Đã check banking Vietcombank');
      expect(mockSourceMsgEdit).toHaveBeenCalled();

      // Kiểm tra tuân thủ Discord Components V2: không chứa legacy content và embeds
      const editCallArg = mockSourceMsgEdit.mock.calls[0][0];
      expect(editCallArg.content).toBeUndefined();
      expect(editCallArg.embeds).toBeUndefined();
      expect(editCallArg.flags).toBe(MessageFlags.IsComponentsV2);
      expect(editCallArg.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 17, // ComponentType.Container
          }),
        ]),
      );

      expect(mockChannelSend).toHaveBeenCalled(); // Rating buttons sent
    });

    it('handlePaymentModal khi Cancel cũng cập nhật qua Components V2 không có legacy fields', async () => {
      createPayment(db, {
        id: 'TX_FLOW_CANCEL',
        guild_id: 'guild-1',
        buyer_id: '112233445566778899',
        seller_id: 'seller-1',
        amount: 200000,
        description: 'Đơn bị hủy',
        status: 'pending',
        created_at: Date.now(),
      });

      const mockShowModal = jest.fn();
      const btnInteraction: any = {
        customId: 'pay_cancel_TX_FLOW_CANCEL_112233445566778899',
        guildId: 'guild-1',
        guild: { ownerId: 'user-admin' },
        user: { id: 'user-admin' },
        member: { permissions: { has: () => true }, roles: { cache: new Map() } },
        channelId: 'channel-1',
        message: { id: 'msg-1' },
        client: { database: db },
        showModal: mockShowModal,
      };
      await handlePaymentButton(btnInteraction, db);

      const modalArg = mockShowModal.mock.calls[0][0];
      const sessionId = modalArg.data.custom_id.replace('pay_modal_cancel_', '');

      const mockSourceMsgEdit = jest.fn();
      const mockDeferReply = jest.fn();
      const mockEditReply = jest.fn();

      const modalInteraction: any = {
        customId: `pay_modal_cancel_${sessionId}`,
        user: { id: 'user-admin' },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Khách đổi ý không mua nữa'),
        },
        deferReply: mockDeferReply,
        editReply: mockEditReply,
        client: {
          database: db,
          channels: {
            fetch: jest.fn().mockResolvedValue({
              isTextBased: () => true,
              send: jest.fn(),
              messages: {
                fetch: jest.fn().mockResolvedValue({
                  edit: mockSourceMsgEdit,
                }),
              },
            }),
          },
        },
      };

      await handlePaymentModal(modalInteraction, db);

      const tx = getPaymentById(db, 'TX_FLOW_CANCEL');
      expect(tx?.status).toBe('cancelled');
      expect(tx?.note).toBe('Khách đổi ý không mua nữa');

      const editCallArg = mockSourceMsgEdit.mock.calls[0][0];
      expect(editCallArg.content).toBeUndefined();
      expect(editCallArg.embeds).toBeUndefined();
      expect(editCallArg.flags).toBe(MessageFlags.IsComponentsV2);
      expect(editCallArg.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 17, // ComponentType.Container
          }),
        ]),
      );
    });

    it('handleFeedbackRateButton từ chối đánh giá trùng lặp trực tiếp từ database', async () => {
      createPayment(db, {
        id: 'TX_FB_DEDUP',
        guild_id: 'guild-1',
        buyer_id: '112233445566778899',
        seller_id: 'seller_111',
        amount: 50000,
        description: 'Test FB',
        status: 'confirmed',
        created_at: Date.now(),
      });

      // Giả lập đã có feedback trong DB từ trước
      db.prepare(
        'INSERT INTO payment_feedback (tx_id, guild_id, buyer_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('TX_FB_DEDUP', 'guild-1', '112233445566778899', 5, 'Rất tốt', Date.now());

      const mockReply = jest.fn();
      const interaction: any = {
        customId: 'feedback_rate_5_TX_FB_DEDUP_112233445566778899',
        user: { id: '112233445566778899' },
        reply: mockReply,
        client: { database: db },
      };

      await handleFeedbackRateButton(interaction, db);

      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Bạn đã gửi đánh giá cho đơn hàng này rồi'),
        }),
      );
    });
  });
});
