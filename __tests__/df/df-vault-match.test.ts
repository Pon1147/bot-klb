/**
 * Unit tests cho vault.handler.ts (/df vault) và match.handler.ts (/df match)
 */

import { execute as executeVault } from '../../src/features/delta-force/vault.handler.js';
import {
  execute as executeMatch,
  handleMatchSelect,
  formatMatchDuration,
} from '../../src/features/delta-force/match.handler.js';
import * as deltaforceApi from '../../src/services/deltaforce.api.js';
import * as workshopDataService from '../../src/services/workshop-data.service.js';
import * as dfCommandRunner from '../../src/utils/df-command.runner.js';
import * as dfTokenUtils from '../../src/utils/df-token.utils.js';

jest.mock('../../src/services/deltaforce.api.js');
jest.mock('../../src/services/workshop-data.service.js');
jest.mock('../../src/utils/df-command.runner.js');
jest.mock('../../src/utils/df-token.utils.js');

describe('DF Vault & Match Handlers', () => {
  let mockInteraction: any;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInteraction = {
      user: { id: 'test-user-id' },
      options: {
        getString: jest.fn(),
      },
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };

    mockDatabase = {};

    (dfTokenUtils.buildDfApiToken as jest.Mock).mockReturnValue({
      openid: 'mock-openid',
      token: 'mock-token',
    });

    (dfTokenUtils.resolveUserDfToken as jest.Mock).mockReturnValue({
      openid: 'mock-openid',
      token: 'mock-token',
    });

    // Mock runDfCommand chạy trực tiếp callback bên trong với token giả lập và mô phỏng editReply
    (dfCommandRunner.runDfCommand as jest.Mock).mockImplementation(
      async ({ interaction }, callback) => {
        const result = await callback({
          openid: 'mock-openid',
          token: 'mock-token',
        });
        if (result && interaction?.editReply) {
          await interaction.editReply(result);
        }
        return result;
      },
    );
  });

  describe('executeVault (/df vault)', () => {
    it('hiển thị danh sách đồ đỏ gọn gàng kèm ảnh và tổng giá trị chính xác qua Components V2', async () => {
      (deltaforceApi.getCollection as jest.Mock).mockResolvedValue({
        dahong_total_count: 10,
        dahong_type_count: 2,
        dahong_total_value: '50000000',
        collection_list: [
          { item_id: 'item-1', count: 6, is_new: true },
          { item_id: 'item-2', count: 4, is_new: false },
        ],
      });

      (workshopDataService.getWorkshopItemInfo as jest.Mock).mockImplementation(async (id: string) => {
        if (id === 'item-1') {
          return {
            id: 'item-1',
            name: 'Trái Tim Châu Phi',
            imageUrl: 'https://example.com/heart.png',
            value: 5000000,
            grade: '6',
          };
        }
        return {
          id: 'item-2',
          name: 'Nhiên Liệu Tên Lửa',
          imageUrl: 'https://example.com/fuel.png',
          value: 2000000,
          grade: '6',
        };
      });

      (workshopDataService.getWorkshopItemName as jest.Mock).mockImplementation(async (id: string) => {
        if (id === 'item-1') return 'Trái Tim Châu Phi';
        if (id === 'item-2') return 'Nhiên Liệu Tên Lửa';
        return `Item ${id}`;
      });

      await executeVault(mockInteraction, mockDatabase);

      expect(deltaforceApi.getCollection).toHaveBeenCalledTimes(1);
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
          flags: expect.any(Number),
        }),
      );

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      const jsonStr = JSON.stringify(replyArgs.components);
      expect(jsonStr).toContain('Sảnh Triển Lãm Đồ Đỏ');
      expect(jsonStr).toContain('Trái Tim Châu Phi');
      expect(jsonStr).toContain('50.000.000 Coin');
      expect(jsonStr).toContain('https://example.com/heart.png');
    });
  });

  describe('executeMatch (/df match)', () => {
    it('lấy trận gần nhất khi không truyền match_id, hiển thị kết quả Win và đính kèm Select Menu', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({
        list: [
          { room_id: 'room-123', result: 1, map_id: 8803, match_time: 1793637683 },
          { room_id: 'room-456', result: 2, map_id: 3902, match_time: 1793630000 },
        ],
      });

      (deltaforceApi.getMatchDetail as jest.Mock).mockResolvedValue({
        room_id: 'room-123',
        map_id: 8803,
        match_time: 1793637683,
        match_duration: 1200,
        result: 1, // Win
        net_income: 1500000,
        carry_out_value: 2000000,
        kill_count: 4,
        operator_id: '30011',
        members: [
          {
            nickname: 'Player1',
            operator_id: '30011',
            is_self: true,
            carry_out_value: 2000000,
            kill_operator: 3,
            kill_other: 1,
          },
        ],
      });

      await executeMatch(mockInteraction, mockDatabase);

      expect(deltaforceApi.getMatchList).toHaveBeenCalledWith(expect.anything(), { limit: 10 });
      expect(deltaforceApi.getMatchDetail).toHaveBeenCalledWith(expect.anything(), 'room-123');
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        }),
      );

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      const jsonStr = JSON.stringify(replyArgs.components);
      expect(jsonStr).toContain('RÚT QUÂN THÀNH CÔNG');
      expect(jsonStr).toContain('Player1');
      expect(jsonStr).toContain('room-123');
      expect(jsonStr).toContain('df_match_select');
      expect(jsonStr).toContain('20 phút');
    });

    it('formatMatchDuration hiển thị đúng định dạng phút và giây', () => {
      // API Delta Force trả match_duration < 60 theo phút (vd: 12 = 12 phút)
      expect(formatMatchDuration(12)).toBe('12 phút');
      expect(formatMatchDuration('12')).toBe('12 phút');
      expect(formatMatchDuration(1)).toBe('1 phút');

      // Giá trị >= 60 tính theo giây (vd: 1200 = 20 phút)
      expect(formatMatchDuration(1200)).toBe('20 phút');
      expect(formatMatchDuration(754)).toBe('12 phút 34s');
      expect(formatMatchDuration(65)).toBe('1 phút 5s');

      // Không hợp lệ hoặc rỗng
      expect(formatMatchDuration(0)).toBe('N/A');
      expect(formatMatchDuration(-5)).toBe('N/A');
      expect(formatMatchDuration(null)).toBe('N/A');
      expect(formatMatchDuration(undefined)).toBe('N/A');
    });

    it('hiển thị đúng thời gian thi đấu theo timezone Việt Nam (Asia/Ho_Chi_Minh)', async () => {
      mockInteraction.options.getString.mockReturnValue('room-utc7');

      (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({ list: [] });
      (deltaforceApi.getMatchDetail as jest.Mock).mockResolvedValue({
        room_id: 'room-utc7',
        map_id: 8803,
        // 1793986800 tương đương 2026-11-06T17:40:00Z -> Giờ VN (UTC+7) phải là 00:40 07/11/2026
        match_time: 1793986800,
        match_duration: 12,
        result: 1,
        members: [{ nickname: 'Player1', is_self: true, carry_out_value: 1000, kill_operator: 1, kill_other: 0 }],
      });

      await executeMatch(mockInteraction, mockDatabase);

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      const jsonStr = JSON.stringify(replyArgs.components);
      expect(jsonStr).toContain('12 phút');
      expect(jsonStr).toContain('00:40 07/11/2026');
    });

    it('tra cứu đúng mã trận khi có truyền match_id cụ thể', async () => {
      mockInteraction.options.getString.mockReturnValue('custom-room-999');

      (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({
        list: [{ room_id: 'custom-room-999', result: 2, map_id: 3902, match_time: 1793637683 }],
      });

      (deltaforceApi.getMatchDetail as jest.Mock).mockResolvedValue({
        room_id: 'custom-room-999',
        map_id: 3902,
        match_time: 1793637683,
        result: 2, // Defeat
        net_income: -500000,
        carry_out_value: 0,
        kill_count: 1,
      });

      await executeMatch(mockInteraction, mockDatabase);

      expect(deltaforceApi.getMatchDetail).toHaveBeenCalledWith(expect.anything(), 'custom-room-999');

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      const jsonStr = JSON.stringify(replyArgs.components);
      expect(jsonStr).toContain('TỬ TRẬN');
    });

    it('handleMatchSelect xử lý khi click chọn trận đấu khác', async () => {
      const selectInteraction: any = {
        customId: 'df_match_select:test-user-id',
        user: { id: 'test-user-id' },
        values: ['room-456'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
      };

      (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({
        list: [
          { room_id: 'room-123', result: 1, map_id: 8803, match_time: 1793637683 },
          { room_id: 'room-456', result: 2, map_id: 3902, match_time: 1793630000 },
        ],
      });

      (deltaforceApi.getMatchDetail as jest.Mock).mockResolvedValue({
        room_id: 'room-456',
        map_id: 3902,
        match_time: 1793630000,
        result: 2,
        members: [{ nickname: 'Player1', is_self: true, carry_out_value: 0, kill_operator: 0, kill_other: 0 }],
      });

      await handleMatchSelect(selectInteraction, mockDatabase);

      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(deltaforceApi.getMatchDetail).toHaveBeenCalledWith(expect.anything(), 'room-456');
      expect(selectInteraction.editReply).toHaveBeenCalled();
    });
  });
});
