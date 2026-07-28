(function () {
  'use strict';

  const sleep = window.Pon1147.utils.sleep;

  const DEBUG = false;
  const debug = (...args) => {
    if (DEBUG) console.log(...args);
  };

  const RedeemNetwork = (() => {
    let activeAttempt = null;
    let attemptCounter = 0;
    const requestStarts = new Map();
    const networkResponses = new Map();

    const isRedeemPayload = (data) =>
      data && typeof data === 'object' && 'code' in data && ('msg' in data || 'code_type' in data);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || !msg.__pon1147) return;

      if (msg.type === 'requestStart') {
        requestStarts.set(msg.attemptId, {
          time: Date.now(),
          requestCode: msg.requestCode || '',
        });
      }

      if (msg.type === 'response' && isRedeemPayload(msg.data)) {
        if (networkResponses.has(msg.attemptId)) return;
        networkResponses.set(msg.attemptId, {
          time: Date.now(),
          data: msg.data,
          requestCode: msg.requestCode || '',
        });
      }
    });

    const start = () => {
      if (window.__pon1147NetworkHooked) return;
      window.__pon1147NetworkHooked = true;

      if (document.getElementById('__pon1147_hook')) return;
      const script = document.createElement('script');
      script.id = '__pon1147_hook';
      script.textContent = `
        (function () {
          if (window.__pon1147PageHooked) return;
          window.__pon1147PageHooked = true;

          var findCodeInPayload = function (payload) {
            if (payload == null) return '';
            if (typeof Request !== 'undefined' && payload instanceof Request) {
              return findCodeInPayload(payload.url);
            }
            if (typeof URLSearchParams !== 'undefined' && payload instanceof URLSearchParams) {
              return findCodeInPayload(payload.toString());
            }
            if (typeof FormData !== 'undefined' && payload instanceof FormData) {
              return findCodeInPayload(
                Array.from(payload.entries()).map(function (e) { return e[0] + '=' + e[1]; }).join('&')
              );
            }
            if (Array.isArray(payload)) {
              for (var i = 0; i < payload.length; i++) {
                var c = findCodeInPayload(payload[i]);
                if (c) return c;
              }
              return '';
            }
            if (typeof payload === 'object') {
              try { return findCodeInPayload(JSON.stringify(payload)); } catch (e) { return ''; }
            }
            return String(payload);
          };

          var getActive = function () {
            try {
              var raw = document.documentElement.dataset.pon1147Active;
              return raw ? JSON.parse(raw) : null;
            } catch (e) {
              return null;
            }
          };

          if (window.fetch) {
            window.__pon1147Originals = window.__pon1147Originals || {};
            window.__pon1147Originals.fetch = window.__pon1147Originals.fetch || window.fetch;
            var originalFetch = window.__pon1147Originals.fetch.bind(window);
            window.fetch = function () {
              var args = arguments;
              var active = getActive();
              var requestCode = active ? findCodeInPayload(args) : '';
              if (active && requestCode) {
                window.postMessage({
                  __pon1147: true,
                  type: 'requestStart',
                  attemptId: active.id,
                  requestCode: requestCode
                }, '*');
              }
              return originalFetch.apply(this, args).then(function (response) {
                response.clone().json().then(function (data) {
                  if (data && typeof data === 'object' && 'code' in data) {
                    window.postMessage({
                      __pon1147: true,
                      type: 'response',
                      data: data,
                      attemptId: active ? active.id : null,
                      requestCode: requestCode
                    }, '*');
                  }
                }).catch(function () {});
                return response;
              });
            };
          }

          if (window.XMLHttpRequest) {
            window.__pon1147Originals = window.__pon1147Originals || {};
            window.__pon1147Originals.xhrOpen = window.__pon1147Originals.xhrOpen || XMLHttpRequest.prototype.open;
            window.__pon1147Originals.xhrSend = window.__pon1147Originals.xhrSend || XMLHttpRequest.prototype.send;
            var originalOpen = window.__pon1147Originals.xhrOpen;
            var originalSend = window.__pon1147Originals.xhrSend;

            XMLHttpRequest.prototype.open = function () {
              this.__pon1147Url = arguments[1] || '';
              return originalOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function () {
              var self = this;
              var active = getActive();
              var requestCode = active
                ? findCodeInPayload([self.__pon1147Url, arguments[0]])
                : '';

              if (active && requestCode) {
                window.postMessage({
                  __pon1147: true,
                  type: 'requestStart',
                  attemptId: active.id,
                  requestCode: requestCode
                }, '*');
              }

              this.addEventListener('loadend', function () {
                try {
                  if (typeof self.responseText === 'string' && self.responseText.trim()) {
                    var data = JSON.parse(self.responseText);
                    if (data && typeof data === 'object' && 'code' in data) {
                      window.postMessage({
                        __pon1147: true,
                        type: 'response',
                        data: data,
                        attemptId: active ? active.id : null,
                        requestCode: requestCode
                      }, '*');
                    }
                  }
                } catch (e) {}
              });

              return originalSend.apply(this, arguments);
            };
          }

          window.__pon1147RestoreHooks = function () {
            if (!window.__pon1147Originals) return;
            if (window.__pon1147Originals.fetch) {
              window.fetch = window.__pon1147Originals.fetch;
            }
            if (window.__pon1147Originals.xhrOpen) {
              XMLHttpRequest.prototype.open = window.__pon1147Originals.xhrOpen;
            }
            if (window.__pon1147Originals.xhrSend) {
              XMLHttpRequest.prototype.send = window.__pon1147Originals.xhrSend;
            }
            delete window.__pon1147PageHooked;
          };
        })();
      `;
      document.head.appendChild(script);
      script.remove();
    };

    const beginAttempt = (code) => {
      attemptCounter += 1;
      activeAttempt = {
        id: attemptCounter,
        code,
        startedAt: Date.now(),
      };
      document.documentElement.dataset.pon1147Active = JSON.stringify({
        id: activeAttempt.id,
        code,
      });
      requestStarts.clear();
      networkResponses.clear();
      return activeAttempt;
    };

    const endAttempt = () => {
      if (activeAttempt?.id != null) {
        requestStarts.delete(activeAttempt.id);
        networkResponses.delete(activeAttempt.id);
      }
      activeAttempt = null;
      delete document.documentElement.dataset.pon1147Active;
    };

    const hasRequestStarted = (attempt) => requestStarts.has(attempt.id);

    const getNetworkMessage = (attempt) => {
      const item = networkResponses.get(attempt.id);
      if (!item) return { source: '', text: '', rawCode: null };

      const response = item.data;
      const responseCode = Number(response.code);

      if (responseCode === 0) {
        return { source: 'response', text: 'ok', rawCode: 0 };
      }
      if (Number.isFinite(responseCode)) {
        return {
          source: 'response',
          text: `error_hint_${responseCode}`,
          rawCode: responseCode,
        };
      }
      return {
        source: 'response',
        text: String(response.msg || response.message || ''),
        rawCode: response.code ?? null,
      };
    };

    return {
      start,
      beginAttempt,
      endAttempt,
      hasRequestStarted,
      getNetworkMessage,
    };
  })();

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.network = {
    RedeemNetwork,
    start: () => {
      RedeemNetwork.start();
    },
    beginAttempt: (code) => RedeemNetwork.beginAttempt(code),
    endAttempt: () => RedeemNetwork.endAttempt(),
    hasRequestStarted: (attempt) => RedeemNetwork.hasRequestStarted(attempt),
    getNetworkMessage: (attempt) => RedeemNetwork.getNetworkMessage(attempt),
    restoreHooks: () => {
      const script = document.createElement('script');
      script.textContent = `
        if (window.__pon1147RestoreHooks) {
          window.__pon1147RestoreHooks();
        }
      `;
      document.documentElement.appendChild(script);
      script.remove();
    },
  };
})();
