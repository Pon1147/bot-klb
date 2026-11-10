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

export function buildContainerGroup(
  group: SlashCommandSubcommandGroupBuilder,
): SlashCommandSubcommandGroupBuilder {
  return group
    .setName('container')
    .setDescription('Tùy biến giao diện thông báo Components V2.')
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Chỉnh sửa container settings (Interactive UI).')
        .addStringOption(buildEditTypeOptionCallback),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset container settings về mặc định.')
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
