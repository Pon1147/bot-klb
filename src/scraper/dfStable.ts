/**
 * Delta Force HQ – Browser Userscript
 *
 * Chạy trong console của trang HQ để:
 *  1. Lấy Daily Passwords từ DOM
 *  2. Intercept GetMyData API → extract openid + token
 *  3. Tự động copy credentials vào clipboard
 *
 * Usage:
 *   - Paste toàn bộ file vào DevTools Console → Enter
 *   - Hoặc dùng /df-link get-script → copy nội dung → paste vào console
 */

interface DailyPasswords {
  'Đập Nước Zero': string | undefined;
  'Thung lũng Layali': string | undefined;
  'Phố Cổ Brakkesh': string | undefined;
  'Trạm Không Gian': string | undefined;
  'Ngục Giam Thủy Triều': string | undefined;
}

interface DfCredentials {
  openid: string;
  token: string;
}

(function (): void {
  console.clear();
  console.log('%c[DF] Đã khởi động – chờ intercept DfTools API...', 'color:#0f0; font-weight:bold');

  // ─── 1. Daily Passwords ──────────────────────────────────────
  function getDailyPasswords(): DailyPasswords {
    const text = document.body.innerText;

    const passwords: DailyPasswords = {
      'Đập Nước Zero': (text.match(/Đập Nước Zero\s*(\d+)/) || [])[1],
      'Thung lũng Layali': (text.match(/Thung lũng Layali\s*(\d+)/) || [])[1],
      'Phố Cổ Brakkesh': (text.match(/Phố Cổ Brakkesh\s*(\d+)/) || [])[1],
      'Trạm Không Gian': (text.match(/Trạm Không Gian\s*(\d+)/) || [])[1],
      'Ngục Giam Thủy Triều': (text.match(/Ngục Giam Thủy Triều\s*(\d+)/) || [])[1],
    };

    console.log('%c[DF] Daily Passwords:', 'color:#ffeb3b');
    console.table(passwords);
    return passwords;
  }

  getDailyPasswords();

  // ─── 2. Intercept GetMyData → extract credentials ──────────
  const origFetch = window.fetch;
  let capturedCredentials: DfCredentials | null = null;

  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const url = args[0] as string;

    if (url.includes('DfTools') && !capturedCredentials) {
      const params = new URL(url).searchParams;
      const openid = params.get('openid');
      const token = params.get('token');
      const endpoint = url.split('/').pop() || 'unknown';

      if (openid && token) {
        capturedCredentials = { openid, token };
        console.log('%c[DF] ✅ Đã capture từ ' + endpoint + ':', 'color:#0f0', capturedCredentials);
        console.log(
          '%c[DF] token_len=' +
            token.length +
            ', ts=' +
            params.get('ts') +
            ', s=' +
            params.get('s'),
          'color:#888',
        );

        // Copy JSON vào clipboard
        const json = JSON.stringify(capturedCredentials, null, 2);
        try {
          await navigator.clipboard.writeText(json);
          console.log('%c[DF] ✅ Đã copy vào clipboard!', 'color:#0f0');
          console.log('%c[DF] Dán vào Discord: /df-link paste', 'color:#ff0');
        } catch {
          console.log('%c[DF] ⚠️ Không thể auto-copy. Hãy copy manually:', 'color:#f80', json);
        }
      }
    }

    return origFetch.apply(this, args);
  };

  // ─── 3. Hook XHR (fallback) ─────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ): void {
    (this as any)._method = method;
    (this as any)._url = url;
    return origOpen.apply(this, arguments as any);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    const url = (this as any)._url as string;

    if (url && url.includes('DfTools') && !capturedCredentials) {
      const params = new URL(url).searchParams;
      const openid = params.get('openid');
      const token = params.get('token');

      if (openid && token) {
        capturedCredentials = { openid, token };
        console.log('%c[DF] ✅ Đã capture (XHR):', 'color:#0f0', capturedCredentials);

        const json = JSON.stringify(capturedCredentials, null, 2);
        try {
          navigator.clipboard.writeText(json);
          console.log('%c[DF] ✅ Đã copy vào clipboard!', 'color:#0f0');
        } catch {
          console.log('%c[DF] ⚠️ Copy manually:', 'color:#f80', json);
        }
      }
    }

    return origSend.apply(this, arguments as any);
  };

  console.log('%c[DF] Chờ trang gọi DfTools API...', 'color:#888');
  console.log('%c[DF] Nếu đã login → nhấn vài nút trên trang để trigger API', 'color:#888');
})();
