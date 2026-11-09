/// <reference types="jest" />
import { Collection } from 'discord.js';
import {
  deployCommands,
  CommandModule,
  formatCommandForEnvironment,
} from '../../src/infrastructure/discord/command-loader.js';
import { botConfig } from '../../src/config/bot.config.js';

// Mock REST và Routes
const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  return {
    ...actual,
    REST: jest.fn().mockImplementation(() => ({
      setToken: jest.fn().mockReturnThis(),
      get: mockGet,
      put: mockPut,
    })),
    Routes: {
      applicationGuildCommands: (clientId: string, guildId: string) =>
        `/applications/${clientId}/guilds/${guildId}/commands`,
      applicationCommands: (clientId: string) => `/applications/${clientId}/commands`,
    },
  };
});

describe('deployCommands (Hybrid Scope: Guild vs Global)', () => {
  const originalScope = botConfig.commandScope;
  const originalGuildId = botConfig.guildId;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    botConfig.commandScope = originalScope;
    botConfig.guildId = originalGuildId;
  });

  function createMockCommands(): Collection<string, CommandModule> {
    const col = new Collection<string, CommandModule>();
    col.set('ping', {
      data: {
        name: 'ping',
        description: 'Ping command',
        options: [],
        toJSON: () => ({ name: 'ping', description: 'Ping command', options: [] }),
      } as any,
      execute: jest.fn(),
    });
    return col;
  }

  it('nên deploy tới Guild khi scope là guild', async () => {
    botConfig.commandScope = 'guild';
    botConfig.guildId = '123456789012345678';

    // Mock discord trả về rỗng (cần deploy mới)
    mockGet.mockResolvedValueOnce([]);
    mockPut.mockResolvedValueOnce([]);

    const commands = createMockCommands();
    await deployCommands(commands);

    expect(mockGet).toHaveBeenCalledWith(
      `/applications/${botConfig.clientId}/guilds/123456789012345678/commands`,
    );
    expect(mockPut).toHaveBeenCalledWith(
      `/applications/${botConfig.clientId}/guilds/123456789012345678/commands`,
      expect.objectContaining({
        body: expect.arrayContaining([expect.objectContaining({ name: 'ping' })]),
      }),
    );
  });

  it('nên deploy tới Global khi scope là global và dọn dẹp guild commands cũ', async () => {
    botConfig.commandScope = 'global';
    botConfig.guildId = '123456789012345678';

    // Mock discord trả về rỗng cho global commands
    mockGet.mockResolvedValueOnce([]);
    // Mock PUT cho global commands thành công
    mockPut.mockResolvedValueOnce([]);
    // Mock PUT cho cleanup guild commands
    mockPut.mockResolvedValueOnce([]);

    const commands = createMockCommands();
    await deployCommands(commands);

    // Kiểm tra deploy global
    expect(mockGet).toHaveBeenCalledWith(`/applications/${botConfig.clientId}/commands`);
    expect(mockPut).toHaveBeenCalledWith(
      `/applications/${botConfig.clientId}/commands`,
      expect.objectContaining({
        body: expect.arrayContaining([expect.objectContaining({ name: 'ping' })]),
      }),
    );

    // Kiểm tra cleanup guild commands cũ để tránh duplicate
    expect(mockPut).toHaveBeenCalledWith(
      `/applications/${botConfig.clientId}/guilds/123456789012345678/commands`,
      { body: [] },
    );
  });

  it('nên bỏ qua deployment nếu không có thay đổi (fingerprint trùng khớp)', async () => {
    botConfig.commandScope = 'guild';
    botConfig.guildId = '123456789012345678';

    // Mock discord trả về command y hệt local
    mockGet.mockResolvedValueOnce([
      {
        id: '999',
        name: 'ping',
        description: 'Ping command',
        options: [],
      },
    ]);

    const commands = createMockCommands();
    await deployCommands(commands);

    expect(mockGet).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('BUG-07: khop fingerprint giua SlashCommandBuilder instance va REST API raw object', async () => {
    botConfig.commandScope = 'guild';
    botConfig.guildId = '123456789012345678';

    mockGet.mockResolvedValueOnce([
      {
        id: '123',
        name: 'df',
        description: 'Delta Force command',
        options: [
          {
            type: 1,
            name: 'stats',
            description: 'Show stats',
            required: false,
            options: [],
          },
        ],
        default_member_permissions: null,
      },
    ]);

    const col = new Collection<string, CommandModule>();
    col.set('df', {
      data: {
        name: 'df',
        description: 'Delta Force command',
        options: [{ type: 1, name: 'stats', description: 'Show stats' }],
        toJSON() {
          return {
            name: 'df',
            description: 'Delta Force command',
            options: [{ type: 1, name: 'stats', description: 'Show stats' }],
          };
        },
      } as any,
      execute: jest.fn(),
    });

    await deployCommands(col);

    expect(mockGet).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  describe('formatCommandForEnvironment', () => {
    const sampleCommand = {
      name: 'config',
      description: 'Quản lý bot',
      options: [
        {
          type: 2,
          name: 'qr-server',
          description: 'Quản lý tính năng QR',
          options: [
            {
              type: 1,
              name: 'status',
              description: 'Xem trạng thái QR',
            },
          ],
        },
      ],
    };

    it('không thay đổi description khi isDev = false', () => {
      const res = formatCommandForEnvironment(sampleCommand, false);
      expect(res.description).toBe('Quản lý bot');
      const opt = (res.options as any[])[0];
      expect(opt.description).toBe('Quản lý tính năng QR');
      expect(opt.options[0].description).toBe('Xem trạng thái QR');
    });

    it('thêm tiền tố (dev) vào description và các subcommands khi isDev = true', () => {
      const res = formatCommandForEnvironment(sampleCommand, true);
      expect(res.description).toBe('(dev) Quản lý bot');
      const opt = (res.options as any[])[0];
      expect(opt.description).toBe('(dev) Quản lý tính năng QR');
      expect(opt.options[0].description).toBe('(dev) Xem trạng thái QR');
    });

    it('không bị duplicate tiền tố (dev) nếu đã có sẵn', () => {
      const alreadyTagged = {
        name: 'test',
        description: '(dev) Lệnh test',
      };
      const res = formatCommandForEnvironment(alreadyTagged, true);
      expect(res.description).toBe('(dev) Lệnh test');
    });
  });
});

