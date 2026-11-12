/**
 * Subcommand Group: /config booster
 * Quản lý cấu hình tri ân Server Booster (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { executeSectionCommand, getBoosterConfig } from '../../utils/section-config.handlers.js';
import { EN_LOCALE } from '../../locales/en.js';

export function buildBoosterGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('booster')
    .setNameLocalizations({
      vi: 'booster',
    })
    .setDescription('Cấu hình hệ thống cảm ơn Server Booster.')
    .setDescriptionLocalizations({
      'en-US': 'Configure server booster appreciation messages and roles.',
    })
    .addSubcommand((sub) =>
      sub
        .setName('setchannel')
        .setNameLocalizations({
          vi: 'đặt-kênh',
        })
        .setDescription('Chọn kênh gửi tin nhắn cảm ơn Booster.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.booster.setchannel'].desc,
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setNameLocalizations({
              vi: 'kênh',
            })
            .setDescription('Kênh tin nhắn')
            .setDescriptionLocalizations({ 'en-US': 'The text channel to send booster messages' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('setrole')
        .setNameLocalizations({
          vi: 'gán-role',
        })
        .setDescription('Chọn role dành riêng cho Booster.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.booster.setrole'].desc,
        })
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setNameLocalizations({
              vi: 'vai-trò',
            })
            .setDescription('Role Booster')
            .setDescriptionLocalizations({ 'en-US': 'The role to assign to server boosters' })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setNameLocalizations({
          vi: 'bật-tắt',
        })
        .setDescription('Bật hoặc tắt hệ thống thông báo Booster.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.booster.toggle'].desc,
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
        .setDescription('Xem trạng thái cấu hình Booster hiện tại.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.booster.status'].desc,
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setNameLocalizations({
          vi: 'thử-nghiệm',
        })
        .setDescription('Gửi tin nhắn cảm ơn Booster thử nghiệm để kiểm tra hiển thị.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.booster.test'].desc,
        }),
    );
}

export async function executeBoosterGroup(
  interaction: ChatInputCommandInteraction,
  database: Database.Database,
): Promise<void> {
  await executeSectionCommand(interaction, database, getBoosterConfig());
}
