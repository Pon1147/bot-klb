/**
 * Test cho container.command.ts.
 * Verify execute function (lines 88-135) đạt 100% coverage.
 */
import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';

// Mock dependencies
jest.mock('../src/utils/container.utils.js', () => ({
  buildErrorContainer: jest.fn((message: string) => ({
    components: [{ type: 17, components: [{ type: 10, content: message }] }],
    flags: MessageFlags.IsComponentsV2,
  })),
}));

jest.mock('../src/commands/container/container-edit.handler.js', () => ({
  startInteractiveEdit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/commands/container/container-reset.handler.js', () => ({
  handleContainerReset: jest.fn().mockResolvedValue(undefined),
}));

import { startInteractiveEdit } from '../src/commands/container/container-edit.handler.js';
import { handleContainerReset } from '../src/commands/container/container-reset.handler.js';
import { data, execute, buildEditSubcommand, buildResetSubcommand } from '../src/commands/container/container.command.js';

// ─── Helpers ──────────────────────────────────────────────────

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123' },
    user: { id: 'user-123' },
    member: {
      permissions: {
        has: jest.fn().mockReturnValue(true),
      },
    },
    channel: { id: 'channel-123' },
    replied: false,
    options: {
      getString: jest.fn().mockReturnValue('welcome'),
      getSubcommand: jest.fn().mockReturnValue('edit'),
    },
    reply: jest.fn().mockResolvedValue({}),
    fetchReply: jest.fn().mockResolvedValue({ id: 'msg-123' }),
    deferReply: jest.fn().mockResolvedValue({}),
  };

  return { ...base, ...overrides };
}

describe('container.command - data', () => {
  it('phải có name là "container"', () => {
    expect((data as any).name).toBe('container');
  });

  it('phải có description', () => {
    expect((data as any).description).toBeDefined();
  });
});

describe('container.command - buildEditSubcommand', () => {
  it('phải trả về subcommand có name "edit"', () => {
    const mockSub: any = {
      setName: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addStringOption: jest.fn().mockReturnThis(),
    };

    buildEditSubcommand(mockSub);

    expect(mockSub.setName).toHaveBeenCalledWith('edit');
    expect(mockSub.setDescription).toHaveBeenCalled();
    expect(mockSub.addStringOption).toHaveBeenCalled();
  });
});

describe('container.command - buildResetSubcommand', () => {
  it('phải trả về subcommand có name "reset"', () => {
    const mockSub: any = {
      setName: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addStringOption: jest.fn().mockReturnThis(),
    };

    buildResetSubcommand(mockSub);

    expect(mockSub.setName).toHaveBeenCalledWith('reset');
    expect(mockSub.setDescription).toHaveBeenCalled();
    expect(mockSub.addStringOption).toHaveBeenCalled();
  });
});

describe('container.command - execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('guard clause: no guild', () => {
    it('phải reply và return khi không có guild', async () => {
      const interaction = createMockInteraction({
        guild: null,
      });

      await execute(interaction, {});

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Lệnh này chỉ dùng được trong server.',
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });

  describe('guard clause: no Administrator permission', () => {
    it('phải reply và return khi không có permission Administrator', async () => {
      const interaction = createMockInteraction({
        member: {
          permissions: {
            has: jest.fn().mockReturnValue(false),
          },
        },
      });

      await execute(interaction, {});

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
          flags: MessageFlags.Ephemeral,
        }),
      );
    });

    it('phải reply và return khi member là null', async () => {
      const interaction = createMockInteraction({
        member: null,
      });

      await execute(interaction, {});

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Bạn cần quyền Administrator để sử dụng lệnh này.',
          flags: MessageFlags.Ephemeral,
        }),
      );
    });
  });

  describe('subcommand: edit', () => {
    it('phải gọi startInteractiveEdit với type=welcome', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'welcome');
    });

    it('phải gọi startInteractiveEdit với type=leave', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('leave'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'leave');
    });

    it('phải gọi startInteractiveEdit với type=booster', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('booster'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'booster');
    });
  });

  describe('subcommand: reset', () => {
    it('phải gọi handleContainerReset với guildId đúng', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('reset'),
        },
      });

      await execute(interaction, {});

      expect(handleContainerReset).toHaveBeenCalledWith(interaction, 'guild-123');
    });
  });

  describe('subcommand: default (unknown)', () => {
    it('phải reply error container khi subcommand không hợp lệ', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('unknown'),
        },
      });

      await execute(interaction, {});

      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  describe('error handling (outer catch)', () => {
    it('phải catch lỗi từ handler và log error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Make startInteractiveEdit throw
      (startInteractiveEdit as jest.Mock).mockRejectedValue(new Error('Handler Error'));

      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('phải reply error container khi handler throw và interaction chưa replied', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      (startInteractiveEdit as jest.Mock).mockRejectedValue(new Error('Handler Error'));

      const interaction = createMockInteraction({
        replied: false,
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      // Should reply with error container
      expect(interaction.reply).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('phải KHÔNG reply lại nếu interaction đã replied khi handler throw', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      (startInteractiveEdit as jest.Mock).mockRejectedValue(new Error('Handler Error'));

      const interaction = createMockInteraction({
        replied: true,
        reply: jest.fn().mockResolvedValue({}),
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      // interaction.replied = true nên không gọi reply
      expect(interaction.reply).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});