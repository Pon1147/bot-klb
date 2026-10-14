/// <reference types="jest" />
import Database from 'better-sqlite3';
import {
  initializeAutoPostTable,
  getAutoPostConfig,
  getAllAutoPostConfigs,
  updateAutoPostConfig,
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
});

