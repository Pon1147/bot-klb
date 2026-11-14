/**
 * MAIN world — capture DfTools credential candidates.
 *
 * Hook XHR/fetch/performance để quan sát DfTools requests.
 * KHÔNG POST claim, KHÔNG đọc claim code, KHÔNG chrome.*
 */

(function () {
  'use strict';

  console.log('[DF Toolbox] link-page-capture injected (MAIN world)');

  const SOURCE = 'df-link-capture';
  const DF_TOOLS_HOST = 'sg-act.playerinfinite.com';
  const DF_TOOLS_PATH = '/DfTools/';

  /** Kiểm tra URL có phải DfTools request */
  function isDfToolsUrl(url) {
    if (!url) return false;
    return url.includes(DF_TOOLS_HOST) && url.includes(DF_TOOLS_PATH);
  }

  /** Kiểm tra URL có phải Auth Login của Garena SDK */
  function isAuthLoginUrl(url) {
    if (!url) return false;
    return url.includes('iegg.garena.com') && url.includes('/v2/auth/login');
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

  /** Hook XHR/fetch — gọi lại sau mỗi 500ms để bắt requests mới */
  function setupInterceptors() {
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
        } else if (isAuthLoginUrl(url)) {
          this.addEventListener('load', function () {
            try {
              const data = JSON.parse(this.responseText);
              if (data && data.ret === 0 && data.openid && data.token) {
                postCredential(
                  {
                    openid: data.openid,
                    token: data.token,
                    ts: '0',
                    s: '0',
                    game_id: '30150',
                  },
                  'AuthLogin',
                );
              }
            } catch {
              /* ignore */
            }
          });
        }
        return origXhrSend.apply(this, args);
      };
    }

    // ===== Intercept fetch =====
    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const url = args[0]?.url ?? String(args[0]);
        if (isDfToolsUrl(url)) {
          const credential = extractCredential(url);
          if (credential) {
            postCredential(credential, getEndpoint(url));
          }
        }
        const response = await originalFetch.apply(this, args);
        if (isAuthLoginUrl(url)) {
          try {
            const clone = response.clone();
            clone.json().then((data) => {
              if (data && data.ret === 0 && data.openid && data.token) {
                postCredential(
                  {
                    openid: data.openid,
                    token: data.token,
                    ts: '0',
                    s: '0',
                    game_id: '30150',
                  },
                  'AuthLogin',
                );
              }
            }).catch(() => {});
          } catch {
            /* ignore */
          }
        }
        return response;
      };
    }

    // ===== Lắng nghe message event từ popup OAuth =====
    window.addEventListener('message', (event) => {
      try {
        const d = event.data;
        if (d && typeof d === 'object') {
          if (d.openid && d.token) {
            console.log('[DF Toolbox] Captured from window.message!');
            postCredential(
              {
                openid: d.openid,
                token: d.token,
                ts: d.ts || '0',
                s: d.s || '0',
                game_id: '30150',
              },
              'WindowMessage',
            );
          }
        }
      } catch {
        /* ignore */
      }
    });

    console.log('[DF Toolbox] Interceptors setup complete');
  }

  // ===== Hook sau khi page load xong (tránh bị HQ page override) =====
  // Đợi DOMContentLoaded + 2s để HQ scripts load xong
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setupInterceptors, 4000);
    });
  } else {
    // Page đã load rồi
    setTimeout(setupInterceptors, 1000);
  }

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
  }, 3000);

})();
