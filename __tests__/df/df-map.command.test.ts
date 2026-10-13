/// <reference types="jest" />
/**
 * Unit tests cho map.handler.ts và /df map subcommand.
 */

import {
  buildMapContainer,
  execute,
  MAP_SIMULATOR_URL,
  MAP_INTERACTIVE_URL,
} from '../../src/features/delta-force/map.handler.js';
import { execute as executeDf } from '../../src/features/delta-force/df.command.js';
import { MessageFlags } from 'discord.js';

describe('df-map.handler', () => {
  it('buildMapContainer trả về Container và ActionRow với 2 link buttons', () => {
    const result = buildMapContainer();

    expect(result).toBeDefined();
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);

    const json = result.toJSON();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2); // 1 Container + 1 ActionRow

    const container = json[0] as any;
    expect(container.type).toBe(17); // Container
    expect(container.components[0].content).toContain('Trình Mô Phỏng Bản Đồ 3D');
    expect(container.components[0].content).toContain('Đập Nước Zero');
    expect(container.components[0].content).toContain('Thung Lũng Layali');

    const actionRow = json[1] as any;
    expect(actionRow.type).toBe(1); // ActionRow
    expect(actionRow.components).toHaveLength(2);

    // Button 1: 3D Simulator
    expect(actionRow.components[0].style).toBe(5); // Link
    expect(actionRow.components[0].url).toBe(MAP_SIMULATOR_URL);

    // Button 2: 2D Interactive Map
    expect(actionRow.components[1].style).toBe(5); // Link
    expect(actionRow.components[1].url).toBe(MAP_INTERACTIVE_URL);
  });

  it('execute từ chối khi gọi ngoài guild (DM)', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockInteraction: any = {
      guild: null,
      reply: mockReply,
    };

    await execute(mockInteraction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Chỉ dùng trong server.'),
        flags: MessageFlags.Ephemeral,
      }),
    );
  });

  it('execute gửi reply thành công khi trong guild', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockInteraction: any = {
      guild: { id: 'guild-123' },
      reply: mockReply,
    };

    await execute(mockInteraction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: MessageFlags.IsComponentsV2,
        components: expect.any(Array),
      }),
    );
  });

  it('/df map phân phối đúng đến executeMap', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockInteraction: any = {
      guild: { id: 'guild-123' },
      reply: mockReply,
      options: {
        getSubcommandGroup: () => null,
        getSubcommand: () => 'map',
      },
      client: { database: {} },
    };

    await executeDf(mockInteraction);

    expect(mockReply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: MessageFlags.IsComponentsV2,
        components: expect.any(Array),
      }),
    );
  });
});
