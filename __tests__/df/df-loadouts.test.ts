/// <reference types="jest" />
/**
 * Unit tests cho df-loadouts.db.ts và weapon-loadouts.service.ts
 */

import Database from 'better-sqlite3';
import {
  initializeWeaponLoadoutsTable,
  upsertWeaponLoadouts,
  searchWeaponLoadouts,
  getDistinctWeaponNames,
  WeaponLoadoutRecord,
} from '../../src/database/df-loadouts.db.js';
import {
  fetchLoadoutsPage,
  syncWeaponLoadouts,
} from '../../src/features/delta-force/weapon-loadouts.service.js';

describe('df-loadouts.db', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeWeaponLoadoutsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  it('upsertWeaponLoadouts và searchWeaponLoadouts hoạt động chính xác', () => {
    const mockData: WeaponLoadoutRecord[] = [
      {
        weapon_name: 'AKM',
        weapon_type: 'Assault Rifle',
        game_mode: 'Hazard Operations',
        loadout_code: 'AKM-CODE-123',
        tags: 'Meta, Budget',
        description: 'Khẩu AKM sấy siêu đầm tay',
        image_url: 'https://example.com/akm.png',
        author: 'deltaforcetools.gg',
        server_region: 'Garena',
      },
      {
        weapon_name: 'CAR-15',
        weapon_type: 'Assault Rifle',
        game_mode: 'Hazard Operations',
        loadout_code: 'CAR15-CODE-456',
        tags: 'Top Tier',
        description: 'Vũ khí càn quét tầm gần',
        image_url: '',
        author: 'PonNe',
        server_region: 'Garena',
      },
    ];

    const inserted = upsertWeaponLoadouts(db, mockData);
    expect(inserted).toBe(2);

    // Tìm súng theo tên
    const akmResult = searchWeaponLoadouts(db, { weapon: 'akm' });
    expect(akmResult).toHaveLength(1);
    expect(akmResult[0].weapon_name).toBe('AKM');
    expect(akmResult[0].loadout_code).toBe('AKM-CODE-123');

    // Tìm súng không tồn tại
    const noneResult = searchWeaponLoadouts(db, { weapon: 'RocketLauncher' });
    expect(noneResult).toHaveLength(0);

    // getDistinctWeaponNames
    const names = getDistinctWeaponNames(db);
    expect(names).toEqual(['AKM', 'CAR-15']);
  });
});

describe('weapon-loadouts.service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeWeaponLoadoutsTable(db);
  });

  afterEach(() => {
    db.close();
    jest.restoreAllMocks();
  });

  it('syncWeaponLoadouts trả về lỗi khi không có token', async () => {
    const result = await syncWeaponLoadouts(db, '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing WEAPON_LOADOUTS_TOKEN');
  });

  it('fetchLoadoutsPage và syncWeaponLoadouts đồng bộ thành công khi mock API', async () => {
    const mockApiResponse = {
      code: 0,
      message: 'success',
      data: {
        list: [
          {
            weapon_name: 'M4A1',
            weapon_type: 'Assault Rifle',
            game_mode: 'Hazard Operations',
            loadout_code: 'M4A1-META-999',
            tags: 'Meta',
            description: 'Khẩu M4A1 leo rank',
            image_url: '',
            author: 'deltaforcetools.gg',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    } as any);

    const syncRes = await syncWeaponLoadouts(db, 'mock-valid-token');
    expect(syncRes.success).toBe(true);
    expect(syncRes.totalSynced).toBe(1);

    const m4a1InDb = searchWeaponLoadouts(db, { weapon: 'm4a1' });
    expect(m4a1InDb).toHaveLength(1);
    expect(m4a1InDb[0].loadout_code).toBe('M4A1-META-999');
  });
});

