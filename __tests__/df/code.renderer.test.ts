/// <reference types="jest" />
/**
 * Unit tests cho code.renderer.ts — View rendering & helper tách từ code.handler.ts.
 */

import {
  buildCodesContainer,
  hasAnyCodes,
  MAP_DISPLAY,
} from '../../src/features/delta-force/code.renderer.js';
import type { DailyCodes } from '../../src/services/deltaforce.scraper.js';

describe('code.renderer', () => {
  describe('MAP_DISPLAY constant', () => {
    it('định nghĩa đầy đủ 6 bản đồ với tên tiếng Anh chuẩn và ảnh asset URL', () => {
      const keys = Object.keys(MAP_DISPLAY);
      expect(keys).toHaveLength(6);

      for (const [key, map] of Object.entries(MAP_DISPLAY)) {
        expect(key).toBeDefined();
        expect(map.name).toBeDefined();
        expect(typeof map.name).toBe('string');
        expect(map.image).toBeDefined();
        expect(map.url).toBeDefined();
        expect(map.url).toMatch(/^https:\/\/www\.playdeltaforce\.com\/events\/hq\/assets\//);
      }
    });

    it('chứa các map key khớp với DailyCodes interface', () => {
      const keys = Object.keys(MAP_DISPLAY);
      expect(keys).toContain('Đập Nước Zero');
      expect(keys).toContain('Thung lũng Layali');
      expect(keys).toContain('Phố Cổ Brakkesh');
      expect(keys).toContain('AZ3');
      expect(keys).toContain('Trạm Không Gian');
      expect(keys).toContain('Ngục Giam Thủy Triều');
    });
  });

  describe('hasAnyCodes()', () => {
    it('trả về false khi truyền null hoặc undefined', () => {
      expect(hasAnyCodes(null)).toBe(false);
      expect(hasAnyCodes(undefined)).toBe(false);
    });

    it('trả về false khi tất cả code đều null', () => {
      const emptyCodes: DailyCodes = {
        'Đập Nước Zero': null,
        'Thung lũng Layali': null,
        'Phố Cổ Brakkesh': null,
        AZ3: null,
        'Trạm Không Gian': null,
        'Ngục Giam Thủy Triều': null,
      };
      expect(hasAnyCodes(emptyCodes)).toBe(false);
    });

    it('trả về true khi có ít nhất 1 code hợp lệ', () => {
      const partialCodes: DailyCodes = {
        'Đập Nước Zero': '1234',
        'Thung lũng Layali': null,
        'Phố Cổ Brakkesh': null,
        AZ3: null,
        'Trạm Không Gian': null,
        'Ngục Giam Thủy Triều': null,
      };
      expect(hasAnyCodes(partialCodes)).toBe(true);
    });

    it('trả về true khi tất cả các bản đồ đều có code', () => {
      const fullCodes: DailyCodes = {
        'Đập Nước Zero': '1234',
        'Thung lũng Layali': '5678',
        'Phố Cổ Brakkesh': '9012',
        AZ3: '3456',
        'Trạm Không Gian': '7890',
        'Ngục Giam Thủy Triều': '2345',
      };
      expect(hasAnyCodes(fullCodes)).toBe(true);
    });
  });

  describe('buildCodesContainer()', () => {
    it('khi hasCodes = true, render container chứa Section của từng map có code hoặc placeholder', () => {
      const sampleCodes: DailyCodes = {
        'Đập Nước Zero': '1111',
        'Thung lũng Layali': null,
        'Phố Cổ Brakkesh': '3333',
        AZ3: '4444',
        'Trạm Không Gian': null,
        'Ngục Giam Thủy Triều': '6666',
      };

      const result = buildCodesContainer(sampleCodes, true);

      expect(result).toBeDefined();
      expect(result.flags).toBe(32768); // 1 << 15 (SuppressNotifications)
      expect(result.components).toHaveLength(1);

      const json = result.toJSON();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1);

      const container = json[0] as any;
      expect(container.type).toBe(17); // Container component type
      // Gồm 6 sections cho 6 maps
      expect(container.components).toHaveLength(6);

      // Map đầu tiên có code 1111
      const section1 = container.components[0];
      expect(section1.components[0].content).toContain('[1111]');

      // Map thứ hai không có code -> hiển thị [Chưa có]
      const section2 = container.components[1];
      expect(section2.components[0].content).toContain('[Chưa có]');
    });

    it('khi hasCodes = false, render container rỗng/thông báo không tìm thấy mật khẩu hôm nay', () => {
      const result = buildCodesContainer(null, false);

      expect(result).toBeDefined();
      expect(result.components).toHaveLength(1);

      const json = result.toJSON();
      const container = json[0] as any;
      expect(container.components).toHaveLength(1);
      expect(container.components[0].content).toContain('Không tìm thấy mật khẩu hôm nay');
    });
  });
});

