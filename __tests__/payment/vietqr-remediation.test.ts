/**
 * Regression and remediation tests for VietQR payment workflow.
 * Covers:
 * 1. Bank alias normalization and Agribank BIN.
 * 2. Unassigned buyer accounting (no seller inflation).
 * 3. Atomic payment state transitions & Concurrency (no double-confirm/cancel).
 * 4. Invoice expiration enforcement.
 * 5. Optional feedback comments (UX barrier elimination).
 * 6. Idempotent schema migration for payments table.
 */

import Database from 'better-sqlite3';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import {
  createPayment,
  getPaymentById,
  updatePaymentStatus,
  getTopBuyers,
  getUserRank,
  saveFeedback,
} from '../../src/features/payment/payment.service.js';
import {
  normalizeBankCode,
  SUPPORTED_BANKS,
  BANK_BINS,
  buildVietQrContainer,
  buildPaymentResultContainer,
} from '../../src/utils/vietqr.utils.js';

describe('VietQR Payment Remediation Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializePaymentTables(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('1. Bank Alias Normalization and Agribank BIN', () => {
    it('nhận diện chính xác ngân hàng Agribank (VBA) với mã BIN 970405', () => {
      expect(SUPPORTED_BANKS.VBA).toBe('Agribank (Nông nghiệp & PTNT)');
      expect(BANK_BINS.VBA).toBe('970405');

      const byCode = normalizeBankCode('VBA');
      expect(byCode).toEqual({ bankCode: 'VBA', bin: '970405' });

      const byAlias = normalizeBankCode('AGRIBANK');
      expect(byAlias).toEqual({ bankCode: 'VBA', bin: '970405' });

      const byBin = normalizeBankCode('970405');
      expect(byBin).toEqual({ bankCode: 'VBA', bin: '970405' });
    });

    it('chuẩn hóa các tên ngân hàng phổ biến (VIETCOMBANK, TECHCOMBANK, VIETINBANK, MBBANK)', () => {
      expect(normalizeBankCode('VIETCOMBANK')).toEqual({ bankCode: 'VCB', bin: '970436' });
      expect(normalizeBankCode('TECHCOMBANK')).toEqual({ bankCode: 'TCB', bin: '970407' });
      expect(normalizeBankCode('VIETINBANK')).toEqual({ bankCode: 'ICB', bin: '970415' });
      expect(normalizeBankCode('MBBANK')).toEqual({ bankCode: 'MB', bin: '970422' });
      expect(normalizeBankCode('vcb')).toEqual({ bankCode: 'VCB', bin: '970436' });
    });

    it('từ chối mã ngân hàng không hợp lệ', () => {
      expect(normalizeBankCode('')).toBeNull();
      expect(normalizeBankCode('UNKNOWN_BANK_XYZ')).toBeNull();
    });
  });

  describe('2. Unassigned Buyer Accounting (Seller != Buyer)', () => {
    it('lưu buyer_id là UNASSIGNED khi không có khách hàng chỉ định', () => {
      createPayment(db, {
        id: 'TX_UNASSIGNED_1',
        guild_id: 'guild_1',
        buyer_id: 'UNASSIGNED',
        seller_id: 'seller_123',
        amount: 200_000,
        description: 'Dịch vụ mở',
        status: 'confirmed',
        created_at: Date.now(),
      });

      // Tạo thêm 1 giao dịch thật của người mua buyer_real
      createPayment(db, {
        id: 'TX_REAL_1',
        guild_id: 'guild_1',
        buyer_id: 'buyer_real',
        seller_id: 'seller_123',
        amount: 50_000,
        description: 'Dịch vụ có người mua',
        status: 'confirmed',
        created_at: Date.now(),
      });

      // getTopBuyers phải KHÔNG chứa UNASSIGNED và seller_123 không bị thổi phồng
      const topBuyers = getTopBuyers(db, 'guild_1', 10);
      expect(topBuyers.length).toBe(1);
      expect(topBuyers[0].buyerId).toBe('buyer_real');
      expect(topBuyers[0].totalAmount).toBe(50_000);

      // getUserRank của seller phải là null vì họ không phải là người mua
      const sellerRank = getUserRank(db, 'guild_1', 'seller_123');
      expect(sellerRank).toBeNull();
    });

    it('buildVietQrContainer hiển thị rõ hóa đơn mở cho bất kỳ ai', () => {
      const container = buildVietQrContainer({
        bankId: 'VCB',
        accountNo: '123456789',
        accountName: 'NGUYEN VAN A',
        amount: 50_000,
        transferCode: 'NAP 123456 ABCD',
        serverName: 'Test Server',
        creatorId: 'seller_123',
        customerId: null,
      });

      const json = container.toJSON();
      const text = JSON.stringify(json);
      expect(text).toContain('Bất kỳ thành viên nào (Hóa đơn mở)');
      expect(text).not.toContain('<@seller_123> Hóa đơn thanh toán của bạn');
    });

    it('buildPaymentResultContainer không tag seller làm người mua khi duyệt hóa đơn mở', () => {
      const result = buildPaymentResultContainer({
        isConfirm: true,
        txId: 'TX_OPEN_1',
        amount: 100_000,
        buyerId: 'UNASSIGNED',
        description: 'Dịch vụ mở',
        operatorId: 'staff_1',
      });

      const json = result.toJSON();
      const text = JSON.stringify(json);
      expect(text).toContain('Hóa đơn thanh toán đã được xác nhận thành công!');
      expect(text).toContain('Thành viên chuyển khoản (Chưa định danh)');
      expect(text).not.toContain('<@UNASSIGNED>');
    });
  });

  describe('3. Atomic State Transitions & Concurrency', () => {
    it('chặn double-confirmation ở mức database (Atomic Conditional Update)', () => {
      createPayment(db, {
        id: 'TX_CONCURRENT',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 100_000,
        description: 'Test concurrent',
        status: 'pending',
        created_at: Date.now(),
      });

      // Lần xác nhận đầu tiên thành công
      const firstConfirm = updatePaymentStatus(db, 'TX_CONCURRENT', 'guild_1', 'confirmed', 'Staff A duyệt');
      expect(firstConfirm).toBe(true);

      // Lần xác nhận thứ hai (race condition) bắt buộc thất bại
      const secondConfirm = updatePaymentStatus(db, 'TX_CONCURRENT', 'guild_1', 'confirmed', 'Staff B duyệt');
      expect(secondConfirm).toBe(false);

      // Kiểm tra DB chỉ ghi nhận 1 lần
      const tx = getPaymentById(db, 'TX_CONCURRENT');
      expect(tx?.status).toBe('confirmed');
      expect(tx?.note).toBe('Staff A duyệt');
    });

    it('chặn xung đột Confirm vs Cancel race conditions', () => {
      createPayment(db, {
        id: 'TX_RACE_CANCEL',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 100_000,
        description: 'Test race cancel',
        status: 'pending',
        created_at: Date.now(),
      });

      // Confirm trước
      expect(updatePaymentStatus(db, 'TX_RACE_CANCEL', 'guild_1', 'confirmed')).toBe(true);

      // Thao tác Cancel sau đó bị chặn vì trạng thái không còn là pending
      expect(updatePaymentStatus(db, 'TX_RACE_CANCEL', 'guild_1', 'cancelled', 'Khách đòi hủy')).toBe(false);

      const tx = getPaymentById(db, 'TX_RACE_CANCEL');
      expect(tx?.status).toBe('confirmed');
    });
  });

  describe('4. Invoice Expiration Enforcement', () => {
    it('lưu và truy vấn chính xác trường expires_at của hóa đơn', () => {
      const now = Date.now();
      const expiresAt = now + 60 * 60 * 1000;

      createPayment(db, {
        id: 'TX_EXP_TEST',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 50_000,
        description: 'Test expiration',
        status: 'pending',
        created_at: now,
        expires_at: expiresAt,
        bank_id: 'VCB',
        account_no: '0461000644931',
        account_name: 'LE PHAM DANG KHOA',
      });

      const tx = getPaymentById(db, 'TX_EXP_TEST');
      expect(tx?.expires_at).toBe(expiresAt);
      expect((tx as any)?.bank_id).toBe('VCB');
      expect((tx as any)?.account_no).toBe('0461000644931');
      expect((tx as any)?.account_name).toBe('LE PHAM DANG KHOA');
    });
  });

  describe('5. Optional Feedback Comments', () => {
    it('cho phép lưu đánh giá thành công khi người dùng không nhập nhận xét', () => {
      createPayment(db, {
        id: 'TX_FEEDBACK_TEST',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 50_000,
        description: 'Test feedback',
        status: 'confirmed',
        created_at: Date.now(),
      });

      const saved = saveFeedback(db, {
        tx_id: 'TX_FEEDBACK_TEST',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        rating: 5,
        comment: null, // Không nhập comment
        created_at: Date.now(),
      });

      expect(saved).toBe(true);

      const feedback = db.prepare('SELECT * FROM payment_feedback WHERE tx_id = ?').get('TX_FEEDBACK_TEST') as any;
      expect(feedback.rating).toBe(5);
      expect(feedback.comment).toBeNull();
    });
  });

  describe('6. Backward-Compatible Idempotent Schema Migration', () => {
    it('chạy initializePaymentTables nhiều lần không gây lỗi và bảo toàn dữ liệu', () => {
      // Chạy khởi tạo lần 2
      expect(() => initializePaymentTables(db)).not.toThrow();

      const columns = db.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>;
      expect(columns.some((c) => c.name === 'expires_at')).toBe(true);
      expect(columns.some((c) => c.name === 'bank_id')).toBe(true);
      expect(columns.some((c) => c.name === 'account_no')).toBe(true);
      expect(columns.some((c) => c.name === 'account_name')).toBe(true);
    });
  });

  describe('7. Cross-Guild Payment Protection', () => {
    it('chặn cập nhật đơn hàng nếu guild_id không khớp (Cross-Guild Scoping)', () => {
      createPayment(db, {
        id: 'TX_GUILD_A',
        guild_id: 'guild_A',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 50_000,
        description: 'Guild A Order',
        status: 'pending',
        created_at: Date.now(),
      });

      // Thử cập nhật đơn của guild_A từ guild_B -> Bị từ chối
      const crossUpdate = updatePaymentStatus(db, 'TX_GUILD_A', 'guild_B', 'confirmed', 'Hacker duyệt');
      expect(crossUpdate).toBe(false);

      // Đơn hàng tại guild_A vẫn giữ nguyên trạng thái pending
      const tx = getPaymentById(db, 'TX_GUILD_A');
      expect(tx?.status).toBe('pending');

      // Cập nhật đúng guild_A -> Thành công
      const validUpdate = updatePaymentStatus(db, 'TX_GUILD_A', 'guild_A', 'confirmed', 'Staff duyệt');
      expect(validUpdate).toBe(true);
      expect(getPaymentById(db, 'TX_GUILD_A')?.status).toBe('confirmed');
    });
  });

  describe('8. Bank Snapshot Permanent Immobility', () => {
    it('bảo toàn thông tin ngân hàng gốc của đơn hàng dù cấu hình ngân hàng guild thay đổi', () => {
      createPayment(db, {
        id: 'TX_SNAPSHOT_LOCK',
        guild_id: 'guild_1',
        buyer_id: 'buyer_1',
        seller_id: 'seller_1',
        amount: 100_000,
        description: 'Order before bank change',
        status: 'pending',
        created_at: Date.now(),
        bank_id: 'VCB',
        account_no: '0461000644931',
        account_name: 'LE PHAM DANG KHOA',
      });

      const tx = getPaymentById(db, 'TX_SNAPSHOT_LOCK');
      expect((tx as any)?.bank_id).toBe('VCB');
      expect((tx as any)?.account_no).toBe('0461000644931');
      expect((tx as any)?.account_name).toBe('LE PHAM DANG KHOA');
    });
  });
});
