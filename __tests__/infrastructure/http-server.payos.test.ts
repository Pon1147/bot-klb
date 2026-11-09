import http from 'node:http';
import Database from 'better-sqlite3';
import { createRequestHandler } from '../../src/infrastructure/http/http-server.js';
import { initializePaymentTables } from '../../src/database/payment.db.js';
import {
  createDonation,
  getDonationByOrderCode,
} from '../../src/features/payment/payment.service.js';
import { generatePayosSignature } from '../../src/services/payos.service.js';
import { botConfig } from '../../src/config/bot.config.js';

describe('HttpServer PayOS Webhook', () => {
  let db: Database.Database;
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll((done) => {
    db = new Database(':memory:');
    initializePaymentTables(db);

    const mockClient: any = {
      database: db,
      guilds: { cache: new Map() },
    };

    server = http.createServer(createRequestHandler(mockClient));
    server.listen(0, () => {
      const address = server.address() as any;
      port = address.port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      db.close();
      done();
    });
  });

  it('trả về trang HTML cảm ơn khi người dùng truy cập GET /webhook/payment (returnUrl)', async () => {
    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Cảm Ơn Bạn Đã Ủng Hộ');
  });

  it('phản hồi thành công handshake xác minh webhookUrl từ PayOS Dashboard', async () => {
    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: 'https://my-domain.com/webhook/payment' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.message).toContain('Webhook URL verified successfully');
  });

  it('xác thực thành công và đánh dấu đơn quyên góp đã thanh toán khi nhận webhook hợp lệ', async () => {
    const orderCode = 998877;
    createDonation(db, {
      order_code: orderCode,
      user_id: 'donor_user_1',
      user_tag: 'Donor#9999',
      guild_id: 'guild_1',
      amount: 50000,
      message: 'Buy a coffee',
      status: 'pending',
      created_at: Date.now(),
    });

    const data = {
      orderCode,
      amount: 50000,
      description: 'Donate test',
      accountNumber: '1234567890',
      reference: 'REF123456',
      transactionDateTime: '2026-11-09 18:00:00',
      currency: 'VND',
      paymentLinkId: 'plink_abc',
      code: '00',
      desc: 'success',
    };

    const signature = generatePayosSignature(data, botConfig.payosChecksumKey);

    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        desc: 'success',
        data,
        signature,
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.code).toBe('00');

    // Kiểm tra trong DB trạng thái đã đổi thành paid
    const updatedDonation = getDonationByOrderCode(db, orderCode);
    expect(updatedDonation?.status).toBe('paid');
    expect(updatedDonation?.paid_at).toBeGreaterThan(0);
  });

  it('từ chối khi chữ ký webhook không hợp lệ (Invalid signature)', async () => {
    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        desc: 'success',
        data: {
          orderCode: 112233,
          amount: 10000,
        },
        signature: 'fake_invalid_signature',
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid signature');
  });
});
