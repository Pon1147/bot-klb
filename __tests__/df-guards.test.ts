/**
 * Unit tests cho df-guards.ts — requireGuild, requireDfToken, requireDfTokenOrInfo.
 */

jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
}));

jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((msg) => ({
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

jest.mock('../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
}));

jest.mock('../src/database/df-binding.db.js', () => ({
  getActiveBinding: jest.fn(),
}));

import { requireGuild, requireDfToken, requireDfTokenOrInfo, requireDfBinding } from '../src/utils/df-guards.js';
import { getDfToken } from '../src/database/df.token.db.js';
import { getActiveBinding } from '../src/database/df-binding.db.js';
import { MessageFlags } from 'discord.js';

describe('df-guards — requireGuild', () => {
  it('nên trả về true khi không có guild', async () => {
    const interaction: any = {
      guild: null,
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const result = await requireGuild(interaction);
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server'), flags: MessageFlags.Ephemeral }),
    );
  });

  it('nên trả về false khi có guild', async () => {
    const interaction: any = {
      guild: { id: '111' },
      reply: jest.fn().mockResolvedValue(undefined),
    };
    const result = await requireGuild(interaction);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('df-guards — requireDfToken (lines 18-27)', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên trả về true và reply error khi không có token', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfToken(interaction, mockDb);
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('nên trả về false khi có token', async () => {
    (getDfToken as jest.Mock).mockReturnValue({
      openid: '123',
      token: 'abc',
      linked_at: '2026-01-01',
      last_used_at: null,
    });

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfToken(interaction, mockDb);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('df-guards — requireDfTokenOrInfo', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên trả về true và reply info khi không có token', async () => {
    (getDfToken as jest.Mock).mockReturnValue(undefined);

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfTokenOrInfo(interaction, mockDb);
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('nên trả về false khi có token', async () => {
    (getDfToken as jest.Mock).mockReturnValue({
      openid: '123',
      token: 'abc',
      linked_at: '2026-01-01',
      last_used_at: null,
    });

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfTokenOrInfo(interaction, mockDb);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('df-guards — requireDfBinding', () => {
  const mockDb: any = { prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nên trả về true và reply error khi không có binding và không có legacy token', async () => {
    (getActiveBinding as jest.Mock).mockReturnValue(undefined);
    (getDfToken as jest.Mock).mockReturnValue(undefined);

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfBinding(interaction, mockDb);
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('nên trả về false khi có binding active', async () => {
    (getActiveBinding as jest.Mock).mockReturnValue({
      id: 1,
      openid: 'test',
      status: 'active',
    });

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfBinding(interaction, mockDb);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('nên trả về false khi có legacy token (fallback)', async () => {
    (getActiveBinding as jest.Mock).mockReturnValue(undefined);
    (getDfToken as jest.Mock).mockReturnValue({
      openid: 'legacy',
      token: 'abc',
    });

    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    const result = await requireDfBinding(interaction, mockDb);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
