import Database from 'better-sqlite3';
import type { DfApiToken } from '../types/deltaforce.types.js';
import type { DfTokenRow } from '../database/df.token.db.js';
import { getActiveBinding } from '../database/df-binding.db.js';
import { decryptCredential } from '../services/df-crypto.js';
import { getDfToken } from '../database/df.token.db.js';

export function buildDfApiToken(row: DfTokenRow | DfApiToken): DfApiToken {
  return {
    openid: row.openid,
    token: row.token,
    ts: row.ts ?? undefined,
    s: row.s ?? undefined,
    u: row.u ?? undefined,
  };
}

/**
 * Phân giải DfApiToken của user từ database (ưu tiên active binding AES-256-GCM, fallback legacy).
 */
export function resolveUserDfToken(database: Database.Database, userId: string): DfApiToken | null {
  try {
    const binding = getActiveBinding(database, userId);
    if (binding) {
      const decrypted = decryptCredential(
        binding.cred_nonce,
        binding.cred_ciphertext,
        binding.cred_tag,
        binding.discord_user_id,
        binding.openid,
        binding.key_version,
      );
      const cred = JSON.parse(decrypted);
      return {
        openid: binding.openid,
        token: cred.token,
        ts: cred.ts || undefined,
        s: cred.s || undefined,
        u: cred.u || undefined,
      };
    }
  } catch {
    // Ignore error, fallback legacy
  }

  const legacy = getDfToken(database, userId);
  if (legacy) {
    return buildDfApiToken(legacy);
  }

  return null;
}
