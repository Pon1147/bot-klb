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
import { EN_LOCALE } from '../../../locales/en.js';

export function buildAutopostGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('autopost')
    .setDescription('Quản lý lịch phát tự động map/gun toàn hệ thống (Chỉ dành cho Bot Owner).')
    .setDescriptionLocalizations({
      'en-US': 'Manage automated tactical guides and weapon meta auto-posting.',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('set')
        .setDescription('Thiết lập chu kỳ lặp lại cho loại nội dung.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.autopost.set'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung muốn phát tự động')
            .setDescriptionLocalizations({ 'en-US': 'Content type to broadcast' })
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
            .setDescriptionLocalizations({ 'en-US': 'Interval between broadcasts in hours (1-24)' })
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('broadcast_now')
            .setDescription('Phát sóng ngay lập tức đợt đầu tiên? (Mặc định: True)')
            .setDescriptionLocalizations({
              'en-US': 'Broadcast first batch immediately? (default: true)',
            })
            .setRequired(false),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('toggle')
        .setDescription('Bật hoặc tắt phát tự động cho loại nội dung.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.autopost.toggle'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung')
            .setDescriptionLocalizations({ 'en-US': 'Content type' })
            .setRequired(true)
            .addChoices(
              { name: '🗺️ Bản Đồ 3D (/df map)', value: 'map' },
              { name: '🔫 Build Súng Garena (/df gun)', value: 'gun' },
            ),
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Bật (True) hoặc Tắt (False)')
            .setDescriptionLocalizations({ 'en-US': 'Enable (true) or Disable (false)' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setDescription('Xem trạng thái cấu hình Auto-Post toàn hệ thống.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.autopost.status'].desc,
        }),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('run')
        .setDescription('Bắn thử nghiệm ngay lập tức 1 đợt tới toàn bộ các máy chủ.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.autopost.run'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại nội dung muốn phát ngay')
            .setDescriptionLocalizations({ 'en-US': 'Content type to immediately broadcast' })
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
