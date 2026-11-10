import {
  buildHelpPageContainer,
  buildHelpSelectRow,
  buildHelpButtonsRow,
  TOTAL_HELP_PAGES,
} from '../../src/features/delta-force/help.handler.js';
import { ComponentType } from 'discord.js';

// Giới hạn: Discord Components V2 TextDisplay (Type 10) — tổng text mọi TextDisplay trong 1 message <= 4,000 ký tự.
// Ref: https://discordjs.guide/message-components/v2-components.html
// Ngưỡng test: 3,500 ký tự (đệm 500 so với trần). Thực tế: 1,120–1,760 ký tự/trang.
describe('Discord Component V2 Payload & Total Character Limit Guard', () => {
  const locales = ['vi', 'en'] as const;

  for (const loc of locales) {
    describe(`Kiểm tra giới hạn ký tự toàn bộ message cho locale: [${loc}]`, () => {
      for (let page = 1; page <= TOTAL_HELP_PAGES; page++) {
        it(`Trang ${page} (${loc}): Tổng text toàn container & components < 3500 ký tự (trần Discord 4000)`, () => {
          const containerResult = buildHelpPageContainer(page, loc);
          const containerJson = containerResult.toJSON();

          expect(containerJson).toHaveLength(1);
          const root = containerJson[0] as any;
          expect(root.type).toBe(ComponentType.Container);

          const selectRow = buildHelpSelectRow(page, 'user-dummy', loc).toJSON() as any;
          const buttonsRow = buildHelpButtonsRow(page, 'user-dummy', loc).toJSON() as any;

          // 1. Đo text trong Container
          let totalTextLength = 0;
          for (const comp of root.components) {
            if (comp.content) {
              totalTextLength += comp.content.length;
            }
          }

          // 2. Đo text trong Select Menu (placeholder + labels + descriptions)
          for (const comp of selectRow.components) {
            if (comp.placeholder) totalTextLength += comp.placeholder.length;
            if (Array.isArray(comp.options)) {
              for (const opt of comp.options) {
                if (opt.label) totalTextLength += opt.label.length;
                if (opt.description) totalTextLength += opt.description.length;
              }
            }
          }

          // 3. Đo text trong Buttons (labels)
          for (const comp of buttonsRow.components) {
            if (comp.label) totalTextLength += comp.label.length;
          }

          // Tổng text toàn bộ message hiển thị
          expect(totalTextLength).toBeLessThan(3500);
          expect(totalTextLength).toBeGreaterThan(100);
        });
      }
    });
  }
});
