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

export type AppEnvironment = 'dev' | 'stage' | 'product';

/**
 * Phân giải môi trường hoạt động từ biến ENVIRONMENT hoặc NODE_ENV.
 * Hỗ trợ các giá trị: 'dev' | 'stage' | 'product' (mặc định: 'dev').
 */
export function resolveEnvironment(envValue?: string): AppEnvironment {
  const raw = (envValue || process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev')
    .toLowerCase()
    .trim();
  if (raw === 'product' || raw === 'production' || raw === 'prod') {
    return 'product';
  }
  if (raw === 'stage' || raw === 'staging') {
    return 'stage';
  }
  return 'dev';
}

const currentEnv = resolveEnvironment();

/**
 * Phân giải đường dẫn database SQLite theo môi trường nhằm cách ly hoàn toàn dữ liệu.
 * - dev: './data/bot-dev.db'
 * - stage: './data/bot-stage.db'
 * - product: './data/bot.db'
 * (Nếu biến DATABASE_PATH được khai báo tường minh, sẽ ưu tiên sử dụng).
 */
export function resolveDatabasePath(env: AppEnvironment = currentEnv): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath && path.isAbsolute(envPath)) {
    return envPath;
  }
  if (envPath) return envPath;
  if (process.env.NODE_ENV === 'test') return './data/bot.db';
  if (env === 'dev') return './data/bot-dev.db';
  if (env === 'stage') return './data/bot-stage.db';
  return './data/bot.db';
}

/**
 * Phân giải phạm vi đăng ký slash command:
 * - dev / stage: 'guild' (cập nhật tức thì 1 giây vào server test, không chờ cache toàn cầu).
 * - product: 'global' (phân phối tới mọi máy chủ bot tham gia).
 */
export function resolveCommandScope(env: AppEnvironment = currentEnv): 'global' | 'guild' {
  if (process.env.COMMAND_SCOPE) {
    const scope = process.env.COMMAND_SCOPE.toLowerCase();
    if (scope === 'global' || scope === 'guild') return scope;
  }
  if (process.env.DEV_GUILD_ID) return 'guild';
  if (env === 'product') return 'global';
  return 'guild';
}

/**
 * Phân giải URL Public API của bot theo môi trường:
 * - dev: http://localhost:PORT
 * - stage: URL staging trên Railway
 * - product: URL production trên Railway
 */
export function resolvePublicApiUrl(env: AppEnvironment = currentEnv): string {
  if (process.env.BOT_PUBLIC_API_URL) return process.env.BOT_PUBLIC_API_URL;
  if (env === 'product') return 'https://bot-klb-production.up.railway.app';
  if (env === 'stage') return 'https://bot-klb-stage.up.railway.app';
  const port = process.env.PORT || '8080';
  return `http://localhost:${port}`;
}

/**
 * Bot configuration from environment variables.
 * All values are loaded from .env file, never hardcoded.
 * Tests can run with fallback values.
 */
export const botConfig = {
  // Môi trường kiểm soát
  env: currentEnv,
  isDev: currentEnv === 'dev',
  isStage: currentEnv === 'stage',
  isProduct: currentEnv === 'product',

  token: requireEnvVariable('BOT_TOKEN', 'test-bot-token'),
  clientId: requireEnvVariable('CLIENT_ID', '000000000000000000'),
  guildId: requireEnvVariable('GUILD_ID', '000000000000000000'),
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
  welcomeRoleId: process.env.WELCOME_ROLE_ID || null,
  dfCodesChannelId: process.env.DF_CODES_CHANNEL_ID || null,
  databasePath: resolveDatabasePath(currentEnv),
  // MongoDB Connection URI (ho tro bien moi truong tu Railway: MONGODB_URI hoac MONGO_URL)
  mongoUri: (process.env.MONGODB_URI || process.env.MONGO_URL || '').includes('${{')
    ? null
    : process.env.MONGODB_URI || process.env.MONGO_URL || null,
  // DF Link crypto key (32 bytes, Base64-encoded)
  dfCredKeyV1: process.env.DF_CRED_KEY_V1 || null,
  // Command deployment scope: 'global' | 'guild' (tự động theo môi trường)
  commandScope: resolveCommandScope(currentEnv),
  // Discord Webhook handoff config (legacy fallback)
  dfWebhookSecret: process.env.DF_WEBHOOK_SECRET || '',
  dfLinkChannelId: process.env.DF_LINK_CHANNEL_ID || '',
  dfWebhookUrl: process.env.DF_CLAIM_WEBHOOK_URL || '',
  // Bot Owner / Developer Discord User ID
  botOwnerId: process.env.BOT_OWNER_ID || '418779992290492416',
  // HTTP Server Configuration
  port: parseInt(process.env.PORT || '8080', 10),
  botPublicApiUrl: resolvePublicApiUrl(currentEnv),
  // DeltaForceTools Weapon Loadouts API Token
  weaponLoadoutsToken: process.env.WEAPON_LOADOUTS_TOKEN || '',
};
