/// <reference types="jest" />
/**
 * Unit tests cho /team command (Command Tree Phase 2).
 * Verify builders, toJSON structure, và execute dispatch.
 */

import { data, execute } from '../../src/features/team-find/team.command.js';
import { execute as executeTeamFind } from '../../src/features/team-find/team-find.handler.js';

jest.mock('../../src/features/team-find/team-find.handler.js', () => ({
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

  it('lệnh root thực thi trực tiếp, không chia tầng subcommand thừa', () => {
    expect(json.options?.some((o: any) => o.type === 1)).toBeFalsy();
  });
});

describe('/team command — Execute Dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phải dispatch tới executeTeamFind trực tiếp khi gọi lệnh', async () => {
    const interaction = createMockInteraction();

    await execute(interaction);

    expect(executeTeamFind).toHaveBeenCalledWith(interaction, expect.anything());
  });
});

