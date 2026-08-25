// Service Worker - Extension lifecycle + Discord Webhook handler

// ===== CONSTANTS =====
const AUTH_EVENTS_KEY = 'auth_events';
const DF_CLAIM_PENDING_KEY = 'df_claim_pending';
const DF_CLAIM_RESULT_KEY = 'df_claim_result';

// ===== DF_CLAIM: Listen storage change (thay vì message handler) =====
// Content script ghi claim vào df_claim_pending → SW detect → xử lý → ghi kết quả
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes[DF_CLAIM_PENDING_KEY]) return;

  const pending = changes[DF_CLAIM_PENDING_KEY].newValue;
  if (!pending?.code || !pending?.credential) return;

  console.log('[Service Worker] DF_CLAIM detected from storage:', pending.code);

  // Xử lý claim
  (async () => {
    try {
      const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
      if (!webhookUrl) {
        chrome.storage.local.set({ [DF_CLAIM_RESULT_KEY]: { ok: false, error: 'webhookUrl not configured' } });
        return;
      }

      const credential = pending.credential || {};
      const payload = {
        content: JSON.stringify({
          type: 'df_claim',
          secret: 'df-link-2026-pon1147',
          code: pending.code,
          openid: credential.openid || null,
          token: credential.token || null,
          ts: credential.ts || null,
          s: credential.s || null,
          u: credential.u || null,
          source_endpoint: pending.endpoint || null,
          captured_at: Date.now(),
        }),
      };

      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = {
        ok: r.status === 204 || r.ok,
        error: r.ok ? undefined : 'http_' + r.status,
      };
      console.log('[Service Worker] DF_CLAIM result:', result);
      chrome.storage.local.set({ [DF_CLAIM_RESULT_KEY]: result });
    } catch (e) {
      console.error('[Service Worker] DF_CLAIM error:', e);
      chrome.storage.local.set({ [DF_CLAIM_RESULT_KEY]: { ok: false, error: 'network' } });
    }
  })();
});

// ===== Lifecycle: init storage + onboarding =====
chrome.runtime.onInstalled.addListener((details) => {
  // Init redeem state
  chrome.storage.local.get('centralState', (result) => {
    if (!result.centralState) {
      chrome.storage.local.set({ centralState: defaultState });
    }
  });

  // First-run: mở popup để user paste webhook URL
  if (details.reason === 'install') {
    chrome.storage.local.get('webhookUrl', (result) => {
      if (!result.webhookUrl) {
        chrome.tabs.create({ url: 'popup/popup.html' });
      }
    });
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
  // --- DF_CLAIM: Handle from link-content.js → POST Discord Webhook ---
  // Gửi raw credential (bot sẽ encrypt trước khi lưu). Webhook là private endpoint,
  // message bị xóa ngay sau khi bot xử lý.
  if (msg?.type === 'DF_CLAIM') {
    (async () => {
      try {
        const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
        if (!webhookUrl) {
          sendResponse({ ok: false, error: 'webhookUrl not configured' });
          return;
        }

        const credential = msg.credential || {};
        const payload = {
          content: JSON.stringify({
            type: 'df_claim',
            secret: 'df-link-2026-pon1147',
            code: msg.code,
            openid: credential.openid || null,
            token: credential.token || null,
            ts: credential.ts || null,
            s: credential.s || null,
            u: credential.u || null,
            source_endpoint: msg.source_endpoint || null,
            captured_at: Date.now(),
          }),
        };

        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        sendResponse({
          ok: r.status === 204 || r.ok,
          error: r.ok ? undefined : 'http_' + r.status,
        });
      } catch (e) {
        sendResponse({ ok: false, error: 'network' });
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
