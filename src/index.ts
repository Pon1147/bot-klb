import { Client, Collection } from 'discord.js';
import { botConfig } from './config/bot.config.js';
import { BOT_INTENTS } from './config/intents.js';
import { initializeDatabase } from './database/welcome.database.js';
import { initializeSettingsTable } from './database/guild.settings.db.js';
import { SettingsService, setSettingsService } from './services/settings.service.js';
import { loadCommands, CommandModule, deployCommands } from './handlers/command.handler.js';
import { loadEvents } from './handlers/event.handler.js';
import { createLogger } from './utils/logger.js';
import { startSessionCleanup } from './commands/container/container-session.js';

const logger = createLogger('Bot');

/**
 * Main entry point: initialize bot, load commands/events, and login.
 * This file only bootstraps the application — no business logic here.
 */
async function main(): Promise<void> {
  logger.header('KL BOT — Starting up');

  // Step 1: Initialize database
  logger.info('Initializing database...');
  const database = initializeDatabase();
  logger.info('Database initialized');

  // Step 2: Initialize guild_settings table
  logger.info('Initializing guild settings table...');
  initializeSettingsTable(database);
  logger.info('Guild settings table ready');

  // Step 3: Initialize SettingsService
  logger.info('Initializing SettingsService...');
  const settingsService = new SettingsService(database);
  setSettingsService(settingsService);
  logger.info('SettingsService ready');

  // Step 4: Create Discord client
  logger.info('Creating Discord client...');
  const client = new Client({
    intents: BOT_INTENTS,
  });
  logger.info('Discord client created');

  // Step 5: Load commands
  logger.info('Loading commands...');
  const commands = new Collection<string, CommandModule>();
  loadCommands(commands);
  (client as any).commands = commands;
  logger.info(`Commands loaded: ${commands.size} command(s)`);

  // Step 6: Load events
  logger.info('Loading events...');
  loadEvents(client);
  logger.info('Events loaded');

  // Step 7: Start session cleanup (prevent memory leak)
  logger.info('Starting session cleanup...');
  startSessionCleanup();
  logger.info('Session cleanup started');

  // Attach database to client
  (client as any).database = database;

  // Step 8: Deploy commands
  logger.info('Deploying commands to Discord...');
  await deployCommands(commands);
  logger.info('Commands deployed');

  // Login
  logger.divider();
  logger.info('Logging in to Discord...');
  await client.login(botConfig.token);
}

/**
 * Start the bot and handle uncaught errors.
 */
main().catch((error) => {
  logger.fatal('Fatal error starting bot:', { error });
  process.exit(1);
});