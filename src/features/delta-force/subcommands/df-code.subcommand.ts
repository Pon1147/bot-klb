/**
 * Subcommand Group: /df code
 * Quản lý tra cứu và cấu hình phát mã két sắt hằng ngày (BM-04).
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { execute as executeCode } from '../code.handler.js';
import { EN_LOCALE } from '../../../locales/en.js';

export function buildCodeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('code')
    .setNameLocalizations({
      vi: 'mã-két',
    })
    .setDescription('Mật khẩu hằng ngày của các map.')
    .setDescriptionLocalizations({
      'en-US': 'Daily safe vault combination codes and scheduler configuration.',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('show')
        .setNameLocalizations({
          vi: 'xem',
        })
        .setDescription('Xem mật khẩu hôm nay.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.code.show'].desc,
        })
        .addIntegerOption((opt) =>
          opt
            .setName('page')
            .setNameLocalizations({
              vi: 'trang',
            })
            .setDescription('Số trang hiển thị')
            .setDescriptionLocalizations({ 'en-US': 'Page number' })
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setNameLocalizations({
          vi: 'trạng-thái',
        })
        .setDescription('Xem channel cấu hình gửi codes.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.code.status'].desc,
        }),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setchannel')
        .setNameLocalizations({
          vi: 'đặt-kênh',
        })
        .setDescription('Đặt channel tự động gửi codes mỗi ngày.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.code.setchannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setNameLocalizations({
              vi: 'kênh',
            })
            .setDescription('Kênh để gửi codes.')
            .setDescriptionLocalizations({ 'en-US': 'Channel to post daily safe codes' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('settime')
        .setNameLocalizations({
          vi: 'đặt-giờ',
        })
        .setDescription('Đặt giờ tự động gửi codes mỗi ngày.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.code.settime'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setNameLocalizations({
              vi: 'thời-gian',
            })
            .setDescription('Giờ gửi theo định dạng HH:mm (24h), ví dụ 08:00')
            .setDescriptionLocalizations({ 'en-US': 'Schedule time in HH:mm format (e.g., 08:00)' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setadminchannel')
        .setNameLocalizations({
          vi: 'kênh-báo-lỗi',
        })
        .setDescription('Đặt channel nhận thông báo lỗi scheduler.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.code.setadminchannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setNameLocalizations({
              vi: 'kênh',
            })
            .setDescription('Channel để bot gửi thông báo khi scrape lỗi.')
            .setDescriptionLocalizations({ 'en-US': 'Channel for scheduler error notifications' })
            .setRequired(true),
        ),
    );
}

export async function executeCodeGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeCode(interaction, database);
}
