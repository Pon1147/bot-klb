import Database from 'better-sqlite3';
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import {
  handleSelectBankButton,
  handleBankSelectMenu,
  handleEditInfoButton,
  handleSellerInfoModalSubmit,
  handleDeleteQrButton,
} from '../../src/features/seller/handlers/seller-qr.handler.js';
import {
  handlePaymentConfirmButton,
  handlePaymentConfirmModalSubmit,
  handlePaymentCancelButton,
  handlePaymentCancelModalSubmit,
} from '../../src/features/seller/handlers/seller-pay.handler.js';
import {
  handleRateStarButton,
  handleRateModalSubmit,
} from '../../src/features/seller/handlers/seller-rate.handler.js';
import {
  initializeSellerTables,
  SellerDatabase,
  setSellerDb,
} from '../../src/database/seller.db.js';
import { initializeSettingsTable } from '../../src/database/guild.settings.db.js';
import * as vietqrService from '../../src/features/seller/services/vietqr.service.js';

jest.mock('../../src/features/seller/services/vietqr.service.js', () => ({
  ...jest.requireActual('../../src/features/seller/services/vietqr.service.js'),
  getBankList: jest.fn().mockResolvedValue([
    { bin: '970422', shortName: 'MBBank', name: 'Ngan hang Quan Doi' },
    { bin: '970436', shortName: 'Vietcombank', name: 'Ngan hang Ngoai Thuong' },
  ]),
}));

import {
  SettingsService,
  setSettingsService,
} from '../../src/services/settings.service.js';

function createMockInteractionContext(options: {
  userId: string;
  guildId?: string;
  isAdmin?: boolean;
  userRoles?: string[];
}) {
  const rolesMap = new Map<string, { id: string; name: string }>();
  (options.userRoles || []).forEach((r) => rolesMap.set(r, { id: r, name: r }));

  const user = { id: options.userId, tag: `User#${options.userId}` };
  const member = {
    id: options.userId,
    user,
    permissions: {
      has: jest.fn().mockReturnValue(Boolean(options.isAdmin)),
    },
    roles: { cache: rolesMap },
  };
  const memberPermissions = {
    has: jest.fn().mockReturnValue(Boolean(options.isAdmin)),
  };
  const guild = {
    id: options.guildId || 'guild-123',
    ownerId: 'owner-999',
    members: {
      cache: new Map([[options.userId, member]]),
      fetch: jest.fn().mockImplementation((id: string) => {
        if (id === options.userId) return Promise.resolve(member);
        return Promise.resolve({
          id,
          roles: { cache: new Map() },
        });
      }),
    },
  };

  return { user, member, memberPermissions, guild, guildId: guild.id };
}

