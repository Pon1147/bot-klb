// Runs in PAGE CONTEXT — can intercept page XHR/fetch requests.
// Posts captured responses back to content script via postMessage.
(() => {
  'use strict';

  const CAPTURE_SOURCE = 'garena-redeem-capture';

  function isRedeemUrl(url) {
    if (!url) return false;
    if (url.includes('redeem.df.garena.sg')) return true;
    if (url.includes('playerinfinite.com') && (url.includes('RedeemCDKey') || url.includes('CdkV2'))) return true;
    return false;
  }

  function isValidResponse(data) {
    return data && typeof data === 'object' && 'code' in data;
  }

  // ===== Intercept XHR =====
  if (window.XMLHttpRequest) {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
      this.__garenaRedeemUrl = args[1];
      return origXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this.__garenaRedeemUrl || '';
      if (isRedeemUrl(url)) {
        const onload = () => {
          try {
            if (typeof this.responseText === 'string' && this.responseText.trim()) {
              const data = JSON.parse(this.responseText);
              if (isValidResponse(data)) {
                window.postMessage({ source: CAPTURE_SOURCE, data: data, url: url }, '*');
              }
            }
          } catch { /* not JSON */ }
        };
        this.addEventListener('load', onload, { once: true });
      }
      return origXhrSend.apply(this, args);
    };
  }

  // ===== Intercept fetch =====
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    if (isRedeemUrl(url)) {
      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();
        const text = await clone.text();
        try {
          const jsonData = JSON.parse(text);
          if (isValidResponse(jsonData)) {
            window.postMessage({ source: CAPTURE_SOURCE, data: jsonData, url: url }, '*');
          }
        } catch { /* not JSON */ }
        return response;
      } catch { /* fetch failed */ }
    }
    return originalFetch.apply(this, args);
  };

})();
