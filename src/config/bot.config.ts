import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/**
 * Validate environment variables.
 * Throw error if required variable is missing (runtime only).
 * Tests use fallback values from .env.test or defaults.
 */
function requireEnvVariable(variableName: string, fallback?: string): string {
  const value = process.env[variableName];
  if (!value && !fallback) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
  return value || fallback || '';
}

/**
 * Resolve database path — dùng path tuyệt đối dựa trên file location.
 *
 * WHY: Path tương đối './data/bot.db' gây mất settings khi:
 * - Bot chạy từ systemd service (cwd khác project root)
 * - Bot chạy từ dist/ (cwd có thể là / hoặc /app)
 * - Docker container restart (cwd không guaranteed)
 *
 * Giải pháp: Dùng __dirname (CommonJS native) để xác định
 * path tuyệt đối của file config, sau đó build path tương đối từ đó.
 * Không phụ thuộc vào cwd — luôn trỏ đúng data/bot.db.
 */
function resolveDatabasePath(): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath && path.isAbsolute(envPath)) {
    // Nếu user cung cấp absolute path, dùng trực tiếp
    return envPath;
  }
  // __dirname là CommonJS native — available khi compile sang dist/
  // Config file nằm ở src/config/bot.config.ts → dist/config/bot.config.js
  // Database cần ở data/bot.db (cùng cấp với dist/)
  // → Cần go up 2 levels từ dist/config/ → project root
  const projectRoot = path.resolve(__dirname, '..', '..');
  return path.join(projectRoot, 'data', 'bot.db');
}

/**
 * Bot configuration from environment variables.
 * All values are loaded from .env file, never hardcoded.
 * Tests can run with fallback values.
 */
export const botConfig = {
  token: requireEnvVariable('BOT_TOKEN', 'test-bot-token'),
  clientId: requireEnvVariable('CLIENT_ID', '000000000000000000'),
  guildId: requireEnvVariable('GUILD_ID', '000000000000000000'),
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  welcomeRoleId: process.env.WELCOME_ROLE_ID || null,
  dfCodesChannelId: process.env.DF_CODES_CHANNEL_ID || null,
  databasePath: resolveDatabasePath(),
  // DF Link crypto key (32 bytes, Base64-encoded)
  dfCredKeyV1: process.env.DF_CRED_KEY_V1 || null,
  // Discord Webhook handoff config
  dfWebhookSecret: process.env.DF_WEBHOOK_SECRET || '',
  dfLinkChannelId: process.env.DF_LINK_CHANNEL_ID || '',
  dfWebhookUrl: process.env.DF_CLAIM_WEBHOOK_URL || '',
};
