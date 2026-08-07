/**
 * Unit tests cho deltaforce.api.ts — API service functions.
 * Mock axios để test request/response mà không gọi real API.
 */

jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => ({
      post: jest.fn(),
    })),
  };
  return mockAxios;
}, { virtual: true });

const MOCK_TOKEN = { openid: '1234567890', token: 'abc123def456' };

describe('deltaforce.api', () => {
  let getMyData: (token: any) => Promise<any>;
  let getSeasonData: (token: any, seasonNo: string) => Promise<any>;
  let getMatchList: (token: any) => Promise<any>;
  let getCollection: (token: any) => Promise<any>;
  let getDailyReport: (token: any) => Promise<any>;
  let mockPost: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    const axios = require('axios');
    mockPost = jest.fn();
    axios.create.mockReturnValue({ post: mockPost });

    ({ getMyData, getSeasonData, getMatchList, getCollection, getDailyReport } =
      require('../../src/services/deltaforce.api.js'));
  });

  function mockSuccess(data: any) {
    mockPost.mockResolvedValue({ data: { code: 0, msg: 'ok', data } });
  }

  function mockError(code = -1, msg = 'error') {
    mockPost.mockResolvedValue({ data: { code, msg, data: null } });
  }

  describe('getMyData', () => {
    it('nên trả về player info khi API thành công', async () => {
      const mockData = {
        player_info: { nickname: 'TestPlayer', level: 50, avatar: '', play_duration: '100', register_time: '1609459200' },
        rank_data: { current_rank: 'Vàng', current_rank_score: 2000, highest_rank: 'Bạch Kim', highest_rank_season_id: 8 },
        summary_data: { bf_combat: null, combat: null, economy: null, performance: null, team: null, total_match_count: 200, vehicle: null },
      };
      mockSuccess(mockData);
      const result = await getMyData(MOCK_TOKEN);
      expect(result).toEqual(mockData);
      expect(mockPost).toHaveBeenCalledWith('/GetMyData', expect.any(Object));
    });

    it('nên throw error khi API thất bại', async () => {
      mockError(-1, 'Invalid token');
      await expect(getMyData(MOCK_TOKEN)).rejects.toThrow('GetMyData failed');
    });
  });

  describe('getSeasonData', () => {
    it('nên gửi đúng seasonNo', async () => {
      mockSuccess({});
      await getSeasonData(MOCK_TOKEN, '10009');
      const body = mockPost.mock.calls[0][1];
      expect(body.seasonno).toEqual(['10009']);
    });

    it('nên throw error khi API thất bại', async () => {
      mockError(-2, 'Season not found');
      await expect(getSeasonData(MOCK_TOKEN, '99999')).rejects.toThrow('GetMyData (season 99999) failed');
    });
  });

  describe('getMatchList', () => {
    it('nên trả về match list khi API thành công', async () => {
      const mockData = {
        commonly_used_operators_id: '1',
        list: [{ carry_out_value: '50000', kill_count: 5, map_id: 2201, match_time: '1609459200', net_income: '10000', operator_icon: '', operator_id: '1', result: 1, room_id: '1', score: 1000, is_leave: 0 }],
      };
      mockSuccess(mockData);
      const result = await getMatchList(MOCK_TOKEN);
      expect(result).toEqual(mockData);
      expect(mockPost).toHaveBeenCalledWith('/GetMatchList', expect.any(Object));
    });

    it('nên throw error khi API thất bại', async () => {
      mockError(-3, 'No data');
      await expect(getMatchList(MOCK_TOKEN)).rejects.toThrow('GetMatchList failed');
    });
  });

  describe('getDailyReport', () => {
    it('nên trả về daily report khi API thành công', async () => {
      const mockData = {
        avatar: '', battlefield_battle: { kd_ratio: '1.5', kill_count: 10, match_count: 5, retreat_rate: '20%', revenue: '50000' },
        beacon_battle: null, common_operator_id: '1', daily_passwords: null, date: '2026-06-09',
        field_support: [], high_value_items: [], highlight_match: null, nickname: 'TestPlayer', tag_id: 1,
      };
      mockSuccess(mockData);
      const result = await getDailyReport(MOCK_TOKEN);
      expect(result).toEqual(mockData);
      expect(mockPost).toHaveBeenCalledWith('/GetDailyReport', expect.any(Object));
    });

    it('nên throw error khi API thất bại', async () => {
      mockError(-4, 'Daily not ready');
      await expect(getDailyReport(MOCK_TOKEN)).rejects.toThrow('GetDailyReport failed');
    });
  });

  describe('getCollection', () => {
    it('nên trả về collection list khi API thành công', async () => {
      const mockData = { collection_list: [{ count: 1, is_new: true, item_id: 'item1' }] };
      mockSuccess(mockData);
      const result = await getCollection(MOCK_TOKEN);
      expect(result).toEqual(mockData);
      expect(mockPost).toHaveBeenCalledWith('/GetDahongCollection', {});
    });

    it('nên throw error khi API thất bại', async () => {
      mockError(-5, 'No collection');
      await expect(getCollection(MOCK_TOKEN)).rejects.toThrow('GetDahongCollection failed');
    });
  });
});