describe('Seller Handlers', () => {
  let db: Database.Database;
  let sellerDb: SellerDatabase;
  let settingsService: SettingsService;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSettingsTable(db);
    initializeSellerTables(db);
    sellerDb = new SellerDatabase(db);
    setSellerDb(sellerDb);

    settingsService = new SettingsService(db);
    setSettingsService(settingsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    db.close();
    setSellerDb(null);
  });

  describe('Seller QR Handlers', () => {
    it('handleSelectBankButton chặn người không có quyền', async () => {
      const ctx = createMockInteractionContext({ userId: 'other-user', isAdmin: false });
      const interaction = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleSelectBankButton(interaction, 'target-seller');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Bạn không có quyền chỉnh sửa cấu hình QR'),
        }),
      );
    });

    it('handleSelectBankButton chặn chính chủ nếu server đã cấu hình role mà user không sở hữu role', async () => {
      settingsService.updateSeller('guild-123', { roleId: 'role-pro-seller' });
      const ctx = createMockInteractionContext({
        userId: 'seller-1',
        isAdmin: false,
        userRoles: ['other-role'],
      });
      const interaction = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleSelectBankButton(interaction, 'seller-1');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Bạn cần có role Thợ Kéo'),
        }),
      );
    });

    it('handleSelectBankButton gửi select menu ngân hàng cho chính chủ có role Thợ Kéo', async () => {
      settingsService.updateSeller('guild-123', { roleId: 'role-pro-seller' });
      const ctx = createMockInteractionContext({
        userId: 'seller-1',
        isAdmin: false,
        userRoles: ['role-pro-seller'],
      });
      const interaction = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleSelectBankButton(interaction, 'seller-1');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chọn ngân hàng thụ hưởng'),
          components: expect.any(Array),
        }),
      );
    });

    it('handleBankSelectMenu mở modal nhập STK', async () => {
      const ctx = createMockInteractionContext({ userId: 'seller-1' });
      const interaction = {
        ...ctx,
        values: ['970422|MBBank'],
        showModal: jest.fn().mockResolvedValue(undefined),
      } as unknown as StringSelectMenuInteraction;

      await handleBankSelectMenu(interaction, 'seller-1');

      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('handleSellerInfoModalSubmit lưu STK vào SQLite và cập nhật UI', async () => {
      const ctx = createMockInteractionContext({ userId: 'seller-1' });
      const interaction = {
        ...ctx,
        fields: {
          getTextInputValue: jest.fn().mockImplementation((id: string) => {
            if (id === 'seller_qr_input_account') return '0123456789';
            if (id === 'seller_qr_input_name') return 'nguyen van a';
            return '';
          }),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        message: {
          editable: true,
          edit: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as ModalSubmitInteraction;

      await handleSellerInfoModalSubmit(interaction, 'seller-1', '970422', 'MBBank');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã lưu thông tin tài khoản ngân hàng VietQR thành công!'),
        }),
      );

      const profile = sellerDb.getProfile('seller-1', 'guild-123');
      expect(profile?.accountNumber).toBe('0123456789');
      expect(profile?.accountName).toBe('NGUYEN VAN A');
    });

    it('handleDeleteQrButton xóa QR và cập nhật UI', async () => {
      sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-123',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '0123456789',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      const ctx = createMockInteractionContext({ userId: 'seller-1' });
      const interaction = {
        ...ctx,
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleDeleteQrButton(interaction, 'seller-1');

      expect(sellerDb.getProfile('seller-1', 'guild-123')).toBeNull();
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });
  });

  describe('Seller Pay Handlers (Confirm & Cancel)', () => {
    beforeEach(() => {
      sellerDb.createTransaction({
        txId: 'TX-TEST-1',
        guildId: 'guild-123',
        channelId: 'ch-1',
        messageId: 'msg-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 200000,
        description: 'Kéo Đập Nước',
        status: 'pending',
        note: null,
        processedBy: null,
        createdAt: Date.now(),
        processedAt: null,
      });
    });

    it('handlePaymentConfirmButton mở modal xác nhận cho thợ kéo', async () => {
      const ctx = createMockInteractionContext({ userId: 'seller-1' });
      const interaction = {
        ...ctx,
        showModal: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handlePaymentConfirmButton(interaction, 'TX-TEST-1');
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('handlePaymentConfirmButton chặn người không phải thợ kéo/admin', async () => {
      const ctx = createMockInteractionContext({ userId: 'stranger-1', isAdmin: false });
      const interaction = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handlePaymentConfirmButton(interaction, 'TX-TEST-1');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ có thợ kéo của đơn này hoặc Quản trị viên'),
        }),
      );
    });

    it('handlePaymentConfirmModalSubmit cập nhật đơn thành confirmed và gửi prompt đánh giá', async () => {
      const ctx = createMockInteractionContext({ userId: 'seller-1' });
      const interaction = {
        ...ctx,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Đã nhận tiền qua app'),
        },
        message: {
          editable: true,
          edit: jest.fn().mockResolvedValue(undefined),
        },
        channel: {
          send: jest.fn().mockResolvedValue(undefined),
        },
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ModalSubmitInteraction;

      await handlePaymentConfirmModalSubmit(interaction, 'TX-TEST-1');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã xác nhận thành công đơn'),
        }),
      );

      const tx = sellerDb.getTransaction('TX-TEST-1');
      expect(tx?.status).toBe('confirmed');
      expect(tx?.note).toBe('Đã nhận tiền qua app');
      expect(interaction.channel?.send).toHaveBeenCalled();
    });

    it('handlePaymentCancelModalSubmit cập nhật đơn thành cancelled', async () => {
      const ctx = createMockInteractionContext({ userId: 'buyer-1' });
      const interaction = {
        ...ctx,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Khách bận đột xuất'),
        },
        message: {
          editable: true,
          edit: jest.fn().mockResolvedValue(undefined),
        },
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ModalSubmitInteraction;

      await handlePaymentCancelModalSubmit(interaction, 'TX-TEST-1');

      const tx = sellerDb.getTransaction('TX-TEST-1');
      expect(tx?.status).toBe('cancelled');
      expect(tx?.note).toBe('Khách bận đột xuất');
    });
  });

  describe('Seller Rate Handlers', () => {
    beforeEach(() => {
      sellerDb.createTransaction({
        txId: 'TX-R-1',
        guildId: 'guild-123',
        channelId: 'ch-1',
        messageId: 'msg-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 200000,
        description: 'Kéo Đập Nước',
        status: 'confirmed',
        note: 'Xong',
        processedBy: 'seller-1',
        createdAt: Date.now(),
        processedAt: Date.now(),
      });
    });

    it('handleRateStarButton chặn nếu không phải buyer của đơn', async () => {
      const ctx = createMockInteractionContext({ userId: 'other-user' });
      const interaction = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleRateStarButton(interaction, 5, 'TX-R-1');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ người mua (khách hàng) của đơn này mới có quyền gửi đánh giá'),
        }),
      );
    });

    it('handleRateStarButton mở modal khi buyer bấm sao', async () => {
      const ctx = createMockInteractionContext({ userId: 'buyer-1' });
      const interaction = {
        ...ctx,
        showModal: jest.fn().mockResolvedValue(undefined),
      } as unknown as ButtonInteraction;

      await handleRateStarButton(interaction, 5, 'TX-R-1');
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('handleRateModalSubmit lưu đánh giá vào SQLite', async () => {
      const ctx = createMockInteractionContext({ userId: 'buyer-1' });
      const interaction = {
        ...ctx,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('Kéo rất uy tín, nhiệt tình'),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        message: {
          editable: true,
          edit: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as ModalSubmitInteraction;

      await handleRateModalSubmit(interaction, 5, 'TX-R-1');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Cảm ơn bạn đã gửi đánh giá **5 ⭐**'),
        }),
      );

      const review = sellerDb.getReviewByTxId('TX-R-1');
      expect(review).not.toBeNull();
      expect(review?.rating).toBe(5);
      expect(review?.comment).toBe('Kéo rất uy tín, nhiệt tình');
    });
  });
});

