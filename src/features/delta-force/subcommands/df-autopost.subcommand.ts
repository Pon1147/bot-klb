/**
 * Subcommand Group: /df autopost
 * Quản lý lịch phát tự động bản đồ 3D và build súng meta toàn hệ thống (BM-04).
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { execute as executeAutopost } from '../autopost.handler.js';

export function buildAutopostGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('autopost')
    .setDescription('Quản lý lịch phát tự động map/gun toàn hệ thống (Chỉ dành cho Bot Owner).')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Thiết lập chu kỳ lặp lại cho loại nội dung.')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung muốn phát tự động')
            .setRequired(true)
            .addChoices(
              { name: '🗺️ Bản Đồ 3D (/df map)', value: 'map' },
              { name: '🔫 Build Súng Garena (/df gun)', value: 'gun' },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('interval_hours')
            .setDescription('Khoảng cách số giờ giữa mỗi lần phát (1 - 24 giờ)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('broadcast_now')
            .setDescription('Phát sóng ngay lập tức đợt đầu tiên? (Mặc định: True)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt phát tự động cho loại nội dung.')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung')
            .setRequired(true)
            .addChoices(
              { name: '🗺️ Bản Đồ 3D (/df map)', value: 'map' },
              { name: '🔫 Build Súng Garena (/df gun)', value: 'gun' },
            ),
        )
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Bật (True) hoặc Tắt (False)').setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('status').setDescription('Xem trạng thái cấu hình Auto-Post toàn hệ thống.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('run')
        .setDescription('Bắn thử nghiệm ngay lập tức 1 đợt tới toàn bộ các máy chủ.')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung muốn phát ngay')
            .setRequired(true)
            .addChoices(
              { name: '🗺️ Bản Đồ 3D (/df map)', value: 'map' },
              { name: '🔫 Build Súng Garena (/df gun)', value: 'gun' },
            ),
        ),
    );
}

export async function executeAutopostGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeAutopost(interaction, database);
}
