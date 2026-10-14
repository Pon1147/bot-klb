/**
 * Service quản lý lịch phát tự động toàn hệ thống (Global Auto-Post Scheduler) cho Delta Force.
 * Tự động duyệt qua toàn bộ các server bot đang tham gia và gửi cẩm nang định kỳ vào announcement channel.
 */

import cron from 'node-cron';
import { Client, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { buildMapContainer } from '../features/delta-force/map.handler.js';
import { buildWeaponContainer } from '../features/delta-force/build.handler.js';
import { getSettingsService } from './settings.service.js';
import { findAnnouncementChannel } from '../features/admin/config.command.js';
import {
  AutoPostContentType,
  getAutoPostConfig,
  getAllAutoPostConfigs,
  updateAutoPostConfig,
} from '../database/df-autopost.db.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DfAutoPostScheduler');

type CronTask = ReturnType<typeof cron.schedule>;

/** Quản lý các active cron jobs theo từng loại nội dung ('map' | 'gun') */
const activeTasks = new Map<AutoPostContentType, CronTask>();

/** Timezone chuẩn Việt Nam (UTC+7) */
export const SCHEDULER_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Chuyển đổi số giờ lặp lại thành biểu thức cron.
 * - 24 giờ: Chạy vào 08:00 sáng mỗi ngày ("0 8 * * *").
 * - N giờ (1-23): Chạy vào phút thứ 0 sau mỗi N giờ ("0 *\/N * * *").
 */
export function intervalToCron(intervalHours: number): string {
  const safeHours = Math.max(1, Math.min(24, Math.floor(intervalHours)));
  if (safeHours === 24) {
    return '0 8 * * *';
  }
  return `0 */${safeHours} * * *`;
}

/**
 * Kết quả báo cáo sau khi phát sóng auto-post tới các server.
 */
export interface BroadcastResult {
  type: AutoPostContentType;
  totalGuilds: number;
  successCount: number;
  failedCount: number;
  details: Array<{
    guildId: string;
    guildName: string;
    channelName?: string;
    success: boolean;
    reason?: string;
  }>;
}

/**
 * Phát sóng nội dung (map hoặc gun) tới tất cả các server mà bot đang tham gia.
 * Có cơ chế delay giữa các guild để tránh Discord rate limit.
 */
export async function broadcastAutoPost(
  client: Client,
  database: Database.Database,
  type: AutoPostContentType,
  options: { delayMs?: number } = {},
): Promise<BroadcastResult> {
  const delayMs = options.delayMs ?? 1000;
  const guilds = Array.from(client.guilds.cache.values());
  const settingsService = getSettingsService();

  logger.info(`[Broadcast][type=${type}] Bắt đầu phát sóng tới ${guilds.length} máy chủ...`);

  const containerResult = type === 'map' ? buildMapContainer() : buildWeaponContainer();
  const results: BroadcastResult['details'] = [];

  for (let i = 0; i < guilds.length; i++) {
    const guild = guilds[i];
    try {
      const configuredChannelId = settingsService.get(guild.id).botAnnounce?.channelId;
      const { channel, reason } = findAnnouncementChannel(guild, configuredChannelId);

      if (!channel) {
        results.push({
          guildId: guild.id,
          guildName: guild.name,
          success: false,
          reason: reason || 'Không tìm thấy kênh văn bản thích hợp có quyền gửi tin nhắn',
        });
        continue;
      }

      await channel.send({
        components: containerResult.toJSON(),
        files: containerResult.files,
        flags: MessageFlags.IsComponentsV2,
      });

      results.push({
        guildId: guild.id,
        guildName: guild.name,
        channelName: channel.name,
        success: true,
      });

      // Nghỉ nhẹ giữa các guild để chống rate-limit nếu còn guild tiếp theo
      if (i < guilds.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      results.push({
        guildId: guild.id,
        guildName: guild.name,
        success: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  // Cập nhật thời điểm chạy gần nhất vào DB
  updateAutoPostConfig(database, type, { lastRunAt: new Date().toISOString() });

  logger.info(
    `[Broadcast][type=${type}] Hoàn tất: ${successCount} thành công, ${failedCount} thất bại / tổng số ${guilds.length} máy chủ`,
  );

  return {
    type,
    totalGuilds: guilds.length,
    successCount,
    failedCount,
    details: results,
  };
}

/**
 * Dừng cron task của một loại nội dung.
 */
export function stopAutoPostTask(type: AutoPostContentType): boolean {
  const task = activeTasks.get(type);
  if (task) {
    task.stop();
    activeTasks.delete(type);
    logger.info(`Đã dừng cron task cho loại "${type}"`);
    return true;
  }
  return false;
}

/**
 * Dừng toàn bộ các cron tasks đang chạy.
 */
export function stopAllAutoPostTasks(): void {
  for (const [type, task] of activeTasks.entries()) {
    task.stop();
    logger.info(`Đã dừng cron task cho loại "${type}"`);
  }
  activeTasks.clear();
  logger.info('Toàn bộ cron tasks Auto-Post đã dừng');
}

/**
 * Lấy danh sách các loại nội dung hiện đang có cron task hoạt động.
 */
export function getActiveAutoPostTypes(): AutoPostContentType[] {
  return Array.from(activeTasks.keys());
}

/**
 * Lên lịch cron task cho một loại nội dung dựa trên cấu hình trong database.
 */
export function scheduleAutoPostTask(
  client: Client,
  database: Database.Database,
  type: AutoPostContentType,
): void {
  stopAutoPostTask(type);

  const config = getAutoPostConfig(database, type);
  if (!config.enabled) {
    logger.debug(`[type=${type}] Cấu hình Auto-Post đang tắt — không lên lịch`);
    return;
  }

  const cronExpr = intervalToCron(config.intervalHours);

  logger.info(
    `[Schedule][type=${type}] Lên lịch cron: expr="${cronExpr}" (mỗi ${config.intervalHours}h) | tz=${SCHEDULER_TIMEZONE}`,
  );

  const task = cron.schedule(
    cronExpr,
    async () => {
      logger.info(`[Cron Trigger][type=${type}] Bắt đầu thực thi phát sóng tự động định kỳ...`);
      try {
        await broadcastAutoPost(client, database, type);
      } catch (error) {
        logger.error(`[Cron Trigger][type=${type}] Lỗi khi phát sóng: ${(error as Error).message}`);
      }
    },
    {
      timezone: SCHEDULER_TIMEZONE,
    },
  );

  activeTasks.set(type, task);
}

/**
 * Khởi động toàn bộ Global Auto-Post Scheduler khi bot bật.
 */
export function startDfAutoPostScheduler(client: Client, database: Database.Database): void {
  stopAllAutoPostTasks();

  const configs = getAllAutoPostConfigs(database);
  logger.info(`[Init] Tìm thấy ${configs.length} cấu hình Auto-Post`);

  for (const config of configs) {
    if (config.enabled) {
      scheduleAutoPostTask(client, database, config.type);
    }
  }

  client.once('disconnect', () => stopAllAutoPostTasks());
  process.once('SIGINT', () => stopAllAutoPostTasks());
  process.once('SIGTERM', () => stopAllAutoPostTasks());
}

/**
 * Tải lại lịch trình khi Bot Owner thay đổi cấu hình.
 */
export function rescheduleDfAutoPost(
  client: Client,
  database: Database.Database,
  type?: AutoPostContentType,
): void {
  if (type) {
    scheduleAutoPostTask(client, database, type);
    return;
  }

  startDfAutoPostScheduler(client, database);
}
