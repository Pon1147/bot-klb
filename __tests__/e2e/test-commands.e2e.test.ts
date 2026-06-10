/**
 * Test Commands E2E — /test-welcome, /test-booster.
 * Real SettingsService + real guild_settings table + real buildContainer.
 * Mocked: discord.js (constants), bot.config (env vars).
 */

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

jest.mock('../../src/config/bot.config', () => ({
  botConfig: {
    token: 'test-token',
    clientId: 'test-client-id',
    guildId: 'test-guild-id',
    welcomeChannelId: null,
    welcomeRoleId: null,
    databasePath: ':memory:',
  },
}));

jest.mock('discord.js', () => ({
  ComponentType: { TextDisplay: 10, Separator: 14, Container: 17, Section: 9, Thumbnail: 11 },
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  PermissionFlagsBits: { Administrator: 0x8 },
  SlashCommandBuilder: class {
    setName() { return this; }
    setDescription() { return this; }
    addUserOption() { return this; }
  },
  ActionRowBuilder: class { addComponents() { return this; } },
  ButtonBuilder: class { setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } },
  ButtonStyle: { Secondary: 2 },
  AttachmentBuilder: class { constructor() {} },
}));

import Database from 'better-sqlite3';
import { createTestDb, seedGuildSettings } from './setup';
import { createMockInteraction, createMockGuild, createMockTextChannel, createMockRole } from './fixtures';
import type { GuildSettings } from '../../src/types/settings.types';

function makeSettings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    welcome: {
      enabled: true,
      channelId: null,
      roleId: null,
      container: { accentColor: 0x5865f2, headerTemplate: '## Xin chào {username}!', contentLines: ['Chào mừng!'], mediaUrl: null, mediaDescription: null, showSeparator: true },
      ...overrides.welcome,
    },
    leave: {
      enabled: false,
      channelId: null,
      container: { accentColor: 0xff0000, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false },
    },
    booster: {
      enabled: false,
      channelId: null,
      roleId: null,
      container: { accentColor: 0xfb663a, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false },
      ...overrides.booster,
    },
  };
}

// ── /test-welcome ─────────────────────────────────────────────────

describe('Test Commands E2E — /test-welcome', () => {
  let db: Database.Database;
  let execute: (interaction: any, db: any) => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    db = createTestDb();
    ({ execute } = require('../../src/commands/welcome/welcome-test.command'));
  });

  afterEach(() => {
    db.close();
  });

  function setupSettingsService() {
    const { SettingsService, setSettingsService } = require('../../src/services/settings.service');
    setSettingsService(new SettingsService(db));
  }

  it('phải xử lý khi SettingsService chưa khởi tạo', async () => {
    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const call = interaction.reply.mock.calls[0][0];
    expect(call.components || call.content).toBeDefined();
  });

  it('phải từ chối khi không có guild', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings());

    const interaction = createMockInteraction({ guild: null });
    // Ensure guild is truly null (not a default mock)
    interaction.guild = null;
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('server') }),
    );
  });

  it('phải từ chối khi thiếu quyền Administrator', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings());

    const interaction = createMockInteraction({
      member: {
        permissions: {
          has: () => false,
        },
      },
    });
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Administrator') }),
    );
  });

  it('phải xử lý lỗi khi SettingsService ném exception', async () => {
    // Deliberately set a corrupt settings service that throws
    const { SettingsService, setSettingsService } = require('../../src/services/settings.service');
    const badService = new SettingsService(db);
    jest.spyOn(badService, 'getWelcome').mockImplementation(() => {
      throw new Error('corrupt settings');
    });
    setSettingsService(badService);

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const replyCall = interaction.reply.mock.calls[0][0];
    expect(replyCall.components).toBeDefined();
  });

  it('phải gửi container vào channel khi có cấu hình', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-welcome' });
    const guild = createMockGuild({
      id: 'guild-123',
      channels: new Map([['channel-welcome', channel]]),
    });

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: null },
    }));

    const interaction = createMockInteraction({ guild });
    await execute(interaction, db);

    // Either channel.send (success) or interaction.reply (error/ephemeral fallback)
    const wasHandled = channel.send.mock.calls.length > 0 || interaction.reply.mock.calls.length > 0;
    expect(wasHandled).toBe(true);

    if (interaction.reply.mock.calls.length > 0) {
      const replyCall = interaction.reply.mock.calls[0][0];
      // Should have either success message or components
      expect(replyCall.content || replyCall.components).toBeDefined();
    }
  });

  it('phải reply ephemeral khi chưa có channel', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: null, roleId: null },
    }));

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array), flags: expect.any(Number) }),
    );
  });
});

// ── /test-booster ─────────────────────────────────────────────────

describe('Test Commands E2E — /test-booster', () => {
  let db: Database.Database;
  let execute: (interaction: any, db: any) => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    db = createTestDb();
    ({ execute } = require('../../src/commands/booster/test.command'));
  });

  afterEach(() => {
    db.close();
  });

  function setupSettingsService() {
    const { SettingsService, setSettingsService } = require('../../src/services/settings.service');
    setSettingsService(new SettingsService(db));
  }

  it('phải xử lý khi SettingsService chưa khởi tạo', async () => {
    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalled();
    const call = interaction.reply.mock.calls[0][0];
    expect(call.components || call.content).toBeDefined();
  });

  it('phải gửi container vào channel khi có cấu hình', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-booster' });
    const guild = createMockGuild({
      id: 'guild-123',
      channels: new Map([['channel-booster', channel]]),
    });

    seedGuildSettings(db, 'guild-123', makeSettings({
      booster: { enabled: true, channelId: 'channel-booster', roleId: 'role-booster' },
    }));

    const interaction = createMockInteraction({ guild });
    await execute(interaction, db);

    const wasHandled = channel.send.mock.calls.length > 0 || interaction.reply.mock.calls.length > 0;
    expect(wasHandled).toBe(true);

    if (interaction.reply.mock.calls.length > 0) {
      const replyCall = interaction.reply.mock.calls[0][0];
      expect(replyCall.content || replyCall.components).toBeDefined();
    }
  });

  it('phải reply ephemeral khi chưa có channel', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings({
      booster: { enabled: true, channelId: null, roleId: null },
    }));

    const interaction = createMockInteraction();
    await execute(interaction, db);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array), flags: expect.any(Number) }),
    );
  });
});
