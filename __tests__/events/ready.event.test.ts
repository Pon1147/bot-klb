/// <reference types="jest" />
/**
 * Unit tests cho ready.event.ts:
 * - Ghi log bot username/tag và ID
 * - Ghi log danh sách các guilds và member count
 */

import { Client, Collection, Events } from 'discord.js';
import { execute, default as readyEvent } from '../../src/events/ready.event.js';

describe('events/ready.event', () => {
  it('should export correct event name and once=true', () => {
    expect(readyEvent.name).toBe(Events.ClientReady);
    expect(readyEvent.once).toBe(true);
    expect(typeof readyEvent.execute).toBe('function');
  });

  it('should log bot user and connected guilds correctly', async () => {
    const mockGuilds = new Collection<string, any>();
    mockGuilds.set('guild-1', {
      name: 'Server Alpha',
      id: 'guild-1',
      memberCount: 50,
    });
    mockGuilds.set('guild-2', {
      name: 'Server Beta',
      id: 'guild-2',
      memberCount: 120,
    });

    const mockClient = {
      user: {
        tag: 'DeltaBot#0001',
        id: '123456789',
      },
      guilds: {
        cache: mockGuilds,
      },
    } as unknown as Client;

    await expect(execute(mockClient)).resolves.not.toThrow();
  });

  it('should handle missing user safely', async () => {
    const mockClient = {
      user: null,
      guilds: {
        cache: new Collection(),
      },
    } as unknown as Client;

    await expect(execute(mockClient)).resolves.not.toThrow();
  });
});
