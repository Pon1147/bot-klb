import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { botConfig } from './config/bot.config.js';
import { initializeDatabase } from './database/welcome.database.js';
import { initializeSettingsTable } from './database/guild.settings.db.js';
import { SettingsService, setSettingsService } from './services/settings.service.js';
import { loadCommands, CommandModule, deployCommands } from './handlers/command.handler.js';
import { loadEvents } from './handlers/event.handler.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Bot');

/**
 * Main entry point: initialize bot, load commands/events, and login.
 * This file only bootstraps the application — no business logic here.
 */
async function main(): Promise<void> {
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║          KL BOT — STARTING UP                    ║');
  logger.info('╚══════════════════════════════════════════════════╝');

  // Step 1: Initialize database (legacy table)
  logger.info('Step 1/6: Initializing database...');
  const database = initializeDatabase();
  logger.info('✓ Database initialized successfully.');

  // Step 1.5: Initialize guild_settings table (new JSON-based settings)
  logger.info('Step 2/6: Initializing guild settings table...');
  initializeSettingsTable(database);
  logger.info('✓ Guild settings table ready.');

  // Step 2: Initialize SettingsService (single source of truth)
  logger.info('Step 3/6: Initializing SettingsService...');
  const settingsService = new SettingsService(database);
  setSettingsService(settingsService);
  logger.info('✓ SettingsService ready.');

  // Step 3: Create Discord client
  logger.info('Step 4/6: Creating Discord client...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  logger.info('✓ Discord client created.');

  // Step 4: Load commands
  logger.info('Step 5/6: Loading commands...');
  const commands = new Collection<string, CommandModule>();
  loadCommands(commands);
  (client as any).commands = commands;
  logger.info(`✓ Commands loaded: ${commands.size} command(s) ready.`);

  // Step 5: Load events
  logger.info('Step 5.5/6: Loading events...');
  loadEvents(client);
  logger.info('✓ Events loaded.');

  // Attach database to client for use in event handlers
  (client as any).database = database;

  // Step 6: Deploy commands to Discord API
  logger.info('Step 6/6: Deploying commands to Discord...');
  await deployCommands(commands);
  logger.info('✓ Commands deployment initiated.');

  // Login to Discord
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║  Logging in to Discord...                        ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  await client.login(botConfig.token);
}

/**
 * Start the bot and handle uncaught errors.
 */
main().catch((error) => {
  logger.fatal('Fatal error starting bot:', { error });
  process.exit(1);
});
