import Database from 'better-sqlite3';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import {
  createPayment,
  getPaymentById,
  updatePaymentStatus,
  getUserPayments,
  getTopBuyers,
  getUserRank,
  saveFeedback,
  createDonation,
  getDonationByOrderCode,
  updateDonationStatus,
} from '../../src/features/payment/payment.service.js';

describe('payment.service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializePaymentTables(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Payments CRUD', () => {
    it('lưu và truy vấn hóa đơn thanh toán thành công', () => {
      createPayment(db, {
        id: 'TX1001',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-1',
        amount: 50000,
        description: 'Mua Rank VIP',
        status: 'pending',
        created_at: Date.now(),
      });

      const tx = getPaymentById(db, 'TX1001');
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(50000);
      expect(tx?.status).toBe('pending');
      expect(tx?.description).toBe('Mua Rank VIP');
    });

    it('cập nhật trạng thái thanh toán thành công (confirmed)', () => {
      createPayment(db, {
        id: 'TX1002',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-1',
        amount: 100000,
        description: 'Buff rank',
        status: 'pending',
        created_at: Date.now(),
      });

      const updated = updatePaymentStatus(db, 'TX1002', 'confirmed', 'Đã nhận đủ tiền');
      expect(updated).toBe(true);

      const tx = getPaymentById(db, 'TX1002');
      expect(tx?.status).toBe('confirmed');
      expect(tx?.note).toBe('Đã nhận đủ tiền');
      expect(tx?.processed_at).toBeGreaterThan(0);
    });

    it('không thể cập nhật hóa đơn đã hoàn tất hoặc bị hủy trước đó', () => {
      createPayment(db, {
        id: 'TX1003',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-1',
        amount: 20000,
        description: 'Đơn test',
        status: 'confirmed',
        created_at: Date.now(),
        processed_at: Date.now(),
      });

      const secondUpdate = updatePaymentStatus(db, 'TX1003', 'cancelled', 'Hủy nhầm');
      expect(secondUpdate).toBe(false);
    });

    it('lấy danh sách giao dịch và thống kê top khách hàng', () => {
      createPayment(db, {
        id: 'TX1',
        guild_id: 'guild-1',
        buyer_id: 'user-A',
        seller_id: 'admin',
        amount: 200000,
        description: 'Don 1',
        status: 'confirmed',
        created_at: 1000,
      });

      createPayment(db, {
        id: 'TX2',
        guild_id: 'guild-1',
        buyer_id: 'user-B',
        seller_id: 'admin',
        amount: 500000,
        description: 'Don 2',
        status: 'confirmed',
        created_at: 2000,
      });

      createPayment(db, {
        id: 'TX3',
        guild_id: 'guild-1',
        buyer_id: 'user-A',
        seller_id: 'admin',
        amount: 100000,
        description: 'Don 3',
        status: 'confirmed',
        created_at: 3000,
      });

      const userAPayments = getUserPayments(db, 'guild-1', 'user-A');
      expect(userAPayments).toHaveLength(2);

      const top = getTopBuyers(db, 'guild-1', 10);
      expect(top).toHaveLength(2);
      expect(top[0].buyerId).toBe('user-B');
      expect(top[0].totalAmount).toBe(500000);
      expect(top[1].buyerId).toBe('user-A');
      expect(top[1].totalAmount).toBe(300000);

      const rankA = getUserRank(db, 'guild-1', 'user-A');
      expect(rankA?.rank).toBe(2);
      expect(rankA?.totalAmount).toBe(300000);

      const rankB = getUserRank(db, 'guild-1', 'user-B');
      expect(rankB?.rank).toBe(1);
    });
  });

  describe('Payment Feedback', () => {
    it('lưu feedback đánh giá ⭐ và ngăn trùng lặp trên cùng 1 txId', () => {
      createPayment(db, {
        id: 'TX_FB_1',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-1',
        amount: 50000,
        description: 'Don FB',
        status: 'confirmed',
        created_at: Date.now(),
      });

      const saved = saveFeedback(db, {
        tx_id: 'TX_FB_1',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        rating: 5,
        comment: 'Dịch vụ rất nhanh và nhiệt tình!',
        created_at: Date.now(),
      });
      expect(saved).toBe(true);

      // Thử lưu lần 2 với cùng tx_id phải bị chặn (UNIQUE constraint)
      const duplicate = saveFeedback(db, {
        tx_id: 'TX_FB_1',
        guild_id: 'guild-1',
        buyer_id: 'buyer-1',
        rating: 4,
        comment: 'Spam feedback',
        created_at: Date.now(),
      });
      expect(duplicate).toBe(false);
    });
  });

  describe('Donations PayOS', () => {
    it('lưu thông tin quyên góp và cập nhật trạng thái đã thanh toán', () => {
      createDonation(db, {
        order_code: 1770001234,
        user_id: 'user-donor',
        user_tag: 'Donor#1234',
        guild_id: 'guild-1',
        amount: 50000,
        message: 'Cảm ơn bot nhiều!',
        status: 'pending',
        created_at: Date.now(),
      });

      const record = getDonationByOrderCode(db, 1770001234);
      expect(record).toBeDefined();
      expect(record?.amount).toBe(50000);
      expect(record?.status).toBe('pending');

      const updated = updateDonationStatus(db, 1770001234, 'paid');
      expect(updated).toBe(true);

      const paidRecord = getDonationByOrderCode(db, 1770001234);
      expect(paidRecord?.status).toBe('paid');
      expect(paidRecord?.paid_at).toBeGreaterThan(0);
    });
  });
});
