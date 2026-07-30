import { DEFAULT_CODES } from './constants.js';

const codesSet = new Set(DEFAULT_CODES);

export class ResponseCapture {
  constructor() {
    this.responses = [];
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.responses = [];

    this._interceptFetch();
    this._interceptXHR();
  }

  _interceptFetch() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);

      if (self._isRedeemUrl(url)) {
        const options = args[1] || {};
        const body = options.body;

        // Check if request body contains a redeem code
        const code = body ? await self._extractCodeFromBody(body) : null;

        if (code) {
          try {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            const text = await clone.text();

            try {
              const jsonData = JSON.parse(text);
              self.responses.push({
                code,
                data: jsonData,
                status: response.status,
                time: Date.now(),
              });
            } catch { /* not JSON */ }

            return response;
          } catch (err) {
            return originalFetch.apply(this, args);
          }
        }
      }

      return originalFetch.apply(this, args);
    };
  }

  _interceptXHR() {
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.send = function (body) {
      const url = this._url || this.responseURL;

      if (self._isRedeemUrl(url)) {
        const code = body ? self._extractCodeFromBodySync(body) : null;

        if (code) {
          const onload = () => {
            try {
              const data = JSON.parse(this.responseText);
              if (data && typeof data === 'object') {
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
      }

      return originalSend.apply(this, [body]);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      this._url = args[1];
      this._method = args[0];
      return originalOpen.apply(this, args);
    };
  }

  _isRedeemUrl(url) {
    return url && typeof url === 'string' && url.includes('redeem.df.garena.sg');
  }

  async _extractCodeFromBody(body) {
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
    return this._extractCodeFromBodySync(text);
  }

  _extractCodeFromBodySync(text) {
    if (!text || typeof text !== 'string') return null;

    for (const code of codesSet) {
      if (text.includes(code)) return code;
    }
    return null;
  }

  getLastResponse() {
    return this.responses.length > 0 ? this.responses[this.responses.length - 1] : null;
  }

  reset() {
    this.responses = [];
  }
}
