/**
 * AES-256-GCM encryption helpers cho DfTools credential at-rest.
 *
 * Encrypt chỉ trong Claim API sau validate.
 * Decrypt chỉ trong DfToolsClient.
 * Never log plaintext. Never return credential trong HTTP response.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12;

/** Kết quả encrypt: nonce + ciphertext + auth tag (hex) */
export interface EncryptedCredential {
  nonce: string;
  ciphertext: string;
  tag: string;
}

/** Key version → key buffer mapping */
const keyRegistry = new Map<string, Buffer>();

/**
 * Khởi tạo key từ env variable (Base64-encoded 32 bytes).
 * Throw nếu thiếu hoặc sai độ dài.
 */
export function initCryptoKey(version = 'v1'): void {
  const raw = process.env.DF_CRED_KEY_V1;
  if (!raw) {
    throw new Error('DF_CRED_KEY_V1 not configured');
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`DF_CRED_KEY_V1 must be 32 bytes (got ${key.length})`);
  }

  keyRegistry.set(version, key);
}

/**
 * Lấy key buffer cho version.
 */
function getKey(version: string): Buffer {
  const key = keyRegistry.get(version);
  if (!key) {
    throw new Error(`Crypto key version "${version}" not registered`);
  }
  return key;
}

/**
 * Build AAD: garena|df_hq|{discordUserId}|{openid}
 */
function buildAad(discordUserId: string, openid: string): Buffer {
  return Buffer.from(`garena|df_hq|${discordUserId}|${openid}`);
}

/**
 * Encrypt credential blob.
 *
 * @param plaintext — JSON string của credential
 * @param discordUserId — Discord user ID (cho AAD)
 * @param openid — OpenID (cho AAD)
 * @param keyVersion — Key version (default: v1)
 * @returns nonce + ciphertext + tag (hex-encoded)
 */
export function encryptCredential(
  plaintext: string,
  discordUserId: string,
  openid: string,
  keyVersion = 'v1',
): EncryptedCredential {
  const key = getKey(keyVersion);
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const aad = buildAad(discordUserId, openid);

  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(aad);

  const ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  cipher.final(); // finalize GCM trước khi getAuthTag
  const tag = cipher.getAuthTag().toString('hex');

  return { nonce: nonce.toString('hex'), ciphertext, tag };
}

/**
 * Decrypt credential blob.
 *
 * @param nonce — 12-byte nonce (hex)
 * @param ciphertext — encrypted data (hex)
 * @param tag — 16-byte auth tag (hex)
 * @param discordUserId — Discord user ID (cho AAD)
 * @param openid — OpenID (cho AAD)
 * @param keyVersion — Key version (default: v1)
 * @returns decrypted plaintext string
 */
export function decryptCredential(
  nonce: string,
  ciphertext: string,
  tag: string,
  discordUserId: string,
  openid: string,
  keyVersion = 'v1',
): string {
  const key = getKey(keyVersion);
  const nonceBuf = Buffer.from(nonce, 'hex');
  const tagBuf = Buffer.from(tag, 'hex');
  const aad = buildAad(discordUserId, openid);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonceBuf);
  decipher.setAAD(aad);
  decipher.setAuthTag(tagBuf);

  const decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  return decrypted + decipher.final('utf8');
}
