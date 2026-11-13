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

  // First-run: mở trang onboarding hướng dẫn liên kết & redeem code
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome/welcome.html' });
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

        // Hỗ trợ dynamic endpoint cho Dev/Staging qua chrome.storage.local (fallback sang Production)
        const storageConfig = await chrome.storage.local.get(['claim_api_url']);
        const targetUrl = (storageConfig.claim_api_url && typeof storageConfig.claim_api_url === 'string')
          ? storageConfig.claim_api_url.trim()
          : 'https://bot-klb-production.up.railway.app/api/v1/auth/claim';
        console.log(`[SW] Sending claim to Bot API: ${targetUrl}`);

        let res;
        let data = {};
        try {
          res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          console.log(`[SW] Bot API response status: ${res.status} ${res.statusText}`);

          data = await res.json().catch((err) => {
            console.warn('[SW] Failed to parse JSON response from Bot API:', err);
            return {};
          });
        } catch (fetchErr) {
          console.warn(`[SW] Failed to fetch targetUrl (${targetUrl}):`, fetchErr);
        }

        // Auto Dev Fallback: Nếu targetUrl mặc định (Production) không tìm thấy code (401 hoặc !data.ok),
        // tự động thử gửi tới local dev bot (port 8088 hoặc 8080)
        if ((!res || res.status === 401 || !data?.ok) && !targetUrl.includes('localhost') && !targetUrl.includes('127.0.0.1')) {
          const devPorts = [8088, 8080];
          for (const devPort of devPorts) {
            try {
              const localUrl = `http://localhost:${devPort}/api/v1/auth/claim`;
              const localRes = await fetch(localUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (localRes.ok) {
                const localData = await localRes.json().catch(() => ({}));
                if (localData?.ok) {
                  console.log(`[SW] ✓ Successfully claimed via local dev bot (localhost:${devPort})!`);
                  sendResponse({ ok: true });
                  return;
                }
              }
            } catch (localErr) {
              // Port này không có bot dev, thử tiếp port khác
            }
          }
        }

        console.log('[SW] Bot API response data:', data);
        sendResponse({ ok: Boolean(res?.ok && data?.ok), error: data?.error || 'Mạng không ổn định hoặc Bot API chưa sẵn sàng. Thử lại sau.' });
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
