/// <reference types="jest" />
/**
 * Unit tests cho ready.event.ts:
 * - Ghi log bot username/tag và ID
 * - Ghi log danh sách các guilds và member count
 */

import { Client, Collection, Events } from 'discord.js';
import { execute, pruneOrphanGuilds, default as readyEvent } from '../../src/events/ready.event.js';
import * as settingsModule from '../../src/services/settings.service.js';

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

  describe('pruneOrphanGuilds', () => {
    it('phải xóa các guild có trong database nhưng không còn trong client.guilds.cache', () => {
      const mockDelete = jest.fn();
      jest.spyOn(settingsModule, 'getSettingsService').mockReturnValue({
        delete: mockDelete,
      } as any);

      const mockGuilds = new Collection<string, any>();
      mockGuilds.set('guild-active', { id: 'guild-active' });

      const mockDatabase = {
        prepare: jest.fn().mockReturnValue({
          all: jest.fn().mockReturnValue([
            { guild_id: 'guild-active' },
            { guild_id: 'guild-orphan-1' },
            { guild_id: 'guild-orphan-2' },
          ]),
        }),
      };

      const mockClient = {
        guilds: { cache: mockGuilds },
        database: mockDatabase,
      } as any;

      const pruned = pruneOrphanGuilds(mockClient);

      expect(pruned).toBe(2);
      expect(mockDelete).toHaveBeenCalledWith('guild-orphan-1');
      expect(mockDelete).toHaveBeenCalledWith('guild-orphan-2');
      expect(mockDelete).not.toHaveBeenCalledWith('guild-active');
    });

    it('không làm gì nếu client.guilds.cache rỗng', () => {
      const mockClient = {
        guilds: { cache: new Collection() },
        database: {},
      } as any;

      expect(pruneOrphanGuilds(mockClient)).toBe(0);
    });
  });
});
