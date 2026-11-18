import Database from 'better-sqlite3';

export type KeoOrderStatus =
  'OPEN' | 'CLAIMED' | 'PAID' | 'WORKER_DONE' | 'COMPLETED' | 'CANCELLED';

export interface KeoOrderRecord {
  id: string;
  guild_id: string;
  ticket_channel_id: string;
  customer_id: string;
  package_name: string;
  amount: number;
  note: string | null;
  worker_id: string | null;
  status: KeoOrderStatus;
  dispatch_message_id: string | null;
  ticket_message_id: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Khởi tạo bảng lưu trữ đơn kéo Lão Bản (keo_orders).
 */
export function initializeKeoTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS keo_orders (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      ticket_channel_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      note TEXT,
      worker_id TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLAIMED', 'PAID', 'WORKER_DONE', 'COMPLETED', 'CANCELLED')),
      dispatch_message_id TEXT,
      ticket_message_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_keo_guild_status ON keo_orders(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_keo_ticket ON keo_orders(ticket_channel_id);
  `);
}

/**
 * Tạo một đơn kéo mới.
 */
export function createKeoOrder(database: Database.Database, order: KeoOrderRecord): void {
  database
    .prepare(
      `
      INSERT INTO keo_orders (
        id, guild_id, ticket_channel_id, customer_id, package_name,
        amount, note, worker_id, status, dispatch_message_id,
        ticket_message_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      order.id,
      order.guild_id,
      order.ticket_channel_id,
      order.customer_id,
      order.package_name,
      order.amount,
      order.note || null,
      order.worker_id || null,
      order.status,
      order.dispatch_message_id || null,
      order.ticket_message_id || null,
      order.created_at,
      order.updated_at,
    );
}

/**
 * Lấy thông tin đơn kéo theo ID.
 */
export function getKeoOrderById(
  database: Database.Database,
  orderId: string,
): KeoOrderRecord | undefined {
  return database.prepare(`SELECT * FROM keo_orders WHERE id = ?`).get(orderId) as
    KeoOrderRecord | undefined;
}

/**
 * Lấy đơn kéo đang hoạt động của kênh Ticket (chưa hoàn tất hoặc chưa hủy).
 */
export function getActiveKeoOrderByTicket(
  database: Database.Database,
  ticketChannelId: string,
): KeoOrderRecord | undefined {
  return database
    .prepare(
      `
      SELECT * FROM keo_orders
      WHERE ticket_channel_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
      ORDER BY created_at DESC LIMIT 1
    `,
    )
    .get(ticketChannelId) as KeoOrderRecord | undefined;
}

/**
 * Thợ nhận đơn kéo với Atomic Lock (người bấm đầu tiên giành đơn).
 * Trả về true nếu nhận thành công, false nếu đơn đã có người khác nhận trước.
 */
export function claimKeoOrder(
  database: Database.Database,
  orderId: string,
  workerId: string,
): boolean {
  const now = Date.now();
  const result = database
    .prepare(
      `
      UPDATE keo_orders
      SET status = 'CLAIMED', worker_id = ?, updated_at = ?
      WHERE id = ? AND status = 'OPEN'
    `,
    )
    .run(workerId, now, orderId);

  return result.changes === 1;
}

/**
 * Cập nhật trạng thái đơn kéo.
 */
export function updateKeoOrderStatus(
  database: Database.Database,
  orderId: string,
  status: KeoOrderStatus,
): boolean {
  const now = Date.now();
  const result = database
    .prepare(
      `
      UPDATE keo_orders
      SET status = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(status, now, orderId);

  return result.changes === 1;
}

/**
 * Cập nhật ID tin nhắn của thẻ trên Kênh Bắn Đơn và Kênh Ticket.
 */
export function updateKeoMessageIds(
  database: Database.Database,
  orderId: string,
  dispatchMessageId?: string | null,
  ticketMessageId?: string | null,
): void {
  const now = Date.now();
  if (dispatchMessageId && ticketMessageId) {
    database
      .prepare(
        `
        UPDATE keo_orders
        SET dispatch_message_id = ?, ticket_message_id = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(dispatchMessageId, ticketMessageId, now, orderId);
  } else if (dispatchMessageId) {
    database
      .prepare(
        `
        UPDATE keo_orders
        SET dispatch_message_id = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(dispatchMessageId, now, orderId);
  } else if (ticketMessageId) {
    database
      .prepare(
        `
        UPDATE keo_orders
        SET ticket_message_id = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(ticketMessageId, now, orderId);
  }
}
