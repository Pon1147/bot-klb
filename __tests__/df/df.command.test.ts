/// <reference types="jest" />
/**
 * Unit tests cho /df command (Command Tree Phase 2).
 * Verify builders, toJSON structure, options, và execute dispatch.
 */

import { data, execute } from '../../src/features/delta-force/df.command.js';
import { execute as executeStats } from '../../src/features/delta-force/stats.handler.js';
import { execute as executeDaily } from '../../src/features/delta-force/daily.handler.js';
import { execute as executeHistory } from '../../src/features/delta-force/history.handler.js';
import { execute as executeWorkshop } from '../../src/features/delta-force/workshop.handler.js';
import { execute as executeUnlink } from '../../src/features/delta-force/unlink.handler.js';
import { execute as executeCode } from '../../src/features/delta-force/code.handler.js';
import { execute as executeLink } from '../../src/features/delta-force/link.handler.js';
import { execute as executeHelp } from '../../src/features/delta-force/help.handler.js';

jest.mock('../../src/features/delta-force/stats.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/daily.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/history.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/workshop.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/unlink.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/code.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/link.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/features/delta-force/help.handler.js', () => ({
  execute: jest.fn().mockResolvedValue(undefined),
}));

function createMockInteraction(overrides: Record<string, unknown> = {}): any {
  const base: Record<string, unknown> = {
    guild: { id: 'guild-123' },
    user: { id: 'user-123' },
    channel: { id: 'channel-123' },
    client: { database: {} },
    options: {
      getSubcommandGroup: jest.fn().mockReturnValue(null),
      getSubcommand: jest.fn().mockReturnValue('stats'),
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
    },
    reply: jest.fn().mockResolvedValue({}),
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
  };

  return { ...base, ...overrides };
}

describe('/df command — Structure & Builder', () => {
  const json = data.toJSON();

  it('phải có root name là "df"', () => {
    expect(json.name).toBe('df');
  });

  it('phải chứa direct subcommands: stats, daily, history, workshop, unlink, help', () => {
    const directSubs = json.options?.filter((o: any) => o.type === 1).map((o: any) => o.name);
    expect(directSubs).toEqual(['stats', 'daily', 'history', 'workshop', 'unlink', 'help']);
  });

  it('subcommand "history" phải có option "limit" (INTEGER, 1-20, optional)', () => {
    const historySub = json.options?.find((o: any) => o.name === 'history');
    expect(historySub).toBeDefined();

    const limitOpt = historySub.options?.find((o: any) => o.name === 'limit');
    expect(limitOpt.type).toBe(4); // INTEGER
    expect(limitOpt.required).toBeFalsy();
    expect(limitOpt.min_value).toBe(1);
    expect(limitOpt.max_value).toBe(20);
  });

  it('phải chứa 2 SubcommandGroups: code và link', () => {
    const groups = json.options?.filter((o: any) => o.type === 2).map((o: any) => o.name);
    expect(groups).toEqual(['code', 'link']);
  });

  describe('code group structure', () => {
    const codeGroup = json.options?.find((o: any) => o.name === 'code');

    it('phải có subcommands: show, status, setchannel, settime, setadminchannel', () => {
      const subNames = codeGroup.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['show', 'status', 'setchannel', 'settime', 'setadminchannel']);
    });

    it('subcommand "show" phải có option "page" (INTEGER, >=1, optional)', () => {
      const showSub = codeGroup.options?.find((s: any) => s.name === 'show');
      const pageOpt = showSub.options?.find((o: any) => o.name === 'page');
      expect(pageOpt.type).toBe(4); // INTEGER
      expect(pageOpt.min_value).toBe(1);
      expect(pageOpt.required).toBeFalsy();
    });

    it('subcommand "setchannel" phải có option "channel" (CHANNEL, required)', () => {
      const setChanSub = codeGroup.options?.find((s: any) => s.name === 'setchannel');
      const chanOpt = setChanSub.options?.find((o: any) => o.name === 'channel');
      expect(chanOpt.type).toBe(7); // CHANNEL
      expect(chanOpt.required).toBe(true);
    });

    it('subcommand "settime" phải có option "time" (STRING, required)', () => {
      const setTimeSub = codeGroup.options?.find((s: any) => s.name === 'settime');
      const timeOpt = setTimeSub.options?.find((o: any) => o.name === 'time');
      expect(timeOpt.type).toBe(3); // STRING
      expect(timeOpt.required).toBe(true);
    });

    it('subcommand "setadminchannel" phải có option "channel" (CHANNEL, required)', () => {
      const setAdminSub = codeGroup.options?.find((s: any) => s.name === 'setadminchannel');
      const chanOpt = setAdminSub.options?.find((o: any) => o.name === 'channel');
      expect(chanOpt.type).toBe(7); // CHANNEL
      expect(chanOpt.required).toBe(true);
    });
  });

  describe('link group structure', () => {
    const linkGroup = json.options?.find((o: any) => o.name === 'link');

    it('phải có subcommands: start, status, manual', () => {
      const subNames = linkGroup.options?.map((s: any) => s.name);
      expect(subNames).toEqual(['start', 'status', 'manual']);
    });

    it('subcommand "manual" phải có option "token" (STRING, required)', () => {
      const manualSub = linkGroup.options?.find((s: any) => s.name === 'manual');
      const tokenOpt = manualSub.options?.find((o: any) => o.name === 'token');
      expect(tokenOpt.type).toBe(3); // STRING
      expect(tokenOpt.required).toBe(true);
    });
  });
});

