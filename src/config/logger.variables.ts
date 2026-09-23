/**
 * Logger configuration - tập trung colors, icons, level mapping ở 1 nơi.
 * Thay đổi style log → chỉ cần chỉnh file này.
 */

/**
 * ANSI color codes cho terminal output.
 */
export const LOG_COLORS = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
} as const;

/**
 * Mapping log level → color key.
 */
export const LEVEL_COLOR_MAP = {
  debug: 'DIM',
  info: 'GREEN',
  warn: 'YELLOW',
  error: 'RED',
  fatal: 'BG_RED',
} as const;

/**
 * Badge text cho từng level (aligned 5 ký tự).
 */
export const LEVEL_BADGES = {
  debug: ' DEBUG',
  info: ' INFO ',
  warn: ' WARN ',
  error: ' ERROR',
  fatal: ' FATAL',
} as const;

/**
 * Emoji icons cho từng log level.
 */
export const LEVEL_ICONS = {
  debug: '🔍',
  info: '✓',
  warn: '⚠',
  error: '✗',
  fatal: '✖',
} as const;
