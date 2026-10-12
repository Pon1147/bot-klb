import Database from 'better-sqlite3';
import {
  initializeSellerTables,
  SellerDatabase,
  getSellerDb,
  setSellerDb,
} from '../../src/database/seller.db.js';

describe('SellerDatabase (SQLite Layer)', () => {
  let db: Database.Database;
  let sellerDb: SellerDatabase;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSellerTables(db);
    sellerDb = new SellerDatabase(db);
    setSellerDb(sellerDb);
  });

  afterEach(() => {
    db.close();
    setSellerDb(null);
  });

  describe('getSellerDb / setSellerDb', () => {
    it('trả về instance đã cấu hình', () => {
      expect(getSellerDb()).toBe(sellerDb);
    });

    it('ném ra lỗi nếu chưa khởi tạo', () => {
      setSellerDb(null);
      expect(() => getSellerDb()).toThrow(
        'SellerDatabase has not been initialized with a SQLite database instance.',
      );
    });

    it('tự động khởi tạo khi truyền database', () => {
      setSellerDb(null);
      const newDb = new Database(':memory:');
      const instance = getSellerDb(newDb);
      expect(instance).toBeInstanceOf(SellerDatabase);
      newDb.close();
    });
  });

  describe('Seller Profile CRUD', () => {
    it('trả về null nếu profile không tồn tại', () => {
      expect(sellerDb.getProfile('user-1', 'guild-1')).toBeNull();
    });

    it('upsert tạo mới profile thành công', () => {
      const created = sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-1',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '0987654321',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      expect(created.userId).toBe('seller-1');
      expect(created.bankName).toBe('MBBank');
      expect(created.createdAt).toBeGreaterThan(0);

      const fetched = sellerDb.getProfile('seller-1', 'guild-1');
      expect(fetched).not.toBeNull();
      expect(fetched?.accountNumber).toBe('0987654321');
      expect(fetched?.accountName).toBe('NGUYEN VAN A');
      expect(fetched?.isActive).toBe(true);
    });

    it('upsert cập nhật profile đã tồn tại giữ nguyên createdAt', () => {
      const first = sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-1',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '0987654321',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      const updated = sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-1',
        bankCode: '970436',
        bankName: 'Vietcombank',
        accountNumber: '1234567890',
        accountName: 'NGUYEN VAN A',
        isActive: false,
      });

      expect(updated.createdAt).toBe(first.createdAt);
      expect(updated.bankName).toBe('Vietcombank');
      expect(updated.accountNumber).toBe('1234567890');
      expect(updated.isActive).toBe(false);

      const fetched = sellerDb.getProfile('seller-1', 'guild-1');
      expect(fetched?.bankName).toBe('Vietcombank');
      expect(fetched?.isActive).toBe(false);
    });

    it('xóa profile thành công', () => {
      sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-1',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '0987654321',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      expect(sellerDb.deleteProfile('seller-1', 'guild-1')).toBe(true);
      expect(sellerDb.getProfile('seller-1', 'guild-1')).toBeNull();
      expect(sellerDb.deleteProfile('seller-1', 'guild-1')).toBe(false);
    });
  });

  describe('Seller Transaction CRUD & Status Updates', () => {
    const mockTx = {
      txId: 'TX123456',
      guildId: 'guild-1',
      channelId: 'channel-1',
      messageId: null,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      amount: 150000,
      description: 'Kéo Đập Nước 3 game',
      status: 'pending' as const,
      note: null,
      processedBy: null,
      createdAt: Date.now(),
      processedAt: null,
    };

    it('tạo và lấy transaction theo txId', () => {
      sellerDb.createTransaction(mockTx);
      const fetched = sellerDb.getTransaction('TX123456');

      expect(fetched).not.toBeNull();
      expect(fetched?.amount).toBe(150000);
      expect(fetched?.status).toBe('pending');
      expect(fetched?.buyerId).toBe('buyer-1');
      expect(fetched?.sellerId).toBe('seller-1');
    });

    it('cập nhật messageId', () => {
      sellerDb.createTransaction(mockTx);
      sellerDb.updateTransactionMessageId('TX123456', 'msg-999');

      const fetched = sellerDb.getTransaction('TX123456');
      expect(fetched?.messageId).toBe('msg-999');
    });

    it('cập nhật trạng thái confirmed thành công', () => {
      sellerDb.createTransaction(mockTx);
      const ok = sellerDb.updateTransactionStatus(
        'TX123456',
        'confirmed',
        'Đã nhận đủ tiền',
        'seller-1',
      );

      expect(ok).toBe(true);
      const fetched = sellerDb.getTransaction('TX123456');
      expect(fetched?.status).toBe('confirmed');
      expect(fetched?.note).toBe('Đã nhận đủ tiền');
      expect(fetched?.processedBy).toBe('seller-1');
      expect(fetched?.processedAt).toBeGreaterThan(0);
    });

    it('lọc danh sách transactions theo các tiêu chí', () => {
      sellerDb.createTransaction({ ...mockTx, txId: 'TX1', amount: 100000 });
      sellerDb.createTransaction({
        ...mockTx,
        txId: 'TX2',
        amount: 200000,
        status: 'confirmed',
        sellerId: 'seller-2',
      });
      sellerDb.createTransaction({
        ...mockTx,
        txId: 'TX3',
        amount: 300000,
        buyerId: 'buyer-2',
      });

      const byGuild = sellerDb.getTransactions({ guildId: 'guild-1' });
      expect(byGuild).toHaveLength(3);

      const bySeller = sellerDb.getTransactions({ sellerId: 'seller-2' });
      expect(bySeller).toHaveLength(1);
      expect(bySeller[0].txId).toBe('TX2');

      const byBuyer = sellerDb.getTransactions({ buyerId: 'buyer-2' });
      expect(byBuyer).toHaveLength(1);
      expect(byBuyer[0].txId).toBe('TX3');

      const byStatus = sellerDb.getTransactions({ status: 'confirmed' });
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0].txId).toBe('TX2');
    });
  });

  describe('Seller Reviews & Stats', () => {
    beforeEach(() => {
      sellerDb.createTransaction({
        txId: 'TX-R1',
        guildId: 'guild-1',
        channelId: 'ch-1',
        messageId: 'msg-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 200000,
        description: 'Kéo Thung lũng Layali',
        status: 'confirmed',
        note: 'Xong',
        processedBy: 'seller-1',
        createdAt: 1000,
        processedAt: 2000,
      });

      sellerDb.createTransaction({
        txId: 'TX-R2',
        guildId: 'guild-1',
        channelId: 'ch-1',
        messageId: 'msg-2',
        buyerId: 'buyer-2',
        sellerId: 'seller-1',
        amount: 100000,
        description: 'Kéo Đập Nước',
        status: 'confirmed',
        note: 'Xong',
        processedBy: 'seller-1',
        createdAt: 3000,
        processedAt: 4000,
      });

      sellerDb.createTransaction({
        txId: 'TX-R3',
        guildId: 'guild-1',
        channelId: 'ch-1',
        messageId: 'msg-3',
        buyerId: 'buyer-3',
        sellerId: 'seller-1',
        amount: 50000,
        description: 'Hủy kèo',
        status: 'cancelled',
        note: 'Bận việc',
        processedBy: 'seller-1',
        createdAt: 5000,
        processedAt: 6000,
      });
    });

    it('tạo và lấy review theo txId', () => {
      const review = sellerDb.createReview({
        txId: 'TX-R1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        rating: 5,
        comment: 'Thợ kéo bắn rất cháy, thân thiện!',
      });

      expect(review.id).toBeGreaterThan(0);
      expect(review.rating).toBe(5);

      const fetched = sellerDb.getReviewByTxId('TX-R1');
      expect(fetched?.comment).toBe('Thợ kéo bắn rất cháy, thân thiện!');
      expect(fetched?.rating).toBe(5);
    });

    it('tính toán chính xác seller stats', () => {
      sellerDb.createReview({
        txId: 'TX-R1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        rating: 5,
        comment: 'Tuyệt vời',
      });
      sellerDb.createReview({
        txId: 'TX-R2',
        sellerId: 'seller-1',
        buyerId: 'buyer-2',
        rating: 4,
        comment: 'Khá tốt',
      });

      const stats = sellerDb.getSellerStats('seller-1', 'guild-1');
      expect(stats.totalTransactions).toBe(3);
      expect(stats.confirmedCount).toBe(2);
      expect(stats.cancelledCount).toBe(1);
      expect(stats.totalRevenue).toBe(300000);
      expect(stats.totalReviews).toBe(2);
      expect(stats.averageRating).toBe(4.5);
    });

    it('tính toán bảng xếp hạng top sellers', () => {
      // Thêm seller-2 có 1 transaction 500,000 confirmed
      sellerDb.createTransaction({
        txId: 'TX-S2',
        guildId: 'guild-1',
        channelId: 'ch-1',
        messageId: 'msg-4',
        buyerId: 'buyer-1',
        sellerId: 'seller-2',
        amount: 500000,
        description: 'Kéo Trạm Không Gian',
        status: 'confirmed',
        note: null,
        processedBy: 'seller-2',
        createdAt: 7000,
        processedAt: 8000,
      });

      const top = sellerDb.getTopSellers('guild-1');
      expect(top).toHaveLength(2);
      // seller-2 doanh thu 500k đứng top 1
      expect(top[0].sellerId).toBe('seller-2');
      expect(top[0].totalRevenue).toBe(500000);
      // seller-1 doanh thu 300k đứng top 2
      expect(top[1].sellerId).toBe('seller-1');
      expect(top[1].totalRevenue).toBe(300000);
    });
  });
});

