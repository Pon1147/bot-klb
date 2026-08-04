/**
 * MAIN world — capture DfTools credential candidates.
 *
 * Hook XHR/fetch/performance để quan sát DfTools requests.
 * KHÔNG POST claim, KHÔNG đọc claim code, KHÔNG chrome.*
 */

(function () {
  'use strict';

  const SOURCE = 'df-link-capture';
  const DF_TOOLS_HOST = 'sg-act.playerinfinite.com';
  const DF_TOOLS_PATH = '/DfTools/';

  /** Kiểm tra URL có phải DfTools request */
  function isDfToolsUrl(url) {
    if (!url) return false;
    return url.includes(DF_TOOLS_HOST) && url.includes(DF_TOOLS_PATH);
  }

  /** Extract credential candidate từ URL query params */
  function extractCredential(url) {
    try {
      const p = new URL(url, location.origin).searchParams;
      const openid = p.get('openid');
      const token = p.get('token');

      if (!openid || !token) return null;

      return {
        openid,
        token,
        ts: p.get('ts'),
        s: p.get('s'),
        u: p.get('u'),
        a: p.get('a'),
        game_id: p.get('game_id'),
      };
    } catch {
      return null;
    }
  }

  /** Lấy endpoint name từ URL path */
  function getEndpoint(url) {
    try {
      const urlObj = new URL(url, location.origin);
      const parts = urlObj.pathname.split('/');
      return parts[parts.length - 1] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /** Post credential candidate lên content script */
  function postCredential(credential, endpoint) {
    window.postMessage(
      {
        source: SOURCE,
        type: 'CREDENTIAL_CANDIDATE',
        credential,
        endpoint,
        capturedAt: Date.now(),
      },
      window.location.origin,
    );
  }

  // ===== Intercept XHR =====
  if (window.XMLHttpRequest) {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
      this.__dfToolsUrl = args[1];
      return origXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this.__dfToolsUrl || '';
      if (isDfToolsUrl(url)) {
        const credential = extractCredential(url);
        if (credential) {
          postCredential(credential, getEndpoint(url));
        }
      }
      return origXhrSend.apply(this, args);
    };
  }

  // ===== Intercept fetch =====
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0]?.url ?? String(args[0]);
    if (isDfToolsUrl(url)) {
      const credential = extractCredential(url);
      if (credential) {
        postCredential(credential, getEndpoint(url));
      }
    }
    return originalFetch.apply(this, args);
  };

  // ===== Performance scan (fallback) =====
  setTimeout(() => {
    try {
      const entries = performance.getEntriesByType('resource');
      for (const entry of entries) {
        if (isDfToolsUrl(entry.name)) {
          const credential = extractCredential(entry.name);
          if (credential) {
            postCredential(credential, getEndpoint(entry.name));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, 2000);

})();
