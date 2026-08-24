/**
 * MAIN world — Auth Investigator v2.
 *
 * Cải tiến so với v1:
 * 1. Inject ngay khi content script chạy (không delay)
 * 2. URL-agnostic: intercept TẤT CẢ XHR/fetch, parse response body
 * 3. Hash OpenID để xác định identity mapping
 * 4. Theo dõi refresh request/response theo timeline
 * 5. Monitor localStorage/sessionStorage cho auth data
 */

(function () {
  'use strict';

  const SOURCE = 'auth-investigator';
  const EVENT_CHAIN_KEY = 'auth_event_chain';

  // ===== Utility: tóm tắt giá trị =====
  function summarizeValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
      if (value.length > 50) return `<string:${value.length}chars>`;
      return value;
    }
    if (typeof value === 'number') return `<number:${value}>`;
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `<array:${value.length}items>`;
    if (typeof value === 'object') {
      try {
        return `<obj:${Object.keys(value).join(',')}>`;
      } catch {
        return '<obj>';
      }
    }
    return `<${typeof value}>`;
  }

  // ===== A. Intercept TẤT CẢ XHR (không phụ thuộc URL keyword) =====
  function setupXHRInterceptor() {
    if (!window.XMLHttpRequest) return;

    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;

    // Track request timing
    const activeRequests = new Map();

    XMLHttpRequest.prototype.open = function (...args) {
      this.__authUrl = args[1];
      this.__authMethod = args[0] || 'GET';
      return origXhrOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this.__authUrl || '';
      const method = this.__authMethod || 'GET';
      const requestId = `xhr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Parse request body cho refresh detection
      let requestBody = null;
      const body = args[0];
      if (body && typeof body === 'string') {
        try { requestBody = JSON.parse(body); } catch { /* not JSON — try form-encoded */ }
        if (!requestBody) {
          try { requestBody = Object.fromEntries(new URLSearchParams(body)); } catch { /* ignore */ }
        }
      }

      // Lưu request info cho timing + correlation
      activeRequests.set(requestId, {
        type: 'xhr',
        url,
        method,
        startTime: Date.now(),
        requestBody,
      });

      // Detect refresh request
      const isRefresh = isRefreshRequest(method, url, requestBody);
      if (isRefresh) {
        postRefreshRequestEvent(requestId, url, method, requestBody);
      }

      const onload = async () => {
        try {
          const reqInfo = activeRequests.get(requestId);
          if (reqInfo) {
            reqInfo.endTime = Date.now();
            reqInfo.duration = reqInfo.endTime - reqInfo.startTime;
            reqInfo.statusCode = this.status;
          }

          // Parse response body
          if (typeof this.responseText === 'string' && this.responseText.trim()) {
            let parsed;
            try {
              parsed = JSON.parse(this.responseText);
            } catch {
              parsed = null;
            }

            if (parsed) {
              const event = await createAuthEvent('auth_xhr_response', requestId, url, method, parsed);
              // Correlate với refresh request — truyền requestId
              if (isRefresh) {
                event.isRefreshResponse = true;
                event.correlatedRefreshRequest = true;
                event.refreshRequestId = requestId;
              }
              postEvent(event);
            }
          } else if (this.status >= 300 && this.status < 400) {
            // Redirect response — parse URL params cho OpenID
            const redirectEvent = await createAuthEvent('auth_xhr_redirect', requestId, url, method, null);
            redirectEvent.statusCode = this.status;
            redirectEvent.isRedirect = true;
            postEvent(redirectEvent);
          }

          activeRequests.delete(requestId);
        } catch {
          /* ignore */
        }
      };

      this.addEventListener('load', onload, { once: true });

      return origXhrSend.apply(this, args);
    };
  }

  // ===== B. Intercept TẤT CẢ fetch (không phụ thuộc URL keyword) =====
  function setupFetchInterceptor() {
    if (!window.fetch) return;

    const originalFetch = window.fetch;
    const activeRequests = new Map();

    window.fetch = async function (...args) {
      const input = args[0];
      const init = args[1] || {};

      // Fix: extract URL và method đúng cách
      const url =
        typeof input === 'string'
          ? input
          : input?.url || '';
      const method =
        init.method ||
        (typeof input !== 'string' ? input?.method : undefined) ||
        'GET';
      const body =
        init.body ||
        (typeof input !== 'string' ? input?.body : undefined);

      // Parse request body cho refresh detection
      let requestBody = null;
      if (body && typeof body === 'string') {
        try { requestBody = JSON.parse(body); } catch { /* not JSON — try form-encoded */ }
        if (!requestBody) {
          try { requestBody = Object.fromEntries(new URLSearchParams(body)); } catch { /* ignore */ }
        }
      }

      const requestId = `fetch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Log request
      activeRequests.set(requestId, {
        type: 'fetch',
        url,
        method,
        startTime: Date.now(),
        requestBody,
      });

      // Detect refresh request
      const isRefresh = isRefreshRequest(method, url, requestBody);
      if (isRefresh) {
        postRefreshRequestEvent(requestId, url, method, requestBody);
      }

      postEvent(await createAuthEvent('auth_fetch_sent', requestId, url, method, null));

      try {
        const response = await originalFetch.apply(this, args);

        // Clone response để đọc body
        const clone = response.clone();
        const text = await clone.text();

        try {
          const jsonData = JSON.parse(text);
          const reqInfo = activeRequests.get(requestId);
          if (reqInfo) {
            reqInfo.endTime = Date.now();
            reqInfo.duration = reqInfo.endTime - reqInfo.startTime;
            reqInfo.statusCode = response.status;
          }

          const event = await createAuthEvent('auth_fetch_response', requestId, url, method, jsonData);
          // Correlate với refresh request — truyền requestId
          if (isRefresh) {
            event.isRefreshResponse = true;
            event.correlatedRefreshRequest = true;
            event.refreshRequestId = requestId;
          }
          postEvent(event);
        } catch {
          // Không phải JSON — kiểm tra redirect
          if (response.status >= 300 && response.status < 400) {
            const redirectEvent = await createAuthEvent('auth_fetch_redirect', requestId, url, method, null);
            redirectEvent.statusCode = response.status;
            redirectEvent.isRedirect = true;
            postEvent(redirectEvent);
          }
        }

        // Trả response gốc lại cho page
        return response;
      } catch (err) {
        const reqInfo = activeRequests.get(requestId);
        if (reqInfo) {
          reqInfo.error = err?.message?.slice(0, 100);
        }
        activeRequests.delete(requestId);
        throw err;
      }
    };
  }

  // ===== C. Detect refresh request (scoring-based) =====
  function isRefreshRequest(method, url, body) {
    if (method !== 'POST') return false;
    const lowerUrl = (url || '').toLowerCase();
    let score = 0;

    // URL tín hiệu: /auth/refresh, /token/refresh, ...
    if (lowerUrl.includes('/refresh') || lowerUrl.includes('/token/refresh')) {
      score += 2;
    } else if (lowerUrl.includes('refresh')) {
      score += 1;
    }

    // JSON body tín hiệu mạnh
    if (body && typeof body === 'object') {
      if ('refresh_token' in body) score += 3;
      if ('refreshToken' in body) score += 3;
      if (body.grant_type === 'refresh_token') score += 3;
    }

    // Form-encoded body
    if (body && typeof body === 'string') {
      const lowerBody = body.toLowerCase();
      if (lowerBody.includes('refresh_token') || lowerBody.includes('refreshToken')) score += 3;
      if (lowerBody.includes('grant_type=refresh_token')) score += 3;
    }

    return score >= 3; // cần ít nhất 1 body signal hoặc 2 URL signals
  }

  // ===== C1. Tạo event cho refresh request =====
  function postRefreshRequestEvent(requestId, url, method, body) {
    postEvent({
      type: 'auth_refresh_request',
      requestId,
      url: url?.slice(0, 200),
      method,
      timestamp: Date.now(),
      bodySummary: summarizeValue(body),
    });
  }

  // ===== D. Tạo auth event từ parsed JSON =====
  async function createAuthEvent(type, requestId, url, method, data) {
    if (!data || typeof data !== 'object') {
      const event = {
        type: `${type}_no_data`,
        requestId,
        url: url?.slice(0, 200),
        method,
        timestamp: Date.now(),
        hasAccessToken: false,
        hasRefreshToken: false,
        hasGarenaSnsOpenid: false,
        hasOpenId: false,
        hasDfToolsOpenid: false,
        hasDfToolsToken: false,
      };

      // Parse URL params cho redirect events (Garena login callback)
      try {
        const urlObj = new URL(url, location.origin);
        for (const [key, value] of urlObj.searchParams) {
          if (key === 'garena_sns_openid' && value) {
            event.hasGarenaSnsOpenid = true;
            event.urlGarenaOpenidHash = await hashValue(value);
          }
          if (key === 'openid' && value) {
            event.hasDfToolsOpenid = true;
            event.urlDfToolsOpenidHash = await hashValue(value);
          }
        }
      } catch {
        /* ignore */
      }

      return event;
    }

    const event = {
      type,
      requestId,
      url: url?.slice(0, 200),
      method,
      timestamp: Date.now(),
      // Auth fields presence
      hasAccessToken: 'access_token' in data,
      hasRefreshToken: 'refresh_token' in data,
      expiresIn: data.expires_in ?? null,
      hasGarenaSnsOpenid: 'garena_sns_openid' in data,
      hasOpenId: 'open_id' in data,
      hasThirdType: 'third_type' in data,
      thirdType: data.third_type || null,
      // Hashed values (không lưu raw data) — hash async sau
      accessTokenFingerprint: null,
      garenaSnsOpenidHash: null,
      dfToolsOpenidHash: null,
      urlGarenaOpenidHash: null,
      urlDfToolsOpenidHash: null,
      // Channel info detection
      hasChannelInfo: 'channel_info' in data,
      channelInfoKeys: null,
      channelInfoHasAccessToken: false,
      channelInfoHasRefreshToken: false,
      // DfTools credential detection (openid+token trong URL params)
      hasDfToolsOpenid: false,
      hasDfToolsToken: false,
      // Result/status detection
      isSuccess: data.ret === 0 || data.code === 0 || data.success === true,
      resultKeys: Object.keys(data),
    };

    // Parse channel_info
    if (data.channel_info && typeof data.channel_info === 'object') {
      event.channelInfoKeys = Object.keys(data.channel_info);
      event.channelInfoHasAccessToken = 'access_token' in data.channel_info;
      event.channelInfoHasRefreshToken = 'refresh_token' in data.channel_info;
      // Also check for token/openid/expires_in in channel_info
      if ('token' in data.channel_info) event.hasAccessToken = true;
      if ('token' in data.channel_info) event.accessTokenFingerprint = await hashValue(data.channel_info.token);
      if ('refresh_token' in data.channel_info) event.hasRefreshToken = true;
      if ('expires_in' in data.channel_info) event.expiresIn = data.channel_info.expires_in;
      if ('expiresIn' in data.channel_info) event.expiresIn = data.channel_info.expiresIn;
      if ('openid' in data.channel_info) {
        event.hasOpenId = true;
        event.dfToolsOpenidHash = await hashValue(data.channel_info.openid);
      }
      if ('garena_sns_openid' in data.channel_info) {
        event.hasGarenaSnsOpenid = true;
        event.garenaSnsOpenidHash = await hashValue(data.channel_info.garena_sns_openid);
      }
    }

    // Parse URL params cho DfTools + Garena credentials
    try {
      const urlObj = new URL(url, location.origin);
      for (const [key, value] of urlObj.searchParams) {
        if (key === 'openid' && value) {
          event.hasDfToolsOpenid = true;
          event.urlDfToolsOpenidHash = await hashValue(value);
        }
        if (key === 'garena_sns_openid' && value) {
          event.hasGarenaSnsOpenid = true;
          event.urlGarenaOpenidHash = await hashValue(value);
        }
        if (key === 'token') event.hasDfToolsToken = true;
      }
    } catch {
      /* ignore */
    }

    // Hash OpenID trước khi return để đảm bảo data đầy đủ
    await enrichWithHashes(event, data);

    return event;
  }

  // ===== D1. Async hash values (access_token, OpenID) =====
  async function enrichWithHashes(event, data) {
    // Token fingerprint (hash toàn bộ access_token, không lưu raw)
    if (data.access_token) {
      event.accessTokenFingerprint = await hashValue(data.access_token);
    }
    if (data.garena_sns_openid) {
      event.garenaSnsOpenidHash = await hashValue(data.garena_sns_openid);
    }
    if (data.open_id) {
      event.dfToolsOpenidHash = await hashValue(data.open_id);
    }
    if (data.channel_info && typeof data.channel_info === 'object') {
      if (data.channel_info.garena_sns_openid) {
        event.channelInfoGarenaOpenidHash = await hashValue(data.channel_info.garena_sns_openid);
      }
      if (data.channel_info.open_id) {
        event.channelInfoOpenIdHash = await hashValue(data.channel_info.open_id);
      }
    }
  }

  // ===== E. Hash value (SHA-256, không lưu giá trị thật) =====
  async function hashValue(value) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(String(value));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return 'hash_err';
    }
  }

  // ===== F. Monitor storage writes (localStorage, sessionStorage) =====
  function setupStorageMonitor() {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (isAuthRelatedKey(key)) {
        const storageType = this === window.localStorage ? 'localStorage' : 'sessionStorage';
        postEvent({
          type: 'auth_storage_write',
          storageType,
          key,
          valueLength: value?.length || 0,
          valuePreview: value?.slice(0, 20) || '',
          timestamp: Date.now(),
        });
      }
      return origSetItem.call(this, key, value);
    };
  }

  function isAuthRelatedKey(key) {
    if (!key) return false;
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('token') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('session') ||
      lowerKey.includes('openid') ||
      lowerKey.includes('garena') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('login') ||
      lowerKey.includes('refresh')
    );
  }

  // ===== G. Post event lên content script =====
  function postEvent(eventData) {
    window.postMessage(
      {
        source: SOURCE,
        ...eventData,
      },
      window.location.origin,
    );
  }

  // ===== H. Bootstrap — chạy NGAY, không delay =====
  function bootstrap() {
    console.log('[DF Investigator v2] Starting immediately...');

    // Parse callback URL params (Garena login redirect)
    parseCallbackUrl();

    setupXHRInterceptor();
    setupFetchInterceptor();
    setupStorageMonitor();

    console.log('[DF Investigator v2] Ready — intercepting all XHR/fetch/storage');
  }

  // ===== Parse Garena login callback URL =====
  function parseCallbackUrl() {
    try {
      const urlObj = new URL(window.location.href);
      const garenaOpenid = urlObj.searchParams.get('garena_sns_openid');
      const garenaToken = urlObj.searchParams.get('token');

      if (garenaOpenid) {
        hashValue(garenaOpenid).then(hash => {
          postEvent({
            type: 'auth_callback_garena',
            timestamp: Date.now(),
            hasGarenaSnsOpenid: true,
            garenaSnsOpenidHash: hash,
            urlGarenaOpenidHash: hash,
          });
        });
      }
      if (garenaToken) {
        hashValue(garenaToken).then(hash => {
          postEvent({
            type: 'auth_callback_garena_token',
            timestamp: Date.now(),
            hasAccessToken: true,
            accessTokenFingerprint: hash,
          });
        });
      }
    } catch {
      /* ignore */
    }
  }

  // Chạy ngay khi script được inject
  bootstrap();

})();
