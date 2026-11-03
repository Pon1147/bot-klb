/**
 * Unit tests cho vault.handler.ts (/df vault) và match.handler.ts (/df match)
 */

import { execute as executeVault } from '../../src/features/delta-force/vault.handler.js';
import { execute as executeMatch } from '../../src/features/delta-force/match.handler.js';
import * as deltaforceApi from '../../src/services/deltaforce.api.js';
import * as workshopDataService from '../../src/services/workshop-data.service.js';
import * as dfCommandRunner from '../../src/utils/df-command.runner.js';

jest.mock('../../src/services/deltaforce.api.js');
jest.mock('../../src/services/workshop-data.service.js');
jest.mock('../../src/utils/df-command.runner.js');

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
    };

    mockDatabase = {};

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
    it('hiển thị danh sách đồ đỏ và tổng giá trị chính xác qua Components V2', async () => {
      (deltaforceApi.getCollection as jest.Mock).mockResolvedValue({
        dahong_total_count: 10,
        dahong_type_count: 2,
        dahong_total_value: '50000000',
        collection_list: [
          { item_id: 'item-1', count: 6, is_new: true },
          { item_id: 'item-2', count: 4, is_new: false },
        ],
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
      expect(jsonStr).toContain('50.000.000');
    });
  });

  describe('executeMatch (/df match)', () => {
    it('lấy trận gần nhất khi không truyền match_id và hiển thị kết quả Win', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({
        list: [{ room_id: 'room-123' }],
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

      expect(deltaforceApi.getMatchList).toHaveBeenCalledWith(expect.anything(), { limit: 1 });
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
    });

    it('tra cứu đúng mã trận khi có truyền match_id cụ thể', async () => {
      mockInteraction.options.getString.mockReturnValue('custom-room-999');

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

      expect(deltaforceApi.getMatchList).not.toHaveBeenCalled();
      expect(deltaforceApi.getMatchDetail).toHaveBeenCalledWith(expect.anything(), 'custom-room-999');

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      const jsonStr = JSON.stringify(replyArgs.components);
      expect(jsonStr).toContain('TỬ TRẬN');
    });
  });
});
