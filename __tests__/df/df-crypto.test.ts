/**
 * Unit tests cho df-crypto.ts — AES-256-GCM encryption helpers.
 *
 * Yêu cầu nghiệp vụ & bảo mật (Rule: security-review, tdd-workflow):
 * 1. Khởi tạo key 32-byte từ Base64 biến môi trường DF_CRED_KEY_V1.
 * 2. Throw lỗi nếu key thiếu hoặc sai độ dài.
 * 3. Mã hóa ra nonce (12 bytes), ciphertext, và auth tag (16 bytes) định dạng hex.
 * 4. Gắn AAD (Additional Authenticated Data) ràng buộc discordUserId + openid để chống credential swap.
 * 5. Giải mã thành công dữ liệu gốc khi cung cấp đúng tham số.
 * 6. Từ chối giải mã (throw) nếu ciphertext bị sửa đổi (tampered), sai auth tag, sai discordUserId hoặc sai openid.
 */

import {
  initCryptoKey,
  encryptCredential,
  decryptCredential,
} from '../../src/services/df-crypto.js';
import crypto from 'node:crypto';

describe('df-crypto — AES-256-GCM Security Service', () => {
  const originalEnv = process.env.DF_CRED_KEY_V1;
  // Tạo 32 bytes ngẫu nhiên chuẩn cho key v1
  const validKeyBuffer = crypto.randomBytes(32);
  const validKeyBase64 = validKeyBuffer.toString('base64');

  beforeEach(() => {
    process.env.DF_CRED_KEY_V1 = validKeyBase64;
    initCryptoKey('v1');
  });

  afterAll(() => {
    process.env.DF_CRED_KEY_V1 = originalEnv;
  });

  describe('initCryptoKey', () => {
    it('nên ném ra lỗi nếu biến môi trường DF_CRED_KEY_V1 không tồn tại', () => {
      delete process.env.DF_CRED_KEY_V1;
      expect(() => initCryptoKey('v1')).toThrow('DF_CRED_KEY_V1 not configured');
    });

    it('nên ném ra lỗi nếu độ dài key không đúng 32 bytes (256 bits)', () => {
      const shortKey = Buffer.from('short-key').toString('base64');
      process.env.DF_CRED_KEY_V1 = shortKey;
      expect(() => initCryptoKey('v1')).toThrow('DF_CRED_KEY_V1 must be 32 bytes');
    });
  });

  describe('encryptCredential & decryptCredential round-trip', () => {
    it('nên mã hóa và giải mã thành công chuỗi dữ liệu gốc (round-trip)', () => {
      const plaintext = JSON.stringify({ token: 'test-token-12345', openid: 'garena-openid-999' });
      const discordUserId = 'discord-user-111';
      const openid = 'garena-openid-999';

      const encrypted = encryptCredential(plaintext, discordUserId, openid, 'v1');

      // Nonce phải 12 bytes = 24 ký tự hex
      expect(encrypted.nonce).toHaveLength(24);
      // Tag phải 16 bytes = 32 ký tự hex
      expect(encrypted.tag).toHaveLength(32);
      expect(encrypted.ciphertext).toBeTruthy();

      const decrypted = decryptCredential(
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.tag,
        discordUserId,
        openid,
        'v1',
      );

      expect(decrypted).toBe(plaintext);
    });

    it('nên ném ra lỗi nếu version key không tồn tại trong registry', () => {
      expect(() => {
        encryptCredential('secret', 'user-1', 'openid-1', 'v999');
      }).toThrow('Crypto key version "v999" not registered');

      expect(() => {
        decryptCredential('00'.repeat(12), 'aabb', '00'.repeat(16), 'user-1', 'openid-1', 'v999');
      }).toThrow('Crypto key version "v999" not registered');
    });

    it('nên từ chối giải mã (throw) nếu auth tag bị sai lệch hoặc giả mạo (tampering)', () => {
      const plaintext = 'sensitive-token-payload';
      const discordUserId = 'user-123';
      const openid = 'openid-456';

      const encrypted = encryptCredential(plaintext, discordUserId, openid, 'v1');
      // Đổi 1 ký tự hex trong tag
      const corruptedTag =
        (encrypted.tag[0] === '0' ? '1' : '0') + encrypted.tag.slice(1);

      expect(() => {
        decryptCredential(
          encrypted.nonce,
          encrypted.ciphertext,
          corruptedTag,
          discordUserId,
          openid,
          'v1',
        );
      }).toThrow();
    });

    it('nên từ chối giải mã (throw) nếu ciphertext bị sửa đổi', () => {
      const plaintext = 'sensitive-token-payload';
      const discordUserId = 'user-123';
      const openid = 'openid-456';

      const encrypted = encryptCredential(plaintext, discordUserId, openid, 'v1');
      const corruptedCiphertext =
        (encrypted.ciphertext[0] === '0' ? '1' : '0') + encrypted.ciphertext.slice(1);

      expect(() => {
        decryptCredential(
          encrypted.nonce,
          corruptedCiphertext,
          encrypted.tag,
          discordUserId,
          openid,
          'v1',
        );
      }).toThrow();
    });

    it('nên từ chối giải mã nếu discordUserId trong AAD bị tráo đổi (credential swapping prevention)', () => {
      const plaintext = 'user-a-credential';
      const userA = 'user-a';
      const userB = 'user-b';
      const openid = 'openid-123';

      const encrypted = encryptCredential(plaintext, userA, openid, 'v1');

      // Kẻ tấn công dùng payload của User A gán cho User B
      expect(() => {
        decryptCredential(
          encrypted.nonce,
          encrypted.ciphertext,
          encrypted.tag,
          userB,
          openid,
          'v1',
        );
      }).toThrow();
    });

    it('nên từ chối giải mã nếu openid trong AAD bị tráo đổi', () => {
      const plaintext = 'user-a-credential';
      const userId = 'user-a';
      const openidA = 'openid-original';
      const openidB = 'openid-swapped';

      const encrypted = encryptCredential(plaintext, userId, openidA, 'v1');

      expect(() => {
        decryptCredential(
          encrypted.nonce,
          encrypted.ciphertext,
          encrypted.tag,
          userId,
          openidB,
          'v1',
        );
      }).toThrow();
    });
  });
});

