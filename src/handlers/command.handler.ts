import { Collection } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { botConfig } from '../config/bot.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CommandHandler');

/**
 * Interface for a slash command module.
 * Each command file must export `data` (SlashCommandBuilder) and `execute` function.
 */
export interface CommandModule {
  data: any;
  execute: (...args: any[]) => Promise<any>;
}

/**
 * Recursively collect all JavaScript files from a directory.
 * Supports nested command folders (e.g., welcome/welcome-setup.command.js).
 */
function collectCommandFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Recurse into subdirectories
        const nestedFiles = collectCommandFiles(fullPath);
        files.push(...nestedFiles.map((f) => path.join(entry, f)));
      } else if ((entry.endsWith('.js') || entry.endsWith('.ts')) && !entry.endsWith('.d.ts')) {
        files.push(entry);
      }
    }
  } catch (error) {
    logger.error(`Failed to read directory: ${dirPath}`, { error });
  }

  return files;
}

/**
 * Load all command modules from the commands directory.
 * Recursively reads all subdirectories to support organized command folders.
 */
export function loadCommands(collection: Collection<string, CommandModule>): void {
  const commandsPath = path.join(__dirname, '..', 'commands');

  logger.info('=== COMMAND LOADING STARTED ===');
  logger.debug(`Scanning directory: ${commandsPath}`);

  // Guard clause: directory must exist
  try {
    statSync(commandsPath);
  } catch {
    logger.fatal(`Commands directory not found: ${commandsPath}`);
    return;
  }

  const commandFiles = collectCommandFiles(commandsPath);
  logger.debug(`Found ${commandFiles.length} file(s) in commands directory`, { files: commandFiles });

  if (!commandFiles.length) {
    logger.warn('No command files found. Bot will start with 0 commands.');
    return;
  }

  let loadedCount = 0;
  let skippedCount = 0;

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    logger.debug(`Loading file: ${file} → ${filePath}`);

    try {
      const commandModule = require(filePath);

      // Strict contract validation: must have data and execute
      if (!commandModule.data) {
        logger.warn(`Skipping "${file}": missing "data" export (SlashCommandBuilder required).`, { file });
        skippedCount++;
        continue;
      }

      if (typeof commandModule.execute !== 'function') {
        logger.warn(`Skipping "${file}": missing or invalid "execute" export (must be a function).`, { file });
        skippedCount++;
        continue;
      }

      const commandName = commandModule.data.name;
      collection.set(commandName, commandModule);
      loadedCount++;

      logger.info(`✓ Loaded command: /${commandName}`, {
        file,
        description: commandModule.data.description || 'N/A',
      });
    } catch (error) {
      logger.error(`✗ Failed to load "${file}":`, { error, filePath });
      skippedCount++;
    }
  }

  logger.info('=== COMMAND LOADING COMPLETED ===');
  logger.info(`Summary: ${loadedCount} loaded, ${skippedCount} skipped, ${collection.size} total in collection`, {
    loaded: loadedCount,
    skipped: skippedCount,
    total: collection.size,
    commandNames: [...collection.keys()],
  });
}

/**
 * Serialize a command to a comparable JSON string for change detection.
 * Normalizes the command data to detect meaningful differences.
 */
function commandFingerprint(commandData: any): string {
  const cmd = typeof commandData.toJSON === 'function' ? commandData.toJSON() : commandData;
  return JSON.stringify(cmd);
}

/**
 * Deploy all slash commands to Discord API.
 * Compares local commands with existing Discord commands to avoid unnecessary re-deployment.
 * Only deploys when commands have actually changed.
 */
export async function deployCommands(
  commandCollection: Collection<string, CommandModule>,
): Promise<void> {
  logger.info('=== COMMAND DEPLOYMENT STARTED ===');

  if (!commandCollection.size) {
    logger.warn('No commands to deploy. Check command loading logs above.');
    return;
  }

  const rest = new REST().setToken(botConfig.token);

  // Fetch existing commands from Discord
  let existingCommands: any[] = [];
  try {
    existingCommands = (await rest.get(
      Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId),
    )) as any[];
    logger.debug(`Found ${existingCommands.length} existing command(s) on Discord`);
  } catch (error) {
    logger.warn('Could not fetch existing commands. Will deploy all commands.', { error });
  }

  // Build local command list
  const localCommands = [];
  for (const [name, command] of commandCollection) {
    localCommands.push(command.data.toJSON());
    logger.debug(`Prepared command for comparison: /${name}`);
  }

  // Compare local commands with existing commands to detect changes
  const existingMap = new Map(existingCommands.map((c: any) => [c.name, commandFingerprint(c)]));
  let hasChanges = localCommands.length !== existingCommands.length;

  if (!hasChanges) {
    for (const localCmd of localCommands) {
      const localFingerprint = commandFingerprint({ toJSON: () => localCmd });
      const existingFingerprint = existingMap.get(localCmd.name);
      if (localFingerprint !== existingFingerprint) {
        hasChanges = true;
        logger.info(`Command /${localCmd.name} has changed. Deployment required.`);
        break;
      }
    }
  }

  if (!hasChanges) {
    logger.info(`No changes detected. Skipping deployment of ${localCommands.length} command(s).`);
    logger.info('=== COMMAND DEPLOYMENT COMPLETED ===');
    return;
  }

  logger.info(`Changes detected. Deploying ${localCommands.length} command(s) to Guild: ${botConfig.guildId}`, {
    clientId: botConfig.clientId,
    guildId: botConfig.guildId,
    commandCount: localCommands.length,
  });

  try {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: localCommands,
    });

    logger.info('✓ Commands deployed successfully to Discord!', {
      deployedCount: localCommands.length,
      commands: localCommands.map((c: any) => c.name),
    });
  } catch (error) {
    logger.error('✗ Failed to deploy commands:', { error });
  }

  logger.info('=== COMMAND DEPLOYMENT COMPLETED ===');
}
