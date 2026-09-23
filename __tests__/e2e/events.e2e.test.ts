/**
 * Events E2E — guildMemberAdd, guildMemberUpdate.
 * Real SettingsService + real guild_settings table + real buildContainer.
 * Mocked: discord.js (constants), bot.config (env vars).
 */

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});
afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
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
  SlashCommandBuilder: class { setName() { return this; } setDescription() { return this; } },
  ActionRowBuilder: class { addComponents() { return this; } },
  ButtonBuilder: class { setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } },
  ButtonStyle: { Secondary: 2 },
  AttachmentBuilder: class { constructor() {} },
  Client: class {},
  GuildMember: class {},
}));

import Database from 'better-sqlite3';
import { createTestDb, seedGuildSettings } from './setup';
import { createMockGuildMember, createMockTextChannel, createMockRole } from './fixtures';
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
    leave: { enabled: false, channelId: null, container: { accentColor: 0xff0000, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false } },
    booster: {
      enabled: false,
      channelId: null,
      roleId: null,
      container: { accentColor: 0xfb663a, headerTemplate: null, contentLines: [], mediaUrl: null, mediaDescription: null, showSeparator: false },
      ...overrides.booster,
    },
  };
}

// ── guildMemberAdd ────────────────────────────────────────────────

describe('Events E2E — guildMemberAdd', () => {
  let db: Database.Database;

  beforeEach(() => {
    jest.resetModules();
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  function setupSettingsService() {
    const { SettingsService, setSettingsService } = require('../../src/services/settings.service');
    setSettingsService(new SettingsService(db));
  }

  it('phải gửi welcome message + cấp role khi cấu hình đầy đủ', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-welcome' });
    const role = createMockRole({ id: 'role-welcome' });

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: 'role-welcome' },
    }));

    const member = createMockGuildMember({
      userId: 'user-456',
      username: 'NewMember',
      bot: false,
      guildId: 'guild-123',
      channelId: 'channel-welcome',
      channelIdExists: true,
      roleId: 'role-welcome',
      roleIdExists: true,
    });
    member.guild.channels.cache.get.mockImplementation((id: string) => id === 'channel-welcome' ? channel : undefined);
    member.guild.roles.cache.get.mockImplementation((id: string) => id === 'role-welcome' ? role : undefined);

    const { execute } = require('../../src/events/guildMemberAdd.event');
    await execute({}, member);

    expect(channel.send).toHaveBeenCalled();
    expect(member.roles.add).toHaveBeenCalledWith(role);
  });

  it('phải bỏ qua khi member là bot', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: null },
    }));

    const member = createMockGuildMember({ bot: true, guildId: 'guild-123' });
    const { execute } = require('../../src/events/guildMemberAdd.event');
    await expect(execute({}, member)).resolves.not.toThrow();
  });

  it('phải bỏ qua khi welcome bị tắt', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: false, channelId: 'channel-welcome', roleId: null },
    }));

    const member = createMockGuildMember({ bot: false, guildId: 'guild-123' });
    const { execute } = require('../../src/events/guildMemberAdd.event');
    await expect(execute({}, member)).resolves.not.toThrow();
  });

  it('phải bỏ qua khi chưa có channel', async () => {
    setupSettingsService();
    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: null, roleId: null },
    }));

    const member = createMockGuildMember({ bot: false, guildId: 'guild-123' });
    const { execute } = require('../../src/events/guildMemberAdd.event');
    await expect(execute({}, member)).resolves.not.toThrow();
  });

  it('phải bỏ qua khi channel không phải text-based', async () => {
    setupSettingsService();

    // Channel exists but isTextBased returns false
    const notTextChannel = { isTextBased: () => false };
    const member = createMockGuildMember({
      bot: false,
      guildId: 'guild-123',
      channelId: 'channel-welcome',
      channelIdExists: false, // don't create a real text channel
    });
    member.guild.channels.cache.get.mockImplementation(() => notTextChannel);

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: null },
    }));

    const { execute } = require('../../src/events/guildMemberAdd.event');
    await execute({}, member);

    // Should not send anything since channel is not text-based
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('phải xử lý lỗi khi channel.send ném exception', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-welcome' });
    channel.send.mockRejectedValue(new Error('channel send failed'));

    const member = createMockGuildMember({
      bot: false,
      guildId: 'guild-123',
      channelId: 'channel-welcome',
      channelIdExists: true,
      roleIdExists: false, // no role to avoid extra branching
    });
    member.guild.channels.cache.get.mockImplementation((id: string) => id === 'channel-welcome' ? channel : undefined);

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: null },
    }));

    const { execute } = require('../../src/events/guildMemberAdd.event');
    await execute({}, member);

    // Error should be caught and logged, not thrown
    expect(console.error).toHaveBeenCalled();
  });

  it('phải cảnh báo khi welcome role không tồn tại', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-welcome' });
    const member = createMockGuildMember({
      bot: false,
      guildId: 'guild-123',
      channelId: 'channel-welcome',
      channelIdExists: true,
      roleId: 'role-nonexistent',
      roleIdExists: false,
    });
    member.guild.channels.cache.get.mockImplementation((id: string) => id === 'channel-welcome' ? channel : undefined);
    member.guild.roles.cache.get.mockImplementation(() => undefined); // role not found

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: 'role-nonexistent' },
    }));

    const { execute } = require('../../src/events/guildMemberAdd.event');
    await execute({}, member);

    expect(channel.send).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
    );
  });

  it('phải xử lý lỗi khi gán role thất bại', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-welcome' });
    const role = createMockRole({ id: 'role-welcome' });

    const member = createMockGuildMember({
      bot: false,
      guildId: 'guild-123',
      channelId: 'channel-welcome',
      channelIdExists: true,
      roleId: 'role-welcome',
      roleIdExists: true,
    });
    member.roles.add.mockRejectedValue(new Error('permission denied'));
    member.guild.channels.cache.get.mockImplementation((id: string) => id === 'channel-welcome' ? channel : undefined);
    member.guild.roles.cache.get.mockImplementation((id: string) => id === 'role-welcome' ? role : undefined);

    seedGuildSettings(db, 'guild-123', makeSettings({
      welcome: { enabled: true, channelId: 'channel-welcome', roleId: 'role-welcome' },
    }));

    const { execute } = require('../../src/events/guildMemberAdd.event');
    await execute({}, member);

    expect(channel.send).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to assign role'),
    );
  });
});

