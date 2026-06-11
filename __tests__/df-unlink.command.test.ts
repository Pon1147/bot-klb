/**
 * Unit tests cho df-unlink.command.ts â€” /df-unlink slash command.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
  },
}));

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
  deleteDfToken: jest.fn(),
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildSuccessContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
  buildInfoContainer: jest.fn((msg) => ({
    components: [{ type: 17, components: [{ type: 10, content: msg }] }],
    flags: 65536,
    files: [],
    toJSON() { return this.components; },
  })),
}));

import { execute } from '../src/commands/df/unlink.command.js';
import { getDfToken, deleteDfToken } from '../src/database/df.token.db.js';
import { MessageFlags } from 'discord.js';

describe('df-unlink.command', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };
  const mockReply = jest.fn().mockResolvedValue(undefined);

  function createMockInteraction(overrides: any = {}): any {
    return {
      guild: { id: '111' },
      user: { id: '222' },
      reply: mockReply,
      options: {},
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nÃªn tráº£ vá» error khi khÃ´ng cÃ³ guild', async () => {
    const interaction = createMockInteraction({ guild: null });
    await execute(interaction, mockDb);
    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Chỉ dùng trong server.', flags: MessageFlags.Ephemeral }),
    );
  });

  it('nÃªn há»§y liÃªn káº¿t khi cÃ³ token', async () => {
    (getDfToken as jest.Mock).mockReturnValue({
      openid: '123',
      token: 'abc',
      linked_at: '2026-06-09',
      last_used_at: null,
    });
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);

    expect(deleteDfToken).toHaveBeenCalledWith(mockDb, '222');
    expect(mockReply).toHaveBeenCalled();
  });

  it('nÃªn tráº£ vá» info khi chÆ°a liÃªn káº¿t tÃ i khoáº£n', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    const interaction = createMockInteraction();
    await execute(interaction, mockDb);

    expect(deleteDfToken).not.toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalled();
  });
});
