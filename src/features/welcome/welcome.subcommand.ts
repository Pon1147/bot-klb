/**
 * Subcommand Group: /config welcome
 * Quản lý cấu hình chào mừng thành viên mới (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getWelcomeConfig } from '../../utils/section-config.handlers.js';
import { EN_LOCALE } from '../../locales/en.js';

export function buildWelcomeGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('welcome')
    .setNameLocalizations({
      vi: 'chào-mừng',
    })
    .setDescription('Cấu hình hệ thống chào mừng thành viên mới.')
    .setDescriptionLocalizations({
      'en-US': 'Configure automated welcome messages for new members.',
    })
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setNameLocalizations({
          vi: 'đặt-kênh',
        })
        .setDescription('Chọn kênh gửi tin nhắn chào mừng.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.welcome.setchannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setNameLocalizations({
              vi: 'kênh',
            })
            .setDescription('Kênh tin nhắn')
            .setDescriptionLocalizations({ 'en-US': 'The text channel for welcome messages' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setNameLocalizations({
          vi: 'gán-role',
        })
        .setDescription('Chọn role tự động cấp khi vào server.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.welcome.setrole'].desc,
        })
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setNameLocalizations({
              vi: 'vai-trò',
            })
            .setDescription('Role cần cấp')
            .setDescriptionLocalizations({ 'en-US': 'The role to automatically grant' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setNameLocalizations({
          vi: 'bật-tắt',
        })
        .setDescription('Bật hoặc tắt hệ thống chào mừng.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.welcome.toggle'].desc,
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
        .setDescription('Xem trạng thái cấu hình chào mừng hiện tại.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.welcome.status'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setNameLocalizations({
          vi: 'thử-nghiệm',
        })
        .setDescription('Gửi tin nhắn chào mừng thử nghiệm để kiểm tra hiển thị.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.welcome.test'].desc,
        }),
    );
}

export async function executeWelcomeGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getWelcomeConfig());
}
