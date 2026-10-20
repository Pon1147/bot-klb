import { MongoClient, Db } from 'mongodb';
import { createLogger } from '../../utils/logger.js';
import { MONGO_COLLECTIONS } from './collections.js';

const logger = createLogger('MongoClient');

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;

/**
 * Ket noi den MongoDB instance.
 * Ho tro connection string tu Railway (MONGODB_URI hoac MONGO_URL).
 */
export async function connectMongo(uri?: string, dbName?: string): Promise<Db | null> {
  if (isConnected && db) {
    return db;
  }

  const connectionUri = uri !== undefined ? uri : process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!connectionUri || connectionUri.includes('${{')) {
    logger.debug('Khong co MONGODB_URI/MONGO_URL hop le duoc cau hinh, bo qua ket noi MongoDB.');
    return null;
  }

  try {
    logger.info('Dang ket noi den MongoDB...');
    client = new MongoClient(connectionUri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    const targetDbName = dbName !== undefined ? dbName : process.env.MONGODB_DB_NAME;
    db = targetDbName ? client.db(targetDbName) : client.db();
    isConnected = true;

    // Ping kiem tra ket noi
    await db.command({ ping: 1 });
    logger.info(`✓ Ket noi MongoDB thanh cong den database: "${db.databaseName}"`);

    return db;
  } catch (error) {
    logger.error('✗ Ket noi MongoDB that bai:', { error });
    client = null;
    db = null;
    isConnected = false;
    throw error;
  }
}

/**
 * Ngat ket noi MongoDB graceful shutdown.
 */
export async function disconnectMongo(): Promise<void> {
  if (client) {
    try {
      await client.close();
      logger.info('Da dong ket noi MongoDB thanh cong.');
    } catch (error) {
      logger.error('Loi khi dong ket noi MongoDB:', { error });
    } finally {
      client = null;
      db = null;
      isConnected = false;
    }
  }
}

/**
 * Lay database instance hien tai.
 */
export function getMongoDb(): Db | null {
  return db;
}

/**
 * Kiem tra xem MongoDB co dang ket noi khong.
 */
export function isMongoConnected(): boolean {
  return isConnected && db !== null;
}

/**
 * Test helper: inject mock Db instance cho unit tests.
 */
export function _setTestDb(mockDb: Db | null): void {
  db = mockDb;
  isConnected = mockDb !== null;
}

/**
 * Khoi tao cac Index can thiet tren MongoDB (Unique index & TTL index).
 * Chi goi 1 lan khi bootstrap bot.
 * Tra ve true neu tat ca indexes duoc khoi tao thanh cong, false neu that bai.
 */
export async function initMongoIndexes(): Promise<boolean> {
  if (!db) return false;

  try {
    // 1. Guild Settings: unique index theo guildId
    await db
      .collection(MONGO_COLLECTIONS.GUILD_SETTINGS)
      .createIndex({ guildId: 1 }, { unique: true, background: true });

    // 2. Account Bindings: unique index theo discord_user_id, index theo openid va status
    const bindings = db.collection(MONGO_COLLECTIONS.ACCOUNT_BINDINGS);
    await bindings.createIndex({ discord_user_id: 1 }, { unique: true, background: true });
    await bindings.createIndex({ openid: 1 }, { background: true });
    await bindings.createIndex({ status: 1 }, { background: true });

    // 3. Claim Sessions: unique index theo code, TTL index tu dong xoa session het han!
    const claims = db.collection(MONGO_COLLECTIONS.CLAIM_SESSIONS);
    await claims.createIndex({ code: 1 }, { unique: true, background: true });
    await claims.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, background: true });

    // 4. Capture Events: index theo discord_user_id va endpoint
    const events = db.collection(MONGO_COLLECTIONS.CAPTURE_EVENTS);
    await events.createIndex({ discord_user_id: 1 }, { background: true });
    await events.createIndex({ endpoint: 1 }, { background: true });

    // 5. DF Tokens (legacy): unique index theo discord_id
    await db
      .collection(MONGO_COLLECTIONS.DF_TOKENS)
      .createIndex({ discord_id: 1 }, { unique: true, background: true });

    // 6. Seller Profiles: compound unique index theo user_id + guild_id
    const sellerProfiles = db.collection(MONGO_COLLECTIONS.SELLER_PROFILES);
    await sellerProfiles.createIndex(
      { user_id: 1, guild_id: 1 },
      { unique: true, background: true },
    );
    await sellerProfiles.createIndex({ guild_id: 1 }, { background: true });

    // 7. Seller Transactions: unique index theo tx_id, index theo guild_id, seller_id, buyer_id, status
    const sellerTxs = db.collection(MONGO_COLLECTIONS.SELLER_TRANSACTIONS);
    await sellerTxs.createIndex({ tx_id: 1 }, { unique: true, background: true });
    await sellerTxs.createIndex({ guild_id: 1 }, { background: true });
    await sellerTxs.createIndex({ seller_id: 1 }, { background: true });
    await sellerTxs.createIndex({ buyer_id: 1 }, { background: true });
    await sellerTxs.createIndex({ status: 1 }, { background: true });

    // 8. Seller Reviews: unique index theo tx_id, index theo seller_id
    const sellerReviews = db.collection(MONGO_COLLECTIONS.SELLER_REVIEWS);
    await sellerReviews.createIndex({ tx_id: 1 }, { unique: true, background: true });
    await sellerReviews.createIndex({ seller_id: 1 }, { background: true });

    logger.info('✓ Khoi tao MongoDB indexes hoan tat (Unique & TTL indexes da san sang).');

    return true;
  } catch (error) {
    logger.error('Loi khi khoi tao MongoDB indexes:', { error });
    return false;
  }
}
