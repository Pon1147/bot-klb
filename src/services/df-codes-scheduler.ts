import cron from 'node-cron';
import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { fetchDailyCodes } from './deltaforce.scraper.js';
import { buildCodesContainer, hasAnyCodes } from '../commands/df/code.command.js';
import { getSettingsService } from './settings.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DfCodesScheduler');

let cronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Tạo cron expression từ giờ Việt Nam (UTC+7).
 * node-cron chạy theo giờ server (UTC+7) → dùng trực tiếp giờ Việt Nam.
 * Ví dụ: "15:30" → "30 15 * * *"
 */
function timeToCron(timeStr: string): string {
  const [hour, minute] = timeStr.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * Hủy cron job hiện tại.
 */
function stopCronJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('Cron job stopped');
  }
}

/**
 * Lấy timezone hệ thống để log/debug.
 */
function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

/**
 * Khởi động daily df-code scheduler — dùng cron job thay vì polling.
 */
export function startDfCodesScheduler(client: Client, database: Database.Database): void {
  // Hủy job cũ (nếu có)
  stopCronJob();

  const settingsService = getSettingsService();
  // ORDER BY guild_id để thứ tự luôn xác định (guild có ID nhỏ nhất được chọn đầu tiên)
  const guildIds = database
    .prepare('SELECT DISTINCT guild_id FROM guild_settings ORDER BY guild_id ASC')
    .all() as Array<{ guild_id: string }>;

  logger.info(`[init] Found ${guildIds.length} guild(s) in database`);

  let scheduleTime = '01:00'; // fallback mặc định
  let channelId: string | null = null;
  let configuredGuildId: string | null = null;

  // Log chi tiết config của TẤT CẢ guilds
  for (const { guild_id } of guildIds) {
    const settings = settingsService.get(guild_id);
    const dfCodes = settings.dfCodes;
    const hasChannel = !!dfCodes?.channelId;
    const hasTime = !!dfCodes?.scheduleTime;
    logger.info(
      `[init] guild=${guild_id} dfCodes.channelId=${dfCodes?.channelId ?? 'null'} dfCodes.scheduleTime=${dfCodes?.scheduleTime ?? 'null'} hasChannel=${hasChannel} hasTime=${hasTime}`,
    );

    // Lấy config từ guild đầu tiên có channel configured
    if (dfCodes?.channelId && dfCodes?.scheduleTime) {
      scheduleTime = dfCodes.scheduleTime;
      channelId = dfCodes.channelId;
      configuredGuildId = guild_id;
      logger.info(
        `[init] Selected guild ${guild_id} for cron job (channelId=${channelId}, scheduleTime=${scheduleTime})`,
      );
      break;
    }
  }

  if (!channelId) {
    logger.warn(
      '[init] No df-codes channel configured — skipping cron job (need both channelId AND scheduleTime)',
    );
    return;
  }

  const cronExpr = timeToCron(scheduleTime);
  const systemTz = getSystemTimezone();
  // Tính giờ UTC để log
  const [vietHour, vietMinute] = scheduleTime.split(':').map(Number);
  const utcHour = (vietHour - 7 + 24) % 24;
  const utcTime = `${String(utcHour).padStart(2, '0')}:${String(vietMinute).padStart(2, '0')}`;
  logger.info(
    `[init] Starting cron job | expr="${cronExpr}" | scheduleTime=${scheduleTime} (UTC+7) | utc=${utcTime} | systemTz=${systemTz} | channel=${channelId}`,
  );

  cronJob = cron.schedule(cronExpr, async () => {
    const fireTime = new Date().toISOString();
    logger.info(`[cron] FIRED at ${fireTime} (cronExpr=${cronExpr})`);

    try {
      logger.info(`[cron] Step 1/4: Scraping daily codes...`);
      const codes = await fetchDailyCodes().catch((e) => {
        logger.error(`[cron] Step 1/4 FAILED: scrape error = ${(e as Error).message}`);
        return null;
      });
      logger.info(`[cron] Step 1/4: scrape result = ${JSON.stringify(codes)}`);

      const hasCodes = hasAnyCodes(codes);
      logger.info(`[cron] Step 1/4: hasCodes=${hasCodes}`);
      if (!hasCodes) {
        logger.warn('[cron] Step 1/4: No codes to send (scrape returned null or all null)');
        return;
      }

      logger.info(`[cron] Step 2/4: Building codes container...`);
      const result = buildCodesContainer(codes, hasCodes);
      if (!result.components || result.components.length === 0) {
        logger.warn('[cron] Step 2/4: buildCodesContainer returned empty components');
        return;
      }
      logger.info(`[cron] Step 2/4: Container built with ${result.components.length} component(s)`);

      logger.info(`[cron] Step 3/4: Fetching channel ${channelId}...`);
      const channel = await client.channels.fetch(channelId!);
      if (!channel?.isTextBased()) {
        logger.warn(
          `[cron] Step 3/4: Channel ${channelId} is not a text channel (type=${channel?.type ?? 'null'}) — skipping`,
        );
        return;
      }
      const channelName = 'name' in channel ? (channel as { name: string }).name : channelId;
      logger.info(`[cron] Step 3/4: Channel found = #${channelName} (id=${channel.id})`);

      logger.info(`[cron] Step 4/4: Sending message to #${channelName}...`);
      await (channel as { send: (data: unknown) => Promise<unknown> }).send({
        components: result.toJSON(),
        flags: result.flags,
      });

      logger.info(
        `[cron] SUCCESS — Daily df-codes sent to #${channelName} (${channelId}) at ${fireTime}`,
      );
    } catch (error) {
      const errorMsg = (error as Error).message;
      const errorStack = (error as Error).stack || '';
      logger.error(`[cron] FAILED: ${errorMsg}`);
      logger.error(`[cron] Stack: ${errorStack}`);

      // Gửi thông báo vào admin channel nếu có
      const adminChannelId = configuredGuildId
        ? settingsService.get(configuredGuildId)?.dfCodes?.adminChannelId
        : undefined;
      if (adminChannelId) {
        logger.info(`[cron] Sending admin notification to ${adminChannelId}...`);
        try {
          const adminChannel = await client.channels.fetch(adminChannelId);
          if (adminChannel?.isTextBased()) {
            await (adminChannel as { send: (data: unknown) => Promise<unknown> }).send({
              content: `⚠️ **DF Codes scheduler lỗi:** ${errorMsg}`,
            });
            const adminChannelName =
              'name' in adminChannel ? (adminChannel as { name: string }).name : adminChannelId;
            logger.info(`[cron] Admin notification sent to #${adminChannelName}`);
          } else {
            logger.warn(`[cron] Admin channel ${adminChannelId} is not a text channel`);
          }
        } catch (adminError) {
          logger.error(
            `[cron] Failed to send admin notification: ${(adminError as Error).message}`,
          );
        }
      } else {
        logger.warn('[cron] No adminChannelId configured — cannot send error notification');
      }
    }
  });

  // Dọn dẹp khi bot disconnect
  client.once('disconnect', () => stopCronJob());
  process.once('SIGINT', () => stopCronJob());
  process.once('SIGTERM', () => stopCronJob());
}

/**
 * Reschedule cron job khi user đổi time/channel.
 * Gọi từ /df-code settime hoặc setchannel.
 */
export function rescheduleDfCodes(client: Client, database: Database.Database): void {
  stopCronJob();
  startDfCodesScheduler(client, database);
}
