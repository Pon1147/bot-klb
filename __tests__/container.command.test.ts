/**
 * Test cho container.command.ts.
 * Verify execute function (lines 88-135) Ä‘áº¡t 100% coverage.
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
    toJSON() { return this.components; },
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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  it('pháº£i cÃ³ name lÃ  "container"', () => {
    expect(data.name).toBe('container');
  });

  it('pháº£i cÃ³ description', () => {
    expect(data.description).toBeDefined();
  });
});

describe('container.command - buildEditSubcommand', () => {
  it('pháº£i tráº£ vá» subcommand cÃ³ name "edit"', () => {
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
  it('pháº£i tráº£ vá» subcommand cÃ³ name "reset"', () => {
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
    it('pháº£i reply vÃ  return khi khÃ´ng cÃ³ guild', async () => {
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
    it('pháº£i reply vÃ  return khi khÃ´ng cÃ³ permission Administrator', async () => {
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

    it('pháº£i reply vÃ  return khi member lÃ  null', async () => {
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
    it('pháº£i gá»i startInteractiveEdit vá»›i type=welcome', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('welcome'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'welcome');
    });

    it('pháº£i gá»i startInteractiveEdit vá»›i type=leave', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: jest.fn().mockReturnValue('leave'),
          getSubcommand: jest.fn().mockReturnValue('edit'),
        },
      });

      await execute(interaction, {});

      expect(startInteractiveEdit).toHaveBeenCalledWith(interaction, 'leave');
    });

    it('pháº£i gá»i startInteractiveEdit vá»›i type=booster', async () => {
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
    it('pháº£i gá»i handleContainerReset vá»›i guildId Ä‘Ãºng', async () => {
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
    it('pháº£i reply error container khi subcommand khÃ´ng há»£p lá»‡', async () => {
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
    it('pháº£i catch lá»—i tá»« handler vÃ  log error', async () => {
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

    it('pháº£i reply error container khi handler throw vÃ  interaction chÆ°a replied', async () => {
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

    it('pháº£i KHÃ”NG reply láº¡i náº¿u interaction Ä‘Ã£ replied khi handler throw', async () => {
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

      // interaction.replied = true nÃªn khÃ´ng gá»i reply
      expect(interaction.reply).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});