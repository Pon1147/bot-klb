// Service Worker - Extension lifecycle + Discord Webhook handler

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

// ===== LINK: Handle DF_CLAIM from link-content.js → POST Discord Webhook =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'DF_CLAIM') return;

  (async () => {
    try {
      const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
      if (!webhookUrl) {
        sendResponse({ ok: false, error: 'webhookUrl not configured — set in DevTools: chrome.storage.local.set({webhookUrl: "URL"})' });
        return;
      }

      const payload = {
        content: JSON.stringify({
          type: 'df_claim',
          secret: 'df-link-2026-pon1147', // đổi thành DF_WEBHOOK_SECRET thực tế
          code: msg.code,
          openid: msg.credential.openid,
          token: msg.credential.token,
          ts: msg.credential.ts,
          s: msg.credential.s,
          u: msg.credential.u,
          a: msg.credential.a,
          source_endpoint: msg.source_endpoint,
          captured_at: Date.now(),
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
});
