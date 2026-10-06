/// <reference types="jest" />
/**
 * Test cho MongoDB client va cac repositories.
 * Kiem tra hanh vi khi offline (fallback an toan) va khi mock connect.
 */

import Database from 'better-sqlite3';
import {
  isMongoConnected,
  getMongoDb,
  connectMongo,
  disconnectMongo,
  initMongoIndexes,
  _setTestDb,
} from '../../src/database/mongo/mongo.client.js';
import { MongoClient } from 'mongodb';
import * as MongoIndex from '../../src/database/mongo/index.js';
import * as MongoRepoIndex from '../../src/database/mongo/repositories/index.js';
import {
  getGuildSettingsFromMongo,
  saveGuildSettingsToMongo,
  loadAllGuildSettingsFromMongo,
} from '../../src/database/mongo/repositories/guild-settings.repo.js';
import {
  getAccountBindingFromMongo,
  getAccountBindingByOpenidFromMongo,
  upsertAccountBindingToMongo,
  revokeAccountBindingInMongo,
  touchLastOkInMongo,
  loadAllActiveBindingsFromMongo,
} from '../../src/database/mongo/repositories/df-binding.repo.js';
import {
  createClaimSessionInMongo,
  consumeClaimSessionAtomicInMongo,
} from '../../src/database/mongo/repositories/df-claim.repo.js';
import {
  initializeAccountBindingsTable,
  syncBindingsFromMongoToSqlite,
} from '../../src/database/df-binding.db.js';
import { SettingsService } from '../../src/services/settings.service.js';
import { cloneDefaultSettings } from '../../src/config/default.settings.js';

