import Database from 'better-sqlite3';
import { initializeSubscriptionTables } from '../../src/database/subscription.db.js';
import {
  createSubscriptionOrder,
  checkSubscriptionEntitlement,
  KEO_PACKAGES,
} from '../../src/features/subscription/subscription.service.js';
import {
  reconcileSubscriptionOrder,
  runSubscriptionReconciler,
  sendSubscriptionReceiptNotification,
} from '../../src/features/subscription/subscription-reconcile.service.js';
import * as payosService from '../../src/services/payos.service.js';
import { buildSubscriptionExpiredNoticeCard } from '../../src/features/keo-lao-ban/keo.builder.js';

// Mock PayOS service API calls
jest.mock('../../src/services/payos.service.js', () => {
  const actual = jest.requireActual('../../src/services/payos.service.js');
  return {
    ...actual,
    getPayosPaymentInfo: jest.fn(),
  };
});

describe('Subscription Phase P1 — Reconciliation & Entitlement Guard', () => {
  let db: Database.Database;
  const mockedGetPayosPaymentInfo = payosService.getPayosPaymentInfo as jest.Mock;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    initializeSubscriptionTables(db);
    jest.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  describe('Reconciliation Order Processing', () => {
    it('bỏ qua nếu đơn hàng không tồn tại', async () => {
      const res = await reconcileSubscriptionOrder(db, 99999);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('order_not_found');
    });

    it('bỏ qua an toàn (idempotent) nếu đơn hàng đã được fulfill trước đó', async () => {
      const order = createSubscriptionOrder(db, {
        orderCode: 1001,
        guildId: 'guild_1',
        userId: 'user_1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 900_000,
      });

      db.prepare("UPDATE subscription_orders SET status = 'paid' WHERE order_code = ?").run(
        order.order_code,
      );

      const res = await reconcileSubscriptionOrder(db, 1001);
      expect(res.success).toBe(true);
      expect(res.reason).toBe('already_fulfilled');
      expect(mockedGetPayosPaymentInfo).not.toHaveBeenCalled();
    });

    it('tự động hoàn tất (fulfill) khi PayOS phản hồi trạng thái PAID', async () => {
      const order = createSubscriptionOrder(db, {
        orderCode: 1002,
        guildId: 'guild_recon',
        userId: 'admin_1',
        packageType: '1_MONTH',
        durationDays: KEO_PACKAGES['1_MONTH'].durationDays,
        amount: KEO_PACKAGES['1_MONTH'].amount,
        expiresAt: Date.now() + 900_000,
      });

      mockedGetPayosPaymentInfo.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'paylink_123',
          orderCode: 1002,
          amount: 149_000,
          amountPaid: 149_000,
          amountRemaining: 0,
          status: 'PAID',
          createdAt: new Date().toISOString(),
          transactions: [
            {
              reference: 'FT_RECON_001',
              amount: 149_000,
              accountNumber: '123456789',
              description: 'KLB 1002',
              transactionDateTime: new Date().toISOString(),
            },
          ],
        },
      });

      const res = await reconcileSubscriptionOrder(db, 1002);
      expect(res.success).toBe(true);
      expect(res.result?.success).toBe(true);

      // Kiểm tra DB: đơn đã chuyển sang paid và guild đã được gia hạn
      const updatedOrder = db
        .prepare('SELECT * FROM subscription_orders WHERE order_code = 1002')
        .get() as any;
      expect(updatedOrder.status).toBe('paid');
      expect(updatedOrder.payment_reference).toBe('FT_RECON_001');

      const entitlement = checkSubscriptionEntitlement(db, 'guild_recon');
      expect(entitlement.isEntitled).toBe(true);
      expect(entitlement.expiresAt).toBeGreaterThan(Date.now());
    });

    it('cập nhật đơn sang cancelled khi PayOS báo đơn bị hủy', async () => {
      createSubscriptionOrder(db, {
        orderCode: 1003,
        guildId: 'guild_cancel',
        userId: 'user_1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 900_000,
      });

      mockedGetPayosPaymentInfo.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'paylink_cancel',
          orderCode: 1003,
          amount: 149_000,
          amountPaid: 0,
          amountRemaining: 149_000,
          status: 'CANCELLED',
          createdAt: new Date().toISOString(),
        },
      });

      const res = await reconcileSubscriptionOrder(db, 1003);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('cancelled');

      const updated = db
        .prepare('SELECT status FROM subscription_orders WHERE order_code = 1003')
        .get() as any;
      expect(updated.status).toBe('cancelled');
    });

    it('áp dụng Exponential Backoff khi PayOS vẫn ở trạng thái PENDING', async () => {
      createSubscriptionOrder(db, {
        orderCode: 1004,
        guildId: 'guild_pending',
        userId: 'user_1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 900_000,
      });

      mockedGetPayosPaymentInfo.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'paylink_pending',
          orderCode: 1004,
          amount: 149_000,
          amountPaid: 0,
          amountRemaining: 149_000,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      });

      const before = Date.now();
      const res = await reconcileSubscriptionOrder(db, 1004);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('still_pending');

      const updated = db
        .prepare('SELECT reconcile_attempts, next_reconcile_at FROM subscription_orders WHERE order_code = 1004')
        .get() as any;
      expect(updated.reconcile_attempts).toBe(1);
      // Backoff lần 1: 2^1 * 60,000 = 120,000ms (~2 phút)
      expect(updated.next_reconcile_at).toBeGreaterThanOrEqual(before + 119_000);
    });

    it('chuyển đơn sang expired khi quá 1 giờ và attempts >= 3 mà PayOS vẫn chưa thanh toán', async () => {
      const now = Date.now();
      // Đơn tạo 2 giờ trước (hết hạn > 1h)
      const order = createSubscriptionOrder(db, {
        orderCode: 1005,
        guildId: 'guild_expired',
        userId: 'user_1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now - 3_700_000,
      });

      db.prepare('UPDATE subscription_orders SET reconcile_attempts = 3 WHERE order_code = 1005').run();

      mockedGetPayosPaymentInfo.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'paylink_exp',
          orderCode: 1005,
          amount: 149_000,
          amountPaid: 0,
          amountRemaining: 149_000,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        },
      });

      const res = await reconcileSubscriptionOrder(db, 1005);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('expired');

      const updated = db
        .prepare('SELECT status FROM subscription_orders WHERE order_code = 1005')
        .get() as any;
      expect(updated.status).toBe('expired');
    });

    it('bảo vệ đơn hàng: khi PayOS gặp lỗi API, tăng retry và KHÔNG đổi trạng thái sang failed', async () => {
      createSubscriptionOrder(db, {
        orderCode: 1006,
        guildId: 'guild_api_err',
        userId: 'user_1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 900_000,
      });

      mockedGetPayosPaymentInfo.mockResolvedValueOnce({
        success: false,
        error: 'PayOS Gateway Timeout (HTTP 504)',
      });

      const res = await reconcileSubscriptionOrder(db, 1006);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('api_error');

      const updated = db
        .prepare('SELECT status, reconcile_attempts FROM subscription_orders WHERE order_code = 1006')
        .get() as any;
      expect(updated.status).toBe('pending');
      expect(updated.reconcile_attempts).toBe(1);
    });
  });

  describe('Reconciliation Worker Batch Processing', () => {
    it('quét và xử lý đúng danh sách các đơn pending đủ điều kiện', async () => {
      const now = Date.now();
      // Đơn 1: Đủ điều kiện (pending, next_reconcile_at null)
      createSubscriptionOrder(db, {
        orderCode: 2001,
        guildId: 'guild_w1',
        userId: 'u1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now + 500_000,
      });

      // Đơn 2: Đã hết hạn hơn 1 giờ -> không thuộc nhóm quét
      createSubscriptionOrder(db, {
        orderCode: 2002,
        guildId: 'guild_w2',
        userId: 'u2',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now - 4_000_000,
      });

      mockedGetPayosPaymentInfo.mockResolvedValue({
        success: true,
        data: {
          id: 'paylink_2001',
          orderCode: 2001,
          amount: 149_000,
          amountPaid: 149_000,
          amountRemaining: 0,
          status: 'PAID',
          createdAt: new Date().toISOString(),
        },
      });

      const reconciledCount = await runSubscriptionReconciler(db);
      expect(reconciledCount).toBe(1);
      expect(mockedGetPayosPaymentInfo).toHaveBeenCalledWith(2001);
      expect(mockedGetPayosPaymentInfo).not.toHaveBeenCalledWith(2002);
    });
  });

  describe('Subscription Expired Notice Card (Components V2)', () => {
    it('tạo container Components V2 đầy đủ thông báo lịch sự và watermark', () => {
      const card = buildSubscriptionExpiredNoticeCard();
      expect(card.components).toBeDefined();
      expect(card.components.length).toBe(1);
      expect(card.flags).toBeDefined();

      const containerStr = JSON.stringify(card.components[0]);
      expect(containerStr).toContain('Dịch Vụ Kéo Lão Bản Tạm Khóa');
      expect(containerStr).toContain('/setup');
      expect(containerStr).toContain('⚡');
    });
  });

  describe('Notification Receipt Delivery Guard', () => {
    it('gửi DM và thông báo không throw lỗi khi user chặn tin nhắn', async () => {
      const mockClient: any = {
        users: {
          send: jest.fn().mockRejectedValue(new Error('Cannot send messages to this user')),
        },
        guilds: {
          cache: new Map(),
        },
      };

      const order = {
        order_code: 3001,
        guild_id: 'guild_dm',
        user_id: 'user_blocked',
        package_type: '1_MONTH' as const,
        duration_days: 30,
        amount: 149_000,
        status: 'paid' as const,
        created_at: Date.now(),
        expires_at: Date.now() + 900_000,
        reconcile_attempts: 0,
      };

      const result = {
        success: true as const,
        status: 'paid' as const,
        guildId: 'guild_dm',
        durationDays: 30,
        newExpiry: Date.now() + 30 * 86_400_000,
        isLate: false,
      };

      // Đảm bảo không ném exception làm crash tiến trình
      await expect(
        sendSubscriptionReceiptNotification(mockClient, order, result),
      ).resolves.not.toThrow();
      expect(mockClient.users.send).toHaveBeenCalled();
    });
  });
});
