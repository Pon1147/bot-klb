/**
 * Subcommand Group: /config container
 * Tùy biến giao diện thông báo Discord Components V2 (BM-02).
 */

import { ChatInputCommandInteraction, SlashCommandSubcommandGroupBuilder } from 'discord.js';
import {
  buildEditTypeOptionCallback,
  buildResetTypeOptionCallback,
} from '../../utils/container.utils.js';
import { startInteractiveEdit } from './container-edit.handler.js';
import { handleContainerReset } from './container-reset.handler.js';
import { EN_LOCALE } from '../../locales/en.js';

export function buildContainerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('container')
    .setNameLocalizations({
      vi: 'giao-diện',
    })
    .setDescription('Tùy biến giao diện thông báo Components V2.')
    .setDescriptionLocalizations({
      'en-US': 'Customize and edit Discord Components V2 message layout.',
    })
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setNameLocalizations({
          vi: 'chỉnh-sửa',
        })
        .setDescription('Chỉnh sửa container settings (Interactive UI).')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.container.edit'].desc,
        })
        .addStringOption(buildEditTypeOptionCallback),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setNameLocalizations({
          vi: 'đặt-lại',
        })
        .setDescription('Reset container settings về mặc định.')
        .setDescriptionLocalizations({
          'en-US': EN_LOCALE.commands['config.container.reset'].desc,
        })
        .addStringOption(buildResetTypeOptionCallback),
    );
}

export async function executeContainerGroup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'edit') {
    const type = interaction.options.getString('type', true) as 'welcome' | 'leave' | 'booster';
    await startInteractiveEdit(interaction, type);
  } else if (subcommand === 'reset') {
    await handleContainerReset(interaction, interaction.guild!.id);
  }
}
