/**
 * Unit tests cho deltaforce.api.ts — API service functions.
 * Mock axios để test request/response mà không gọi real API.
 */

const mockPost = jest.fn();
const mockCreate = jest.fn(() => ({ post: mockPost }));

import {
  getMyData,
  getSeasonData,
  getMatchList,
  getCollection,
  getDailyReport,
  validateToken,
  getWorkshopRecommendations,
  getWorkbenchList,
  setAxiosCreatorForTest,
  sanitizeAxiosError,
  sanitizeUrl,
} from '../../src/services/deltaforce.api.js';

const MOCK_TOKEN = { openid: '1234567890', token: 'abc123def456' };

describe('deltaforce.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAxiosCreatorForTest(mockCreate as any);
  });

  afterAll(() => {
    setAxiosCreatorForTest(null);
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

  describe('validateToken', () => {
    it('nên trả về true khi code = 0', async () => {
      mockSuccess({});
      const isValid = await validateToken(MOCK_TOKEN, 'openid-123');
      expect(isValid).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('/GetMyData', expect.objectContaining({ openid: 'openid-123' }));
    });

    it('nên trả về false khi code khác 0', async () => {
      mockError(-1, 'Token expired');
      const isValid = await validateToken(MOCK_TOKEN, 'openid-123');
      expect(isValid).toBe(false);
    });

    it('nên trả về false khi network request ném lỗi', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));
      const isValid = await validateToken(MOCK_TOKEN, 'openid-123');
      expect(isValid).toBe(false);
    });
  });

  describe('getWorkshopRecommendations', () => {
    it('nên trả về recommendations khi API thành công', async () => {
      const mockRecs = { list: [{ item_id: 1, item_name: 'Item A', profit_per_hour: 500 }] };
      mockSuccess(mockRecs);
      const result = await getWorkshopRecommendations(MOCK_TOKEN);
      expect(result).toEqual(mockRecs);
      expect(mockPost).toHaveBeenCalledWith('/GetManufactureRecommendationList', {});
    });

    it('nên throw error khi API trả về mã lỗi', async () => {
      mockError(-10, 'Maintenance');
      await expect(getWorkshopRecommendations(MOCK_TOKEN)).rejects.toThrow(
        'GetManufactureRecommendationList failed: code=-10 msg=Maintenance',
      );
    });
  });

  describe('getWorkbenchList', () => {
    it('nên trả về workbench list khi API thành công', async () => {
      const mockWorkbench = { list: [{ slot_id: 1, remain_time: 120, status: 1 }] };
      mockSuccess(mockWorkbench);
      const result = await getWorkbenchList(MOCK_TOKEN);
      expect(result).toEqual(mockWorkbench);
      expect(mockPost).toHaveBeenCalledWith('/GetWorkbenchList', {});
    });

    it('nên throw error khi API trả về mã lỗi', async () => {
      mockError(-11, 'Invalid slot');
      await expect(getWorkbenchList(MOCK_TOKEN)).rejects.toThrow(
        'GetWorkbenchList failed: code=-11 msg=Invalid slot',
      );
    });
  });

  describe('NEW-05 Sensitive Token Redaction & Sanitization', () => {
    it('sanitizeUrl: phải che giấu token, signature và openid trong URL query params', () => {
      const sensitiveUrl =
        'https://api.deltaforce.com/GetMyData?openid=1234567890&token=very_secret_token_123&s=sig_secret_xyz&game_id=1001';
      const cleanUrl = sanitizeUrl(sensitiveUrl);

      expect(cleanUrl).not.toContain('very_secret_token_123');
      expect(cleanUrl).not.toContain('sig_secret_xyz');
      expect(cleanUrl).toContain('token=***REDACTED***');
      expect(cleanUrl).toContain('s=***REDACTED***');
      expect(cleanUrl).toContain('openid=1234****7890');
      expect(cleanUrl).toContain('game_id=1001');
    });

    it('sanitizeAxiosError: phải khử nhạy cảm trong error.config.params, data và request.path', () => {
      const axiosError: any = {
        name: 'AxiosError',
        message: 'Request failed with status code 500: https://api.com?token=secret_in_message',
        config: {
          url: '/GetMyData?token=secret_in_url',
          params: {
            openid: '1234567890',
            token: 'super_secret_token',
            s: 'signature_abc',
            ts: '12345',
          },
          data: JSON.stringify({
            openid: '1234567890',
            token: 'super_secret_token',
            game_id: 1001,
          }),
        },
        request: {
          path: '/GetMyData?openid=1234567890&token=super_secret_token&s=sig_123',
        },
      };

      const sanitized: any = sanitizeAxiosError(axiosError);

      expect(sanitized.config.params.token).toBe('***REDACTED***');
      expect(sanitized.config.params.s).toBe('***REDACTED***');
      expect(sanitized.config.params.openid).toBe('1234****7890');
      expect(sanitized.config.params.ts).toBe('12345');

      const sanitizedBody = JSON.parse(sanitized.config.data);
      expect(sanitizedBody.token).toBe('***REDACTED***');
      expect(sanitizedBody.openid).toBe('1234****7890');

      expect(sanitized.request.path).not.toContain('super_secret_token');
      expect(sanitized.request.path).toContain('token=***REDACTED***');
      expect(sanitized.message).not.toContain('secret_in_message');
    });

    it('outbound request: không làm thay đổi các parameters thực tế gửi đi tới API Garena', async () => {
      mockPost.mockResolvedValueOnce({ data: { code: 0, msg: 'ok', data: { test: true } } });

      await getMyData(MOCK_TOKEN);

      // Kiểm tra config truyền vào axiosCreator chứa token thô chính xác
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            openid: '1234567890',
            token: 'abc123def456',
          }),
        }),
      );
    });

    it('network failure: khi Axios request bị reject, error trả về phải được sanitize sạch', async () => {
      const rawAxiosError: any = new Error('Network Timeout');
      rawAxiosError.config = {
        params: {
          openid: '1234567890',
          token: 'leak_candidate_token',
          s: 'leak_sig',
        },
      };
      mockPost.mockRejectedValueOnce(rawAxiosError);

      await expect(getMyData(MOCK_TOKEN)).rejects.toThrow();

      // Kiểm tra error config đã được redact
      expect(rawAxiosError.config.params.token).toBe('***REDACTED***');
      expect(rawAxiosError.config.params.s).toBe('***REDACTED***');
      expect(rawAxiosError.config.params.openid).toBe('1234****7890');
    });
  });


    it('sanitizeAxiosError: phải khử nhạy cảm headers, response.data, stack và toJSON()', () => {
      const axiosError: any = {
        name: 'AxiosError',
        message: 'Request failed with 500: https://api.deltaforce.com?token=super_secret_token_123',
        stack: 'AxiosError: Request failed: https://api.deltaforce.com?token=super_secret_token_123\n    at post (api.ts:50)',
        config: {
          url: '/GetMyData?token=super_secret_token_123',
          headers: {
            token: 'header_secret_token',
            authorization: 'Bearer secret_auth_header',
            cookie: 'session_token=123',
            'content-type': 'application/json',
          },
          params: {
            token: 'super_secret_token_123',
            openid: '1234567890',
          },
        },
        request: {
          path: '/GetMyData?token=super_secret_token_123',
          _header: 'GET /GetMyData?token=super_secret_token_123 HTTP/1.1\r\n',
        },
        response: {
          data: {
            token: 'echoed_secret_token',
            s: 'echoed_sig',
          },
        },
        toJSON: function() {
          return {
            message: this.message,
            config: this.config,
          };
        },
      };

      const sanitized: any = sanitizeAxiosError(axiosError);

      // Check headers
      expect(sanitized.config.headers.token).toBe('***REDACTED***');
      expect(sanitized.config.headers.authorization).toBe('***REDACTED***');
      expect(sanitized.config.headers.cookie).toBe('***REDACTED***');
      expect(sanitized.config.headers['content-type']).toBe('application/json');

      // Check request._header
      expect(sanitized.request._header).not.toContain('super_secret_token_123');
      expect(sanitized.request._header).toContain('token=***REDACTED***');

      // Check response.data
      expect(sanitized.response.data.token).toBe('***REDACTED***');
      expect(sanitized.response.data.s).toBe('***REDACTED***');

      // Check stack
      expect(sanitized.stack).not.toContain('super_secret_token_123');
      expect(sanitized.stack).toContain('token=***REDACTED***');

      // Check JSON.stringify serialization
      const jsonStr = JSON.stringify(sanitized);
      expect(jsonStr).not.toContain('super_secret_token_123');
      expect(jsonStr).not.toContain('header_secret_token');
      expect(jsonStr).not.toContain('echoed_secret_token');

      // Check toJSON() method serialization
      const jsonFromMethod = sanitized.toJSON();
      expect(jsonFromMethod.config.params.token).toBe('***REDACTED***');
      expect(JSON.stringify(jsonFromMethod)).not.toContain('super_secret_token_123');
    });

    it('retry sau khi thất bại: request thứ 2 vẫn gửi token chính xác và thành công', async () => {
      // Giả lập lần 1 thất bại
      const networkErr = new Error('502 Bad Gateway');
      (networkErr as any).config = { params: { token: 'abc123def456', openid: '1234567890' } };
      mockPost.mockRejectedValueOnce(networkErr);

      await expect(getMyData(MOCK_TOKEN)).rejects.toThrow();

      // Giả lập lần 2 (retry) thành công
      const mockSuccessData = {
        player_info: { nickname: 'RetryPlayer', level: 60, avatar: '', play_duration: '200', register_time: '1609459200' },
        rank_data: { current_rank: 'Vàng', current_rank_score: 2500, highest_rank: 'Kim Cương', highest_rank_season_id: 8 },
        summary_data: { bf_combat: null, combat: null, economy: null, performance: null, team: null, total_match_count: 300, vehicle: null },
      };
      mockSuccess(mockSuccessData);

      const result = await getMyData(MOCK_TOKEN);
      expect(result).toEqual(mockSuccessData);

      // Xác nhận lần 2 vẫn truyền token thô chính xác vào axios
      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            token: 'abc123def456',
            openid: '1234567890',
          }),
        }),
      );
    });

});
