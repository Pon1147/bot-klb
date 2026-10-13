/// <reference types="jest" />
/**
 * Unit tests cho build.handler.ts và /df build / /df gun subcommand.
 */

import {
  buildWeaponContainer,
  execute,
  WEAPON_BUILDS_URL,
} from '../../src/features/delta-force/build.handler.js';
import { execute as executeDf } from '../../src/features/delta-force/df.command.js';
import { MessageFlags } from 'discord.js';

describe('df-build.handler', () => {
  it('buildWeaponContainer trả về Container và ActionRow với duy nhất 1 link button hoa hồng', () => {
    const result = buildWeaponContainer();

    expect(result).toBeDefined();
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);

    const json = result.toJSON();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2); // 1 Container + 1 ActionRow

    const container = json[0] as any;
    expect(container.type).toBe(17); // Container
    expect(container.components[0].content).toContain('Thư Viện Build Súng & Mã Gunsmith Meta');
    expect(container.components[0].content).toContain('Copies');
    expect(container.components[0].content).toContain('CAR-15');
    expect(container.components[0].content).toContain('M4A1');

    const actionRow = json[1] as any;
    expect(actionRow.type).toBe(1); // ActionRow
    expect(actionRow.components).toHaveLength(1); // Chỉ 1 button duy nhất để tính hoa hồng

    // Button duy nhất: Weapon builds có UTM
    expect(actionRow.components[0].style).toBe(5); // Link
    expect(actionRow.components[0].url).toBe(WEAPON_BUILDS_URL);
    expect(actionRow.components[0].url).toContain('utm_source=');
    expect(actionRow.components[0].url).toContain('server_region=Garena');
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

  it('execute gửi reply thành công khi trong guild kèm files và components', async () => {
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
        files: expect.any(Array),
      }),
    );
  });

  it('/df build phân phối đúng đến executeBuild', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockInteraction: any = {
      guild: { id: 'guild-123' },
      reply: mockReply,
      options: {
        getSubcommandGroup: () => null,
        getSubcommand: () => 'build',
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

  it('/df gun phân phối đúng đến executeBuild', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockInteraction: any = {
      guild: { id: 'guild-123' },
      reply: mockReply,
      options: {
        getSubcommandGroup: () => null,
        getSubcommand: () => 'gun',
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

