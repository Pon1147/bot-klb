import { bootstrap } from './app/bootstrap.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Bot');

/**
 * Main application entry point.
 * Delegates lifecycle orchestration to app/bootstrap.
 */
bootstrap().catch((error) => {
  logger.fatal('Fatal error starting bot:', { error });
  process.exit(1);
});
