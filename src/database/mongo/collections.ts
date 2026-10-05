import type { ObjectId } from 'mongodb';
import type { GuildSettings } from '../../types/settings.types.js';

/**
 * Tên các collection trong MongoDB database.
 */
export const MONGO_COLLECTIONS = {
  GUILD_SETTINGS: 'guild_settings',
  ACCOUNT_BINDINGS: 'account_bindings',
  CLAIM_SESSIONS: 'claim_sessions',
  CAPTURE_EVENTS: 'capture_events',
  DF_TOKENS: 'df_tokens',
} as const;

/**
 * Schema document cho guild settings.
 * _id tương đương guildId.
 */
export interface GuildSettingsDocument {
  _id: string;
  guildId: string;
  settings: GuildSettings;
  updatedAt: Date;
}

/**
 * Schema document cho account bindings (Delta Force game accounts).
 */
export interface AccountBindingDocument {
  _id?: ObjectId;
  discord_user_id: string;
  provider: string;
  platform: string;
  openid: string;
  cred_nonce: string;
  cred_ciphertext: string;
  cred_tag: string;
  key_version: string;
  status: 'active' | 'expired' | 'revoked';
  captured_at: Date | null;
  last_ok_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Schema document cho claim sessions (code xac thuc linking mot lan).
 */
export interface ClaimSessionDocument {
  _id?: ObjectId;
  code: string;
  discord_user_id: string;
  status: 'pending' | 'consumed' | 'expired';
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
  fail_count: number;
}

/**
 * Schema document cho capture events (telemetry nghien cuu).
 */
export interface CaptureEventDocument {
  _id?: ObjectId;
  discord_user_id: string | null;
  endpoint: string;
  captured_at: Date;
  credential_fingerprint: string;
  notes: string | null;
}

/**
 * Schema document cho df_tokens (legacy fallback).
 */
export interface DfTokenDocument {
  _id?: ObjectId;
  discord_id: string;
  openid: string;
  token: string;
  ts: string | null;
  s: string | null;
  u: string | null;
  linked_at: string;
  last_used_at: string | null;
}
