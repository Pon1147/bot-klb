/**
 * Backward compatibility re-export.
 * Real implementation has moved to src/infrastructure/discord/command-loader.ts
 */
export {
  CommandModule,
  loadCommands,
  deployCommands,
} from '../infrastructure/discord/command-loader.js';
