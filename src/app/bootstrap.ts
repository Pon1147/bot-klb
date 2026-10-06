import { Client, Collection } from 'discord.js';
import { readFileSync } from 'fs';
import { botConfig } from '../config/bot.config.js';
import { BOT_INTENTS } from '../config/intents.js';
import {
  DEFAULT_PERMISSIONS,
  getPermissionsFilePath,
  loadPermissions,
  PermissionsConfig,
} from '../config/permissions.js';
import { initializeDatabase } from '../database/welcome.database.js';
import { initializeSettingsTable } from '../database/guild.settings.db.js';
import { initializeDfTokensTable } from '../database/df.token.db.js';
import {
  initializeClaimSessionsTable,
  migrateClaimSessionsToNumeric,
} from '../database/df-claim.db.js';
import {
  initializeAccountBindingsTable,
  syncBindingsFromMongoToSqlite,
} from '../database/df-binding.db.js';
import { initializeCaptureEventsTable } from '../database/df-telemetry.db.js';
import { connectMongo, initMongoIndexes } from '../database/mongo/index.js';
import { SettingsService, setSettingsService } from '../services/settings.service.js';
import {
  CommandModule,
  deployCommands,
  loadCommands,
} from '../infrastructure/discord/command-loader.js';
import { loadEvents } from '../infrastructure/discord/event-loader.js';
import { createLogger } from '../utils/logger.js';
import { startSessionCleanup } from '../features/container/index.js';
import {
  initCryptoKey,
  cleanupTeamFindSessions,
  startClaimCleanup,
  startDfCodesScheduler,
} from '../features/delta-force/index.js';
import { TEAM_FIND_CLEANUP_INTERVAL_MS } from '../config/app.constants.js';

const logger = createLogger('Bootstrap');

/**
 * Orchestrates the application bootstrap sequence:
 * 1. Database & schema migrations
 * 2. Crypto configuration
 * 3. Settings service & RBAC permissions
 * 4. Discord client initialization
 * 5. Commands loading & deployment
 * 6. Events registration
 * 7. Background jobs & schedulers
 * 8. Discord login & post-login schedulers
 */
export async function bootstrap(): Promise<Client> {
  logger.header('KL BOT — Starting up');

  // Step 1: Initialize database
  logger.info('Initializing database...');
  const database = initializeDatabase();
  logger.info('Database initialized');

  // Step 2: Initialize guild_settings table
  logger.info('Initializing guild settings table...');
  initializeSettingsTable(database);
  logger.info('Guild settings table ready');

  // Step 2b: Initialize DeltaForce tokens table (legacy, keep for migration)
  logger.info('Initializing DeltaForce tokens table...');
  initializeDfTokensTable(database);
  logger.info('DeltaForce tokens table ready');

  // Step 2c: Initialize DF Link tables (claim sessions + account bindings + telemetry)
  logger.info('Initializing DF Link tables...');
  initializeClaimSessionsTable(database);
  migrateClaimSessionsToNumeric(database);
  initializeAccountBindingsTable(database);
  initializeCaptureEventsTable(database);
  logger.info('DF Link tables ready');

  // Step 2d: Kết nối MongoDB (nếu MONGODB_URI / MONGO_URL được cấu hình trên Railway)
  if (botConfig.mongoUri) {
    logger.info('Connecting to MongoDB...');
    try {
      await connectMongo(botConfig.mongoUri);
      await initMongoIndexes();
      logger.info('MongoDB connected and indexes initialized');

      // Đồng bộ account bindings từ MongoDB sang SQLite
      const syncedBindings = await syncBindingsFromMongoToSqlite(database);
      logger.info(`Synced ${syncedBindings} account binding(s) from MongoDB to local SQLite`);
    } catch (err) {
      logger.error(
        'Failed to connect to MongoDB, falling back to local SQLite: ' + (err as Error).message,
      );
    }
  }

  // Step 2e: Initialize crypto key (AES-256-GCM)
  if (botConfig.dfCredKeyV1) {
    try {
      initCryptoKey('v1');
      logger.info('Crypto key initialized (v1)');
    } catch (err) {
      logger.warn('Crypto key init failed: ' + (err as Error).message);
    }
  } else {
    logger.warn('DF_CRED_KEY_V1 not configured — encryption disabled');
  }

  // Step 3: Initialize SettingsService
  logger.info('Initializing SettingsService...');
  const settingsService = new SettingsService(database);
  setSettingsService(settingsService);
  if (botConfig.mongoUri) {
    await settingsService.initMongo();
  }
  logger.info('SettingsService ready');

  // Step 3b: Load RBAC permissions
  logger.info('Loading RBAC permissions...');
  try {
    const permPath = getPermissionsFilePath();
    const permData = JSON.parse(readFileSync(permPath, 'utf8')) as PermissionsConfig;
    loadPermissions(permData);
    logger.info(
      `RBAC permissions loaded from ${permPath}: ${Object.keys(permData.commands).length} command(s)`,
    );
  } catch (err) {
    logger.warn(
      `RBAC permissions load from file failed: ${(err as Error).message}. Falling back to default permissions.`,
    );
    loadPermissions(DEFAULT_PERMISSIONS);
    logger.info(
      `RBAC default permissions loaded: ${Object.keys(DEFAULT_PERMISSIONS.commands).length} command(s)`,
    );
  }

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

  // Khởi động daily df-code scheduler
  logger.info('Starting daily df-code scheduler...');
  startDfCodesScheduler(client, database);
  logger.info('Daily df-code scheduler started');

  return client;
}
