/// <reference types="jest" />
/**
 * Unit tests cho getCommandPath utility (Phase 3).
 * Verify trích xuất command path chuẩn hóa cho các cấu trúc 1 cấp, 2 cấp, 3 cấp.
 */

import { getCommandPath } from '../../src/utils/command-path.utils.js';

function createMockInteraction(
  commandName: string,
  subcommandGroup: string | null = null,
  subcommand: string | null = null,
): any {
  return {
    commandName,
    options: {
      getSubcommandGroup: jest.fn((required?: boolean) => {
        if (required && !subcommandGroup) {
          throw new Error('No subcommand group');
        }
        return subcommandGroup;
      }),
      getSubcommand: jest.fn((required?: boolean) => {
        if (required && !subcommand) {
          throw new Error('No subcommand');
        }
        return subcommand;
      }),
    },
  };
}

describe('getCommandPath — Single-level commands (Legacy / Root-only)', () => {
  it('df-stats → df-stats', () => {
    const interaction = createMockInteraction('df-stats', null, null);
    expect(getCommandPath(interaction)).toBe('df-stats');
  });

  it('df-daily → df-daily', () => {
    const interaction = createMockInteraction('df-daily', null, null);
    expect(getCommandPath(interaction)).toBe('df-daily');
  });

  it('team-find → team-find', () => {
    const interaction = createMockInteraction('team-find', null, null);
    expect(getCommandPath(interaction)).toBe('team-find');
  });
});

describe('getCommandPath — Two-level commands (Root + Subcommand)', () => {
  it('df stats → df.stats', () => {
    const interaction = createMockInteraction('df', null, 'stats');
    expect(getCommandPath(interaction)).toBe('df.stats');
  });

  it('df daily → df.daily', () => {
    const interaction = createMockInteraction('df', null, 'daily');
    expect(getCommandPath(interaction)).toBe('df.daily');
  });

  it('team find → team.find', () => {
    const interaction = createMockInteraction('team', null, 'find');
    expect(getCommandPath(interaction)).toBe('team.find');
  });

  it('welcome setchannel → welcome.setchannel', () => {
    const interaction = createMockInteraction('welcome', null, 'setchannel');
    expect(getCommandPath(interaction)).toBe('welcome.setchannel');
  });
});

describe('getCommandPath — Three-level commands (Root + Group + Subcommand)', () => {
  it('config roles set → config.roles.set', () => {
    const interaction = createMockInteraction('config', 'roles', 'set');
    expect(getCommandPath(interaction)).toBe('config.roles.set');
  });

  it('config welcome toggle → config.welcome.toggle', () => {
    const interaction = createMockInteraction('config', 'welcome', 'toggle');
    expect(getCommandPath(interaction)).toBe('config.welcome.toggle');
  });

  it('df code show → df.code.show', () => {
    const interaction = createMockInteraction('df', 'code', 'show');
    expect(getCommandPath(interaction)).toBe('df.code.show');
  });

  it('df link manual → df.link.manual', () => {
    const interaction = createMockInteraction('df', 'link', 'manual');
    expect(getCommandPath(interaction)).toBe('df.link.manual');
  });
});

describe('getCommandPath — Missing optional levels & Edge cases', () => {
  it('group = null và subcommand = valid → trả về root.sub', () => {
    const interaction = createMockInteraction('df', null, 'history');
    expect(getCommandPath(interaction)).toBe('df.history');
  });

  it('group = null và subcommand = null → trả về root', () => {
    const interaction = createMockInteraction('ping', null, null);
    expect(getCommandPath(interaction)).toBe('ping');
  });

  it('xử lý an toàn khi getSubcommandGroup hoặc getSubcommand ném lỗi', () => {
    const interaction = {
      commandName: 'broken-mock',
      options: {
        getSubcommandGroup: jest.fn(() => {
          throw new Error('Unexpected options error');
        }),
        getSubcommand: jest.fn(() => {
          throw new Error('Unexpected options error');
        }),
      },
    };
    expect(getCommandPath(interaction as any)).toBe('broken-mock');
  });
});

