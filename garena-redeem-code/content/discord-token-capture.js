/**
 * Content script chạy trên discord.com — capture Discord auth token.
 * Token được lưu vào chrome.storage.local để link-content.js đọc.
 *
 * Discord là SPA → token có thể được set sau vài giây (rehydration, refresh).
 * Poll liên tục cho đến khi tìm thấy token (tối đa 30s).
 */

(function () {
  'use strict';

  console.log('[DF Toolbox] discord-token-capture loaded');

  const TOKEN_KEYS = [
    'discord_token',
    'discord_auth_token',
    'token',
    'auth_token',
    'discordAccessToken',
    'discord-access-token',
    'DISCORD_TOKEN',
    'userToken',
    'discord_user_token',
    'discord-token',
  ];

  let attempts = 0;
  const maxAttempts = 30; // 30s at 1s intervals

  function tryCapture() {
    for (const key of TOKEN_KEYS) {
      try {
        const val = localStorage.getItem(key);
        // Kiểm tra token hợp lệ: chuỗi không rỗng, tối thiểu 10 ký tự
        // Không dùng heuristic 'MT' — Discord có thể đổi format token
        if (val && val.length >= 10) {
          chrome.storage.local.set({ discord_auth_token: val }, () => {
            console.log('[DF Toolbox] Captured Discord auth token from localStorage key:', key);
          });
          return; // success, stop polling
        }
      } catch {
        // localStorage bị block → bỏ qua key này
      }
    }
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryCapture, 1000);
    } else {
      console.warn('[DF Toolbox] No Discord auth token found after', maxAttempts, 'attempts');
    }
  }

  // Bắt đầu poll ngay
  tryCapture();
})();
