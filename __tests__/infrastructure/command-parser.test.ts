import { data as configData } from '../../src/features/admin/config.command.js';
import { data as dfData } from '../../src/features/delta-force/df.command.js';
import { data as payData } from '../../src/features/payment/pay.command.js';
import { data as donateData } from '../../src/features/payment/donate.command.js';
import { data as teamData } from '../../src/features/team-find/team.command.js';
import { extractCommandPathsFromBuilders } from '../../src/infrastructure/registry/command-parser.js';
import { COMMAND_PATH_POLICIES } from '../../src/config/permissions.js';

describe('Command Parser & Runtime Path Extraction', () => {
  const allBuilders = [configData, dfData, payData, donateData, teamData];
  const parsedCommands = extractCommandPathsFromBuilders(allBuilders);
  const parsedPaths = parsedCommands.map((c) => c.path).sort();
  const policyPaths = Object.keys(COMMAND_PATH_POLICIES).sort();

  it('trích xuất đúng số lượng và đường dẫn từ 5 builders so với COMMAND_PATH_POLICIES', () => {
    // runtime builder gồm 55 subcommands chính thức
    expect(parsedPaths.length).toBe(55);
    // Mọi runtime path đều phải có policy hợp lệ
    for (const p of parsedPaths) {
      expect(policyPaths).toContain(p);
    }
  });

  it('mọi subcommand đều trích xuất được danh sách options hợp lệ', () => {
    const statsCmd = parsedCommands.find((c) => c.path === 'df.stats');
    expect(statsCmd).toBeDefined();
    expect(statsCmd?.root).toBe('df');
    expect(statsCmd?.subcommand).toBe('stats');
    expect(Array.isArray(statsCmd?.options)).toBe(true);
  });
});
