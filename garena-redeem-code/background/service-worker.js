// Service Worker - Extension lifecycle + Discord Webhook handler

// ===== CONSTANTS =====
const AUTH_EVENTS_KEY = 'auth_events';
const DF_CLAIM_PENDING_KEY = 'df_claim_pending';
const DF_CLAIM_RESULT_KEY = 'df_claim_result';
const DF_CLAIM_PROCESSING_KEY = 'df_claim_processing';

// ===== DF_CLAIM deduplication: check nếu đang xử lý =====
// Content script gửi DF_CLAIM message trực tiếp → SW xử lý
// Deduplication vẫn cần để tránh user click nhanh 2 lần
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // Chỉ dùng để cleanup processing lock nếu content script crash
  if (changes[DF_CLAIM_PROCESSING_KEY]) {
    console.log('[Service Worker] Processing lock changed, cleaning up');
    chrome.storage.local.remove(DF_CLAIM_PROCESSING_KEY);
  }
});

// ===== Lifecycle: init storage + onboarding =====
chrome.runtime.onInstalled.addListener((details) => {
  // Init redeem state
  chrome.storage.local.get('centralState', (result) => {
    if (!result.centralState) {
      chrome.storage.local.set({ centralState: defaultState });
    }
  });

  // First-run: mở popup onboarding nếu cần
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'popup/popup.html' });
  }
});

const defaultState = {
  sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  codes: [],
  currentIndex: 0,
  currentCode: null,
  status: 'NO_CODES',
  stats: { total: 0, success: 0, failed: 0 },
  logs: [],
  codeStates: [],
};

// ===== MESSAGE HANDLER: DF_CLAIM + Auth Investigator =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // --- DF_CLAIM: Gửi trực tiếp lên Bot Server API ---
  if (msg?.type === 'DF_CLAIM') {
    const maskedOpenid = msg.credential?.openid ? `${msg.credential.openid.slice(0, 4)}***` : 'missing';
    console.log(`[SW] Received DF_CLAIM: code=${msg.code}, openid=${maskedOpenid}, source=${msg.source_endpoint || 'unknown'}`);

    (async () => {
      try {
        const credential = msg.credential || {};
        const payload = {
          code: msg.code,
          openid: credential.openid || null,
          token: credential.token || null,
          ts: credential.ts || null,
          s: credential.s || null,
          u: credential.u || null,
          a: credential.a || null,
          game_id: credential.game_id || null,
          source_endpoint: msg.source_endpoint || null,
        };

        const targetUrl = 'https://bot-klb-production.up.railway.app/api/v1/auth/claim';
        console.log(`[SW] Sending claim to Bot API: ${targetUrl}`);

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        console.log(`[SW] Bot API response status: ${res.status} ${res.statusText}`);

        const data = await res.json().catch((err) => {
          console.warn('[SW] Failed to parse JSON response from Bot API:', err);
          return {};
        });

        console.log('[SW] Bot API response data:', data);
        sendResponse({ ok: res.ok && data.ok, error: data.error });
      } catch (e) {
        console.error('[SW] Network error when calling Bot API:', e);
        sendResponse({ ok: false, error: 'Mạng không ổn định hoặc Bot API chưa sẵn sàng. Thử lại sau.' });
      }
    })();

    return true; // async sendResponse
  }

  // --- Auth Investigator: GET_AUTH_EVENTS ---
  if (msg?.type === 'GET_AUTH_EVENTS') {
    chrome.storage.local.get(AUTH_EVENTS_KEY, (result) => {
      sendResponse({
        ok: true,
        events: result[AUTH_EVENTS_KEY] || [],
      });
    });
    return true; // async
  }

  // --- Auth Investigator: CLEAR_AUTH_EVENTS ---
  if (msg?.type === 'CLEAR_AUTH_EVENTS') {
    chrome.storage.local.set({ [AUTH_EVENTS_KEY]: [] }, () => {
      sendResponse({ ok: true });
    });
    return true; // async
  }

  // --- Auth State: Send Discord notification via webhook ---
  if (msg?.type === 'AUTH_NOTIFICATION') {
    (async () => {
      try {
        const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
        if (!webhookUrl) {
          sendResponse({ ok: false, error: 'webhookUrl not configured' });
          return;
        }

        const { type, reason, sessionId, shortSessionId, details, timestamp: notifTs } = msg.notification;

        // Deduplication: skip nếu đã gửi notification cùng session+type trong 5 phút
        const dedupKey = `${sessionId}:${type}`;
        const { lastNotifSent } = await chrome.storage.local.get('lastNotifSent');
        const lastSent = lastNotifSent || {};
        const lastSentForThis = lastSent[dedupKey];
        if (lastSentForThis && (Date.now() - lastSentForThis) < 5 * 60 * 1000) {
          console.log(`[Service Worker] Deduplicated: ${dedupKey}`);
          sendResponse({ ok: true, deduplicated: true });
          return;
        }
        lastSent[dedupKey] = Date.now();
        chrome.storage.local.set({ lastNotifSent: lastSent });

        const timestamp = new Date(notifTs).toLocaleString('vi-VN');

        const embeds = [];

        if (type === 'AUTH_EXPIRED') {
          embeds.push({
            color: 0xdc2626,
            title: '🔴 Delta Force Authentication Expired',
            fields: [
              { name: 'Session', value: shortSessionId || sessionId, inline: true },
              { name: 'Reason', value: reason || 'TOKEN_EXPIRED', inline: true },
              { name: 'Detected', value: timestamp, inline: true },
            ],
            footer: { text: 'DF Toolbox — Auth Investigator' },
            timestamp: new Date(msg.notification.timestamp).toISOString(),
          });
        } else if (type === 'AUTH_RESTORED') {
          embeds.push({
            color: 0x16a34a,
            title: '🟢 Delta Force Authentication Restored',
            fields: [
              { name: 'Session', value: shortSessionId || sessionId, inline: true },
              { name: 'Status', value: 'ACTIVE', inline: true },
              { name: 'Restored', value: timestamp, inline: true },
            ],
            footer: { text: 'DF Toolbox — Auth Investigator' },
            timestamp: new Date(msg.notification.timestamp).toISOString(),
          });
        } else if (type === 'AUTH_REFRESH_FAILED') {
          embeds.push({
            color: 0xea580c,
            title: '🟡 Delta Force Authentication Refresh Failed',
            fields: [
              { name: 'Session', value: shortSessionId || sessionId, inline: true },
              { name: 'Reason', value: reason || 'REFRESH_FAILED', inline: true },
              { name: 'Detected', value: timestamp, inline: true },
            ],
            footer: { text: 'DF Toolbox — Auth Investigator' },
            timestamp: new Date(msg.notification.timestamp).toISOString(),
          });
        } else {
          sendResponse({ ok: false, error: 'unknown notification type' });
          return;
        }

        const payload = { embeds };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        sendResponse({ ok: true, deduplicated: false });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || 'network' });
      }
    })();

    return true; // async sendResponse
  }

});
