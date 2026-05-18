import { Client } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('EventHandler');

export interface EventModule {
  name: string;
  once: boolean;
  execute: (..._args: any[]) => Promise<void>;
}

/**
 * Recursively collect all event files from a directory.
 */
function collectEventFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        const nestedFiles = collectEventFiles(fullPath);
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
 * Load all event handlers from the events directory and register them on the client.
 */
export function loadEvents(botClient: Client): void {
  const eventsPath = path.join(__dirname, '..', 'events');

  logger.info('=== EVENT LOADING STARTED ===');
  logger.debug(`Scanning directory: ${eventsPath}`);

  // Guard clause: directory must exist
  try {
    statSync(eventsPath);
  } catch {
    logger.fatal(`Events directory not found: ${eventsPath}`);
    return;
  }

  const eventFiles = collectEventFiles(eventsPath);
  logger.debug(`Found ${eventFiles.length} file(s) in events directory`, { files: eventFiles });

  if (!eventFiles.length) {
    logger.warn('No event files found. Bot will start with 0 event handlers.');
    return;
  }

  let loadedCount = 0;
  let skippedCount = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    logger.debug(`Loading event file: ${file} → ${filePath}`);

    try {
      // Support both `export default { name, once, execute }` and named exports
      const rawModule = require(filePath);
      const eventModule = (rawModule.default || rawModule) as EventModule;

      // Strict contract validation
      if (!eventModule.name) {
        logger.warn(`Skipping "${file}": missing "name" export (event name required).`, { file });
        skippedCount++;
        continue;
      }

      if (typeof eventModule.execute !== 'function') {
        logger.warn(`Skipping "${file}": missing or invalid "execute" export (must be a function).`, { file });
        skippedCount++;
        continue;
      }

      const shouldOnce = eventModule.once ?? false;
      const eventName = eventModule.name;
      const mode = shouldOnce ? 'once' : 'on';

      // Bind client as first argument so events can access client.commands, client.database
      const boundExecute = eventModule.execute.bind(null, botClient);

      if (shouldOnce) {
        botClient.once(eventName, boundExecute);
      } else {
        botClient.on(eventName, boundExecute);
      }

      loadedCount++;
      logger.info(`✓ Registered event: ${eventName} (mode: ${mode})`, {
        file,
        mode,
      });
    } catch (error) {
      logger.error(`✗ Failed to load event "${file}":`, { error, filePath });
      skippedCount++;
    }
  }

  logger.info('=== EVENT LOADING COMPLETED ===');
  logger.info(`Summary: ${loadedCount} loaded, ${skippedCount} skipped`, {
    loaded: loadedCount,
    skipped: skippedCount,
    total: loadedCount,
  });
}