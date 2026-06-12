import { ChatInputCommandInteraction } from 'discord.js';
import {
  buildSectionSubcommands,
  executeSectionCommand,
  getWelcomeConfig,
} from '../../utils/section-config.handlers.js';

export const data = buildSectionSubcommands('welcome', {
  main: 'Configure the welcome system for new members.',
  setChannel: 'Set the welcome message channel.',
  setRole: 'Set the role to assign on join.',
  toggle: 'Enable or disable the welcome system.',
  status: 'Show current welcome configuration.',
});

export async function execute(
  interaction: ChatInputCommandInteraction,
  _database: unknown,
): Promise<void> {
  await executeSectionCommand(interaction, _database, getWelcomeConfig());
}
