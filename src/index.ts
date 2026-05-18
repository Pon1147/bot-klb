import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { botConfig } from './config/bot.config.js';
import { initializeDatabase } from './database/welcome.database.js';
import { loadCommands, CommandModule } from './handlers/command.handler.js';
import { loadEvents } from './handlers/event.handler.js';

/**
 * Main entry point: initialize bot, load commands/events, and login.
 */
async function main(): Promise<void> {
  // Initialize database connection
  const database = initializeDatabase();
  console.log('Database initialized.');

  // Create Discord client with required intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Load all slash commands into collection
  const commands = new Collection<string, CommandModule>();
  loadCommands(commands);

  // Store commands collection on client for event handlers to access
  (client as any).commands = commands;
  (client as any).database = database;

  // Load all event handlers
  loadEvents(client);

  // Login to Discord with token from environment
  await client.login(botConfig.token);
}

/**
 * Start the bot and handle uncaught errors.
 */
main().catch((error) => {
  console.error('Fatal error starting bot:', error);
  process.exit(1);
});
