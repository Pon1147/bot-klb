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

  let mockUsersSend: jest.Mock;

  beforeAll((done) => {
    if (!botConfig.payosChecksumKey) {
      botConfig.payosChecksumKey = 'test-payos-checksum-key-123456789';
    }
    db = new Database(':memory:');
    initializePaymentTables(db);

    mockUsersSend = jest.fn().mockResolvedValue({});
    const mockClient: any = {
      database: db,
      guilds: { cache: new Map() },
      users: { send: mockUsersSend },
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

    // Kiểm tra đã gửi tin nhắn cảm ơn qua DM cho donor
    expect(mockUsersSend).toHaveBeenCalledWith(
      'donor_user_1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringContaining('Cảm Ơn'),
            }),
          }),
        ]),
      }),
    );
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

  it('từ chối khi dữ liệu webhook bị giả mạo / thay đổi sau khi ký (Tampered Payload)', async () => {
    const originalData = {
      orderCode: 112244,
      amount: 10000,
      description: 'Original description',
    };
    const validSignature = generatePayosSignature(originalData, botConfig.payosChecksumKey);

    // Dữ liệu bị kẻ tấn công thay đổi amount từ 10,000 lên 100,000 mà giữ signature cũ
    const tamperedData = {
      ...originalData,
      amount: 100000,
    };

    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        desc: 'success',
        data: tamperedData,
        signature: validSignature,
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error).toBe('Invalid signature');
  });

  it('không cập nhật trạng thái paid nếu payload.code khác 00', async () => {
    const orderCode = 998878;
    createDonation(db, {
      order_code: orderCode,
      user_id: 'donor_user_2',
      user_tag: 'Donor2#9999',
      guild_id: 'guild_1',
      amount: 20000,
      message: 'Failed test',
      status: 'pending',
      created_at: Date.now(),
    });

    const data = {
      orderCode,
      amount: 20000,
      description: 'Failed pay',
      code: '01',
      desc: 'failed',
    };

    const signature = generatePayosSignature(data, botConfig.payosChecksumKey);

    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '01',
        desc: 'failed',
        data,
        signature,
      }),
    });

    expect(res.status).toBe(200);
    const updated = getDonationByOrderCode(db, orderCode);
    expect(updated?.status).toBe('pending');
  });

  it('xử lý idempotent khi nhận webhook trùng lặp (Duplicate Webhook Delivery)', async () => {
    const orderCode = 998879;
    createDonation(db, {
      order_code: orderCode,
      user_id: 'donor_user_dup',
      user_tag: 'DonorDup#9999',
      guild_id: 'guild_1',
      amount: 30000,
      message: 'Idempotency test',
      status: 'pending',
      created_at: Date.now(),
    });

    const data = {
      orderCode,
      amount: 30000,
      description: 'Idempotent donation',
      code: '00',
      desc: 'success',
    };
    const signature = generatePayosSignature(data, botConfig.payosChecksumKey);

    mockUsersSend.mockClear();

    // Delivery 1
    const res1 = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00', desc: 'success', data, signature }),
    });
    expect(res1.status).toBe(200);
    expect(mockUsersSend).toHaveBeenCalledTimes(1);

    // Delivery 2 (Duplicate replay)
    const res2 = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00', desc: 'success', data, signature }),
    });
    expect(res2.status).toBe(200);
    // Vẫn chỉ gọi DM 1 lần, không gửi duplicate DM
    expect(mockUsersSend).toHaveBeenCalledTimes(1);

    const donation = getDonationByOrderCode(db, orderCode);
    expect(donation?.status).toBe('paid');
  });

  it('bảo toàn trạng thái thanh toán nếu gửi DM Discord thất bại (DM Failure Isolation)', async () => {
    const orderCode = 998880;
    createDonation(db, {
      order_code: orderCode,
      user_id: 'donor_user_closed_dm',
      user_tag: 'DonorClosedDM#9999',
      guild_id: 'guild_1',
      amount: 40000,
      message: 'DM closed test',
      status: 'pending',
      created_at: Date.now(),
    });

    const data = {
      orderCode,
      amount: 40000,
      description: 'DM fail donation',
      code: '00',
      desc: 'success',
    };
    const signature = generatePayosSignature(data, botConfig.payosChecksumKey);

    mockUsersSend.mockRejectedValueOnce(new Error('Cannot send messages to this user'));

    const res = await fetch(`${baseUrl}/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '00', desc: 'success', data, signature }),
    });

    expect(res.status).toBe(200);
    // Trạng thái DB vẫn là paid dù gửi DM thất bại
    const donation = getDonationByOrderCode(db, orderCode);
    expect(donation?.status).toBe('paid');
  });
});
