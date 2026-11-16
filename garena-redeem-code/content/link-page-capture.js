(function () {
  'use strict';

  console.log('[DF Toolbox] On-Demand capture activated (MAIN world)');

  const SOURCE = 'df-link-capture';
  const DF_TOOLS_HOST = 'sg-act.playerinfinite.com';
  const DF_TOOLS_PATH = '/DfTools/';

  let isActive = true;

  const origXhrOpen = window.XMLHttpRequest ? XMLHttpRequest.prototype.open : null;
  const origXhrSend = window.XMLHttpRequest ? XMLHttpRequest.prototype.send : null;
  const origFetch = window.fetch ? window.fetch : null;

  function cleanup() {
    if (!isActive) return;
    isActive = false;

    if (autoCleanupTimer) {
      clearTimeout(autoCleanupTimer);
      autoCleanupTimer = null;
    }

    if (window.XMLHttpRequest && origXhrOpen && origXhrSend) {
      XMLHttpRequest.prototype.open = origXhrOpen;
      XMLHttpRequest.prototype.send = origXhrSend;
    }

    if (window.fetch && origFetch) {
      window.fetch = origFetch;
    }

    const scriptTag = document.getElementById('df-link-capture-script');
    if (scriptTag) scriptTag.remove();

    console.log('[DF Toolbox] On-Demand capture cleaned up, prototypes restored');
  }

  let autoCleanupTimer = setTimeout(() => {
    if (!isActive) return;
    cleanup();
    window.postMessage(
      {
        source: SOURCE,
        type: 'CAPTURE_TIMEOUT',
      },
      window.location.origin,
    );
  }, 60000);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'DF_STOP_CAPTURE') {
      cleanup();
    }
  });

  function isDfToolsUrl(url) {
    if (!url) return false;
    return url.includes(DF_TOOLS_HOST) && url.includes(DF_TOOLS_PATH);
  }

  function isAuthLoginUrl(url) {
    if (!url) return false;
    return url.includes('iegg.garena.com') && url.includes('/v2/auth/login');
  }

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
        game_id: p.get('game_id') || '30150',
      };
    } catch {
      return null;
    }
  }

  function getEndpoint(url) {
    try {
      const urlObj = new URL(url, location.origin);
      const parts = urlObj.pathname.split('/');
      return parts[parts.length - 1] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  function postCredential(credential, endpoint) {
    if (!isActive) return;

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

    cleanup();
  }

  if (window.XMLHttpRequest && origXhrOpen && origXhrSend) {
    XMLHttpRequest.prototype.open = function (...args) {
      if (!isActive) return origXhrOpen.apply(this, args);
      this.__dfToolsUrl = args[1];
      return origXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      if (!isActive) return origXhrSend.apply(this, args);

      const url = this.__dfToolsUrl || '';
      if (isDfToolsUrl(url)) {
        const credential = extractCredential(url);
        if (credential) {
          postCredential(credential, getEndpoint(url));
        }
      } else if (isAuthLoginUrl(url)) {
        this.addEventListener('load', function () {
          if (!isActive) return;

          try {
            const data = JSON.parse(this.responseText);
            if (data && data.ret === 0 && data.openid && data.token) {
              postCredential(
                {
                  openid: String(data.openid),
                  token: String(data.token),
                  ts: '0',
                  s: '0',
                  game_id: '30150',
                },
                'AuthLogin',
              );
            }
          } catch {
          }
        });
      }
      return origXhrSend.apply(this, args);
    };
  }

  if (window.fetch && origFetch) {
    window.fetch = async function (...args) {
      if (!isActive) return origFetch.apply(this, args);

      const url = args[0]?.url ?? String(args[0]);
      if (isDfToolsUrl(url)) {
        const credential = extractCredential(url);
        if (credential) {
          postCredential(credential, getEndpoint(url));
        }
      }

      const response = await origFetch.apply(this, args);

      if (!isActive) return response;

      if (isAuthLoginUrl(url)) {
        try {
          const clone = response.clone();
          clone.json().then((data) => {
            if (!isActive) return;
            if (data && data.ret === 0 && data.openid && data.token) {
              postCredential(
                {
                  openid: String(data.openid),
                  token: String(data.token),
                  ts: '0',
                  s: '0',
                  game_id: '30150',
                },
                'AuthLogin',
              );
            }
          }).catch(() => {});
        } catch {
        }
      }
      return response;
    };
  }

  try {
    const entries = window.performance?.getEntriesByType?.('resource') || [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryName = entries[i]?.name || '';
      if (isDfToolsUrl(entryName)) {
        const credential = extractCredential(entryName);
        if (credential) {
          console.log('[DF Toolbox] Captured existing session from performance buffer (0s instant)');
          postCredential(credential, getEndpoint(entryName));
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[DF Toolbox] Performance buffer scan error:', err);
  }
})();
