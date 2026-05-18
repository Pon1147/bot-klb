import { Events, ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'discord.js';

/**
 * Command module interface - matches what command handler loads.
 */
interface CommandModule {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Handle interactionCreate event: process slash commands.
 * Only handles ChatInputCommand interactions; other types are ignored.
 */
export async function execute(
  interaction: any,
  commands: Collection<string, CommandModule>
): Promise<void> {
  // Guard clause: only handle slash commands
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;
  const commandModule = commands.get(commandName);

  // Guard clause: skip if command not found
  if (!commandModule) {
    console.warn(`Command not found: ${commandName}`);
    return;
  }

  try {
    await commandModule.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);

    // Reply with error message if interaction is still reusable
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      });
    }
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,
  execute,
};