describe('MongoDB Module & Fallbacks', () => {
  beforeEach(async () => {
    // Dam bao khong co connection that
    await disconnectMongo();
  });

  afterEach(async () => {
    await disconnectMongo();
  });

  describe('When MongoDB is disconnected (offline / test mode)', () => {
    it('isMongoConnected() phai tra ve false va getMongoDb() phai la null', () => {
      expect(isMongoConnected()).toBe(false);
      expect(getMongoDb()).toBeNull();
    });

    it('connectMongo() khong co URI phai tra ve null va khong quang loi', async () => {
      const db = await connectMongo('');
      expect(db).toBeNull();
      expect(isMongoConnected()).toBe(false);
    });

    it('guild-settings repo phai fallback an toan khi offline', async () => {
      const settings = await getGuildSettingsFromMongo('123456');
      expect(settings).toBeNull();

      const all = await loadAllGuildSettingsFromMongo();
      expect(all.size).toBe(0);

      // Save khong duoc throw loi
      await expect(
        saveGuildSettingsToMongo('123456', cloneDefaultSettings()),
      ).resolves.not.toThrow();
    });

    it('df-binding repo phai fallback an toan khi offline', async () => {
      const binding = await getAccountBindingFromMongo('user1');
      expect(binding).toBeNull();

      const bindingByOpenid = await getAccountBindingByOpenidFromMongo('openid1');
      expect(bindingByOpenid).toBeNull();

      const all = await loadAllActiveBindingsFromMongo();
      expect(all).toEqual([]);

      await expect(
        upsertAccountBindingToMongo({
          discord_user_id: 'user1',
          openid: 'op1',
          cred_nonce: 'nonce',
          cred_ciphertext: 'cipher',
          cred_tag: 'tag',
        }),
      ).resolves.not.toThrow();

      await expect(revokeAccountBindingInMongo('user1')).resolves.not.toThrow();
      await expect(touchLastOkInMongo('user1')).resolves.not.toThrow();
    });

    it('df-claim repo phai fallback an toan khi offline', async () => {
      await expect(
        createClaimSessionInMongo('123456', 'user1', new Date(Date.now() + 60000)),
      ).resolves.not.toThrow();

      const consumeResult = await consumeClaimSessionAtomicInMongo('123456');
      expect(consumeResult.ok).toBe(false);
      expect(consumeResult.reason).toBe('mongo_not_connected');
    });

    it('syncBindingsFromMongoToSqlite phai tra ve 0 khi offline', async () => {
      const sqlite = new Database(':memory:');
      initializeAccountBindingsTable(sqlite);

      const count = await syncBindingsFromMongoToSqlite(sqlite);
      expect(count).toBe(0);

      sqlite.close();
    });

    it('SettingsService.initMongo() phai chay em xuoi khi offline', async () => {
      const sqlite = new Database(':memory:');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
          guild_id TEXT PRIMARY KEY,
          settings_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const service = new SettingsService(sqlite);
      await expect(service.initMongo()).resolves.not.toThrow();

      sqlite.close();
    });
  });

  describe('When MongoDB is connected (with mock Db)', () => {
    let mockCollections: Record<string, Record<string, any>>;

    beforeEach(() => {
      mockCollections = {};

      const createMockCollection = (_name: string) => {
        const store = new Map<string, any>();
        return {
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
          updateOne: jest.fn(async (filter: any, update: any, options?: any) => {
            const id = filter._id || filter.discord_user_id || JSON.stringify(filter);
            let existing = store.get(id) || { _id: filter._id, ...filter };
            if (update.$set) {
              existing = { ...existing, ...update.$set };
            }
            if (update.$setOnInsert && !store.has(id)) {
              existing = { ...existing, ...update.$setOnInsert };
            }
            store.set(id, existing);
            return { acknowledged: true, modifiedCount: 1, upsertedCount: options?.upsert ? 1 : 0 };
          }),
          insertOne: jest.fn(async (doc: any) => {
            const id = doc.code || doc._id || String(Date.now());
            store.set(id, doc);
            return { acknowledged: true, insertedId: id };
          }),
          findOneAndUpdate: jest.fn(async (filter: any, update: any) => {
            for (const [id, item] of store.entries()) {
              if (item.code === filter.code && item.status === filter.status) {
                if (filter.expires_at?.$gt && item.expires_at <= filter.expires_at.$gt) {
                  continue;
                }
                const updated = { ...item, ...update.$set };
                store.set(id, updated);
                return updated;
              }
            }
            return null;
          }),
          find: jest.fn((filter: any) => ({
            toArray: jest.fn(async () => {
              const res = [];
              for (const item of store.values()) {
                if (!filter || Object.keys(filter).length === 0) {
                  res.push(item);
                } else {
                  let match = true;
                  for (const [k, v] of Object.entries(filter)) {
                    if (item[k] !== v) match = false;
                  }
                  if (match) res.push(item);
                }
              }
              return res;
            }),
          })),
          _store: store,
        };
      };

      const mockDb = {
        collection: jest.fn((name: string) => {
          if (!mockCollections[name]) {
            mockCollections[name] = createMockCollection(name);
          }
          return mockCollections[name];
        }),
      } as any;

      _setTestDb(mockDb);
    });

    afterEach(() => {
      _setTestDb(null);
    });

    it('isMongoConnected() phai tra ve true', () => {
      expect(isMongoConnected()).toBe(true);
      expect(getMongoDb()).not.toBeNull();
    });

    it('guild-settings repo phai save va load dung tu Mongo', async () => {
      const defaultSettings = cloneDefaultSettings();
      defaultSettings.welcome.enabled = false;

      await saveGuildSettingsToMongo('guild-abc', defaultSettings);
      const loaded = await getGuildSettingsFromMongo('guild-abc');

      expect(loaded).toBeDefined();
      expect(loaded?.welcome.enabled).toBe(false);

      const all = await loadAllGuildSettingsFromMongo();
      expect(all.has('guild-abc')).toBe(true);
    });

    it('df-binding repo phai upsert, touch va load active bindings', async () => {
      await upsertAccountBindingToMongo({
        discord_user_id: 'user-999',
        openid: 'openid-999',
        cred_nonce: 'nonce-val',
        cred_ciphertext: 'cipher-val',
        cred_tag: 'tag-val',
      });

      const binding = await getAccountBindingFromMongo('user-999');
      expect(binding).toBeDefined();
      expect(binding?.openid).toBe('openid-999');
      expect(binding?.status).toBe('active');

      const byOpenid = await getAccountBindingByOpenidFromMongo('openid-999');
      expect(byOpenid?.discord_user_id).toBe('user-999');

      await touchLastOkInMongo('user-999');
      const touched = await getAccountBindingFromMongo('user-999');
      expect(touched?.last_ok_at).toBeDefined();

      const allActive = await loadAllActiveBindingsFromMongo();
      expect(allActive.length).toBe(1);

      await revokeAccountBindingInMongo('user-999');
      const revoked = mockCollections['account_bindings']._store.get('user-999');
      expect(revoked.status).toBe('revoked');
    });

    it('df-claim repo phai insert va atomic consume thanh cong', async () => {
      await createClaimSessionInMongo('CODE-123', 'user-456', new Date(Date.now() + 60000));

      const res = await consumeClaimSessionAtomicInMongo('CODE-123');
      expect(res.ok).toBe(true);
      expect(res.discordUserId).toBe('user-456');
    });

    it('df-claim repo atomic consume phai bao code_not_found khi code khong ton tai', async () => {
      const res = await consumeClaimSessionAtomicInMongo('NONEXISTENT');
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('code_not_found');
    });

    it('df-claim repo atomic consume phai bao code_already_consumed khi code da bi dung', async () => {
      await createClaimSessionInMongo('CODE-CONSUMED', 'user-789', new Date(Date.now() + 60000));
      const res1 = await consumeClaimSessionAtomicInMongo('CODE-CONSUMED');
      expect(res1.ok).toBe(true);

      const res2 = await consumeClaimSessionAtomicInMongo('CODE-CONSUMED');
      expect(res2.ok).toBe(false);
      expect(res2.reason).toBe('code_already_consumed');
    });

    it('df-claim repo atomic consume phai bao code_expired khi code da het han', async () => {
      await createClaimSessionInMongo('CODE-EXPIRED', 'user-expired', new Date(Date.now() - 5000));
      const res = await consumeClaimSessionAtomicInMongo('CODE-EXPIRED');
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('code_expired');
    });

    it('df-claim repo phai bat loi server_error khi MongoDB thao tac that bai', async () => {
      const claimColl = getMongoDb()!.collection('claim_sessions') as any;
      claimColl.findOneAndUpdate.mockRejectedValueOnce(new Error('DB Connection Timeout'));
      const res = await consumeClaimSessionAtomicInMongo('CODE-ERR');
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('server_error');

      claimColl.insertOne.mockRejectedValueOnce(new Error('Insert error'));
      await expect(
        createClaimSessionInMongo('CODE-ERR2', 'user-err', new Date()),
      ).resolves.not.toThrow();
    });

    it('df-binding repo va guild-settings repo phai an toan khi query Mongo nem loi', async () => {
      const bindingColl = getMongoDb()!.collection('account_bindings') as any;
      const guildColl = getMongoDb()!.collection('guild_settings') as any;

      bindingColl.findOne.mockRejectedValueOnce(new Error('Find error 1'));
      expect(await getAccountBindingFromMongo('err-user')).toBeNull();

      bindingColl.findOne.mockRejectedValueOnce(new Error('Find error 2'));
      expect(await getAccountBindingByOpenidFromMongo('err-openid')).toBeNull();

      bindingColl.updateOne.mockRejectedValueOnce(new Error('Update error'));
      await expect(
        upsertAccountBindingToMongo({
          discord_user_id: 'err-u',
          openid: 'op',
          cred_nonce: 'n',
          cred_ciphertext: 'c',
          cred_tag: 't',
        }),
      ).resolves.not.toThrow();

      bindingColl.updateOne.mockRejectedValueOnce(new Error('Revoke error'));
      await expect(revokeAccountBindingInMongo('err-u')).resolves.not.toThrow();

      bindingColl.updateOne.mockRejectedValueOnce(new Error('Touch error'));
      await expect(touchLastOkInMongo('err-u')).resolves.not.toThrow();

      bindingColl.find.mockReturnValueOnce({
        toArray: jest.fn().mockRejectedValueOnce(new Error('Cursor error')),
      });
      expect(await loadAllActiveBindingsFromMongo()).toEqual([]);

      guildColl.findOne.mockRejectedValueOnce(new Error('Guild find error'));
      expect(await getGuildSettingsFromMongo('guild-err')).toBeNull();

      guildColl.updateOne.mockRejectedValueOnce(new Error('Guild update error'));
      await expect(
        saveGuildSettingsToMongo('guild-err', cloneDefaultSettings()),
      ).resolves.not.toThrow();

      guildColl.find.mockReturnValueOnce({
        toArray: jest.fn().mockRejectedValueOnce(new Error('Guild cursor error')),
      });
      const allSettings = await loadAllGuildSettingsFromMongo();
      expect(allSettings.size).toBe(0);
    });

    it('syncBindingsFromMongoToSqlite phai sync data tu Mongo sang SQLite', async () => {
      await upsertAccountBindingToMongo({
        discord_user_id: 'user-sync-1',
        openid: 'openid-sync-1',
        cred_nonce: 'n',
        cred_ciphertext: 'c',
        cred_tag: 't',
      });

      const sqlite = new Database(':memory:');
      initializeAccountBindingsTable(sqlite);

      const count = await syncBindingsFromMongoToSqlite(sqlite);
      expect(count).toBe(1);

      const row = sqlite
        .prepare('SELECT * FROM df_account_bindings WHERE discord_user_id = ?')
        .get('user-sync-1') as any;
      expect(row).toBeDefined();
      expect(row.openid).toBe('openid-sync-1');

      sqlite.close();
    });

    it('SettingsService.initMongo() phai preload settings tu Mongo vao memory cache va SQLite', async () => {
      const defaultSettings = cloneDefaultSettings();
      defaultSettings.welcome.channelId = 'channel-mongo-123';
      await saveGuildSettingsToMongo('guild-mongo-1', defaultSettings);

      const sqlite = new Database(':memory:');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
          guild_id TEXT PRIMARY KEY,
          settings_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const service = new SettingsService(sqlite);
      await service.initMongo();

      const cached = service.get('guild-mongo-1');
      expect(cached.welcome.channelId).toBe('channel-mongo-123');

      // Test update syncs to Mongo
      service.update('guild-mongo-1', { welcome: { enabled: false } });
      const updatedInMongo = await getGuildSettingsFromMongo('guild-mongo-1');
      expect(updatedInMongo?.welcome.enabled).toBe(false);

      sqlite.close();
    });
  });

  describe('MongoClient lifecycle & index initialization', () => {
    let mockDbInstance: any;
    let connectSpy: jest.SpyInstance;
    let closeSpy: jest.SpyInstance;
    let dbSpy: jest.SpyInstance;

    beforeEach(() => {
      mockDbInstance = {
        databaseName: 'test-db',
        command: jest.fn().mockResolvedValue({ ok: 1 }),
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn().mockResolvedValue('index-created'),
        }),
      };

      connectSpy = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as any);
      closeSpy = jest.spyOn(MongoClient.prototype, 'close').mockResolvedValue(undefined);
      dbSpy = jest.spyOn(MongoClient.prototype, 'db').mockReturnValue(mockDbInstance);
    });

    afterEach(async () => {
      connectSpy.mockRestore();
      closeSpy.mockRestore();
      dbSpy.mockRestore();
      await disconnectMongo();
    });

    it('connectMongo phai bo qua connection URI chua template Railway ${{', async () => {
      const res = await connectMongo('${{ secrets.MONGODB_URI }}');
      expect(res).toBeNull();
      expect(isMongoConnected()).toBe(false);
    });

    it('connectMongo phai ket noi thanh cong, ping db va cache connection', async () => {
      const db1 = await connectMongo('mongodb://localhost:27017/test');
      expect(db1).toBe(mockDbInstance);
      expect(isMongoConnected()).toBe(true);
      expect(getMongoDb()).toBe(mockDbInstance);
      expect(mockDbInstance.command).toHaveBeenCalledWith({ ping: 1 });

      // Goi lai connectMongo khi dang ket noi phai tra ve ngay cached db
      const db2 = await connectMongo('mongodb://localhost:27017/test');
      expect(db2).toBe(mockDbInstance);
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('connectMongo phai nem loi va reset state khi client.connect that bai', async () => {
      connectSpy.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(connectMongo('mongodb://bad-host:27017/test')).rejects.toThrow('Connection refused');
      expect(isMongoConnected()).toBe(false);
      expect(getMongoDb()).toBeNull();
    });

    it('disconnectMongo phai dong client va reset state an toan du client.close nem loi', async () => {
      await connectMongo('mongodb://localhost:27017/test');
      expect(isMongoConnected()).toBe(true);

      closeSpy.mockRejectedValueOnce(new Error('Close error'));
      await expect(disconnectMongo()).resolves.not.toThrow();
      expect(isMongoConnected()).toBe(false);
      expect(getMongoDb()).toBeNull();
    });

    it('initMongoIndexes phai tra ve false khi chua ket noi DB', async () => {
      expect(await initMongoIndexes()).toBe(false);
    });

    it('initMongoIndexes phai tao day du unique va TTL indexes khi ket noi DB', async () => {
      _setTestDb(mockDbInstance);
      const ok = await initMongoIndexes();
      expect(ok).toBe(true);
      expect(mockDbInstance.collection).toHaveBeenCalledTimes(5);
    });

    it('initMongoIndexes phai bat loi va tra ve false khi createIndex that bai', async () => {
      mockDbInstance.collection = jest.fn().mockReturnValue({
        createIndex: jest.fn().mockRejectedValue(new Error('Index conflict')),
      });
      _setTestDb(mockDbInstance);
      const ok = await initMongoIndexes();
      expect(ok).toBe(false);
    });

    it('barrel exports cua database/mongo va repositories phai resolve dung cac functions', () => {
      expect(typeof MongoIndex.connectMongo).toBe('function');
      expect(typeof MongoIndex.getMongoDb).toBe('function');
      expect(typeof MongoIndex.initMongoIndexes).toBe('function');
      expect(typeof MongoIndex.getGuildSettingsFromMongo).toBe('function');
      expect(typeof MongoIndex.createClaimSessionInMongo).toBe('function');
      expect(typeof MongoRepoIndex.consumeClaimSessionAtomicInMongo).toBe('function');
      expect(typeof MongoRepoIndex.getAccountBindingFromMongo).toBe('function');
    });
  });
});
