/// <reference types="jest" />
/**
 * Unit tests cho /team command (Command Tree Phase 2).
 * Verify builders, toJSON structure, và execute dispatch.
 */

import { data, execute } from '../../src/features/delta-force/team.command.js';
import { execute as executeTeamFind } from '../../src/features/delta-force/team-find.handler.js';

jest.mock('../../src/features/delta-force/team-find.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123' },
    user: { id: 'user-123' },
    channel: { id: 'channel-123' },
    client: { database: {} },
    options: {
      getSubcommand: jest.fn().mockReturnValue('find'),
    },
    reply: jest.fn().mockResolvedValue({}),
  };

  return { ...base, ...overrides };
}

describe('/team command — Structure & Builder', () => {
  const json = data.toJSON();

  it('phải có root name là "team"', () => {
    expect(json.name).toBe('team');
  });

  it('phải có description hợp lệ', () => {
    expect(json.description).toBeDefined();
    expect(json.description.length).toBeGreaterThan(0);
  });

  it('phải chứa subcommand "find"', () => {
    const sub = json.options?.find((o: any) => o.name === 'find');
    expect(sub).toBeDefined();
    expect(sub.type).toBe(1); // 1 = SUB_COMMAND
  });
});

describe('/team command — Execute Dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phải dispatch tới executeTeamFind khi subcommand là "find"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn().mockReturnValue('find'),
      },
    });

    await execute(interaction);

    expect(executeTeamFind).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải phản hồi lỗi khi subcommand không hợp lệ', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommand: jest.fn().mockReturnValue('unknown'),
      },
    });

    await execute(interaction);

    expect(executeTeamFind).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });
});

