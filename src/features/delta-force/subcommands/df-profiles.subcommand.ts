/**
 * Subcommands: /df (Profiles, Game Telemetry & HQ Data)
 * Nghiệp vụ thông tin người chơi, chiến tích, vũ khí và chế tác (BM-03).
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';

import { execute as executeStats } from '../stats.handler.js';
import { execute as executeDaily } from '../daily.handler.js';
import { execute as executeHistory } from '../history.handler.js';
import { execute as executeVault } from '../vault.handler.js';
import { execute as executeMatch } from '../match.handler.js';
import { execute as executeWorkshop } from '../workshop.handler.js';
import { execute as executeMarket } from '../market.handler.js';
import { execute as executeUnlink } from '../unlink.handler.js';
import { execute as executeMap } from '../map.handler.js';
import { execute as executeBuild } from '../build.handler.js';
import { execute as executeLink } from '../link.handler.js';
import { MAX_HISTORY_PAGE } from '../../../config/app.constants.js';

export function buildLinkGroup(
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
    );
}

export function registerProfileSubcommands(
  builder: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder,
): SlashCommandSubcommandsOnlyBuilder {
  return builder
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
      sub
        .setName('vault')
        .setDescription('Sảnh Triển Lãm Đồ Đỏ: Xem bộ sưu tập đồ đỏ và tổng giá trị kho báu.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('match')
        .setDescription('Xem chi tiết kết quả và thành tích trận đấu.')
        .addStringOption((opt) =>
          opt
            .setName('match_id')
            .setDescription('Chọn trận đấu gần đây (hoặc để trống xem trận mới nhất)')
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('workshop').setDescription('Xem thông tin sản xuất tại Xưởng Căn Cứ Ngầm.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('market')
        .setDescription('Tra cứu giá thị trường và bàn chế tác realtime.')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Tên hoặc mã vật phẩm cần tra cứu.')
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('unlink').setDescription('Hủy liên kết tài khoản Delta Force.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('help')
        .setDescription('Xem hướng dẫn sử dụng bot và tải tiện ích liên kết tài khoản.'),
    )
    .addSubcommand((sub) =>
      sub.setName('map').setDescription('Mô phỏng bản đồ 3D tương tác và cẩm nang học map.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('build')
        .setDescription('Thư viện build súng và mã Gunsmith meta (Garena).')
        .addStringOption((opt) =>
          opt
            .setName('weapon')
            .setDescription('Tên súng cần tra cứu (ví dụ: AKM, M4A1, CAR-15...)')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Chế độ chơi (ví dụ: Hazard Operations, Havoc Warfare...)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('gun')
        .setDescription('Thư viện build súng và mã Gunsmith meta (Garena).')
        .addStringOption((opt) =>
          opt
            .setName('weapon')
            .setDescription('Tên súng cần tra cứu (ví dụ: AKM, M4A1, CAR-15...)')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Chế độ chơi (ví dụ: Hazard Operations, Havoc Warfare...)')
            .setRequired(false),
        ),
    );
}

export async function dispatchProfileSubcommand(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<boolean> {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case 'stats':
      await executeStats(interaction, database);
      return true;
    case 'daily':
      await executeDaily(interaction, database);
      return true;
    case 'history':
      await executeHistory(interaction, database);
      return true;
    case 'vault':
      await executeVault(interaction, database);
      return true;
    case 'match':
      await executeMatch(interaction, database);
      return true;
    case 'workshop':
      await executeWorkshop(interaction, database);
      return true;
    case 'market':
      await executeMarket(interaction, database);
      return true;
    case 'unlink':
      await executeUnlink(interaction, database);
      return true;
    case 'map':
      await executeMap(interaction, database);
      return true;
    case 'build':
    case 'gun':
      await executeBuild(interaction, database);
      return true;
    default:
      return false;
  }
}

export async function executeLinkGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeLink(interaction, database);
}
