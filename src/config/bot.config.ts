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
 * Resolve database path.
 *
 * Nếu DATABASE_PATH được set → dùng giá trị đó (absolute hoặc relative).
 * Nếu không → trả về default relative path './data/bot.db'.
 */
function resolveDatabasePath(): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath && path.isAbsolute(envPath)) {
    return envPath;
  }
  return envPath || './data/bot.db';
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
  // MongoDB Connection URI (ho tro bien moi truong tu Railway: MONGODB_URI hoac MONGO_URL)
  mongoUri: (process.env.MONGODB_URI || process.env.MONGO_URL || '').includes('${{')
    ? null
    : process.env.MONGODB_URI || process.env.MONGO_URL || null,
  // DF Link crypto key (32 bytes, Base64-encoded)
  dfCredKeyV1: process.env.DF_CRED_KEY_V1 || null,
  // Discord Webhook handoff config
  dfWebhookSecret: process.env.DF_WEBHOOK_SECRET || '',
  dfLinkChannelId: process.env.DF_LINK_CHANNEL_ID || '',
  dfWebhookUrl: process.env.DF_CLAIM_WEBHOOK_URL || '',
};
