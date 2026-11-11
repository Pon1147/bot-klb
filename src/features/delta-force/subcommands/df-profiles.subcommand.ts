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
import { execute as executeGiftCode } from '../gift-code.handler.js';
import { MAX_HISTORY_PAGE } from '../../../config/app.constants.js';
import { EN_LOCALE } from '../../../locales/en.js';

export function buildLinkGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('link')
    .setDescription('Liên kết / kiểm tra / xác thực tài khoản Delta Force HQ.')
    .setDescriptionLocalizations({
      'en-US': 'Link / check / verify Delta Force HQ account.',
    })
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('start')
        .setDescription('Tạo mã claim và gửi hướng dẫn qua DM.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.link.start'].desc,
        }),
    )
    .addSubcommand((sub: SlashCommandSubcommandBuilder) =>
      sub
        .setName('status')
        .setDescription('Kiểm tra trạng thái liên kết hiện tại.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.link.status'].desc,
        }),
    );
}

export function registerProfileSubcommands(
  builder: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder,
): SlashCommandSubcommandsOnlyBuilder {
  return builder
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('Xem thống kê tài khoản Delta Force.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.stats'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('daily')
        .setDescription('Trạng thái chiến đấu hàng ngày Delta Force.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.daily'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('history')
        .setDescription('Xem lịch sử trận đấu Delta Force.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.history'].desc,
        })
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Số trận hiển thị (1-20)')
            .setDescriptionLocalizations({
              'en-US': 'Number of matches to display (1-20)',
            })
            .setMinValue(1)
            .setMaxValue(MAX_HISTORY_PAGE),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('vault')
        .setDescription('Sảnh Triển Lãm Đồ Đỏ: Xem bộ sưu tập đồ đỏ và tổng giá trị kho báu.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.vault'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('match')
        .setDescription('Xem chi tiết kết quả và thành tích trận đấu.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.match'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('match_id')
            .setDescription('Chọn trận đấu gần đây (hoặc để trống xem trận mới nhất)')
            .setDescriptionLocalizations({
              'en-US': 'Select recent match (or leave empty for latest)',
            })
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('workshop')
        .setDescription('Xem thông tin sản xuất tại Xưởng Căn Cứ Ngầm.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.workshop'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('market')
        .setDescription('Tra cứu giá thị trường và bàn chế tác realtime.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.market'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Tên hoặc mã vật phẩm cần tra cứu.')
            .setDescriptionLocalizations({
              'en-US': 'Item name or code to look up.',
            })
            .setAutocomplete(true)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unlink')
        .setDescription('Hủy liên kết tài khoản Delta Force.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.unlink'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('help')
        .setDescription('Xem hướng dẫn sử dụng bot và tải tiện ích liên kết tài khoản.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.help'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('map')
        .setDescription('Mô phỏng bản đồ 3D tương tác và cẩm nang học map.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.map'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('build')
        .setDescription('Thư viện build súng và mã Gunsmith meta (Garena).')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.build'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('weapon')
            .setDescription('Tên súng cần tra cứu (ví dụ: AKM, M4A1, CAR-15...)')
            .setDescriptionLocalizations({
              'en-US': 'Weapon name to look up (e.g. AKM, M4A1, CAR-15...)',
            })
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Chế độ chơi (ví dụ: Hazard Operations, Havoc Warfare...)')
            .setDescriptionLocalizations({
              'en-US': 'Game mode (e.g. Hazard Operations, Havoc Warfare...)',
            })
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('gun')
        .setDescription('Thư viện build súng và mã Gunsmith meta (Garena).')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.gun'].desc,
        })
        .addStringOption((opt) =>
          opt
            .setName('weapon')
            .setDescription('Tên súng cần tra cứu (ví dụ: AKM, M4A1, CAR-15...)')
            .setDescriptionLocalizations({
              'en-US': 'Weapon name to look up (e.g. AKM, M4A1, CAR-15...)',
            })
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Chế độ chơi (ví dụ: Hazard Operations, Havoc Warfare...)')
            .setDescriptionLocalizations({
              'en-US': 'Game mode (e.g. Hazard Operations, Havoc Warfare...)',
            })
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('gift-code')
        .setDescription('Nhận 280 mã giftcode tân thủ và công cụ tự động nhận quà.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['df.gift-code'].desc,
        }),
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
    case 'gift-code':
    case 'giftcode':
      await executeGiftCode(interaction, database);
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
