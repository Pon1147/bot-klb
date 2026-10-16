/**
 * Handler quản lý lệnh /df autopost (Global Auto-Post Scheduler).
 * Chỉ dành riêng cho Bot Owner quản lý lịch phát tự động map/gun tới toàn bộ các máy chủ.
 */

import { ChatInputCommandInteraction, ComponentType, MessageFlags } from 'discord.js';
import Database from 'better-sqlite3';
import { botConfig } from '../../config/bot.config.js';
import { COLORS } from '../../config/container.variables.js';
import { makeResult } from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';
import {
  AutoPostContentType,
  getAllAutoPostConfigs,
  updateAutoPostConfig,
} from '../../database/df-autopost.db.js';
import { broadcastAutoPost, rescheduleDfAutoPost } from '../../services/df-autopost-scheduler.js';

const TYPE_NAMES: Record<AutoPostContentType, string> = {
  map: '🗺️ Mô Phỏng Bản Đồ 3D (/df map)',
  gun: '🔫 Thư Viện Build Súng Garena (/df gun)',
};

/**
 * Kiểm tra xem người gọi lệnh có phải là Bot Owner không.
 */
export function isBotOwner(userId: string): boolean {
  return userId === botConfig.botOwnerId;
}

/**
 * Tính toán timestamp Unix (giây) của lần chạy cron tiếp theo dựa trên chu kỳ giờ.
 */
export function getNextCronRunTimestamp(intervalHours: number): number {
  const now = new Date();
  if (intervalHours === 24) {
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return Math.floor(next.getTime() / 1000);
  }

  const safeHours = Math.max(1, Math.min(23, Math.floor(intervalHours)));
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  let nextHour = (Math.floor(now.getHours() / safeHours) + 1) * safeHours;
  if (nextHour >= 24) {
    next.setDate(next.getDate() + 1);
    nextHour = nextHour % 24;
  }
  next.setHours(nextHour);
  return Math.floor(next.getTime() / 1000);
}

/**
 * Xử lý subcommand /df autopost set.
 */
async function handleSet(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const type = interaction.options.getString('type', true) as AutoPostContentType;
  const intervalHours = interaction.options.getInteger('interval_hours', true);
  const broadcastNow = interaction.options.getBoolean('broadcast_now') ?? true;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  updateAutoPostConfig(db, type, { enabled: true, intervalHours });
  rescheduleDfAutoPost(interaction.client, db, type);

  let broadcastSummary = '';
  if (broadcastNow) {
    const broadcastResult = await broadcastAutoPost(interaction.client, db, type, { delayMs: 800 });
    broadcastSummary = `• **Phát sóng đợt 1 ngay:** 🟢 ${broadcastResult.successCount} thành công, 🔴 ${broadcastResult.failedCount} thất bại / tổng số ${broadcastResult.totalGuilds} máy chủ.\n`;
  }

  const typeName = TYPE_NAMES[type] ?? type;
  const nextRun = `<t:${getNextCronRunTimestamp(intervalHours)}:R> (<t:${getNextCronRunTimestamp(intervalHours)}:t>)`;

  const content = [
    '## ✅ Cập Nhật & Kích Hoạt Auto-Post Toàn Hệ Thống Thành Công',
    '',
    `• **Loại nội dung:** ${typeName}`,
    `• **Chu kỳ lặp lại:** Mỗi **${intervalHours} giờ**`,
    `• **Trạng thái:** 🟢 Đang Bật (Đã đồng bộ lưu MongoDB vĩnh viễn)`,
    broadcastSummary.trim(),
    `• **Đợt phát sóng tiếp theo:** ${nextRun}`,
    `• **Phạm vi:** Tự động phát tới toàn bộ **${interaction.client.guilds.cache.size} máy chủ** có bot.`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.SUCCESS },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );

  await interaction.editReply({
    components: result.toJSON(),
  });
}

/**
 * Xử lý subcommand /df autopost toggle.
 */
