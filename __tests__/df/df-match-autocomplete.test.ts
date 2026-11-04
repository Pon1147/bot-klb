/**
 * Test cho autocomplete và dropdown select của /df match
 */

import { routeInteraction } from '../../src/infrastructure/discord/interaction-router.js';
import * as deltaforceApi from '../../src/services/deltaforce.api.js';
import * as dfTokenUtils from '../../src/utils/df-token.utils.js';

jest.mock('../../src/services/deltaforce.api.js');
jest.mock('../../src/utils/df-token.utils.js');

describe('/df match — Autocomplete & Dropdown Select', () => {
  let mockClient: any;
  let mockInteraction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      database: {},
    };

    (dfTokenUtils.resolveUserDfToken as jest.Mock).mockReturnValue({
      openid: 'mock-openid',
      token: 'mock-token',
    });

    (deltaforceApi.getMatchList as jest.Mock).mockResolvedValue({
      list: [
        { room_id: '1008801', result: 1, map_id: 8803, match_time: 1793637683 },
        { room_id: '1008802', result: 2, map_id: 3902, match_time: 1793630000 },
      ],
    });
  });

  it('gợi ý danh sách trận đấu gần đây qua interaction.respond khi autocomplete option "match_id"', async () => {
    mockInteraction = {
      isAutocomplete: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      isChatInputCommand: () => false,
      commandName: 'df',
      options: {
        getSubcommand: () => 'match',
        getFocused: () => ({ name: 'match_id', value: '' }),
      },
      user: { id: 'test-user-id' },
      respond: jest.fn().mockResolvedValue(undefined),
    };

    await routeInteraction(mockClient, mockInteraction);

    expect(mockInteraction.respond).toHaveBeenCalledTimes(1);
    const choices = mockInteraction.respond.mock.calls[0][0];
    expect(choices).toHaveLength(2);
    expect(choices[0].name).toContain('🏆 [WIN]');
    expect(choices[0].value).toBe('1008801');
    expect(choices[1].name).toContain('💀 [DEFEAT]');
    expect(choices[1].value).toBe('1008802');
  });

  it('lọc danh sách autocomplete theo từ khóa user nhập', async () => {
    mockInteraction = {
      isAutocomplete: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
      isChatInputCommand: () => false,
      commandName: 'df',
      options: {
        getSubcommand: () => 'match',
        getFocused: () => ({ name: 'match_id', value: '1008802' }),
      },
      user: { id: 'test-user-id' },
      respond: jest.fn().mockResolvedValue(undefined),
    };

    await routeInteraction(mockClient, mockInteraction);

    expect(mockInteraction.respond).toHaveBeenCalledTimes(1);
    const choices = mockInteraction.respond.mock.calls[0][0];
    expect(choices).toHaveLength(1);
    expect(choices[0].value).toBe('1008802');
  });
});
