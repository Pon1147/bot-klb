// eslint-disable-next-line @typescript-eslint/no-explicit-any
export {};

/**
 * Delta Force HQ — Webhook userscript
 *
 * Intercepts GetMyData API call, then POSTs credentials to bot webhook.
 * Không cần clipboard — script tự gửi thẳng về server.
 */

(function (): void {
  var WEBHOOK_URL = '@@WEBHOOK_URL@@';
  var CODE = '@@CLAIM_CODE@@';
  var done = false;

  console.log('%c[DF] Chờ GetMyData...', 'color:#888');
  console.log('%c[DF] Mã claim:', CODE, 'color:#ff0');

  // ─── Intercept fetch ──────────────────────────────────────
  var origFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
    var url = args[0];
    if (typeof url === 'string' && url.indexOf('GetMyData') !== -1 && !done) {
      var params = new URL(url).searchParams;
      var openid = params.get('openid');
      var token = params.get('token');
      if (openid && token) {
        done = true;
        send(openid, token);
      }
    }
    return (origFetch as any).apply(this, args);
  };

  // ─── Hook XHR (fallback) ──────────────────────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    (this as any)._df_url = url;
    return origOpen.apply(this, [method, url, ...rest] as any);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    var url = (this as any)._df_url as string | undefined;
    if (url && url.indexOf('GetMyData') !== -1 && !done) {
      var params = new URL(url).searchParams;
      var openid = params.get('openid');
      var token = params.get('token');
      if (openid && token) {
        done = true;
        send(openid, token);
      }
    }
    return origSend.apply(this, arguments as any);
  };

  // ─── Gửi về webhook ───────────────────────────────────────
  function send(openid: string, token: string): void {
    console.log('%c[DF] ✅ Đã capture credentials', 'color:#0f0');
    try {
      fetch(WEBHOOK_URL + '/api/df/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: CODE, openid: openid, token: token }),
        mode: 'no-cors',
      });
      console.log('%c[DF] ✅ Đã gửi token về bot!', 'color:#0f0');
      console.log('%c[DF] Chờ bot DM xác nhận...', 'color:#ff0');
    } catch (e: any) {
      console.log('%c[DF] ⚠️ Gửi thất bại:', 'color:#f80', e);
      console.log(
        '%c[DF] Hãy dùng /df-link paste thay thế:',
        'color:#f80',
        JSON.stringify({ openid, token }),
      );
    }
  }

  console.log('%c[DF] Nếu đã login → nhấn F5 để trigger API', 'color:#888');
})();
