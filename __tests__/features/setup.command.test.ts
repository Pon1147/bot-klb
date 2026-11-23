/// <reference types="jest" />
import { data, execute } from '../../src/features/admin/setup.command.js';
import { execute as executeAdmin } from '../../src/features/admin/admin.command.js';

jest.mock('../../src/features/admin/admin.command.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

describe('/setup slash command', () => {
  test('cấu hình SlashCommandBuilder có name là setup', () => {
    expect(data.name).toBe('setup');
    expect(data.name_localizations?.vi).toBe('cài-đặt');
    expect(data.description).toBeDefined();
  });

  test('thực thi dispatch thẳng vào executeAdmin handler', async () => {
    const mockDb = {} as any;
    const interaction: any = {
      client: { database: mockDb },
    };

    await execute(interaction, mockDb);
    expect(executeAdmin).toHaveBeenCalledWith(interaction, mockDb);
  });
});
