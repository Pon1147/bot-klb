/**
 * Unit tests cho market.handler.ts (/df market)
 */

import { execute as executeMarket, handleMarketAutocomplete } from '../../src/features/delta-force/market.handler.js';
import * as deltaforceApi from '../../src/services/deltaforce.api.js';
import * as workshopDataService from '../../src/services/workshop-data.service.js';
import * as dfTokenUtils from '../../src/utils/df-token.utils.js';

jest.mock('../../src/services/deltaforce.api.js');
jest.mock('../../src/services/workshop-data.service.js');
jest.mock('../../src/utils/df-token.utils.js');

describe('DF Market Handler (/df market)', () => {
  let mockInteraction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInteraction = {
      user: { id: 'test-user-id' },
      options: {
        getString: jest.fn(),
        getFocused: jest.fn(),
      },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      respond: jest.fn().mockResolvedValue(undefined),
    };

    (workshopDataService.getWorkshopItemName as jest.Mock).mockImplementation(
      async (id: string) => `Tên vật phẩm #${id}`,
    );
    (workshopDataService.getItemImageUrl as jest.Mock).mockResolvedValue(
      'https://example.com/item.png',
    );
  });

  describe('execute', () => {
    it('hiển thị thông tin chế tác và giá chợ khi có itemId cụ thể', async () => {
      mockInteraction.options.getString.mockReturnValue('37210500001');

      (deltaforceApi.getManufactureDetail as jest.Mock).mockResolvedValue({
        detail: {
          item_id: '37210500001',
          total_sell_price: '747120',
          manufacture_cost: '287631',
          handling_fee: '74712',
          deposit: '22414',
          total_duration: 28800,
          total_income: '362363',
          hourly_income: '45295',
          price_fluctuation_list: [
            { time: '10:00', price: '5200' },
            { time: '06:00', price: '6500' },
          ],
          material_list: [
            {
              material_id: '37110100001',
              material_count: 2,
              unit_price: '120218',
              total_price: '240436',
            },
          ],
        },
        isPersonal: true,
      });

      await executeMarket(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(deltaforceApi.getManufactureDetail).toHaveBeenCalledWith('37210500001', undefined);
      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);

      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(replyArgs.components).toBeDefined();
      expect(replyArgs.flags).toBeDefined();

      const textSection = replyArgs.components[0].components[0].components[0].content;
      expect(textSection).toContain('Bàn Chế Tác');
      expect(textSection).toContain('37210500001');
      expect(textSection).toContain('Garena SEA');
      expect(textSection).toContain('747.120'); // Tổng giá bán
      expect(textSection).toContain('362.363'); // Lợi nhuận ròng
    });

    it('tự động fallback lấy đề xuất khi người dùng không chọn item', async () => {
      mockInteraction.options.getString.mockReturnValue(null);

      (deltaforceApi.getManufactureRecommendationListNoAuth as jest.Mock).mockResolvedValue({
        workbench_list: [
          {
            item_id: '37210500099',
            formula_id: '100',
            profit_rate: '0.45',
            hourly_income: '50000',
          },
        ],
      });

      (deltaforceApi.getManufactureDetail as jest.Mock).mockResolvedValue({
        detail: {
          item_id: '37210500099',
          total_sell_price: '500000',
          manufacture_cost: '200000',
          handling_fee: '50000',
          deposit: '10000',
          total_duration: 3600,
          total_income: '240000',
          hourly_income: '240000',
          price_fluctuation_list: [],
          material_list: [],
        },
        isPersonal: false,
      });

      await executeMarket(mockInteraction);

      expect(deltaforceApi.getManufactureRecommendationListNoAuth).toHaveBeenCalled();
      expect(deltaforceApi.getManufactureDetail).toHaveBeenCalledWith('37210500099', undefined);
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('xử lý lỗi êm ái và trả về error container khi API bị lỗi', async () => {
      mockInteraction.options.getString.mockReturnValue('invalid-id');
      (deltaforceApi.getManufactureDetail as jest.Mock).mockRejectedValue(
        new Error('Item not found'),
      );

      await executeMarket(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
      const replyArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(replyArgs.components).toBeDefined();
    });
  });

  describe('handleMarketAutocomplete', () => {
    it('trả về danh sách gợi ý vật phẩm phù hợp', async () => {
      mockInteraction.options.getFocused.mockReturnValue('đạn');
      (workshopDataService.searchCraftItems as jest.Mock).mockResolvedValue([
        { id: '37210500001', name: 'Đạn .45 ACP Super' },
        { id: '37210500002', name: 'Đạn 9x19mm RIP' },
      ]);

      await handleMarketAutocomplete(mockInteraction);

      expect(workshopDataService.searchCraftItems).toHaveBeenCalledWith('đạn', 20);
      expect(mockInteraction.respond).toHaveBeenCalledWith([
        { name: 'Đạn .45 ACP Super (37210500001)', value: '37210500001' },
        { name: 'Đạn 9x19mm RIP (37210500002)', value: '37210500002' },
      ]);
    });
  });
});
