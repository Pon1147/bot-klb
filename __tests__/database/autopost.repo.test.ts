/// <reference types="jest" />
import Database from 'better-sqlite3';
import {
  saveAutoPostConfigToMongo,
  saveAutoPostMessageToMongo,
  deleteAutoPostMessageFromMongo,
  syncAutoPostFromMongoToSqlite,
} from '../../src/database/mongo/repositories/autopost.repo.js';
import { _setTestDb } from '../../src/database/mongo/mongo.client.js';
import { initializeAutoPostTable, getAutoPostConfig, getAutoPostLastMessage } from '../../src/database/df-autopost.db.js';

describe('autopost.repo (MongoDB sync & persistence)', () => {
  let sqliteDb: Database.Database;
  let mockMongoDb: any;
  let mockConfigCollection: any;
  let mockMessageCollection: any;

  beforeEach(() => {
    sqliteDb = new Database(':memory:');
    initializeAutoPostTable(sqliteDb);

    const configStore = new Map<string, any>();
    const messageStore = new Map<string, any>();

    mockConfigCollection = {
      updateOne: jest.fn(async (filter, update, options) => {
        const id = filter._id;
        const current = configStore.get(id) || {};
        const updated = { ...current, ...update.$set };
        configStore.set(id, updated);
        return { acknowledged: true };
      }),
      find: jest.fn(() => ({
        toArray: async () => Array.from(configStore.values()),
      })),
    };

    mockMessageCollection = {
      updateOne: jest.fn(async (filter, update, options) => {
        const id = filter._id;
        const current = messageStore.get(id) || {};
        const updated = { ...current, ...update.$set };
        messageStore.set(id, updated);
        return { acknowledged: true };
      }),
      deleteOne: jest.fn(async (filter) => {
        messageStore.delete(filter._id);
        return { acknowledged: true, deletedCount: 1 };
      }),
      find: jest.fn(() => ({
        toArray: async () => Array.from(messageStore.values()),
      })),
    };

    mockMongoDb = {
      collection: jest.fn((name: string) => {
        if (name === 'df_autopost_config') return mockConfigCollection;
        if (name === 'df_autopost_messages') return mockMessageCollection;
        return null;
      }),
    };

    _setTestDb(mockMongoDb);
  });

  afterEach(() => {
    sqliteDb.close();
    _setTestDb(null as any);
    jest.clearAllMocks();
  });

  it('lưu cấu hình AutoPost lên MongoDB qua saveAutoPostConfigToMongo', async () => {
    await saveAutoPostConfigToMongo('map', { enabled: true, intervalHours: 4, lastRunAt: '2026-10-16T12:00:00Z' });

    expect(mockConfigCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'map' },
      expect.objectContaining({
        $set: expect.objectContaining({
          type: 'map',
          enabled: true,
          interval_hours: 4,
          last_run_at: '2026-10-16T12:00:00Z',
        }),
      }),
      { upsert: true },
    );
  });

  it('lưu và xóa AutoPost message lên MongoDB', async () => {
    await saveAutoPostMessageToMongo('guild-1', 'gun', 'chan-1', 'msg-123');

    expect(mockMessageCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'guild-1_gun' },
      expect.objectContaining({
        $set: expect.objectContaining({
          guild_id: 'guild-1',
          type: 'gun',
          channel_id: 'chan-1',
          message_id: 'msg-123',
        }),
      }),
      { upsert: true },
    );

    await deleteAutoPostMessageFromMongo('guild-1', 'gun');
    expect(mockMessageCollection.deleteOne).toHaveBeenCalledWith({ _id: 'guild-1_gun' });
  });

  it('đồng bộ dữ liệu từ MongoDB sang SQLite khi khởi động', async () => {
    // Giả lập dữ liệu trên MongoDB
    await saveAutoPostConfigToMongo('gun', { enabled: true, intervalHours: 2, lastRunAt: '2026-10-16T10:00:00Z' });
    await saveAutoPostMessageToMongo('guild-99', 'gun', 'chan-99', 'msg-999');

    // Giả lập SQLite ban đầu trống/mặc định (enabled = false, interval = 6)
    const beforeSync = getAutoPostConfig(sqliteDb, 'gun');
    expect(beforeSync.enabled).toBe(false);

    // Thực hiện đồng bộ
    const res = await syncAutoPostFromMongoToSqlite(sqliteDb);
    expect(res.configs).toBe(1);
    expect(res.messages).toBe(1);

    // Kiểm tra SQLite sau khi đồng bộ
    const afterSync = getAutoPostConfig(sqliteDb, 'gun');
    expect(afterSync.enabled).toBe(true);
    expect(afterSync.intervalHours).toBe(2);
    expect(afterSync.lastRunAt).toBe('2026-10-16T10:00:00Z');

    const msg = getAutoPostLastMessage(sqliteDb, 'guild-99', 'gun');
    expect(msg).not.toBeNull();
    expect(msg?.channelId).toBe('chan-99');
    expect(msg?.messageId).toBe('msg-999');
  });
});

