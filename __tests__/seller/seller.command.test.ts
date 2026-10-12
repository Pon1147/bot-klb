import Database from 'better-sqlite3';
import {
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  User,
} from 'discord.js';
import { execute } from '../../src/features/seller/seller.command.js';
import { initializeSellerTables, SellerDatabase, setSellerDb } from '../../src/database/seller.db.js';
import { SettingsService, setSettingsService } from '../../src/services/settings.service.js';
import * as vietqrService from '../../src/features/seller/services/vietqr.service.js';

jest.mock('../../src/features/seller/services/vietqr.service.js', () => ({
  ...jest.requireActual('../../src/features/seller/services/vietqr.service.js'),
  generateVietQrBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-qr-buffer')),
}));

function createMockInteraction(options: {
  subcommand: string;
  group?: string | null;
  userId?: string;
  guildId?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  optionsData?: Record<string, any>;
}): ChatInputCommandInteraction {
  const userId = options.userId || 'user-123';
  const guildId = options.guildId || 'guild-123';

  const user = {
    id: userId,
    tag: `User#${userId}`,
  } as unknown as User;

  const member = {
    id: userId,
    user,
    permissions: {
      has: jest.fn().mockImplementation((perm: any) => {
        if (options.isAdmin) return true;
        return false;
      }),
    },
    roles: {
      cache: new Map(),
    },
  } as unknown as GuildMember;

  const guild = {
    id: guildId,
    name: 'Test Server',
    ownerId: options.isOwner ? userId : 'owner-999',
    members: {
      cache: new Map([[userId, member]]),
    },
  } as unknown as Guild;

  const memberPermissions = {
    has: jest.fn().mockReturnValue(Boolean(options.isAdmin)),
  };

  const opts = options.optionsData || {};

  return {
    user,
    member,
    memberPermissions,
    guild,
    guildId,
    channelId: 'channel-123',
    commandName: 'seller',
    options: {
      getSubcommandGroup: jest.fn().mockReturnValue(options.group || null),
      getSubcommand: jest.fn().mockReturnValue(options.subcommand),
      getUser: jest.fn().mockImplementation((name: string, required?: boolean) => {
        if (opts[name]) return opts[name];
        if (required) throw new Error(`Missing option ${name}`);
        return null;
      }),
      getInteger: jest.fn().mockImplementation((name: string) => opts[name] ?? null),
      getString: jest.fn().mockImplementation((name: string) => opts[name] ?? null),
      getRole: jest.fn().mockImplementation((name: string) => opts[name] ?? null),
    },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue({ id: 'msg-reply-123' }),
  } as unknown as ChatInputCommandInteraction;
}

import { initializeSettingsTable } from '../../src/database/guild.settings.db.js';

describe('SellerCommand (/seller)', () => {
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

  describe('Subcommand /seller pay', () => {
    it('báo lỗi nếu buyer và seller là cùng một người', async () => {
      const interaction = createMockInteraction({
        subcommand: 'pay',
        userId: 'user-1',
        optionsData: {
          buyer: { id: 'user-1', tag: 'Buyer#1' },
          amount: 100000,
          description: 'Kéo Đập Nước',
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ Khách hàng và thợ kéo không thể là cùng một người!',
        }),
      );
    });

    it('báo lỗi nếu tạo đơn cho người khác mà không phải Admin', async () => {
      const interaction = createMockInteraction({
        subcommand: 'pay',
        userId: 'user-1',
        isAdmin: false,
        isOwner: false,
        optionsData: {
          buyer: { id: 'buyer-9', tag: 'Buyer#9' },
          seller: { id: 'seller-other', tag: 'SellerOther#1' },
          amount: 100000,
          description: 'Kéo Đập Nước',
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ Bạn chỉ có thể tạo đơn thanh toán cho chính mình!',
        }),
      );
    });

    it('báo lỗi nếu thợ kéo chưa cài đặt STK', async () => {
      const interaction = createMockInteraction({
        subcommand: 'pay',
        userId: 'seller-1',
        optionsData: {
          buyer: { id: 'buyer-1', tag: 'Buyer#1' },
          amount: 150000,
          description: 'Kéo Đập Nước 3 game',
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chưa cài đặt tài khoản ngân hàng'),
        }),
      );
    });

    it('tạo đơn và sinh mã QR thành công khi thợ kéo đã có STK', async () => {
      sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-123',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '0987654321',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      const interaction = createMockInteraction({
        subcommand: 'pay',
        userId: 'seller-1',
        optionsData: {
          buyer: { id: 'buyer-1', tag: 'Buyer#1' },
          amount: 150000,
          description: 'Kéo Đập Nước 3 game',
        },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đơn thanh toán kéo game đã được tạo!'),
          embeds: expect.any(Array),
          components: expect.any(Array),
          files: expect.any(Array),
        }),
      );

      const txs = sellerDb.getTransactions({ sellerId: 'seller-1' });
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(150000);
      expect(txs[0].buyerId).toBe('buyer-1');
      expect(txs[0].messageId).toBe('msg-reply-123');
    });
  });

  describe('Subcommand /seller qr', () => {
    it('hiển thị QR dashboard của chính mình (chưa có STK)', async () => {
      const interaction = createMockInteraction({
        subcommand: 'qr',
        userId: 'user-1',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array),
        }),
      );
    });

    it('chặn xem QR của người khác nếu không có quyền admin', async () => {
      const interaction = createMockInteraction({
        subcommand: 'qr',
        userId: 'user-1',
        isAdmin: false,
        isOwner: false,
        optionsData: {
          user: { id: 'user-2', tag: 'User#2' },
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ Bạn chỉ có thể xem/cấu hình mã QR của chính mình!',
        }),
      );
    });

    it('cho phép admin xem QR của người khác', async () => {
      const interaction = createMockInteraction({
        subcommand: 'qr',
        userId: 'admin-1',
        isAdmin: true,
        optionsData: {
          user: { id: 'seller-2', tag: 'Seller#2' },
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });
  });

  describe('Subcommand /seller history & /seller top', () => {
    it('thực thi /seller history trả về danh sách giao dịch', async () => {
      const interaction = createMockInteraction({
        subcommand: 'history',
        userId: 'user-1',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });

    it('thực thi /seller top trả về bảng xếp hạng', async () => {
      const interaction = createMockInteraction({
        subcommand: 'top',
        userId: 'user-1',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        }),
      );
    });
  });

  describe('Subcommand /seller config setrole', () => {
    it('chặn thành viên không có quyền admin cấu hình role thợ kéo', async () => {
      const interaction = createMockInteraction({
        group: 'config',
        subcommand: 'setrole',
        userId: 'member-1',
        isAdmin: false,
        isOwner: false,
        optionsData: {
          role: { id: 'role-seller', name: 'Thợ Kéo' },
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ Bạn cần có quyền Quản trị viên bot để cấu hình role Thợ Kéo!',
        }),
      );
    });

    it('cho phép admin cấu hình role thợ kéo thành công', async () => {
      const interaction = createMockInteraction({
        group: 'config',
        subcommand: 'setrole',
        userId: 'admin-1',
        isAdmin: true,
        optionsData: {
          role: { id: 'role-seller', name: 'Thợ Kéo' },
        },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã thiết lập role Thợ Kéo của server thành: **Thợ Kéo**'),
        }),
      );

      const sellerSettings = settingsService.getSeller('guild-123');
      expect(sellerSettings.roleId).toBe('role-seller');
    });
  });
});
