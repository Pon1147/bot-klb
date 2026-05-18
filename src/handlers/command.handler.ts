import { Collection } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { botConfig } from '../config/bot.config.js';

/**
 * Interface for a slash command module.
 * Each command file must export `data` (SlashCommandBuilder) and `execute` function.
 */
export interface CommandModule {
  data: any;
  execute: (...args: any[]) => Promise<any>;
}

/**
 * Load all command modules from the commands directory.
 * Recursively reads all subdirectories to support organized command folders.
 */
export function loadCommands(collection: Collection<string, CommandModule>): void {
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!readdirSync(commandsPath).length) {
    console.log('No commands found.');
    return;
  }

  const commandFiles = readdirSync(commandsPath, { recursive: true }).filter(f => typeof f === 'string');

  for (const file of commandFiles) {
    const fileName = file as string;
    if (!fileName.endsWith('.js')) continue;

    const filePath = path.join(commandsPath, fileName);
    const commandModule = require(filePath);

    // Validate command structure: must have data and execute
    if (!commandModule.data || !commandModule.execute) {
      console.warn(`Skipping command ${file}: missing data or execute property.`);
      continue;
    }

    collection.set(commandModule.data.name, commandModule);
    console.log(`Loaded command: ${commandModule.data.name}`);
  }
}

/**
 * Deploy all slash commands to Discord API.
 * Registers commands globally so they are available in all guilds.
 */
export async function deployCommands(
  commandCollection: Collection<string, CommandModule>
): Promise<void> {
  const commands = [];

  for (const command of commandCollection.values()) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(botConfig.token);

  try {
    console.log(
      `Deploying ${commands.length} commands to Discord (Guild: ${botConfig.guildId})...`
    );

    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: commands,
    });

    console.log('Commands deployed successfully!');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}