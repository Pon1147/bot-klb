import { Client, Collection } from 'discord.js';
import { botConfig } from './config/bot.config.js';
import { BOT_INTENTS } from './config/intents.js';
import { loadPermissions, PermissionsConfig } from './config/permissions.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeDatabase } from './database/welcome.database.js';
import { initializeSettingsTable } from './database/guild.settings.db.js';
import { initializeDfTokensTable } from './database/df.token.db.js';
import { SettingsService, setSettingsService } from './services/settings.service.js';
import { loadCommands, CommandModule, deployCommands } from './handlers/command.handler.js';
import { loadEvents } from './handlers/event.handler.js';
import { createLogger } from './utils/logger.js';
import { startSessionCleanup } from './commands/container/container-session.js';
import { cleanup as cleanupTeamFindSessions } from './services/team-find-session.js';
import { startWebhookServer } from './server/webhook-server.js';
import { startCleanup as startClaimCleanup } from './services/df-claim-store.js';
import { setupTunnel, stopTunnel } from './services/webhook-tunnel.js';
import { startDfCodesScheduler } from './services/df-codes-scheduler.js';
import { DEFAULT_WEBHOOK_PORT, TEAM_FIND_CLEANUP_INTERVAL_MS } from './config/app.constants.js';

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

  // Step 2b: Initialize DeltaForce tokens table
  logger.info('Initializing DeltaForce tokens table...');
  initializeDfTokensTable(database);
  logger.info('DeltaForce tokens table ready');

  // Step 3: Initialize SettingsService
  logger.info('Initializing SettingsService...');
  const settingsService = new SettingsService(database);
  setSettingsService(settingsService);
  logger.info('SettingsService ready');

  // Step 3b: Load RBAC permissions
  logger.info('Loading RBAC permissions...');
  try {
    const permPath = join(__dirname, '..', 'config', 'permissions.json');
    const permData = JSON.parse(readFileSync(permPath, 'utf8')) as PermissionsConfig;
    loadPermissions(permData);
    logger.info(`RBAC permissions loaded: ${Object.keys(permData.commands).length} command(s)`);
  } catch (err) {
    logger.warn(
      `RBAC permissions load failed: ${(err as Error).message}. Commands will have no role restrictions.`,
    );
  }

  // Step 4: Create Discord client
  logger.info('Creating Discord client...');
  const client = new Client({
    intents: BOT_INTENTS,
  });
  logger.info('Discord client created');

  // Step 4b: Start webhook server (needed before tunnel)
  const webhookPort = parseInt(process.env.WEBHOOK_PORT ?? String(DEFAULT_WEBHOOK_PORT), 10);
  logger.info(`Starting webhook server on port ${webhookPort}...`);
  const webhook = startWebhookServer(database, client, webhookPort);
  logger.info(`Webhook server ready on port ${webhook.port}`);

  // Step 4c: Setup cloudflared quick tunnel (auto HTTPS)
  try {
    const url = await setupTunnel(webhook.port);
    process.env.WEBHOOK_URL = url;
  } catch (err) {
    logger.warn(
      `Cloudflared tunnel setup failed: ${(err as Error).message}. Using localhost fallback.`,
    );
  }

  // Graceful shutdown: stop webhook server + tunnel
  process.on('SIGTERM', () => {
    stopTunnel();
    webhook.stop();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    stopTunnel();
    webhook.stop();
    process.exit(0);
  });

  // Step 5: Load commands
  logger.info('Loading commands...');
  const commands = new Collection<string, CommandModule>();
  loadCommands(commands);
  client.commands = commands;
  logger.info(`Commands loaded: ${commands.size} command(s)`);

  // Step 6: Load events
  logger.info('Loading events...');
  loadEvents(client);
  logger.info('Events loaded');

  // Step 7: Start session cleanup (prevent memory leak)
  logger.info('Starting session cleanup...');
  startSessionCleanup();
  logger.info('Session cleanup started');

  // Step 7b: Start team-find session cleanup
  setInterval(cleanupTeamFindSessions, TEAM_FIND_CLEANUP_INTERVAL_MS);
  logger.info('Team-find session cleanup started');

  // Step 7c: Start claim code cleanup
  logger.info('Starting claim code cleanup...');
  startClaimCleanup();
  logger.info('Claim code cleanup started');

  // Attach database to client
  client.database = database;

  // Step 8: Deploy commands
  logger.info('Deploying commands to Discord...');
  await deployCommands(commands);
  logger.info('Commands deployed');

  // Login
  logger.divider();
  logger.info('Logging in to Discord...');
  await client.login(botConfig.token);

  // Start daily df-code scheduler
  logger.info('Starting daily df-code scheduler (01:00 UTC)...');
  startDfCodesScheduler(client, database);
  logger.info('Daily df-code scheduler started');
}

/**
 * Start the bot and handle uncaught errors.
 */
main().catch((error) => {
  logger.fatal('Fatal error starting bot:', { error });
  process.exit(1);
});
