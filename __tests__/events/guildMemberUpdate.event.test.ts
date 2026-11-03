/// <reference types="jest" />
/**
 * Unit tests cho guildMemberUpdate.event.ts:
 * - Delegate sang feature booster
 * - Bỏ qua bot
 */

import { GuildMember } from 'discord.js';
import { execute } from '../../src/events/guildMemberUpdate.event.js';
import { handleBoosterMemberUpdate } from '../../src/features/booster/booster.event.js';

jest.mock('../../src/features/booster/booster.event.js', () => ({
  handleBoosterMemberUpdate: jest.fn().mockResolvedValue(undefined),
}));

describe('events/guildMemberUpdate.event', () => {
  let mockOldMember: any;
  let mockNewMember: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOldMember = {
      guild: { id: 'guild-111' },
      user: { id: 'user-222', bot: false },
    };

    mockNewMember = {
      guild: mockOldMember.guild,
      user: { id: 'user-222', bot: false },
    };
  });

  it('bỏ qua toàn bộ nếu newMember là bot', async () => {
    mockNewMember.user.bot = true;

    await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

    expect(handleBoosterMemberUpdate).not.toHaveBeenCalled();
  });

  it('gọi handleBoosterMemberUpdate cho user thường', async () => {
    await execute(null, mockOldMember as unknown as GuildMember, mockNewMember as unknown as GuildMember);

    expect(handleBoosterMemberUpdate).toHaveBeenCalledWith(mockOldMember, mockNewMember);
  });
});
