import Database from 'better-sqlite3';
import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import { MONGO_COLLECTIONS, GuildSubscriptionDocument } from '../collections.js';
import type { GuildSubscriptionRecord } from '../../subscription.db.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('GuildSubscriptionMongoRepo');

/**
 * Lưu thông tin bản quyền và trạng thái dùng thử của Guild lên MongoDB (upsert).
 */
export async function saveGuildSubscriptionToMongo(sub: GuildSubscriptionRecord): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<GuildSubscriptionDocument>(MONGO_COLLECTIONS.GUILD_SUBSCRIPTIONS).updateOne(
      { _id: sub.guild_id },
      {
        $set: {
          _id: sub.guild_id,
          guild_id: sub.guild_id,
          license_expires_at: sub.license_expires_at,
          trial_used: sub.trial_used,
          created_at: sub.created_at,
          updated_at: sub.updated_at,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Lỗi khi lưu subscription của guild ${sub.guild_id} lên MongoDB:`, { error });
  }
}

/**
 * Lấy thông tin bản quyền của guild từ MongoDB.
 */
export async function getGuildSubscriptionFromMongo(
  guildId: string,
): Promise<GuildSubscriptionRecord | null> {
  if (!isMongoConnected()) return null;
  const db = getMongoDb();
  if (!db) return null;

  try {
    const doc = await db
      .collection<GuildSubscriptionDocument>(MONGO_COLLECTIONS.GUILD_SUBSCRIPTIONS)
      .findOne({ _id: guildId });

    if (!doc) return null;
    return {
      guild_id: doc.guild_id,
      license_expires_at: doc.license_expires_at,
      trial_used: doc.trial_used,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    };
  } catch (error) {
    logger.error(`Lỗi khi load subscription cho guild ${guildId} từ MongoDB:`, { error });
    return null;
  }
}

/**
 * Lấy toàn bộ subscriptions từ MongoDB.
 */
export async function loadAllGuildSubscriptionsFromMongo(): Promise<GuildSubscriptionRecord[]> {
  if (!isMongoConnected()) return [];
  const db = getMongoDb();
  if (!db) return [];

  try {
    const docs = await db
      .collection<GuildSubscriptionDocument>(MONGO_COLLECTIONS.GUILD_SUBSCRIPTIONS)
      .find({})
      .toArray();

    return docs.map((doc) => ({
      guild_id: doc.guild_id,
      license_expires_at: doc.license_expires_at,
      trial_used: doc.trial_used,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }));
  } catch (error) {
    logger.error('Lỗi khi load danh sách subscriptions từ MongoDB:', { error });
    return [];
  }
}

/**
 * Đồng bộ toàn bộ dữ liệu bản quyền từ MongoDB sang local SQLite khi bot khởi động.
 * Đảm bảo nguyên tắc bảo toàn:
 * - trial_used = MAX(local, remote) => một khi đã dùng thử thì không thể reset về 0.
 * - license_expires_at giữ giá trị lớn hơn hoặc hợp nhất mới nhất.
 */
export async function syncSubscriptionsFromMongoToSqlite(
  database: Database.Database,
): Promise<number> {
  if (!isMongoConnected()) return 0;
  const db = getMongoDb();
  if (!db) return 0;

  try {
    const subs = await loadAllGuildSubscriptionsFromMongo();
    if (subs.length === 0) return 0;

    const stmt = database.prepare(`
      INSERT INTO guild_subscriptions (guild_id, license_expires_at, trial_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        license_expires_at = CASE
          WHEN excluded.license_expires_at IS NOT NULL AND (guild_subscriptions.license_expires_at IS NULL OR excluded.license_expires_at > guild_subscriptions.license_expires_at)
          THEN excluded.license_expires_at
          ELSE guild_subscriptions.license_expires_at
        END,
        trial_used = MAX(guild_subscriptions.trial_used, excluded.trial_used),
        updated_at = MAX(guild_subscriptions.updated_at, excluded.updated_at)
    `);

    const syncTransaction = database.transaction((records: GuildSubscriptionRecord[]) => {
      let count = 0;
      for (const rec of records) {
        stmt.run(
          rec.guild_id,
          rec.license_expires_at,
          rec.trial_used,
          rec.created_at,
          rec.updated_at,
        );
        count++;
      }
      return count;
    });

    return syncTransaction(subs);
  } catch (error) {
    logger.error('Lỗi khi đồng bộ subscriptions từ MongoDB sang SQLite:', { error });
    return 0;
  }
}
