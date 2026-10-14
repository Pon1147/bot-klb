/// <reference types="jest" />
import Database from 'better-sqlite3';
import {
  initializeAutoPostTable,
  getAutoPostConfig,
  getAllAutoPostConfigs,
  updateAutoPostConfig,
  getAutoPostLastMessage,
  saveAutoPostLastMessage,
  deleteAutoPostLastMessage,
} from '../../src/database/df-autopost.db.js';

describe('df-autopost.db', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeAutoPostTable(db);
  });

  afterEach(() => {
    db.close();
  });

  it('khởi tạo bảng với dữ liệu mặc định cho map và gun', () => {
    const configs = getAllAutoPostConfigs(db);
    expect(configs).toHaveLength(2);

    const mapConfig = getAutoPostConfig(db, 'map');
    expect(mapConfig.type).toBe('map');
    expect(mapConfig.enabled).toBe(false);
    expect(mapConfig.intervalHours).toBe(6);
    expect(mapConfig.lastRunAt).toBeNull();

    const gunConfig = getAutoPostConfig(db, 'gun');
    expect(gunConfig.type).toBe('gun');
    expect(gunConfig.enabled).toBe(false);
    expect(gunConfig.intervalHours).toBe(6);
  });

  it('updateAutoPostConfig cập nhật intervalHours và enabled', () => {
    updateAutoPostConfig(db, 'map', { enabled: true, intervalHours: 12 });

    const updated = getAutoPostConfig(db, 'map');
    expect(updated.enabled).toBe(true);
    expect(updated.intervalHours).toBe(12);

    // gun không bị ảnh hưởng
    const gunConfig = getAutoPostConfig(db, 'gun');
    expect(gunConfig.enabled).toBe(false);
    expect(gunConfig.intervalHours).toBe(6);
  });

  it('updateAutoPostConfig cập nhật lastRunAt', () => {
    const nowStr = new Date().toISOString();
    updateAutoPostConfig(db, 'gun', { lastRunAt: nowStr });

    const updated = getAutoPostConfig(db, 'gun');
    expect(updated.lastRunAt).toBe(nowStr);
    expect(updated.enabled).toBe(false); // giữ nguyên
  });

  it('lưu, đọc và cập nhật last_message_id cho từng guild và loại nội dung', () => {
    // Chưa lưu gì -> trả về null
    expect(getAutoPostLastMessage(db, 'guild-1', 'gun')).toBeNull();

    // Lưu lần 1
    saveAutoPostLastMessage(db, 'guild-1', 'gun', 'chan-1', 'msg-100');
    const msg1 = getAutoPostLastMessage(db, 'guild-1', 'gun');
    expect(msg1).not.toBeNull();
    expect(msg1?.channelId).toBe('chan-1');
    expect(msg1?.messageId).toBe('msg-100');

    // Lưu đè lần 2 (cùng guild, cùng type)
    saveAutoPostLastMessage(db, 'guild-1', 'gun', 'chan-1', 'msg-200');
    const msg2 = getAutoPostLastMessage(db, 'guild-1', 'gun');
    expect(msg2?.messageId).toBe('msg-200');

    // Không ảnh hưởng đến loại 'map' của cùng guild
    expect(getAutoPostLastMessage(db, 'guild-1', 'map')).toBeNull();

    // Xóa bản ghi
    deleteAutoPostLastMessage(db, 'guild-1', 'gun');
    expect(getAutoPostLastMessage(db, 'guild-1', 'gun')).toBeNull();
  });
});


