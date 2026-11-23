/// <reference types="jest" />
import { data, execute } from '../../src/features/delta-force/help.command.js';
import { execute as executeHelp } from '../../src/features/delta-force/help.handler.js';

jest.mock('../../src/features/delta-force/help.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

describe('/help slash command', () => {
  test('cấu hình SlashCommandBuilder có name là help', () => {
    expect(data.name).toBe('help');
    expect(data.name_localizations?.vi).toBe('trợ-giúp');
    expect(data.description).toBeDefined();
  });

  test('thực thi dispatch thẳng vào executeHelp handler', async () => {
    const mockDb = {} as any;
    const interaction: any = {
      client: { database: mockDb },
    };

    await execute(interaction, mockDb);
    expect(executeHelp).toHaveBeenCalledWith(interaction, mockDb);
  });
});
