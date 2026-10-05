import { getMongoDb, isMongoConnected } from '../mongo.client.js';
import { MONGO_COLLECTIONS, GuildSettingsDocument } from '../collections.js';
import type { GuildSettings } from '../../../types/settings.types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('GuildSettingsMongoRepo');

/**
 * Lay settings cua 1 guild tu MongoDB.
 */
export async function getGuildSettingsFromMongo(guildId: string): Promise<GuildSettings | null> {
  if (!isMongoConnected()) return null;
  const db = getMongoDb();
  if (!db) return null;

  try {
    const doc = await db
      .collection<GuildSettingsDocument>(MONGO_COLLECTIONS.GUILD_SETTINGS)
      .findOne({ _id: guildId });

    return doc ? doc.settings : null;
  } catch (error) {
    logger.error(`Loi khi load guild settings cho guild ${guildId} tu MongoDB:`, { error });
    return null;
  }
}

/**
 * Luu settings cua guild len MongoDB (upsert).
 */
export async function saveGuildSettingsToMongo(
  guildId: string,
  settings: GuildSettings,
): Promise<void> {
  if (!isMongoConnected()) return;
  const db = getMongoDb();
  if (!db) return;

  try {
    await db.collection<GuildSettingsDocument>(MONGO_COLLECTIONS.GUILD_SETTINGS).updateOne(
      { _id: guildId },
      {
        $set: {
          _id: guildId,
          guildId,
          settings,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.error(`Loi khi luu guild settings cho guild ${guildId} len MongoDB:`, { error });
  }
}

/**
 * Load toan bo settings cua tat ca guilds tu MongoDB (dung de preload vao memory cache).
 */
export async function loadAllGuildSettingsFromMongo(): Promise<Map<string, GuildSettings>> {
  const map = new Map<string, GuildSettings>();
  if (!isMongoConnected()) return map;
  const db = getMongoDb();
  if (!db) return map;

  try {
    const cursor = db.collection<GuildSettingsDocument>(MONGO_COLLECTIONS.GUILD_SETTINGS).find({});

    const docs = await cursor.toArray();
    for (const doc of docs) {
      const gid = doc._id || doc.guildId;
      if (gid && doc.settings) {
        map.set(gid, doc.settings);
      }
    }
    logger.info(`✓ Da preload ${map.size} guild settings tu MongoDB vao bo nho cache.`);
  } catch (error) {
    logger.error('Loi khi load all guild settings tu MongoDB:', { error });
  }

  return map;
}
