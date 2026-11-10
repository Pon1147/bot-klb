/**
 * Unit tests cho DfMetadataService — Quản lý metadata động của Delta Force.
 */

import {
  resolveOperator,
  getLatestSeasonNo,
  getSeasonOptions,
  getSeasonLabel,
  resolveMapName,
  getAllSeasonIds,
  refreshDfMetadata,
  DEFAULT_AVATAR,
  FALLBACK_OPERATORS,
} from '../../src/services/df-metadata.service.js';

describe('DfMetadataService — Synchronous Getters (Fallback baseline)', () => {
  describe('resolveOperator', () => {
    it('nhận diện đúng các đặc vụ quen thuộc', () => {
      const stinger = resolveOperator('20003');
      expect(stinger.name).toBe('Stinger');
      expect(stinger.operatorId).toBe('20003');

      const luna = resolveOperator('40005');
      expect(luna.name).toBe('Luna');

      const tempest = resolveOperator('10012');
      expect(tempest.name).toBe('Tempest');
    });

    it('nhận diện đúng các đặc vụ mới nhất (Aramis Orgueil, Desmoulins, Athos Leal, N-2)', () => {
      const aramis = resolveOperator('60003');
      expect(aramis.name).toBe('Aramis Orgueil');
      expect(aramis.avatarUrl).toContain('e7ddf21aa8a5b232f666273cba8f5dfd');

      const desmoulins = resolveOperator('60001');
      expect(desmoulins.name).toBe('Desmoulins');

      const athos = resolveOperator('60002');
      expect(athos.name).toBe('Athos Leal');

      const n2 = resolveOperator('30012');
      expect(n2.name).toBe('N-2');
    });

    it('trả về fallback an toàn khi ID lạ', () => {
      const unknown = resolveOperator('999999');
      expect(unknown.name).toBe('Operator 999999');
      expect(unknown.avatarUrl).toBe(DEFAULT_AVATAR);
    });

    it('trả về fallback an toàn khi ID null hoặc undefined', () => {
      const emptyNull = resolveOperator(null);
      expect(emptyNull.name).toBe('Chiến binh');
      expect(emptyNull.operatorId).toBe('unknown');

      const emptyUndef = resolveOperator(undefined);
      expect(emptyUndef.name).toBe('Chiến binh');
    });
  });

  describe('Season Resolvers', () => {
    it('getLatestSeasonNo trả về mùa giải mới nhất', () => {
      const latest = getLatestSeasonNo();
      expect(typeof latest).toBe('string');
      expect(latest).toBe('10011');
    });

    it('getSeasonOptions trả về danh sách mùa giải giảm dần với Tổng Quan đầu tiên', () => {
      const options = getSeasonOptions();
      expect(options.length).toBeGreaterThan(5);
      expect(options[0]).toEqual({
        label: 'Tổng Quan',
        value: 'overview',
        seasonNo: 'overview',
      });
      // Mùa mới nhất nằm ở vị trí thứ 2
      expect(options[1].value).toBe('10011');
      expect(options[1].label).toBe('S11');
    });

    it('getSeasonLabel ánh xạ chính xác nhãn mùa giải', () => {
      expect(getSeasonLabel('overview')).toBe('Tổng Quan');
      expect(getSeasonLabel('10011')).toBe('S11');
      expect(getSeasonLabel('10001')).toBe('S1');
      expect(getSeasonLabel('random_unknown')).toBe('S?');
    });

    it('getAllSeasonIds trả về toàn bộ mã mùa giải', () => {
      const ids = getAllSeasonIds();
      expect(ids).toContain('10001');
      expect(ids).toContain('10011');
      expect(ids.length).toBe(10);
    });
  });

  describe('resolveMapName', () => {
    it('tra cứu đúng tên tiếng Việt của bản đồ', () => {
      expect(resolveMapName(1004)).toBe('Trạm Không Gian Haavk');
      expect(resolveMapName(1001)).toBe('Đập Nước Zero');
      expect(resolveMapName(1002)).toBe('Thung Lũng Layali');
    });

    it('xử lý chuỗi hoặc ID chưa rõ', () => {
      expect(resolveMapName('1004')).toBe('Trạm Không Gian Haavk');
      expect(resolveMapName(99999)).toBe('Bản đồ #99999');
      expect(resolveMapName(null)).toBe('Bản đồ không xác định');
      expect(resolveMapName(undefined)).toBe('Bản đồ không xác định');
    });
  });
});

describe('DfMetadataService — Dynamic Refresh & Error Handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('cập nhật dữ liệu mới khi CDN trả về mùa giải mới và đặc vụ mới', async () => {
    const mockOperatorsJs = `var basic_info_operators = [
      {
        "operator_id": "70001",
        "image_url": "https://playdeltaforce.com/sample.png",
        "language": { "vi": "Tân Binh Huyền Thoại" }
      }
    ];`;

    const mockSeasonsJs = `var basic_info_seasons = [
      { "season_id": "10001", "language": { "vi": "S1 - Genesis" } },
      { "season_id": "10012", "language": { "vi": "S12 – Bình Minh Mới" } }
    ];`;

    const mockMapsJs = `var basic_info_maps = {
      "maps": [
        { "map_id": 8888, "language": { "vi": "Chiến Trường Sa Mạc Mới" } }
      ]
    };`;

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('operators_vi.js')) {
        return Promise.resolve(new Response(mockOperatorsJs, { status: 200 }));
      }
      if (url.includes('seasons_vi.js')) {
        return Promise.resolve(new Response(mockSeasonsJs, { status: 200 }));
      }
      if (url.includes('maps_vi.js')) {
        return Promise.resolve(new Response(mockMapsJs, { status: 200 }));
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    await refreshDfMetadata();

    // Đặc vụ mới được nạp động
    const newOp = resolveOperator('70001');
    expect(newOp.name).toBe('Tân Binh Huyền Thoại');
    expect(newOp.avatarUrl).toBe('https://playdeltaforce.com/sample.png');

    // Mùa giải mới S12 trở thành Latest Season No
    expect(getLatestSeasonNo()).toBe('10012');
    expect(getSeasonLabel('10012')).toBe('S12');

    // Bản đồ mới được nhận diện
    expect(resolveMapName(8888)).toBe('Chiến Trường Sa Mạc Mới');
  });

  it('chuẩn hóa tên Gizmo thay vì "Thiết Bị" khi nạp từ CDN chính thức', async () => {
    const mockOperatorsJs = `var basic_info_operators = [
      {
        "operator_id": "30011",
        "image_url": "https://playdeltaforce.com/gizmo.png",
        "language": { "vi": "Thiết Bị" }
      },
      {
        "operator_id": "10012",
        "image_url": "https://playdeltaforce.com/tempest.png",
        "language": { "vi": "Tempest1" }
      }
    ];`;

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('operators_vi.js')) {
        return Promise.resolve(new Response(mockOperatorsJs, { status: 200 }));
      }
      return Promise.resolve(new Response('var dummy = [];', { status: 200 }));
    }) as any;

    await refreshDfMetadata();

    const gizmo = resolveOperator('30011');
    expect(gizmo.name).toBe('Gizmo');

    const tempest = resolveOperator('10012');
    expect(tempest.name).toBe('Tempest');
  });

  it('vẫn hoạt động an toàn và không throw exception khi fetch thất bại', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('CDN Network Outage')) as any;

    await expect(refreshDfMetadata()).resolves.not.toThrow();

    // Dữ liệu fallback vẫn truy vấn bình thường
    const op = resolveOperator('20003');
    expect(op.name).toBe('Stinger');
  });
});
