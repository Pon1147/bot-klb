import { data as configData } from '../../src/features/admin/config.command.js';
import { data as dfData } from '../../src/features/delta-force/df.command.js';
import { data as payData } from '../../src/features/payment/pay.command.js';
import { data as donateData } from '../../src/features/payment/donate.command.js';
import { data as teamData } from '../../src/features/team-find/team.command.js';
import { extractCommandPathsFromBuilders } from '../../src/infrastructure/registry/command-parser.js';
import { VI_LOCALE } from '../../src/locales/vi.js';
import { EN_LOCALE } from '../../src/locales/en.js';

describe('CI Drift Guard — Bi-directional Command & Localization Parity', () => {
  const allBuilders = [configData, dfData, payData, donateData, teamData];
  const parsedCommands = extractCommandPathsFromBuilders(allBuilders);
  const runtimePaths = parsedCommands.map((c) => c.path);

  describe('1. Builder -> i18n Dictionary Parity', () => {
    it('toàn bộ 57 lệnh từ builder đều được quét đầy đủ', () => {
      expect(runtimePaths.length).toBe(57);
    });

    it('mọi command bắt buộc phải có đầy đủ mô tả và ví dụ trong vi.ts', () => {
      const missingInVi: string[] = [];
      for (const path of runtimePaths) {
        const cmdMeta = (VI_LOCALE.commands as any)[path];
        if (!cmdMeta || !cmdMeta.desc || !cmdMeta.example) {
          missingInVi.push(path);
        }
      }
      expect(missingInVi).toEqual([]);
    });

    it('mọi command bắt buộc phải có đầy đủ mô tả và ví dụ trong en.ts', () => {
      const missingInEn: string[] = [];
      for (const path of runtimePaths) {
        const cmdMeta = (EN_LOCALE.commands as any)[path];
        if (!cmdMeta || !cmdMeta.desc || !cmdMeta.example) {
          missingInEn.push(path);
        }
      }
      expect(missingInEn).toEqual([]);
    });

    it('mọi command trong builder phải được cấu hình setDescriptionLocalizations en-US khớp với en.ts', () => {
      const missingOrMismatched: string[] = [];
      for (const cmd of parsedCommands) {
        const expectedEnDesc = (EN_LOCALE.commands as any)[cmd.path]?.desc;
        const actualEnDesc = cmd.descriptionLocalizations?.['en-US'];
        if (!actualEnDesc || actualEnDesc !== expectedEnDesc) {
          missingOrMismatched.push(`${cmd.path}: expected="${expectedEnDesc}", actual="${actualEnDesc}"`);
        }
      }
      expect(missingOrMismatched).toEqual([]);
    });
  });

  describe('2. Reverse Check: i18n Dictionary -> Builder (Orphan Metadata Guard)', () => {
    it('không có lệnh mồ côi nào trong vi.commands mà không tồn tại trong runtime builder', () => {
      const definedKeysInVi = Object.keys(VI_LOCALE.commands);
      const orphanKeys = definedKeysInVi.filter((key) => !runtimePaths.includes(key));
      expect(orphanKeys).toEqual([]);
    });

    it('không có lệnh mồ côi nào trong en.commands mà không tồn tại trong runtime builder', () => {
      const definedKeysInEn = Object.keys(EN_LOCALE.commands);
      const orphanKeys = definedKeysInEn.filter((key) => !runtimePaths.includes(key));
      expect(orphanKeys).toEqual([]);
    });
  });

  describe('3. Bi-directional vi <-> en Key Parity', () => {
    it('danh sách user commands giữa vi và en phải khớp nhau 100%', () => {
      const viKeys = Object.keys(VI_LOCALE.commands).sort();
      const enKeys = Object.keys(EN_LOCALE.commands).sort();
      expect(enKeys).toEqual(viKeys);
    });

    it('danh sách help options giữa vi và en phải khớp nhau 100%', () => {
      const viHelpOptions = Object.keys(VI_LOCALE.help.options).sort();
      const enHelpOptions = Object.keys(EN_LOCALE.help.options).sort();
      expect(enHelpOptions).toEqual(viHelpOptions);
    });
  });

  describe('4. Security & Sanitization Check', () => {
    it('mọi ví dụ lệnh tuyệt đối không chứa Discord ID thật dạng snowflake của admin/user', () => {
      const realAdminId = '418779992290492416';
      const allExamplesVi = Object.values(VI_LOCALE.commands).map((c) => c.example);
      const allExamplesEn = Object.values(EN_LOCALE.commands).map((c) => c.example);

      for (const ex of [...allExamplesVi, ...allExamplesEn]) {
        expect(ex).not.toContain(realAdminId);
      }
    });
  });
});
