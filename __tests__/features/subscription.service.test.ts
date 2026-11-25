import Database from 'better-sqlite3';
import { initializeSubscriptionTables } from '../../src/database/subscription.db.js';
import {
  fulfillPayment,
  activateTrial,
  consumeLicenseKey,
  checkSubscriptionEntitlement,
  createSubscriptionOrder,
  getPendingOrderForGuild,
  generateSubscriptionKey,
  KEO_PACKAGES,
} from '../../src/features/subscription/subscription.service.js';

describe('Subscription Service — Spec V1.2 Invariants', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Sử dụng in-memory database với đầy đủ PRAGMA cho unit tests
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    initializeSubscriptionTables(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('INV-01: Exactly-Once Fulfillment & Idempotency', () => {
    it('Chỉ cộng hạn đúng 1 lần duy nhất khi nhận nhiều lần webhook cho cùng 1 order', () => {
      const guildId = 'guild_123';
      const order = createSubscriptionOrder(db, {
        orderCode: 10001,
        guildId,
        userId: 'user_456',
        packageType: '1_MONTH',
        durationDays: KEO_PACKAGES['1_MONTH'].durationDays,
        amount: KEO_PACKAGES['1_MONTH'].amount,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      // Lần 1: Fulfill thành công
      const result1 = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 149_000,
        paymentReference: 'PAYOS_REF_01',
        transactionTime: Date.now(),
      });

      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.status).toBe('paid');
        expect(result1.durationDays).toBe(30);
      }

      const entitlement1 = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement1.isEntitled).toBe(true);
      const firstExpiry = entitlement1.expiresAt!;

      // Lần 2: Webhook gửi lại cùng orderCode
      const result2 = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 149_000,
        paymentReference: 'PAYOS_REF_01',
        transactionTime: Date.now(),
      });

      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.reason).toBe('already_fulfilled');
      }

      // Hạn dùng không bị nhân đôi
      const entitlement2 = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement2.expiresAt).toBe(firstExpiry);
    });
  });

  describe('INV-02: Underpaid Protection', () => {
    it('Chuyển thiếu tiền lập tức chuyển sang underpaid và tuyệt đối KHÔNG kích hoạt license', () => {
      const guildId = 'guild_underpaid';
      const order = createSubscriptionOrder(db, {
        orderCode: 10002,
        guildId,
        userId: 'user_test',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      // Khách chuyển 50k thay vì 149k
      const result = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 50_000,
        paymentReference: 'PAYOS_REF_UNDER',
        transactionTime: Date.now(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('underpaid');
      }

      // Kiểm tra DB: order chuyển sang underpaid
      const dbOrder = db
        .prepare('SELECT * FROM subscription_orders WHERE order_code = ?')
        .get(order.order_code) as any;
      expect(dbOrder.status).toBe('underpaid');
      expect(dbOrder.actual_paid_amount).toBe(50_000);

      // Server chưa từng được kích hoạt license
      const entitlement = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement.isEntitled).toBe(false);
      expect(entitlement.expiresAt).toBeNull();
    });
  });

  describe('INV-03: Formula max(now, expires_at) + duration', () => {
    it('Bảo lưu thời hạn cũ khi server gia hạn sớm', () => {
      const guildId = 'guild_stacking';
      const now = Date.now();
      const initialRemainingDays = 10;
      const initialExpiry = now + initialRemainingDays * 86_400_000;

      // Khởi tạo server đang còn 10 ngày
      db.prepare(`
        INSERT INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
      `).run(guildId, initialExpiry, now, now);

      const order = createSubscriptionOrder(db, {
        orderCode: 10003,
        guildId,
        userId: 'user_stack',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now + 15 * 60 * 1000,
      });

      const result = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 149_000,
        paymentReference: 'PAYOS_REF_STACK',
        transactionTime: now,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Hạn mới = 10 ngày cũ + 30 ngày mới = 40 ngày từ now
        const expectedExpiry = initialExpiry + 30 * 86_400_000;
        expect(Math.abs(result.newExpiry - expectedExpiry)).toBeLessThan(1000);
      }
    });

    it('Tính từ now nếu server đã hết hạn', () => {
      const guildId = 'guild_expired_renew';
      const now = Date.now();
      const pastExpiry = now - 5 * 86_400_000; // Hết hạn 5 ngày trước

      db.prepare(`
        INSERT INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
      `).run(guildId, pastExpiry, now, now);

      const order = createSubscriptionOrder(db, {
        orderCode: 10004,
        guildId,
        userId: 'user_renew',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now + 15 * 60 * 1000,
      });

      const result = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 149_000,
        paymentReference: 'PAYOS_REF_RENEW',
        transactionTime: now,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Hạn mới = now + 30 ngày
        const expectedExpiry = now + 30 * 86_400_000;
        expect(Math.abs(result.newExpiry - expectedExpiry)).toBeLessThan(1000);
      }
    });
  });

  describe('INV-04: At-Most-Once Trial Activation', () => {
    it('Chỉ kích hoạt dùng thử 3 ngày đúng 1 lần cho mỗi guild', () => {
      const guildId = 'guild_trial_test';

      // Kích hoạt lần 1 -> Thành công
      const trial1 = activateTrial(db, guildId);
      expect(trial1.success).toBe(true);
      expect(trial1.reason).toBe('activated');

      const entitlement = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement.isEntitled).toBe(true);

      // Kích hoạt lần 2 -> Bị từ chối
      const trial2 = activateTrial(db, guildId);
      expect(trial2.success).toBe(false);
      expect(trial2.reason).toBe('already_used');
    });
  });

  describe('INV-05: License Key Redemption & Entropy', () => {
    it('Mã Key tiêu thụ nguyên tử, không thể dùng lại lần 2', () => {
      const guildId = 'guild_key_test';
      const keyRecord = generateSubscriptionKey(db, {
        durationDays: 30,
        createdBy: 'bot_owner_id',
        note: 'Tặng đối tác',
      });

      expect(keyRecord.key.startsWith('KLB-')).toBe(true);
      expect(keyRecord.status).toBe('unused');

      // Nhập key lần 1 -> Thành công
      const redeem1 = consumeLicenseKey(db, keyRecord.key, guildId, 'admin_user');
      expect(redeem1.success).toBe(true);
      expect(redeem1.durationDays).toBe(30);

      const entitlement = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement.isEntitled).toBe(true);

      // Nhập lại chính key đó ở server khác -> Bị từ chối
      const redeem2 = consumeLicenseKey(db, keyRecord.key, 'another_guild', 'admin_2');
      expect(redeem2.success).toBe(false);
      expect(redeem2.reason).toBe('already_used');
    });

    it('Từ chối key hết hạn kích hoạt', () => {
      const pastTime = Date.now() - 1000;
      const expiredKey = generateSubscriptionKey(db, {
        durationDays: 30,
        createdBy: 'bot_owner_id',
        expiresAt: pastTime,
      });

      const redeem = consumeLicenseKey(db, expiredKey.key, 'guild_test', 'user_1');
      expect(redeem.success).toBe(false);
      expect(redeem.reason).toBe('expired');
    });
  });

  describe('INV-06: Unique Payment Reference Constraint', () => {
    it('Chặn 2 đơn hàng khác nhau liên kết với cùng 1 payment_reference', () => {
      const order1 = createSubscriptionOrder(db, {
        orderCode: 20001,
        guildId: 'g1',
        userId: 'u1',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      const order2 = createSubscriptionOrder(db, {
        orderCode: 20002,
        guildId: 'g2',
        userId: 'u2',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      // Fulfill đơn 1 với ref 'SAME_REF'
      fulfillPayment(db, {
        orderCode: order1.order_code,
        actualAmount: 149_000,
        paymentReference: 'SAME_REF',
        transactionTime: Date.now(),
      });

      // Cố tình fulfill đơn 2 với cùng ref 'SAME_REF' -> Bị ném lỗi Sqlite constraint
      expect(() => {
        fulfillPayment(db, {
          orderCode: order2.order_code,
          actualAmount: 149_000,
          paymentReference: 'SAME_REF',
          transactionTime: Date.now(),
        });
      }).toThrow(/UNIQUE constraint failed/i);
    });
  });

  describe('Late Payment Recovery', () => {
    it('Tự động phục hồi đơn từ expired sang paid_late khi tiền về đủ', () => {
      const guildId = 'guild_late_recovery';
      const now = Date.now();
      const order = createSubscriptionOrder(db, {
        orderCode: 30001,
        guildId,
        userId: 'user_late',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: now - 1000, // Đã quá hạn
      });

      // Giả lập worker đã chuyển đơn sang expired
      db.prepare(`UPDATE subscription_orders SET status = 'expired' WHERE order_code = ?`).run(
        order.order_code,
      );

      // Khách quét QR trễ, tiền về thật
      const result = fulfillPayment(db, {
        orderCode: order.order_code,
        actualAmount: 149_000,
        paymentReference: 'LATE_PAY_REF',
        transactionTime: now,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe('paid_late');
        expect(result.isLate).toBe(true);
      }

      // Bản quyền vẫn được kích hoạt đầy đủ
      const entitlement = checkSubscriptionEntitlement(db, guildId);
      expect(entitlement.isEntitled).toBe(true);
    });
  });

  describe('Pending Order Reuse', () => {
    it('Tái sử dụng đơn pending còn hạn (< 15p) để chống spam order rác', () => {
      const guildId = 'guild_anti_spam';
      const order1 = createSubscriptionOrder(db, {
        orderCode: 40001,
        guildId,
        userId: 'user_spam',
        packageType: '1_MONTH',
        durationDays: 30,
        amount: 149_000,
        expiresAt: Date.now() + 10 * 60 * 1000, // Còn hạn 10p
      });

      const existing = getPendingOrderForGuild(db, guildId, '1_MONTH');
      expect(existing).toBeDefined();
      expect(existing?.order_code).toBe(order1.order_code);

      // Không tái sử dụng nếu yêu cầu gói khác (3 tháng)
      const diffPackage = getPendingOrderForGuild(db, guildId, '3_MONTHS');
      expect(diffPackage).toBeUndefined();
    });
  });
});
