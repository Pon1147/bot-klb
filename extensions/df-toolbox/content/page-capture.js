/**
 * MAIN world — capture only.
 *
 * Hook fetch/XHR/performance để quan sát DfTools requests.
 * Không POST claim, không giữ code Discord.
 */

(function () {
  'use strict';

  const DF_TOOLS_HOST = 'sg-act.playerinfinite.com';
  const DF_TOOLS_PATH = '/DfTools/';

  /** Extract query params từ DfTools URL */
  function extractParams(url) {
    try {
      const urlObj = new URL(url);
      const params = {};

      ['openid', 'token', 'ts', 's', 'u', 'a', 'game_id', 'channel'].forEach((key) => {
        const value = urlObj.searchParams.get(key);
        if (value) params[key] = value;
      });

      return Object.keys(params).length >= 2 ? params : null;
    } catch {
      return null;
    }
  }

  /** Kiểm tra credential hợp lệ (có openid + token) */
  function isValidCredential(params) {
    return params.openid && params.token && params.token.length >= 20;
  }

  /** Hook fetch */
  const originalFetch = window.fetch;
  window.fetch = async function (url, ...args) {
    const urlStr = url.toString?.() ?? String(url);

    if (urlStr.includes(DF_TOOLS_HOST) && urlStr.includes(DF_TOOLS_PATH)) {
      const params = extractParams(urlStr);
      if (params && isValidCredential(params)) {
        window.postMessage(
          {
            type: 'DF_CREDENTIALS',
            source: 'fetch',
            params: {
              openid: params.openid,
              token: params.token,
              ts: params.ts,
              s: params.s,
              u: params.u,
            },
          },
          '*',
        );
      }
    }

    return originalFetch.apply(this, [url, ...args]);
  };

  /** Hook XMLHttpRequest */
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._dfMethod = method;
    this._dfUrl = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._dfUrl;
    if (url && typeof url === 'string') {
      if (url.includes(DF_TOOLS_HOST) && url.includes(DF_TOOLS_PATH)) {
        const params = extractParams(url);
        if (params && isValidCredential(params)) {
          window.postMessage(
            {
              type: 'DF_CREDENTIALS',
              source: 'xhr',
              params: {
                openid: params.openid,
                token: params.token,
                ts: params.ts,
                s: params.s,
                u: params.u,
              },
            },
            '*',
          );
        }
      }
    }
    return originalSend.apply(this, args);
  };

  /** Scan performance entries (fallback) */
  function scanPerformanceEntries() {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      if (entry.name.includes(DF_TOOLS_HOST) && entry.name.includes(DF_TOOLS_PATH)) {
        const params = extractParams(entry.name);
        if (params && isValidCredential(params)) {
          window.postMessage(
            {
              type: 'DF_CREDENTIALS',
              source: 'performance',
              params: {
                openid: params.openid,
                token: params.token,
                ts: params.ts,
                s: params.s,
                u: params.u,
              },
            },
            '*',
          );
        }
      }
    }
  }

  // Scan sau 2s (trang đã load xong)
  setTimeout(scanPerformanceEntries, 2000);

  console.log('[DF Toolbox] Page capture initialized (MAIN world)');
})();
