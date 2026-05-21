/**
 * Config barrel export - tập trung tất cả config variables ở 1 nơi.
 *
 * Import từ đây thay vì import từng file riêng lẻ:
 *   import { EMBED_COLORS, BOT_INTENTS, TEMPLATE_VARIABLES } from './config/index.js';
 */

// Bot core config
export { botConfig } from './bot.config.js';

// Template variables
export { TEMPLATE_VARIABLES, TEMPLATE_VARIABLE_DESCRIPTIONS } from './variables.js';

// Container variables (colors, defaults)
export {
  CONTAINER_COLORS,
  EMBED_COLORS,
  WELCOME_CONTAINER_DEFAULTS,
  LEAVE_CONTAINER_DEFAULTS,
} from './container.variables.js';

// Logger variables
export { LOG_COLORS, LEVEL_COLOR_MAP, LEVEL_ICONS } from './logger.variables.js';

// Gateway intents
export { BOT_INTENTS } from './intents.js';

// Default settings
export { defaultGuildSettings, cloneDefaultSettings } from './default.settings.js';
