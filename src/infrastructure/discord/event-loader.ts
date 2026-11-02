import { Client } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('EventHandler');

export interface EventModule {
  name: string;
  once: boolean;
  execute: (...args: unknown[]) => Promise<void>;
}

/**
 * Bọc event listener trong wrapper an toàn:
 * - Bắt synchronous exception (try/catch)
 * - Bắt asynchronous rejection (then/catch)
 * - Ghi log đầy đủ event name, error message và stack trace
 * - Tuyệt đối không để exception thoát ra ngoài làm crash tiến trình
 */
export function wrapSafeEventListener(
  eventName: string,
  executeFn: (...args: unknown[]) => unknown,
  loggerInstance = logger,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    try {
      const result = executeFn(...args);
      // Hỗ trợ cả Native Promise và bất kỳ Thenable tuân thủ Promises/A+ nào
      if (result && typeof (result as Record<string, any>).then === 'function') {
        Promise.resolve(result).catch((asyncError: unknown) => {
          loggerInstance.error(`[Event: ${eventName}] Asynchronous error in event listener:`, {
            event: eventName,
            error: asyncError instanceof Error ? asyncError.message : String(asyncError),
            stack: asyncError instanceof Error ? asyncError.stack : undefined,
          });
        });
      }
    } catch (syncError: unknown) {
      loggerInstance.error(`[Event: ${eventName}] Synchronous error in event listener:`, {
        event: eventName,
        error: syncError instanceof Error ? syncError.message : String(syncError),
        stack: syncError instanceof Error ? syncError.stack : undefined,
      });
    }
  };
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
export function loadEvents(botClient: Client, customEventsPath?: string): void {
  const eventsPath = customEventsPath ?? path.join(__dirname, '..', '..', 'events');

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
      // Dynamic import for plugin architecture — require() is intentional here
      /* eslint-disable @typescript-eslint/no-require-imports */
      const rawModule = require(filePath);
      /* eslint-enable @typescript-eslint/no-require-imports */
      const eventModule = (rawModule.default || rawModule) as EventModule;

      // Strict contract validation
      if (!eventModule.name) {
        logger.warn(`Skipping "${file}": missing "name" export (event name required).`, { file });
        skippedCount++;
        continue;
      }

      if (typeof eventModule.execute !== 'function') {
        logger.warn(
          `Skipping "${file}": missing or invalid "execute" export (must be a function).`,
          { file },
        );
        skippedCount++;
        continue;
      }

      const shouldOnce = eventModule.once ?? false;
      const eventName = eventModule.name;
      const mode = shouldOnce ? 'once' : 'on';

      // Bind client as first argument so events can access client.commands, client.database
      const boundExecute = eventModule.execute.bind(null, botClient);
      const safeListener = wrapSafeEventListener(eventName, boundExecute);

      if (shouldOnce) {
        botClient.once(eventName, safeListener);
      } else {
        botClient.on(eventName, safeListener);
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

  logger.info(`Registered ${loadedCount} event(s), skipped ${skippedCount}`, {
    loaded: loadedCount,
    skipped: skippedCount,
  });
}
