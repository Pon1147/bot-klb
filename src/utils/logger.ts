/**
 * Structured logger — clean, readable, easy to scan.
 *
 * Output format:
 *   [HH:MM:SS] [LEVEL] [Module] Message
 *
 * Example:
 *   [16:20:00] [INFO] [Bot] Bot started successfully
 *   [16:20:01] [WARN] [CommandHandler] No commands found
 *   [16:20:02] [ERROR] [EventHandler] Failed to load event
 */

import { LOG_COLORS, LEVEL_BADGES, LEVEL_COLOR_MAP, LEVEL_ICONS } from '../config/logger.variables.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type ColorKey = keyof typeof LOG_COLORS;

const LEVEL_TO_COLOR: Record<LogLevel, ColorKey> = {
  debug: LEVEL_COLOR_MAP.debug as ColorKey,
  info: LEVEL_COLOR_MAP.info as ColorKey,
  warn: LEVEL_COLOR_MAP.warn as ColorKey,
  error: LEVEL_COLOR_MAP.error as ColorKey,
  fatal: LEVEL_COLOR_MAP.fatal as ColorKey,
};

/**
 * Format time as HH:MM:SS (24h).
 */
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Format a single log line.
 *   [HH:MM:SS] [LEVEL] [Module] Message
 */
function formatLine(
  level: LogLevel,
  module: string,
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const now = new Date();
  const time = LOG_COLORS.DIM + '[' + formatTime(now) + ']' + LOG_COLORS.RESET;

  const colorKey = LEVEL_TO_COLOR[level];
  const badgeColor = LOG_COLORS[colorKey];
  const badge = LEVEL_BADGES[level];
  const icon = LEVEL_ICONS[level];
  const levelPart = badgeColor + badge + LOG_COLORS.RESET + ' ' + icon;

  const modulePart = LOG_COLORS.CYAN + '[' + module + ']' + LOG_COLORS.RESET;

  const metaPart = metadata
    ? ' ' + LOG_COLORS.DIM + LOG_COLORS.CYAN + JSON.stringify(metadata) + LOG_COLORS.RESET
    : '';

  return time + ' ' + levelPart + ' ' + modulePart + ' ' + message + metaPart;
}

/**
 * Core logger function.
 */
function log(level: LogLevel, module: string, message: string, metadata?: Record<string, unknown>): void {
  console.log(formatLine(level, module, message, metadata));
}

/**
 * Format a divider line.
 *   ──────────────────────────────────────────
 */
function formatDivider(char: string, width: number = 50): string {
  return LOG_COLORS.DIM + char.repeat(width) + LOG_COLORS.RESET;
}

/**
 * Format a header block.
 *   ╔══════════════════════════════════════════╗
 *   ║  Title                                    ║
 *   ╚══════════════════════════════════════════╝
 */
function formatHeader(title: string): string {
  const width = 50;
  const pad = width - 2;
  const content = ' ' + title + ' '.repeat(pad - title.length);
  return (
    LOG_COLORS.BOLD + LOG_COLORS.CYAN +
    '╔' + '═'.repeat(width - 2) + '╗' + LOG_COLORS.RESET + '\n' +
    LOG_COLORS.BOLD + LOG_COLORS.CYAN + '║' + LOG_COLORS.RESET +
    LOG_COLORS.WHITE + content + LOG_COLORS.RESET +
    LOG_COLORS.BOLD + LOG_COLORS.CYAN + '║' + LOG_COLORS.RESET + '\n' +
    LOG_COLORS.BOLD + LOG_COLORS.CYAN +
    '╚' + '═'.repeat(width - 2) + '╝' + LOG_COLORS.RESET
  );
}

/**
 * Named logger factory — creates a logger bound to a specific module.
 */
export function createLogger(moduleName: string) {
  return {
    debug: (message: string, metadata?: Record<string, unknown>) => log('debug', moduleName, message, metadata),
    info: (message: string, metadata?: Record<string, unknown>) => log('info', moduleName, message, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) => log('warn', moduleName, message, metadata),
    error: (message: string, metadata?: Record<string, unknown>) => log('error', moduleName, message, metadata),
    fatal: (message: string, metadata?: Record<string, unknown>) => log('fatal', moduleName, message, metadata),

    /** Print a divider line */
    divider: (char?: string) => console.log(formatDivider(char || '-')),

    /** Print a header block */
    header: (title: string) => console.log(formatHeader(title)),
  };
}