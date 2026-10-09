/// <reference types="jest" />
import { Client, Events, Guild } from 'discord.js';
import guildCreateEvent, { execute } from '../../src/events/guildCreate.event.js';
import * as handlerModule from '../../src/features/admin/guild-create.handler.js';

jest.mock('../../src/features/admin/guild-create.handler.js', () => ({
  handleGuildCreate: jest.fn().mockResolvedValue(undefined),
}));

describe('events/guildCreate.event', () => {
  it('phải xuất đúng tên event là GuildCreate và once=false', () => {
    expect(guildCreateEvent.name).toBe(Events.GuildCreate);
    expect(guildCreateEvent.once).toBe(false);
    expect(typeof guildCreateEvent.execute).toBe('function');
  });

  it('phải gọi handleGuildCreate khi execute được kích hoạt', async () => {
    const mockClient = {} as Client;
    const mockGuild = { id: 'guild-abc', name: 'Test Guild' } as unknown as Guild;

    await execute(mockClient, mockGuild);

    expect(handlerModule.handleGuildCreate).toHaveBeenCalledWith(mockClient, mockGuild);
  });
});

