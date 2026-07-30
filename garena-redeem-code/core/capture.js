// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { DEFAULT_CODES } from './constants.js';

const codesSet = new Set(DEFAULT_CODES);

export class ResponseCapture {
  constructor() {
    this.responses = [];
    this.initialized = false;
    this._currentCode = null;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.responses = [];

    this._interceptFetch();
    this._interceptXHR();
  }

  _isRedeemUrl(url) {
    if (!url) return false;
    if (url.includes('redeem.df.garena.sg')) return true;
    if (url.includes('playerinfinite.com') && (url.includes('RedeemCDKey') || url.includes('CdkV2'))) return true;
    return false;
  }

  _extractCode(url, bodyText) {
    // Try URL params first (cdkey=DFPACK293)
    try {
      const u = new URL(url);
      const cdkey = u.searchParams.get('cdkey');
      if (cdkey) return cdkey;
    } catch { /* ignore */ }
    // Fallback: check against known codes
    for (const code of codesSet) {
      if (bodyText.includes(code)) return code;
    }
    // Final fallback: use the code set by reset(code)
    return this._currentCode;
  }

  _extractCodeFromBodySync(text) {
    if (!text || typeof text !== 'string') return null;
    for (const code of codesSet) {
      if (text.includes(code)) return code;
    }
    return null;
  }

  async _extractCodeFromBody(url, body) {
    let text = '';
    if (body instanceof ArrayBuffer) {
      text = new TextDecoder().decode(body);
    } else if (body instanceof Blob) {
      text = await body.text();
    } else if (body instanceof URLSearchParams) {
      text = body.toString();
    } else {
      text = String(body);
    }
    return this._extractCode(url, text);
  }

  _interceptFetch() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);

      if (self._isRedeemUrl(url)) {
        const options = args[1] || {};
        const body = options.body;

        const code = body ? await self._extractCodeFromBody(url, body) : null;

        try {
          const response = await originalFetch.apply(this, args);
          const clone = response.clone();
          const text = await clone.text();

          try {
            const jsonData = JSON.parse(text);
            if (jsonData && typeof jsonData === 'object' && 'code' in jsonData && code) {
              self.responses.push({
                code,
                data: jsonData,
                status: response.status,
                time: Date.now(),
              });
            }
          } catch { /* not JSON */ }

          return response;
        } catch (err) {
          return originalFetch.apply(this, args);
        }
      }

      return originalFetch.apply(this, args);
    };
  }

  _interceptXHR() {
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this._url || this.responseURL;
      const body = args[0];

      if (self._isRedeemUrl(url)) {
        const code = body ? self._extractCode(url, String(body)) : null;

        const onload = () => {
          try {
            const data = JSON.parse(this.responseText);
            if (data && typeof data === 'object' && 'code' in data && code) {
              self.responses.push({
                code,
                data,
                status: this.status,
                time: Date.now(),
              });
            }
          } catch { /* not JSON */ }
        };

        this.addEventListener('load', onload, { once: true });
      }

      return originalSend.apply(this, args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      this._url = args[1];
      this._method = args[0];
      return originalOpen.apply(this, args);
    };
  }

  getLastResponse() {
    return this.responses.length > 0 ? this.responses[this.responses.length - 1] : null;
  }

  reset(code) {
    this.responses = [];
    this._currentCode = code || null;
  }
}
