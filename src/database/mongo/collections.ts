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
  SELLER_PROFILES: 'seller_profiles',
  SELLER_TRANSACTIONS: 'seller_transactions',
  SELLER_REVIEWS: 'seller_reviews',
  AUTOPOST_CONFIG: 'df_autopost_config',
  AUTOPOST_MESSAGES: 'df_autopost_messages',
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

/**
 * Schema document cho seller_profiles (thông tin ngân hàng thợ kéo).
 */
export interface SellerProfileDocument {
  _id?: ObjectId;
  user_id: string;
  guild_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Schema document cho seller_transactions (lịch sử đơn kéo VietQR).
 */
export interface SellerTransactionDocument {
  _id?: ObjectId;
  tx_id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  buyer_id: string;
  seller_id: string;
  amount: number;
  description: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  note: string | null;
  processed_by: string | null;
  created_at: Date;
  processed_at: Date | null;
}

/**
 * Schema document cho seller_reviews (đánh giá sao thợ kéo).
 */
export interface SellerReviewDocument {
  _id?: ObjectId;
  tx_id: string;
  seller_id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

/**
 * Schema document cho AutoPost config toàn hệ thống ('map' | 'gun').
 */
export interface AutoPostConfigDocument {
  _id: string; // 'map' hoặc 'gun'
  type: string;
  enabled: boolean;
  interval_hours: number;
  last_run_at: string | null;
  updated_at: Date;
}

/**
 * Schema document lưu vết tin nhắn AutoPost mới nhất để dọn dẹp.
 */
export interface AutoPostMessageDocument {
  _id: string; // `${guild_id}_${type}`
  guild_id: string;
  type: string;
  channel_id: string;
  message_id: string;
  updated_at: Date;
}
