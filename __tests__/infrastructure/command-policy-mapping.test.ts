/**
 * CI Guard Test: Đảm bảo 100% Slash Commands và Subcommands
 * đều bắt buộc phải được khai báo RBAC Policy trong COMMAND_PATH_POLICIES.
 *
 * Chống triệt để lỗi "unmapped command path denied".
 */

import { data as configData } from '../../src/features/admin/config.command.js';
import { data as dfData } from '../../src/features/delta-force/df.command.js';
import { data as payData } from '../../src/features/payment/pay.command.js';
import { data as donateData } from '../../src/features/payment/donate.command.js';
import { data as teamData } from '../../src/features/team-find/team.command.js';
import { extractCommandPathsFromBuilders } from '../../src/infrastructure/registry/command-parser.js';
import { COMMAND_PATH_POLICIES, resolveCommandPolicy } from '../../src/config/permissions.js';

describe('CI Security Guard — Command RBAC Policy Mapping', () => {
  const allBuilders = [configData, dfData, payData, donateData, teamData];
  const parsedCommands = extractCommandPathsFromBuilders(allBuilders);

  test('Tất cả command paths trích xuất từ SlashCommandBuilders phải có policy hợp lệ', () => {
    const unmappedPaths: string[] = [];

    for (const cmd of parsedCommands) {
      const policy = resolveCommandPolicy(cmd.path);
      if (!policy) {
        unmappedPaths.push(cmd.path);
      }
    }

    expect(unmappedPaths).toEqual([]);
  });

  test('Mọi key trong COMMAND_PATH_POLICIES đều phải là Policy hợp lệ', () => {
    const validPolicies = new Set([
      'MANAGE_RBAC',
      'MANAGE_CONFIG',
      'MANAGE_DF_CODE',
      'DF_ACCESS',
      'TEAM_ACCESS',
      'PAY_ACCESS',
    ]);

    for (const [pathKey, policy] of Object.entries(COMMAND_PATH_POLICIES)) {
      expect(validPolicies.has(policy)).toBe(true);
      expect(typeof pathKey).toBe('string');
      expect(pathKey.length).toBeGreaterThan(0);
    }
  });

  test('df.gift-code và df.giftcode phải được phân quyền DF_ACCESS', () => {
    expect(resolveCommandPolicy('df.gift-code')).toBe('DF_ACCESS');
    expect(resolveCommandPolicy('df.giftcode')).toBe('DF_ACCESS');
  });
});