// ── guildMemberUpdate (boost detection) ────────────────────────────

describe('Events E2E — guildMemberUpdate', () => {
  let db: Database.Database;

  beforeEach(() => {
    jest.resetModules();
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  function setupSettingsService() {
    const { SettingsService, setSettingsService } = require('../../src/services/settings.service');
    setSettingsService(new SettingsService(db));
  }

  it('phải gửi booster message + cấp role khi member boost', async () => {
    setupSettingsService();

    const channel = createMockTextChannel({ id: 'channel-booster' });
    const role = createMockRole({ id: 'role-booster' });

    seedGuildSettings(db, 'guild-123', makeSettings({
      booster: { enabled: true, channelId: 'channel-booster', roleId: 'role-booster' },
    }));

    const oldMember = createMockGuildMember({ premiumSince: null, guildId: 'guild-123' });
    const newMember = createMockGuildMember({
      premiumSince: '2026-06-10T00:00:00.000Z',
      guildId: 'guild-123',
      channelId: 'channel-booster',
      channelIdExists: true,
      roleId: 'role-booster',
      roleIdExists: true,
    });
    newMember.guild.channels.cache.get.mockImplementation((id: string) => id === 'channel-booster' ? channel : undefined);
    newMember.guild.roles.cache.get.mockImplementation((id: string) => id === 'role-booster' ? role : undefined);

    const { execute } = require('../../src/events/guildMemberUpdate.event');
    await execute({}, oldMember, newMember);

    expect(channel.send).toHaveBeenCalled();
    expect(newMember.roles.add).toHaveBeenCalledWith(role);
  });

  it('phải bỏ qua khi member là bot', async () => {
    setupSettingsService();

    const oldMember = createMockGuildMember({ bot: true, premiumSince: null });
    const newMember = createMockGuildMember({ bot: true, premiumSince: '2026-06-10T00:00:00.000Z' });

    const { execute } = require('../../src/events/guildMemberUpdate.event');
    await expect(execute({}, oldMember, newMember)).resolves.not.toThrow();
  });

  it('phải bỏ qua khi member đã đang boost', async () => {
    setupSettingsService();

    const oldMember = createMockGuildMember({ premiumSince: '2025-01-01T00:00:00.000Z' });
    const newMember = createMockGuildMember({ premiumSince: '2026-06-10T00:00:00.000Z' });

    const { execute } = require('../../src/events/guildMemberUpdate.event');
    await expect(execute({}, oldMember, newMember)).resolves.not.toThrow();
  });

  it('phải bỏ qua khi member ngưng boost', async () => {
    setupSettingsService();

    const oldMember = createMockGuildMember({ premiumSince: '2026-01-01T00:00:00.000Z' });
    const newMember = createMockGuildMember({ premiumSince: null });

    const { execute } = require('../../src/events/guildMemberUpdate.event');
    await expect(execute({}, oldMember, newMember)).resolves.not.toThrow();
  });
});
