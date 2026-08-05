import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate environment variables.
 * Throw error if required variable is missing.
 */
function requireEnvVariable(variableName: string): string {
  const value = process.env[variableName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
  return value;
}

/**
 * Bot configuration from environment variables.
 * All values are loaded from .env file, never hardcoded.
 */
export const botConfig = {
  token: requireEnvVariable('BOT_TOKEN'),
  clientId: requireEnvVariable('CLIENT_ID'),
  guildId: requireEnvVariable('GUILD_ID'),
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  welcomeRoleId: process.env.WELCOME_ROLE_ID || null,
  dfCodesChannelId: process.env.DF_CODES_CHANNEL_ID || null,
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
  // DF Link crypto key (32 bytes, Base64-encoded)
  dfCredKeyV1: process.env.DF_CRED_KEY_V1 || null,
  // Discord Webhook handoff config
  dfWebhookSecret: process.env.DF_WEBHOOK_SECRET || '',
  dfLinkChannelId: process.env.DF_LINK_CHANNEL_ID || '',
  dfWebhookUrl: process.env.DF_WEBHOOK_URL || '',
};