async function handleToggle(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const type = interaction.options.getString('type', true) as AutoPostContentType;
  const enabled = interaction.options.getBoolean('enabled', true);

  updateAutoPostConfig(db, type, { enabled });
  rescheduleDfAutoPost(interaction.client, db, type);

  const typeName = TYPE_NAMES[type] ?? type;
  const statusStr = enabled ? '🟢 ĐÃ BẬT' : '🔴 ĐÃ TẮT';

  await sendReply(interaction, {
    content: `✅ Đã chuyển trạng thái Auto-Post của **${typeName}** sang: **${statusStr}** (Đã đồng bộ MongoDB vĩnh viễn).`,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Xử lý subcommand /df autopost status.
 */
async function handleStatus(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const configs = getAllAutoPostConfigs(db);
  const totalGuilds = interaction.client.guilds.cache.size;

  const lines = configs.map((cfg) => {
    const typeName = TYPE_NAMES[cfg.type] ?? cfg.type;
    const statusIcon = cfg.enabled ? '🟢 BẬT' : '🔴 TẮT';
    const lastRun = cfg.lastRunAt
      ? `<t:${Math.floor(new Date(cfg.lastRunAt).getTime() / 1000)}:R>`
      : '_Chưa chạy_';
    const nextRun = cfg.enabled
      ? `<t:${getNextCronRunTimestamp(cfg.intervalHours)}:R>`
      : '_Đang tắt_';
    return [
      `### ${typeName}`,
      `• **Trạng thái:** ${statusIcon}`,
      `• **Chu kỳ:** Mỗi **${cfg.intervalHours} giờ**`,
      `• **Lần chạy gần nhất:** ${lastRun}`,
      `• **Lần phát tiếp theo:** ${nextRun}`,
    ].join('\n');
  });

  const content = [
    '## 🛡️ Bảng Điều Khiển Auto-Post Global (Bot Owner)',
    '',
    `📡 **Tổng số máy chủ đang tham gia:** **${totalGuilds} máy chủ**`,
    '',
    ...lines,
    '',
    '> 💡 *Dữ liệu đã được lưu trữ vĩnh viễn trên MongoDB — không bị mất khi bot khởi động lại.*',
  ].join('\n');

  const result = makeResult(
    [
      {
        type: ComponentType.Container,
        components: [
          { type: ComponentType.TextDisplay, content },
          { type: ComponentType.Separator, accentColor: COLORS.INFO },
        ],
      },
    ],
    MessageFlags.IsComponentsV2,
    [],
  );

  await sendReply(interaction, {
    components: result.toJSON(),
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

/**
 * Xử lý subcommand /df autopost run (bắn thử nghiệm ngay lập tức).
 */
async function handleRun(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const type = interaction.options.getString('type', true) as AutoPostContentType;
  const typeName = TYPE_NAMES[type] ?? type;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await broadcastAutoPost(interaction.client, db, type);

  const detailLines = result.details.map((d, idx) => {
    if (d.success) {
      const matchTag = d.matchReason ? ` _(${d.matchReason})_` : '';
      return `**${idx + 1}. ${d.guildName}**: ✅ Đã gửi → #${d.channelName}${matchTag}`;
    }
    return `**${idx + 1}. ${d.guildName}**: ⚠️ Bỏ qua → ${d.reason}`;
  });

  const content = [
    `## 🚀 Kết Quả Phát Sóng Thủ Công: ${typeName}`,
    '',
    `• **Tổng số máy chủ:** ${result.totalGuilds}`,
    `• **Thành công:** 🟢 ${result.successCount}`,
    `• **Thất bại/Bỏ qua:** 🔴 ${result.failedCount}`,
    '',
    '**Chi tiết từng máy chủ:**',
    ...detailLines.slice(0, 20), // Giới hạn tối đa 20 dòng để tránh vượt ký tự
    result.details.length > 20 ? `_...và còn ${result.details.length - 20} máy chủ khác._` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const safeContent =
    content.length > 1950
      ? `${content.slice(0, 1900)}\n\n_...danh sách chi tiết quá dài đã được rút gọn._`
      : content;

  await interaction.editReply({
    content: safeContent,
  });
}

/**
 * Entry point thực thi nhóm lệnh /df autopost.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  // Guard bảo mật: Chỉ duy nhất Bot Owner được phép thao tác
  if (!isBotOwner(interaction.user.id)) {
    await sendReply(interaction, {
      content: '❌ Lệnh này chỉ dành riêng cho Bot Owner.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const db = (database ?? interaction.client.database) as Database.Database;
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleSet(interaction, db);
      return;
    case 'toggle':
      await handleToggle(interaction, db);
      return;
    case 'status':
      await handleStatus(interaction, db);
      return;
    case 'run':
      await handleRun(interaction, db);
      return;
    default:
      await sendReply(interaction, {
        content: 'Lệnh autopost không hợp lệ.',
        flags: MessageFlags.Ephemeral,
      });
  }
}
