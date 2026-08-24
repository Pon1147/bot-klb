// Runs in PAGE CONTEXT — can intercept page XHR/fetch requests.
// Posts captured responses back to content script via postMessage.
// Format: normalized NetworkEvent với requestId correlation.
(() => {
  'use strict';

  const CAPTURE_SOURCE = 'garena-redeem-capture';

  // ===== Utility: tạo requestId duy nhất =====
  function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function isRedeemUrl(url) {
    if (!url) return false;
    if (url.includes('redeem.df.garena.sg')) return true;
    if (url.includes('playerinfinite.com') && (url.includes('RedeemCDKey') || url.includes('CdkV2'))) return true;
    return false;
  }

  function isValidResponse(data) {
    return data && typeof data === 'object' && 'code' in data;
  }

  // ===== Tạo normalized NetworkEvent =====
  function createNetworkEvent(requestId, url, method, status, data) {
    return {
      source: CAPTURE_SOURCE,
      event: {
        id: requestId,
        requestId,
        type: 'NETWORK_RESPONSE',
        timestamp: Date.now(),
        method: method || 'GET',
        url: url || '',
        status: status || 200,
      },
      data: data || null,
    };
  }

  // ===== Intercept XHR =====
  if (window.XMLHttpRequest) {
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
      this.__garenaRedeemUrl = args[1];
      this.__garenaRedeemMethod = args[0] || 'GET';
      this.__garenaRedeemRequestId = generateRequestId();
      return origXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this.__garenaRedeemUrl || '';
      const method = this.__garenaRedeemMethod || 'GET';
      const requestId = this.__garenaRedeemRequestId;

      if (isRedeemUrl(url)) {
        const onload = () => {
          try {
            if (typeof this.responseText === 'string' && this.responseText.trim()) {
              const data = JSON.parse(this.responseText);
              if (isValidResponse(data)) {
                // Gửi normalized event với requestId
                window.postMessage(
                  createNetworkEvent(requestId, url, method, this.status, data),
                  window.location.origin
                );
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
    const method = (args[1]?.method || 'GET').toUpperCase();
    const requestId = generateRequestId();

    if (isRedeemUrl(url)) {
      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();
        const text = await clone.text();
        try {
          const jsonData = JSON.parse(text);
          if (isValidResponse(jsonData)) {
            // Gửi normalized event với requestId
            window.postMessage(
              createNetworkEvent(requestId, url, method, response.status, jsonData),
              window.location.origin
            );
          }
        } catch { /* not JSON */ }
        return response;
      } catch { /* fetch failed */ }
    }
    return originalFetch.apply(this, args);
  };

})();
