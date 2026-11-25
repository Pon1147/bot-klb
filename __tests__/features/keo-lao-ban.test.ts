import Database from 'better-sqlite3';
import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import {
  initializeKeoTable,
  createKeoOrder,
  getKeoOrderById,
  getActiveKeoOrderByTicket,
  claimKeoOrder,
  updateKeoOrderStatus,
  updateKeoMessageIds,
  KeoOrderRecord,
} from '../../src/database/keo.db.js';
import {
  buildTicketWelcomeCard,
  buildOpenOrderModal,
  buildDispatchCard,
  buildTicketOrderCard,
  buildRatingCard,
  formatVnd,
} from '../../src/features/keo-lao-ban/keo.builder.js';
import {
  handleKeoButton,
  handleKeoModal,
} from '../../src/features/keo-lao-ban/keo.handler.js';
import { execute as handleChannelCreate, welcomedChannels } from '../../src/events/channelCreate.event.js';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import { initializeSubscriptionTables } from '../../src/database/subscription.db.js';
import { SettingsService, setSettingsService } from '../../src/services/settings.service.js';
import { defaultGuildSettings } from '../../src/config/default.settings.js';

describe('Feature: Kéo Lão Bản (Delta Force Carry Service)', () => {
  let db: Database.Database;
  let mockSettingsService: any;

  beforeEach(() => {
    welcomedChannels.clear();
    db = new Database(':memory:');
    initializeKeoTable(db);
    initializePaymentTables(db);
    initializeSubscriptionTables(db);

    // Kích hoạt hạn bản quyền cho guild-1 và guild-no-qr để test happy path
    const activeExpiry = Date.now() + 30 * 86_400_000;
    const now = Date.now();
    const insertSub = db.prepare(
      `INSERT INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
    );
    insertSub.run('guild-1', activeExpiry, now, now);
    insertSub.run('guild-no-qr', activeExpiry, now, now);

    mockSettingsService = {
      get: jest.fn().mockReturnValue({
        ...defaultGuildSettings,
        vietqr: {
          enabled: true,
          bankId: 'VCB',
          accountNo: '0461000644931',
          accountName: 'LE PHUOC DIEN KHOA',
          prefix: 'NAP',
          template: 'compact2',
        },
        keo: {
          enabled: true,
          ticketCategoryId: 'cat-123',
          dispatchChannelId: 'chan-dispatch-456',
          workerRoleId: 'role-worker-789',
          tier1RoleId: 'role-vip1-111',
          tier2RoleId: 'role-vip2-222',
          tier3RoleId: 'role-vip3-333',
        },
      }),
      update: jest.fn(),
    };

    setSettingsService(mockSettingsService as unknown as SettingsService);
  });

  afterEach(() => {
    db.close();
  });

  describe('Database Layer: keo.db', () => {
    it('Tạo, truy vấn và cập nhật đơn kéo chính xác', () => {
      const order: KeoOrderRecord = {
        id: 'ORDER123',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Space City 2h',
        amount: 300000,
        note: 'Kéo buổi tối',
        worker_id: null,
        status: 'OPEN',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };

      createKeoOrder(db, order);
      const fetched = getKeoOrderById(db, 'ORDER123');
      expect(fetched).toBeDefined();
      expect(fetched?.package_name).toBe('Space City 2h');
      expect(fetched?.amount).toBe(300000);

      const active = getActiveKeoOrderByTicket(db, 'ticket-1');
      expect(active?.id).toBe('ORDER123');

      // Atomic claim
      const claim1 = claimKeoOrder(db, 'ORDER123', 'worker-1');
      expect(claim1).toBe(true);

      // Claim lần 2 thất bại vì đơn đã CLAIMED
      const claim2 = claimKeoOrder(db, 'ORDER123', 'worker-2');
      expect(claim2).toBe(false);

      // Cập nhật status
      updateKeoOrderStatus(db, 'ORDER123', 'PAID');
      expect(getKeoOrderById(db, 'ORDER123')?.status).toBe('PAID');

      // Cập nhật message IDs
      updateKeoMessageIds(db, 'ORDER123', 'dispatch-msg-1', 'ticket-msg-1');
      const updated = getKeoOrderById(db, 'ORDER123');
      expect(updated?.dispatch_message_id).toBe('dispatch-msg-1');
      expect(updated?.ticket_message_id).toBe('ticket-msg-1');
    });
  });

  describe('Builder Layer: keo.builder', () => {
    it('buildTicketWelcomeCard: tạo thẻ chào mừng trong ticket với nút Mở Đơn Kéo', () => {
      const card = buildTicketWelcomeCard('ticket-999');
      expect(card.flags).toBe(MessageFlags.IsComponentsV2);
      expect(card.components).toHaveLength(1);
      expect(card.components[0].type).toBe(ComponentType.Container);
      expect(card.components[0].components[0].content).toContain('Dịch Vụ Kéo Delta Force');
      expect(card.components[0].components[2].accessory.custom_id).toBe('keo:open_modal:ticket-999');
      expect(card.components[0].components[2].accessory.style).toBe(ButtonStyle.Primary);
    });

    it('buildOpenOrderModal: tạo modal nhập gói kéo và số tiền', () => {
      const modal = buildOpenOrderModal('ticket-999', 'cust-888', 'Dona');
      expect(modal.data.custom_id).toBe('keo_modal:create:ticket-999:cust-888');
      expect(modal.data.title).toBe('Thiết Lập Đơn Kéo Lão Bản');
      expect(modal.components).toHaveLength(4);
    });

    it('buildDispatchCard: hiển thị nút [Nhận Kèo] khi OPEN và nút [Báo Cáo Xong] khi CLAIMED', () => {
      const baseOrder: KeoOrderRecord = {
        id: 'ORDER999',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Tháp Zero',
        amount: 500000,
        note: null,
        worker_id: null,
        status: 'OPEN',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };

      const openCard = buildDispatchCard(baseOrder);
      expect(openCard.components).toHaveLength(1);
      expect(openCard.components[0].components[0].accessory.custom_id).toBe('keo:claim:ORDER999');
      expect(openCard.components[0].components[0].accessory.label).toContain('Nhận Kèo');

      const claimedCard = buildDispatchCard({ ...baseOrder, status: 'CLAIMED', worker_id: 'worker-1' });
      expect(claimedCard.components).toHaveLength(1);
      expect(claimedCard.components[0].components[0].accessory.custom_id).toBe('keo:worker_done:ORDER999');
      expect(claimedCard.components[0].components[0].accessory.label).toContain('Báo Cáo Xong');
    });

    it('buildTicketOrderCard: hiển thị thông tin ngân hàng và nút Duyệt Tiền cho Owner khi CLAIMED', () => {
      const order: KeoOrderRecord = {
        id: 'ORDER888',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Space City',
        amount: 300000,
        note: null,
        worker_id: 'worker-1',
        status: 'CLAIMED',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };

      const card = buildTicketOrderCard(
        order,
        { bankId: 'VCB', accountNo: '1234567890', accountName: 'NGUYEN VAN A' },
        true,
      );
      expect(card.components).toHaveLength(1);
      const inner = card.components[0].components;
      const bankSection = inner.find((c: any) =>
        c.content?.includes('Thông Tin Chuyển Khoản Ngân Hàng'),
      );
      expect(bankSection).toBeDefined();
      expect(bankSection.content).toContain('VCB');
      expect(bankSection.content).toContain('1234567890');
      expect(bankSection.content).toContain('KEO DER888');

      const confirmSection = inner.find((c: any) =>
        c.accessory?.custom_id?.startsWith('keo:confirm_pay:'),
      );
      expect(confirmSection).toBeDefined();
      expect(confirmSection.accessory.label).toContain('Đã Nhận Tiền');
    });

    it('buildRatingCard: tạo 5 nút đánh giá sao cho khách', () => {
      const order: KeoOrderRecord = {
        id: 'ORDER777',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Space City',
        amount: 300000,
        note: null,
        worker_id: 'worker-1',
        status: 'COMPLETED',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };

      const ratingCard = buildRatingCard(order);
      expect(ratingCard.components[1].components).toHaveLength(5);
      expect(ratingCard.components[1].components[4].custom_id).toBe('keo:rate:ORDER777:5');
    });
  });

  describe('Handler Layer: keo.handler', () => {
    it('handleKeoButton claim: Từ chối người không có role thợ kéo', async () => {
      const order: KeoOrderRecord = {
        id: 'ORD01',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Gói 1',
        amount: 100000,
        note: null,
        worker_id: null,
        status: 'OPEN',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };
      createKeoOrder(db, order);

      const interaction: any = {
        customId: 'keo:claim:ORD01',
        guild: { id: 'guild-1', ownerId: 'owner-1' },
        user: { id: 'stranger-1' },
        member: {
          id: 'stranger-1',
          guild: { id: 'guild-1', ownerId: 'owner-1' },
          roles: { cache: new Map() },
          permissions: { has: jest.fn().mockReturnValue(false) },
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleKeoButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ người sở hữu vai trò Thợ Kéo'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('handleKeoButton claim: Từ chối khi server chưa cấu hình VietQR', async () => {
      const order: KeoOrderRecord = {
        id: 'ORD_NO_QR',
        guild_id: 'guild-no-qr',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Gói 1',
        amount: 100000,
        note: null,
        worker_id: null,
        status: 'OPEN',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };
      createKeoOrder(db, order);
      mockSettingsService.get.mockReturnValueOnce({
        ...defaultGuildSettings,
        vietqr: { bankId: null, accountNo: null },
      });

      const interaction: any = {
        customId: 'keo:claim:ORD_NO_QR',
        guild: { id: 'guild-no-qr', ownerId: 'owner-1' },
        user: { id: 'worker-1' },
        member: {
          id: 'worker-1',
          guild: { id: 'guild-no-qr', ownerId: 'owner-1' },
          roles: { cache: new Map() },
          permissions: { has: jest.fn().mockReturnValue(true) },
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleKeoButton(interaction, db);
      expect(res.handled).toBe(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chưa cấu hình tài khoản nhận tiền VietQR'),
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('handleKeoButton confirm_pay: Chỉ DUY NHẤT Owner (hoặc Admin) mới được bấm duyệt tiền', async () => {
      const order: KeoOrderRecord = {
        id: 'ORD02',
        guild_id: 'guild-1',
        ticket_channel_id: 'ticket-1',
        customer_id: 'cust-1',
        package_name: 'Gói 2',
        amount: 300000,
        note: null,
        worker_id: 'worker-1',
        status: 'CLAIMED',
        dispatch_message_id: null,
        ticket_message_id: null,
        created_at: 1000,
        updated_at: 1000,
      };
      createKeoOrder(db, order);

      // Thợ kéo cố tình bấm nút xác nhận tiền
      const workerInteraction: any = {
        customId: 'keo:confirm_pay:ORD02',
        guild: { id: 'guild-1', ownerId: 'owner-999' },
        user: { id: 'worker-1' },
        member: {
          id: 'worker-1',
          guild: { id: 'guild-1', ownerId: 'owner-999' },
          roles: { cache: new Map([['role-worker-789', {}]]) },
          permissions: { has: jest.fn().mockReturnValue(false) },
        },
        reply: jest.fn().mockResolvedValue({}),
      };

      const res = await handleKeoButton(workerInteraction, db);
      expect(res.handled).toBe(true);
      expect(workerInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Chỉ Chủ Server (hoặc Quản Trị Bot) mới có quyền'),
          flags: MessageFlags.Ephemeral,
        }),
      );

      // Server Owner bấm duyệt tiền -> thành công
      const ownerInteraction: any = {
        customId: 'keo:confirm_pay:ORD02',
        guild: { id: 'guild-1', ownerId: 'owner-999' },
        user: { id: 'owner-999' },
        member: {
          id: 'owner-999',
          guild: { id: 'guild-1', ownerId: 'owner-999' },
          roles: { cache: new Map() },
          permissions: { has: jest.fn().mockReturnValue(true) },
        },
        update: jest.fn().mockResolvedValue({}),
        followUp: jest.fn().mockResolvedValue({}),
      };

      const resOwner = await handleKeoButton(ownerInteraction, db);
      expect(resOwner.handled).toBe(true);
      expect(ownerInteraction.update).toHaveBeenCalled();
      expect(getKeoOrderById(db, 'ORD02')?.status).toBe('PAID');
    });

    it('handleKeoModal: Tạo đơn thành công và bắn vào kênh bắn đơn', async () => {
      const mockDispatchChannel: any = {
        id: 'chan-dispatch-456',
        send: jest.fn().mockResolvedValue({ id: 'msg-dispatch-1' }),
      };

      const interaction: any = {
        customId: 'keo_modal:create:ticket-123:cust-777',
        guild: {
          id: 'guild-1',
          channels: {
            cache: new Map([['chan-dispatch-456', mockDispatchChannel]]),
          },
        },
        fields: {
          getTextInputValue: jest.fn().mockImplementation((id: string) => {
            if (id === 'customer_input') return 'cust-777';
            if (id === 'package_name') return 'Space City 2h';
            if (id === 'amount') return '300.000';
            if (id === 'note') return 'Kéo rank cao';
            return '';
          }),
        },
        reply: jest.fn().mockResolvedValue({}),
        fetchReply: jest.fn().mockResolvedValue({ id: 'msg-ticket-1' }),
      };

      const res = await handleKeoModal(interaction, db);
      expect(res.handled).toBe(true);
      expect(mockDispatchChannel.send).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();

      const active = getActiveKeoOrderByTicket(db, 'ticket-123');
      expect(active).toBeDefined();
      expect(active?.amount).toBe(300000);
      expect(active?.dispatch_message_id).toBe('msg-dispatch-1');
      expect(active?.ticket_message_id).toBe('msg-ticket-1');
    });

    it('handleKeoModal: Tự động phân giải username Lão Bản nhập trong Modal', async () => {
      const mockDispatchChannel: any = {
        id: 'chan-dispatch-456',
        send: jest.fn().mockResolvedValue({ id: 'msg-dispatch-2' }),
      };

      const interaction: any = {
        customId: 'keo_modal:create:ticket-456:unknown-user',
        guild: {
          id: 'guild-1',
          channels: {
            cache: new Map([['chan-dispatch-456', mockDispatchChannel]]),
          },
          members: {
            cache: new Map([
              ['member-dona-id', { id: 'member-dona-id', user: { username: 'dona' } }],
            ]),
          },
        },
        fields: {
          getTextInputValue: jest.fn().mockImplementation((id: string) => {
            if (id === 'customer_input') return 'Dona';
            if (id === 'package_name') return 'Tháp Zero';
            if (id === 'amount') return '500000';
            return '';
          }),
        },
        reply: jest.fn().mockResolvedValue({}),
        fetchReply: jest.fn().mockResolvedValue({ id: 'msg-ticket-2' }),
      };

      const res = await handleKeoModal(interaction, db);
      expect(res.handled).toBe(true);

      const active = getActiveKeoOrderByTicket(db, 'ticket-456');
      expect(active?.customer_id).toBe('member-dona-id');
    });
  });

  describe('Event Listener: channelCreate', () => {
    it('Gửi thẻ chào mừng khi phát hiện channel mới tạo thuộc Category ticket', async () => {
      const mockChannel: any = {
        id: 'ticket-new-1',
        name: 'ticket-cust1',
        type: ChannelType.GuildText,
        parentId: 'cat-123',
        guild: { id: 'guild-1' },
        send: jest.fn().mockResolvedValue({}),
      };

      await handleChannelCreate({} as any, mockChannel);
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.IsComponentsV2,
        }),
      );
    });

    it('Bỏ qua khi channel không thuộc Category ticket', async () => {
      const mockChannel: any = {
        id: 'other-channel',
        name: 'thao-luan',
        type: ChannelType.GuildText,
        parentId: 'other-cat-999',
        guild: { id: 'guild-1' },
        send: jest.fn(),
      };

      await handleChannelCreate({} as any, mockChannel);
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('Chống trùng lặp (Idempotent): Không gửi đúp nếu channelCreate được kích hoạt nhiều lần cùng lúc', async () => {
      const mockChannel: any = {
        id: 'ticket-dup-1',
        name: 'ticket-dup',
        type: ChannelType.GuildText,
        parentId: 'cat-123',
        guild: { id: 'guild-1' },
        send: jest.fn().mockResolvedValue({}),
      };

      await Promise.all([
        handleChannelCreate({} as any, mockChannel),
        handleChannelCreate({} as any, mockChannel),
      ]);
      expect(mockChannel.send).toHaveBeenCalledTimes(1);
    });
  });
});
