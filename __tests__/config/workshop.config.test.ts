/// <reference types="jest" />
/**
 * Unit tests cho workshop.config.ts — workbench sections, prefix detection & component builders.
 */

import { ComponentType } from 'discord.js';
import {
  WORKBENCH_SECTIONS,
  WORKBENCH_ITEM_PREFIXES,
  WORKSHOP_ITEM_NAMES,
  formatRemainingTime,
  formatHourlyIncome,
  detectWorkbenchSection,
  buildWorkshopItemLine,
  buildWorkshopSection,
} from '../../src/config/workshop.config.js';

describe('config/workshop.config', () => {
  describe('constants verification', () => {
    it('định nghĩa đầy đủ các workbench sections và item prefixes', () => {
      expect(WORKBENCH_SECTIONS['1002']).toBeDefined();
      expect(WORKBENCH_SECTIONS['1005']).toBeDefined();
      expect(WORKBENCH_SECTIONS['1006']).toBeDefined();
      expect(WORKBENCH_SECTIONS['1007']).toBeDefined();

      expect(WORKBENCH_ITEM_PREFIXES['1002']).toBe('15');
      expect(WORKBENCH_ITEM_PREFIXES['1005']).toBe('11');
      expect(WORKBENCH_ITEM_PREFIXES['1006']).toBe('14');
      expect(WORKBENCH_ITEM_PREFIXES['1007']).toBe('37');
    });

    it('có danh sách tên vật phẩm WORKSHOP_ITEM_NAMES', () => {
      expect(Object.keys(WORKSHOP_ITEM_NAMES).length).toBeGreaterThan(0);
      expect(WORKSHOP_ITEM_NAMES['15200000044']).toBe('Đèn Pin Tác Chiến OLIGHT Warrior 3S');
    });
  });

  describe('formatRemainingTime & formatHourlyIncome', () => {
    it('formatRemainingTime trả về "—" khi seconds <= 0', () => {
      expect(formatRemainingTime(0)).toBe('—');
      expect(formatRemainingTime(-10)).toBe('—');
    });

    it('formatRemainingTime format chuẩn HH:MM:SS khi seconds > 0', () => {
      expect(formatRemainingTime(3665)).toBe('01:01:05');
    });

    it('formatHourlyIncome format đúng emoji và locale vi-VN', () => {
      const formatted = formatHourlyIncome('1250000');
      expect(formatted).toContain('1.250.000');
      expect(formatted).toContain('<:icon9De6T9unB:1514474246779306115>');
    });
  });

  describe('detectWorkbenchSection', () => {
    it('nhận diện chính xác workbench ID cho từng prefix hợp lệ', () => {
      // 1002: Personal equipment (15xxxxx)
      expect(detectWorkbenchSection('15030010001')).toBe('1002');
      expect(detectWorkbenchSection('15')).toBe('1002');

      // 1005: Ammunition (11xxxxx)
      expect(detectWorkbenchSection('11050005001')).toBe('1005');
      expect(detectWorkbenchSection('11')).toBe('1005');

      // 1006: Medical supplies (14xxxxx)
      expect(detectWorkbenchSection('14020000006')).toBe('1006');
      expect(detectWorkbenchSection('14')).toBe('1006');

      // 1007: Armor (37xxxxx)
      expect(detectWorkbenchSection('37120500001')).toBe('1007');
      expect(detectWorkbenchSection('37')).toBe('1007');
    });

    it('trả về null khi itemPrefix không khớp với bất kỳ workbench nào', () => {
      expect(detectWorkbenchSection('99999999')).toBeNull();
      expect(detectWorkbenchSection('unknown')).toBeNull();
      expect(detectWorkbenchSection('')).toBeNull();
    });
  });

  describe('buildWorkshopItemLine', () => {
    it('kết hợp tên in đậm và kết quả formatFn thành dòng hiển thị', () => {
      const mockItem = {
        hourly_income: '50000',
        remaining_time: 1800,
      };

      const mockFormatFn = (item: typeof mockItem) =>
        `Income: ${item.hourly_income} | Left: ${item.remaining_time}s`;

      const result = buildWorkshopItemLine('Pin Lithium', mockFormatFn, mockItem);

      expect(result).toBe('**Pin Lithium**\nIncome: 50000 | Left: 1800s');
    });
  });

  describe('buildWorkshopSection', () => {
    it('tạo Section component đúng cấu trúc khi không có accessoryUrl', () => {
      const title = 'Bàn Chế Tác';
      const emoji = '🔨';
      const items = ['**Item 1**\nInfo 1', '**Item 2**\nInfo 2'];

      const section = buildWorkshopSection(title, emoji, items);

      expect(section).toEqual({
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: '🔨 **Bàn Chế Tác**\n\n**Item 1**\nInfo 1\n\n**Item 2**\nInfo 2',
          },
        ],
      });
      expect(section.accessory).toBeUndefined();
    });

    it('tạo Section component kèm Thumbnail accessory khi có accessoryUrl', () => {
      const title = 'Trạm Y Tế';
      const emoji = '🏥';
      const items = ['**Hộp Y Tế**\nFull HP'];
      const accessoryUrl = 'https://example.com/medical.png';

      const section = buildWorkshopSection(title, emoji, items, accessoryUrl);

      expect(section).toEqual({
        type: ComponentType.Section,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: '🏥 **Trạm Y Tế**\n\n**Hộp Y Tế**\nFull HP',
          },
        ],
        accessory: {
          type: ComponentType.Thumbnail,
          media: { url: 'https://example.com/medical.png' },
        },
      });
    });
  });
});

