/**
 * Structured logger utility for development environment.
 * Provides colorized, timestamped output with module context.
 * Aligns with .clinerules §5.1 Observability & Logging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

const LEVEL_COLORS: Record<LogLevel, keyof typeof COLORS> = {
  debug: 'dim',
  info: 'green',
  warn: 'yellow',
  error: 'red',
  fatal: 'red',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info: '✅',
  warn: '⚠️ ',
  error: '❌',
  fatal: '💀',
};

function formatMessage(
  level: LogLevel,
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const color = COLORS[LEVEL_COLORS[level]];
  const reset = COLORS.reset;
  const bold = COLORS.bold;
  const icon = LEVEL_ICONS[level];

  const metaPart = metadata
    ? ` ${COLORS.cyan}${JSON.stringify(metadata)}${reset}`
    : '';

  return `${color}${icon} ${reset}${COLORS.dim}[${timestamp}]${reset} ${bold}[${module}]${reset} ${message}${metaPart}`;
}

/**
 * Core logger function.
 */
function log(level: LogLevel, module: string, message: string, metadata?: Record<string, unknown>): void {
  console.log(formatMessage(level, module, message, metadata));
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
  };
}