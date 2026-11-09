/// <reference types="jest" />
import { Events, Guild } from 'discord.js';
import guildDeleteEvent, { execute } from '../../src/events/guildDelete.event.js';
import * as schedulerModule from '../../src/services/df-codes-scheduler.js';
import * as settingsModule from '../../src/services/settings.service.js';

jest.mock('../../src/services/df-codes-scheduler.js', () => ({
  stopGuildCronJob: jest.fn(),
}));

describe('events/guildDelete.event', () => {
  it('phải xuất đúng tên event là GuildDelete và once=false', () => {
    expect(guildDeleteEvent.name).toBe(Events.GuildDelete);
    expect(guildDeleteEvent.once).toBe(false);
    expect(typeof guildDeleteEvent.execute).toBe('function');
  });

  it('phải dừng cron job và xóa cấu hình khi bot rời guild', async () => {
    const mockDelete = jest.fn();
    jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
      delete: mockDelete,
    } as any);

    const mockGuild = { id: 'guild-departed-123', name: 'Old Guild' } as unknown as Guild;

    await execute(mockGuild);

    expect(schedulerModule.stopGuildCronJob).toHaveBeenCalledWith('guild-departed-123');
    expect(mockDelete).toHaveBeenCalledWith('guild-departed-123');
  });
});
