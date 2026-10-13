import Database from 'better-sqlite3';
import {
  _setTestDb,
  disconnectMongo,
  initMongoIndexes,
  isMongoConnected,
} from '../../src/database/mongo/mongo.client.js';
import {
  initializeSellerTables,
  SellerDatabase,
  setSellerDb,
  syncSellerFromMongoToSqlite,
} from '../../src/database/seller.db.js';
import {
  upsertSellerProfileToMongo,
  deleteSellerProfileFromMongo,
  loadAllSellerProfilesFromMongo,
  upsertSellerTransactionToMongo,
  loadAllSellerTransactionsFromMongo,
  insertSellerReviewToMongo,
  loadAllSellerReviewsFromMongo,
} from '../../src/database/mongo/repositories/seller.repo.js';

describe('Seller MongoDB Integration & Sync', () => {
  let sqliteDb: Database.Database;
  let sellerDb: SellerDatabase;

  beforeEach(async () => {
    sqliteDb = new Database(':memory:');
    initializeSellerTables(sqliteDb);
    sellerDb = new SellerDatabase(sqliteDb);
    setSellerDb(sellerDb);
    await disconnectMongo();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    sqliteDb.close();
    setSellerDb(null);
    await disconnectMongo();
  });

  describe('When MongoDB is disconnected (offline fallback)', () => {
    it('isMongoConnected() trả về false', () => {
      expect(isMongoConnected()).toBe(false);
    });

    it('các hàm seller mongo repo không throw error khi offline', async () => {
      await expect(
        upsertSellerProfileToMongo({
          userId: 'user-1',
          guildId: 'guild-1',
          bankCode: '970422',
          bankName: 'MBBank',
          accountNumber: '0123456789',
          accountName: 'TEST',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      ).resolves.not.toThrow();

      await expect(deleteSellerProfileFromMongo('user-1', 'guild-1')).resolves.not.toThrow();
      expect(await loadAllSellerProfilesFromMongo()).toEqual([]);

      await expect(
        upsertSellerTransactionToMongo({
          txId: 'TX123',
          guildId: 'guild-1',
          channelId: 'ch-1',
          messageId: 'msg-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          amount: 100000,
          description: 'Keo rank',
          status: 'pending',
          note: null,
          processedBy: null,
          createdAt: Date.now(),
          processedAt: null,
        }),
      ).resolves.not.toThrow();

      expect(await loadAllSellerTransactionsFromMongo()).toEqual([]);

      await expect(
        insertSellerReviewToMongo({
          txId: 'TX123',
          sellerId: 'seller-1',
          buyerId: 'buyer-1',
          rating: 5,
          comment: 'Uy tin',
          createdAt: Date.now(),
        }),
      ).resolves.not.toThrow();

      expect(await loadAllSellerReviewsFromMongo()).toEqual([]);
    });

    it('syncSellerFromMongoToSqlite trả về 0 khi offline', async () => {
      const result = await syncSellerFromMongoToSqlite(sqliteDb);
      expect(result).toEqual({ profiles: 0, transactions: 0, reviews: 0 });
    });
  });

  describe('When MongoDB is connected (with mock Db)', () => {
    let mockCollections: Record<string, Map<string, any>>;

    beforeEach(() => {
      mockCollections = {
        seller_profiles: new Map(),
        seller_transactions: new Map(),
        seller_reviews: new Map(),
      };

      const createMockColl = (name: string) => {
        const store = mockCollections[name] || new Map();
        mockCollections[name] = store;

        return {
          createIndex: jest.fn().mockResolvedValue('idx_ok'),
          findOne: jest.fn(async (query: any) => {
            for (const item of store.values()) {
              let match = true;
              for (const [k, v] of Object.entries(query)) {
                if (item[k] !== v) {
                  match = false;
                  break;
                }
              }
              if (match) return item;
            }
            return null;
          }),
          updateOne: jest.fn(async (filter: any, update: any) => {
            const id =
              filter.tx_id ||
              `${filter.user_id}_${filter.guild_id}` ||
              JSON.stringify(filter);
            let existing = store.get(id) || { ...filter };
            if (update.$set) {
              existing = { ...existing, ...update.$set };
            }
            store.set(id, existing);
            return { acknowledged: true, upsertedCount: 1, modifiedCount: 1 };
          }),
          deleteOne: jest.fn(async (filter: any) => {
            const id = `${filter.user_id}_${filter.guild_id}`;
            store.delete(id);
            return { acknowledged: true, deletedCount: 1 };
          }),
          find: jest.fn(() => ({
            toArray: jest.fn(async () => Array.from(store.values())),
          })),
        };
      };

      const mockDb = {
        collection: jest.fn((name: string) => createMockColl(name)),
      } as any;

      _setTestDb(mockDb);
    });

    it('initMongoIndexes khởi tạo thành công index cho 3 collection seller', async () => {
      const ok = await initMongoIndexes();
      expect(ok).toBe(true);
    });

    it('SellerDatabase.upsertProfile tự động sync dữ liệu sang MongoDB', async () => {
      sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-100',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '99998888',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });

      // Đợi microtask event loop
      await new Promise((r) => setTimeout(r, 10));

      const profiles = await loadAllSellerProfilesFromMongo();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].user_id).toBe('seller-1');
      expect(profiles[0].account_number).toBe('99998888');
    });

    it('SellerDatabase.deleteProfile tự động sync xóa khỏi MongoDB', async () => {
      sellerDb.upsertProfile({
        userId: 'seller-1',
        guildId: 'guild-100',
        bankCode: '970422',
        bankName: 'MBBank',
        accountNumber: '99998888',
        accountName: 'NGUYEN VAN A',
        isActive: true,
      });
      await new Promise((r) => setTimeout(r, 10));

      sellerDb.deleteProfile('seller-1', 'guild-100');
      await new Promise((r) => setTimeout(r, 10));

      const profiles = await loadAllSellerProfilesFromMongo();
      expect(profiles).toHaveLength(0);
    });

    it('SellerDatabase.createTransaction và updateTransactionStatus tự động sync sang MongoDB', async () => {
      sellerDb.createTransaction({
        txId: 'TX-TEST-01',
        guildId: 'guild-100',
        channelId: 'ch-1',
        messageId: 'msg-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 250000,
        description: 'Keo map Az3',
        status: 'pending',
        note: null,
        processedBy: null,
        createdAt: Date.now(),
        processedAt: null,
      });
      await new Promise((r) => setTimeout(r, 10));

      let txs = await loadAllSellerTransactionsFromMongo();
      expect(txs).toHaveLength(1);
      expect(txs[0].tx_id).toBe('TX-TEST-01');
      expect(txs[0].status).toBe('pending');

      sellerDb.updateTransactionStatus('TX-TEST-01', 'confirmed', 'Da nhan du', 'seller-1');
      await new Promise((r) => setTimeout(r, 10));

      txs = await loadAllSellerTransactionsFromMongo();
      expect(txs[0].status).toBe('confirmed');
      expect(txs[0].note).toBe('Da nhan du');
    });

    it('SellerDatabase.createReview tự động sync sang MongoDB', async () => {
      sellerDb.createTransaction({
        txId: 'TX-TEST-REVIEW',
        guildId: 'guild-100',
        channelId: 'ch-1',
        messageId: 'msg-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 250000,
        description: 'Keo map Az3',
        status: 'confirmed',
        note: null,
        processedBy: null,
        createdAt: Date.now(),
        processedAt: Date.now(),
      });

      sellerDb.createReview({
        txId: 'TX-TEST-REVIEW',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        rating: 5,
        comment: 'Dich vu qua tuyet voi',
      });
      await new Promise((r) => setTimeout(r, 10));

      const reviews = await loadAllSellerReviewsFromMongo();
      expect(reviews).toHaveLength(1);
      expect(reviews[0].tx_id).toBe('TX-TEST-REVIEW');
      expect(reviews[0].rating).toBe(5);
      expect(reviews[0].comment).toBe('Dich vu qua tuyet voi');
    });

    it('syncSellerFromMongoToSqlite khôi phục hoàn chỉnh dữ liệu từ MongoDB vào SQLite', async () => {
      // 1. Giả lập MongoDB đã có sẵn dữ liệu từ trước
      const now = new Date();
      mockCollections.seller_profiles.set('seller-99_guild-1', {
        user_id: 'seller-99',
        guild_id: 'guild-1',
        bank_code: '970436',
        bank_name: 'Vietcombank',
        account_number: '1234567890',
        account_name: 'LE VAN B',
        is_active: true,
        created_at: now,
        updated_at: now,
      });

      mockCollections.seller_transactions.set('TX-RESTORE-1', {
        tx_id: 'TX-RESTORE-1',
        guild_id: 'guild-1',
        channel_id: 'ch-9',
        message_id: 'msg-9',
        buyer_id: 'buyer-99',
        seller_id: 'seller-99',
        amount: 300000,
        description: 'Keo layali',
        status: 'confirmed',
        note: 'Ok',
        processed_by: 'seller-99',
        created_at: now,
        processed_at: now,
      });

      mockCollections.seller_reviews.set('TX-RESTORE-1', {
        tx_id: 'TX-RESTORE-1',
        seller_id: 'seller-99',
        buyer_id: 'buyer-99',
        rating: 5,
        comment: 'Tuyet voi',
        created_at: now,
      });

      // 2. Tạo một SQLite database trống tinh (giả lập container vừa restart)
      const freshSqlite = new Database(':memory:');

      // 3. Chạy syncSellerFromMongoToSqlite
      const result = await syncSellerFromMongoToSqlite(freshSqlite);
      expect(result).toEqual({ profiles: 1, transactions: 1, reviews: 1 });

      // 4. Kiểm tra dữ liệu trong fresh SQLite đã có đầy đủ
      const freshSellerDb = new SellerDatabase(freshSqlite);
      const profile = freshSellerDb.getProfile('seller-99', 'guild-1');
      expect(profile).not.toBeNull();
      expect(profile?.accountName).toBe('LE VAN B');

      const tx = freshSellerDb.getTransaction('TX-RESTORE-1');
      expect(tx).not.toBeNull();
      expect(tx?.amount).toBe(300000);
      expect(tx?.status).toBe('confirmed');

      const review = freshSellerDb.getReviewByTxId('TX-RESTORE-1');
      expect(review).not.toBeNull();
      expect(review?.rating).toBe(5);

      freshSqlite.close();
    });
  });
});
