// Service Worker - Extension lifecycle + Discord Webhook handler

// ===== CONSTANTS =====
const AUTH_EVENTS_KEY = 'auth_events';

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
  // --- DF_CLAIM: Handle from link-content.js → POST Discord Webhook (hash only, no raw credentials) ---
  if (msg?.type === 'DF_CLAIM') {
    (async () => {
      try {
        const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
        if (!webhookUrl) {
          sendResponse({ ok: false, error: 'webhookUrl not configured — set in DevTools: chrome.storage.local.set({webhookUrl: "URL"})' });
          return;
        }

        // Hash credential fields để không gửi raw data lên Discord
        async function hashField(val) {
          if (!val) return null;
          const encoder = new TextEncoder();
          const data = encoder.encode(String(val));
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        }

        const [openidHash, tokenHash] = await Promise.all([
          hashField(msg.credential?.openid),
          hashField(msg.credential?.token),
        ]);

        const payload = {
          content: JSON.stringify({
            type: 'df_claim',
            secret: 'df-link-2026-pon1147',
            code: msg.code,
            openidHash,
            tokenHash,
            source_endpoint: msg.source_endpoint,
            captured_at: Date.now(),
            // KHÔNG gửi raw credential: openid, token, ts, s, u, a
          }),
        };

        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Discord webhook trả 204 No Content khi thành công
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

});