describe('/df command — Execute Dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phải dispatch tới executeStats khi chọn subcommand "stats"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('stats'),
      },
    });

    await execute(interaction);
    expect(executeStats).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeDaily khi chọn subcommand "daily"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('daily'),
      },
    });

    await execute(interaction);
    expect(executeDaily).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeHistory khi chọn subcommand "history"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('history'),
      },
    });

    await execute(interaction);
    expect(executeHistory).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeWorkshop khi chọn subcommand "workshop"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('workshop'),
      },
    });

    await execute(interaction);
    expect(executeWorkshop).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeUnlink khi chọn subcommand "unlink"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('unlink'),
      },
    });

    await execute(interaction);
    expect(executeUnlink).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeCode khi group là "code"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('code'),
        getSubcommand: jest.fn().mockReturnValue('show'),
      },
    });

    await execute(interaction);
    expect(executeCode).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('phải dispatch tới executeLink khi group là "link"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('link'),
        getSubcommand: jest.fn().mockReturnValue('start'),
        getString: jest.fn().mockReturnValue(null),
      },
    });

    await execute(interaction);
    expect(executeLink).toHaveBeenCalledWith(interaction, expect.anything());
  });

  it('link manual: fallback openid thành user.id nếu không cung cấp', async () => {
    let capturedOpenId: string | null = null;
    (executeLink as jest.Mock).mockImplementationOnce((inter: any) => {
      capturedOpenId = inter.options.getString('openid');
      return Promise.resolve();
    });

    const interaction = createMockInteraction({
      user: { id: 'user-fallback-123' },
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue('link'),
        getSubcommand: jest.fn().mockReturnValue('manual'),
        getString: jest.fn((name: string) => (name === 'token' ? 'hex-token' : null)),
      },
    });
    await execute(interaction);
    expect(executeLink).toHaveBeenCalled();
    expect(capturedOpenId).toBe('user-fallback-123');
  });

  it('phải dispatch tới executeHelp khi chọn subcommand "help"', async () => {
    const interaction = createMockInteraction({
      options: {
        getSubcommandGroup: jest.fn().mockReturnValue(null),
        getSubcommand: jest.fn().mockReturnValue('help'),
      },
    });

    await execute(interaction);
    expect(executeHelp).toHaveBeenCalledWith(interaction, expect.anything());
  });
});

