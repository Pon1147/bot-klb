/**
 * Subcommand Group: /config leave
 * Quản lý cấu hình thông báo khi thành viên rời server (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getLeaveConfig } from '../../utils/section-config.handlers.js';
import { EN_LOCALE } from '../../locales/en.js';

export function buildLeaveGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('leave')
    .setNameLocalizations({
      vi: 'tạm-biệt',
    })
    .setDescription('Cấu hình hệ thống tạm biệt khi thành viên rời server.')
    .setDescriptionLocalizations({
      'en-US': 'Configure member leave and farewell notifications.',
    })
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setNameLocalizations({
          vi: 'đặt-kênh',
        })
        .setDescription('Chọn kênh gửi tin nhắn tạm biệt.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.leave.setchannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setNameLocalizations({
              vi: 'kênh',
            })
            .setDescription('Kênh tin nhắn')
            .setDescriptionLocalizations({ 'en-US': 'The text channel for farewell notices' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setNameLocalizations({
          vi: 'bật-tắt',
        })
        .setDescription('Bật hoặc tắt hệ thống tạm biệt.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.leave.toggle'].desc,
        })
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setNameLocalizations({
              vi: 'trạng-thái',
            })
            .setDescription('Bật (true) hoặc Tắt (false)')
            .setDescriptionLocalizations({ 'en-US': 'Enable (true) or Disable (false)' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setNameLocalizations({
          vi: 'trạng-thái',
        })
        .setDescription('Xem trạng thái cấu hình tạm biệt hiện tại.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.leave.status'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setNameLocalizations({
          vi: 'thử-nghiệm',
        })
        .setDescription('Gửi tin nhắn tạm biệt thử nghiệm để kiểm tra hiển thị.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.leave.test'].desc,
        }),
    );
}

export async function executeLeaveGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getLeaveConfig());
}
