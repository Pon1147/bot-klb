/**
 * /df — Lệnh tổng hợp Delta Force (stats, daily, history, workshop, unlink, code, link).
 *
 * Cấu trúc:
 * /df stats
 * /df daily
 * /df history [limit: 1-20]
 * /df workshop
 * /df unlink
 * /df code show [page: >=1]
 * /df code status
 * /df code setchannel <channel>
 * /df code settime <time>
 * /df code setadminchannel <channel>
 * /df link start
 * /df link status
 * /df link manual <token> [openid]
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { execute as executeStats } from './stats.handler.js';
import { execute as executeDaily } from './daily.handler.js';
import { execute as executeHistory } from './history.handler.js';
import { execute as executeWorkshop } from './workshop.handler.js';
import { execute as executeUnlink } from './unlink.handler.js';
import { execute as executeCode } from './code.handler.js';
import { execute as executeLink } from './link.handler.js';
import { execute as executeHelp } from './help.handler.js';

import { MAX_HISTORY_PAGE } from '../../config/app.constants.js';
import { buildErrorContainer } from '../../utils/container.utils.js';
import { sendReply } from '../../utils/reply.utils.js';

// ─── Subcommand Builders ──────────────────────────────────────────

function buildCodeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('code')
    .setDescription('Mật khẩu hằng ngày của các map.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('show')
        .setDescription('Xem mật khẩu hôm nay.')
        .addIntegerOption((opt) =>
          opt.setName('page').setDescription('Số trang hiển thị').setMinValue(1),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('status').setDescription('Xem channel cấu hình gửi codes.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setchannel')
        .setDescription('Đặt channel tự động gửi codes mỗi ngày.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Kênh để gửi codes.').setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('settime')
        .setDescription('Đặt giờ tự động gửi codes mỗi ngày.')
        .addStringOption((opt) =>
          opt
            .setName('time')
            .setDescription('Giờ gửi theo định dạng HH:mm (24h), ví dụ 08:00')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('setadminchannel')
        .setDescription('Đặt channel nhận thông báo lỗi scheduler.')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel để bot gửi thông báo khi scrape lỗi.')
            .setRequired(true),
        ),
    );
}

function buildLinkGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('link')
    .setDescription('Liên kết / kiểm tra / xác thực tài khoản Delta Force HQ.')
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('start').setDescription('Tạo mã claim và gửi hướng dẫn qua DM.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub.setName('status').setDescription('Kiểm tra trạng thái liên kết hiện tại.'),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('manual')
        .setDescription('Liên kết bằng cách nhập token (fallback).')
        .addStringOption((opt) =>
          opt.setName('token').setDescription('Token authentication (hex)').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('openid').setDescription('OpenID của tài khoản HQ').setRequired(false),
        ),
    );
}

// ─── Slash Command Builder ────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('df')
  .setDescription('Các lệnh Delta Force: stats, daily, history, workshop, link, code, unlink.')
  .addSubcommand((sub) =>
    sub.setName('stats').setDescription('Xem thống kê tài khoản Delta Force.'),
  )
  .addSubcommand((sub) =>
    sub.setName('daily').setDescription('Trạng thái chiến đấu hàng ngày Delta Force.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('history')
      .setDescription('Xem lịch sử trận đấu Delta Force.')
      .addIntegerOption((opt) =>
        opt
          .setName('limit')
          .setDescription('Số trận hiển thị (1-20)')
          .setMinValue(1)
          .setMaxValue(MAX_HISTORY_PAGE),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('workshop').setDescription('Xem thông tin sản xuất tại Xưởng Căn Cứ Ngầm.'),
  )
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Hủy liên kết tài khoản Delta Force.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('help')
      .setDescription('Xem hướng dẫn sử dụng bot và tải tiện ích liên kết tài khoản.'),
  )
  .addSubcommandGroup(buildCodeGroup)
  .addSubcommandGroup(buildLinkGroup);

// ─── Execute ──────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const db = (database ?? interaction.client.database) as Database.Database;

  // 1. Phân phối nhóm SubcommandGroups
  if (group === 'code') {
    await executeCode(interaction, db);
    return;
  }

  if (group === 'link') {
    // Nếu gọi /df link manual mà không truyền openid, fallback sang userId để tránh lỗi NOT NULL DB
    if (subcommand === 'manual' && !interaction.options.getString('openid')) {
      const origGetString = interaction.options.getString.bind(interaction.options);
      (interaction.options as unknown as Record<string, unknown>).getString = (
        name: string,
        required?: boolean,
      ) => {
        if (name === 'openid') return interaction.user.id;
        return origGetString(name as never, required as never);
      };
    }
    await executeLink(interaction, db);
    return;
  }

  // 2. Phân phối các Subcommands trực tiếp
  switch (subcommand) {
    case 'stats':
      await executeStats(interaction, db);
      return;
    case 'daily':
      await executeDaily(interaction, db);
      return;
    case 'history':
      await executeHistory(interaction, db);
      return;
    case 'workshop':
      await executeWorkshop(interaction, db);
      return;
    case 'unlink':
      await executeUnlink(interaction, db);
      return;
    case 'help':
      await executeHelp(interaction, db);
      return;
    default:
      await sendReply(interaction, {
        components: buildErrorContainer('Lệnh Delta Force không hợp lệ.').toJSON(),
      });
  }
}
