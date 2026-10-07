import cron from 'node-cron';
import type { Client } from 'discord.js';
import type Database from 'better-sqlite3';
import { fetchDailyCodes } from './deltaforce.scraper.js';
import { buildCodesContainer, hasAnyCodes } from '../features/delta-force/code.renderer.js';
import { getSettingsService } from './settings.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DfCodesScheduler');

type CronTask = ReturnType<typeof cron.schedule>;

/** Lưu trữ các scheduled tasks theo từng guild */
const guildCronJobs = new Map<string, CronTask>();

/** Timezone mặc định cho lịch gửi codes */
export const SCHEDULER_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Tạo cron expression từ giờ Việt Nam (UTC+7).
 * Ví dụ: "15:30" → "30 15 * * *"
 */
export function timeToCron(timeStr: string): string {
  const [hour, minute] = timeStr.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * Dừng cron job của một guild cụ thể.
 */
export function stopGuildCronJob(guildId: string): boolean {
  const task = guildCronJobs.get(guildId);
  if (task) {
    task.stop();
    guildCronJobs.delete(guildId);
    logger.info(`Cron job stopped for guild ${guildId}`);
    return true;
  }
  return false;
}

/**
 * Dừng tất cả cron jobs của mọi guild.
 */
export function stopAllCronJobs(): void {
  for (const [guildId, task] of guildCronJobs.entries()) {
    task.stop();
    logger.info(`Stopped cron job for guild ${guildId}`);
  }
  guildCronJobs.clear();
  logger.info('All cron jobs stopped');
}

/**
 * Lấy danh sách ID các guild hiện đang có active cron job (phục vụ test và audit).
 */
export function getScheduledGuildIds(): string[] {
  return Array.from(guildCronJobs.keys());
}

/**
 * Lên lịch một cron task gửi DF codes cho một guild cụ thể.
 */
function scheduleGuildTask(
  client: Client,
  guildId: string,
  channelId: string,
  scheduleTime: string,
  adminChannelId?: string | null,
): void {
  // Dừng job cũ nếu đã tồn tại cho guild này
  stopGuildCronJob(guildId);

  const cronExpr = timeToCron(scheduleTime);

  logger.info(
    `[guild=${guildId}] Scheduling cron job | expr="${cronExpr}" | time=${scheduleTime} | tz=${SCHEDULER_TIMEZONE} | channel=${channelId}`,
  );

  const task = cron.schedule(
    cronExpr,
    async () => {
      const fireTime = new Date().toISOString();
      logger.info(`[cron][guild=${guildId}] FIRED at ${fireTime} (cronExpr=${cronExpr})`);

      try {
        logger.info(`[cron][guild=${guildId}] Step 1/4: Scraping daily codes...`);
        const codes = await fetchDailyCodes().catch((e) => {
          logger.error(`[cron][guild=${guildId}] Step 1/4 FAILED: ${(e as Error).message}`);
          return null;
        });

        const hasCodes = hasAnyCodes(codes);
        if (!hasCodes) {
          logger.warn(`[cron][guild=${guildId}] Step 1/4: No codes available to send`);
          return;
        }

        logger.info(`[cron][guild=${guildId}] Step 2/4: Building codes container...`);
        const result = buildCodesContainer(codes, hasCodes);
        if (!result.components || result.components.length === 0) {
          logger.warn(`[cron][guild=${guildId}] Step 2/4: buildCodesContainer returned empty`);
          return;
        }

        logger.info(`[cron][guild=${guildId}] Step 3/4: Fetching channel ${channelId}...`);
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          logger.warn(`[cron][guild=${guildId}] Step 3/4: Channel ${channelId} is not text-based`);
          return;
        }
        const channelName = 'name' in channel ? (channel as { name: string }).name : channelId;

        logger.info(`[cron][guild=${guildId}] Step 4/4: Sending message to #${channelName}...`);
        await (channel as { send: (data: unknown) => Promise<unknown> }).send({
          components: result.toJSON(),
          files: result.files,
          flags: result.flags,
        });

        logger.info(`[cron][guild=${guildId}] SUCCESS: Sent to #${channelName} at ${fireTime}`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[cron][guild=${guildId}] FAILED: ${errorMsg}`);

        // Gửi thông báo admin channel nếu có
        if (adminChannelId) {
          try {
            const adminChannel = await client.channels.fetch(adminChannelId);
            if (adminChannel?.isTextBased()) {
              await (adminChannel as { send: (data: unknown) => Promise<unknown> }).send({
                content: `⚠️ **DF Codes scheduler lỗi (${guildId}):** ${errorMsg}`,
              });
            }
          } catch (adminErr) {
            logger.error(
              `[cron][guild=${guildId}] Failed to send admin notification: ${(adminErr as Error).message}`,
            );
          }
        }
      }
    },
    {
      timezone: SCHEDULER_TIMEZONE,
    },
  );

  guildCronJobs.set(guildId, task);
}

/**
 * Khởi động multi-guild daily df-code scheduler.
 * Duyệt tất cả các guild trong database và lên lịch độc lập cho từng guild có đủ cấu hình.
 */
export function startDfCodesScheduler(client: Client, database: Database.Database): void {
  // Dọn dẹp toàn bộ jobs cũ
  stopAllCronJobs();

  const settingsService = getSettingsService();
  const guildIds = database
    .prepare('SELECT DISTINCT guild_id FROM guild_settings ORDER BY guild_id ASC')
    .all() as Array<{ guild_id: string }>;

  logger.info(`[init] Found ${guildIds.length} guild(s) in database`);

  let scheduledCount = 0;
  for (const { guild_id } of guildIds) {
    const settings = settingsService.get(guild_id);
    const dfCodes = settings.dfCodes;

    if (dfCodes?.channelId && dfCodes?.scheduleTime) {
      scheduleGuildTask(
        client,
        guild_id,
        dfCodes.channelId,
        dfCodes.scheduleTime,
        dfCodes.adminChannelId,
      );
      scheduledCount++;
    } else {
      logger.debug(`[init] Guild ${guild_id} has incomplete dfCodes configuration — skipped`);
    }
  }

  logger.info(`[init] Successfully scheduled ${scheduledCount} guild(s)`);

  // Dọn dẹp khi bot disconnect / shutdown
  client.once('disconnect', () => stopAllCronJobs());
  process.once('SIGINT', () => stopAllCronJobs());
  process.once('SIGTERM', () => stopAllCronJobs());
}

/**
 * Reschedule cron job khi người dùng cập nhật time hoặc channel.
 * Nếu truyền targetGuildId: chỉ dừng và cập nhật lại lịch cho guild đó, giữ nguyên các guild khác.
 * Nếu không truyền targetGuildId: khởi động lại toàn bộ.
 */
export function rescheduleDfCodes(
  client: Client,
  database: Database.Database,
  targetGuildId?: string,
): void {
  if (targetGuildId) {
    logger.info(`Rescheduling dfCodes specifically for guild ${targetGuildId}...`);
    const settingsService = getSettingsService();
    const settings = settingsService.get(targetGuildId);
    const dfCodes = settings.dfCodes;

    stopGuildCronJob(targetGuildId);

    if (dfCodes?.channelId && dfCodes?.scheduleTime) {
      scheduleGuildTask(
        client,
        targetGuildId,
        dfCodes.channelId,
        dfCodes.scheduleTime,
        dfCodes.adminChannelId,
      );
    }
    return;
  }

  stopAllCronJobs();
  startDfCodesScheduler(client, database);
}
