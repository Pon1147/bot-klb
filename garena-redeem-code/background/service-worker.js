// Service Worker - Extension lifecycle + Claim API handler

// ===== REDEEM: Initialize storage on install =====
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get('centralState', (result) => {
      if (!result.centralState) {
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
        chrome.storage.local.set({ centralState: defaultState });
      }
    });
  }
});

// ===== LINK: Handle DF_CLAIM from link-content.js =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[DF Toolbox SW] Received DF_CLAIM:', msg);

  if (msg?.type !== 'DF_CLAIM') return;

  (async () => {
    try {
      // Đọc claimBaseUrl từ storage, fallback hardcode
      const { claimBaseUrl } = await chrome.storage.local.get('claimBaseUrl');
      const base = claimBaseUrl || 'https://moves-reproduction-accept-carl.trycloudflare.com';
      console.log('[DF Toolbox SW] Using base URL:', base);

      const body = {
        code: msg.code,
        openid: msg.credential.openid,
        token: msg.credential.token,
        ts: msg.credential.ts,
        s: msg.credential.s,
        u: msg.credential.u,
        a: msg.credential.a,
        source_endpoint: msg.source_endpoint,
      };
      console.log('[DF Toolbox SW] Sending body:', JSON.stringify(body).slice(0, 100) + '...');

      const url = `${base.replace(/\/$/, '')}/api/df/claim`;
      console.log('[DF Toolbox SW] Fetch URL:', url);

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('[DF Toolbox SW] Fetch response status:', r.status);
      const data = await r.json().catch(() => ({}));
      console.log('[DF Toolbox SW] Fetch response data:', data);

      sendResponse({
        ok: r.ok && data.ok === true,
        error: data.error || (!r.ok ? 'http_' + r.status : undefined),
      });
    } catch (e) {
      console.log('[DF Toolbox SW] Fetch error:', e);
      sendResponse({
        ok: false,
        error: 'network — ' + (e?.message || 'Unknown error'),
      });
    }
  })();

  return true; // async sendResponse
});
