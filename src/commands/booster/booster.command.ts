import { ChatInputCommandInteraction } from 'discord.js';
import {
  buildSectionSubcommands,
  executeSectionCommand,
  getBoosterConfig,
} from '../../utils/section-config.handlers.js';

export const data = buildSectionSubcommands('booster', {
  main: 'Configure the booster thank-you system.',
  setChannel: 'Set the booster thank-you message channel.',
  setRole: 'Set the role to assign on boost.',
  toggle: 'Enable or disable the booster system.',
  status: 'Show current booster configuration.',
});

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  await executeSectionCommand(interaction, _database, getBoosterConfig());
}