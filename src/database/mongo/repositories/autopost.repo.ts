import type Database from 'better-sqlite3';
import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import {
  MONGO_COLLECTIONS,
  AutoPostConfigDocument,
  AutoPostMessageDocument,
} from '../collections.js';
import type { AutoPostContentType } from '../../df-autopost.db.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('AutoPostMongoRepo');

/**
 * Lưu hoặc cập nhật cấu hình AutoPost toàn cục lên MongoDB.
 */
export async function saveAutoPostConfigToMongo(
  type: AutoPostContentType,
  config: {
    enabled: boolean;
    intervalHours: number;
    lastRunAt?: string | null;
  },
): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<AutoPostConfigDocument>(MONGO_COLLECTIONS.AUTOPOST_CONFIG).updateOne(
      { _id: type },
      {
        $set: {
          _id: type,
          type,
          enabled: config.enabled,
          interval_hours: config.intervalHours,
          last_run_at: config.lastRunAt ?? null,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Lỗi khi lưu cấu hình AutoPost (${type}) lên MongoDB:`, { error });
  }
}

/**
 * Lưu hoặc cập nhật ID tin nhắn AutoPost mới nhất lên MongoDB.
 */
export async function saveAutoPostMessageToMongo(
  guildId: string,
  type: AutoPostContentType,
  channelId: string,
  messageId: string,
): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  const docId = `${guildId}_${type}`;
  try {
    await db.collection<AutoPostMessageDocument>(MONGO_COLLECTIONS.AUTOPOST_MESSAGES).updateOne(
      { _id: docId },
      {
        $set: {
          _id: docId,
          guild_id: guildId,
          type,
          channel_id: channelId,
          message_id: messageId,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Lỗi khi lưu AutoPost message (${docId}) lên MongoDB:`, { error });
  }
}

/**
 * Xóa thông tin tin nhắn AutoPost khỏi MongoDB khi không còn tồn tại.
 */
export async function deleteAutoPostMessageFromMongo(
  guildId: string,
  type: AutoPostContentType,
): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  const docId = `${guildId}_${type}`;
  try {
    await db.collection<AutoPostMessageDocument>(MONGO_COLLECTIONS.AUTOPOST_MESSAGES).deleteOne({
      _id: docId,
    });
  } catch (error) {
    logger.error(`Lỗi khi xóa AutoPost message (${docId}) khỏi MongoDB:`, { error });
  }
}

/**
 * Đồng bộ toàn bộ AutoPost configs và messages từ MongoDB sang SQLite khi bot khởi động.
 */
export async function syncAutoPostFromMongoToSqlite(
  database: Database.Database,
): Promise<{ configs: number; messages: number }> {
  if (!isMongoConnected()) return { configs: 0, messages: 0 };
  const db = getMongoDb();
  if (!db) return { configs: 0, messages: 0 };

  let configCount = 0;
  let messageCount = 0;

  try {
    // 1. Đồng bộ cấu hình AutoPost ('map', 'gun')
    const configDocs = await db
      .collection<AutoPostConfigDocument>(MONGO_COLLECTIONS.AUTOPOST_CONFIG)
      .find({})
      .toArray();

    const insertConfigStmt = database.prepare(`
      INSERT INTO df_autopost_config (type, enabled, interval_hours, last_run_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(type) DO UPDATE SET
        enabled = excluded.enabled,
        interval_hours = excluded.interval_hours,
        last_run_at = excluded.last_run_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const doc of configDocs) {
      insertConfigStmt.run(
        doc.type,
        doc.enabled ? 1 : 0,
        doc.interval_hours,
        doc.last_run_at ?? null,
      );
      configCount++;
    }

    // 2. Đồng bộ danh sách tin nhắn AutoPost cũ để tiếp tục dọn dẹp không làm trôi bài
    const messageDocs = await db
      .collection<AutoPostMessageDocument>(MONGO_COLLECTIONS.AUTOPOST_MESSAGES)
      .find({})
      .toArray();

    const insertMsgStmt = database.prepare(`
      INSERT INTO df_autopost_messages (guild_id, type, channel_id, message_id, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, type) DO UPDATE SET
        channel_id = excluded.channel_id,
        message_id = excluded.message_id,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const msg of messageDocs) {
      insertMsgStmt.run(msg.guild_id, msg.type, msg.channel_id, msg.message_id);
      messageCount++;
    }
  } catch (error) {
    logger.error('Lỗi khi đồng bộ AutoPost từ MongoDB sang SQLite:', { error });
  }

  return { configs: configCount, messages: messageCount };
}
