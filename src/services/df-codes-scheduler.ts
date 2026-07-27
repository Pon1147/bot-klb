import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { botConfig } from '../config/bot.config.js';
import { fetchDailyCodes } from './deltaforce.scraper.js';
import { buildCodesContainer, hasAnyCodes } from '../commands/df/code.command.js';
import { getSettingsService } from './settings.service.js';
import { getAllGuildIds } from '../database/guild.settings.db.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DfCodesScheduler');

let lastRunDate: string | null = null;
let isRunning = false;

/** Start daily df-code scheduler — fires at 01:00 UTC every day */
export function startDfCodesScheduler(client: Client, database: Database.Database): void {
  const interval = setInterval(() => checkAndSend(client, database), 60_000);

  // Clear interval on shutdown
  client.once('disconnect', () => clearInterval(interval));
  process.once('SIGINT', () => clearInterval(interval));
  process.once('SIGTERM', () => clearInterval(interval));
}

async function checkAndSend(client: Client, database: Database.Database): Promise<void> {
  if (isRunning) return;

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const today = now.toISOString().slice(0, 10);

  // Fire only at 01:00 UTC, once per day
  if (utcHour !== 1 || utcMinute !== 0) return;
  if (lastRunDate === today) return;

  lastRunDate = today;
  isRunning = true;

  try {
    const codes = await fetchDailyCodes().catch(() => null);
    const hasCodes = hasAnyCodes(codes);
    const result = buildCodesContainer(codes, hasCodes);

    if (!result.components || result.components.length === 0) {
      logger.warn('No codes to send');
      return;
    }

    const guildIds = getAllGuildIds(database);
    const settingsService = getSettingsService();

    let sentCount = 0;
    const channels = new Set<string>();

    // Collect channels from guild settings
    for (const guildId of guildIds) {
      const settings = settingsService.get(guildId);
      const channelId = settings.dfCodes.channelId;
      if (channelId && !channels.has(channelId)) {
        channels.add(channelId);
      }
    }

    // Fallback to env var if no guild has channel configured
    if (channels.size === 0 && botConfig.dfCodesChannelId) {
      channels.add(botConfig.dfCodesChannelId);
    }

    if (channels.size === 0) {
      logger.warn('No df-codes channel configured — skipping');
      return;
    }

    // Send to each channel
    for (const channelId of channels) {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        logger.warn(`Channel ${channelId} is not a text channel — skipping`);
        continue;
      }

      await (channel as { send: (data: unknown) => Promise<unknown> }).send({
        content: '_Daily codes updated._',
        components: result.toJSON(),
        files: result.files,
        flags: result.flags,
      });

      sentCount++;
    }

    logger.info(`Daily df-codes sent to ${sentCount} channel(s)`);
  } catch (error) {
    logger.error(`Failed to send daily df-codes: ${(error as Error).message}`);
  } finally {
    isRunning = false;
  }
}
