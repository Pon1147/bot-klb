/**
 * Isolated content script — bridge cho Auth Investigator.
 *
 * Lắng nghe postMessage từ auth-investigator.js (MAIN world)
 * → lưu vào chrome.storage.local
 * → cung cấp API cho popup qua chrome.runtime.sendMessage
 */

(function () {
  'use strict';

  const SOURCE = 'auth-investigator';
  const STORAGE_KEY = 'auth_events';
  const MAX_EVENTS = 200; // giới hạn số events lưu trữ

  console.log('[DF Investigator] Auth investigator content script loaded (isolated world)');

  // ===== Inject MAIN world auth-investigator.js =====
  (function injectAuthInvestigator() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/auth-investigator.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== A. Lắng nghe postMessage từ MAIN world =====
  window.addEventListener('message', (event) => {
    // Security: chỉ accept messages từ cùng origin
    if (event.origin !== window.location.origin) return;
    if (event.source !== window) return;
    if (event.data?.source !== SOURCE) return;

    const eventData = event.data;
    console.log('[DF Investigator] Received event:', eventData.type, 'at', new Date(eventData.timestamp).toISOString());

    saveEvent(eventData);
  });

  // ===== B. Lưu event vào chrome.storage =====
  function saveEvent(eventData) {
    // Check extension context trước khi save (tránh lỗi "Extension context invalidated")
    if (!chrome.runtime?.id) {
      console.warn('[DF Investigator] Extension context invalidated, skipping save');
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const events = result[STORAGE_KEY] || [];

      // Thêm event mới vào đầu mảng
      events.unshift(eventData);

      // Giới hạn số events
      while (events.length > MAX_EVENTS) {
        events.pop();
      }

      chrome.storage.local.set({ [STORAGE_KEY]: events }, () => {
        if (chrome.runtime.lastError) {
          console.error('[DF Investigator] Failed to save event:', chrome.runtime.lastError);
        } else {
          console.log('[DF Investigator] Saved', events.length, 'events to storage');
        }
      });
    });
  }

  // ===== C. Handle messages từ popup =====
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'GET_AUTH_EVENTS') {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        sendResponse({
          ok: true,
          events: result[STORAGE_KEY] || [],
        });
      });
      return true; // async response
    }

    if (msg?.type === 'CLEAR_AUTH_EVENTS') {
      chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    if (msg?.type === 'GET_AUTH_STATS') {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const events = result[STORAGE_KEY] || [];
        const panelState = computePanelState(events);
        sendResponse({ ok: true, panelState, events });
      });
      return true; // async response
    }
  });

  // ===== D. Compute panel state từ events =====
  function computePanelState(events) {
    // Normalize tất cả events
    const normalized = events.map(normalizeEvent);
    const authEvents = normalized.filter((e) => e.isAuth);

    // ===== Overview =====
    const responseEvents = authEvents.filter((e) => e.type.includes('_response'));
    const authResponseEvents = responseEvents.filter(
      (e) => e.auth?.hasAccessToken || e.auth?.hasRefreshToken || e.auth?.hasGarenaSnsOpenid || e.auth?.hasOpenId,
    );

    // ===== Token State =====
    const latestTokenEvent = findLatestTokenEvent(authEvents);
    const tokenState = computeTokenState(latestTokenEvent);

    // ===== Identity Mapping =====
    const identity = computeIdentityMapping(authEvents);

    // ===== Refresh Flow =====
    const refreshFlow = computeRefreshFlow(normalized);

    // ===== Timeline =====
    const timeline = buildTimeline(authEvents);

    // ===== Storage Events =====
    const storageEvents = normalized.filter((e) => e.type === 'auth_storage_write');

    // ===== Domains =====
    const domains = extractUniqueValues(normalized, 'domain');

    return {
      // Overview
      totalEvents: normalized.length,
      authEvents: authEvents.length,
      authResponseEvents: authResponseEvents.length,
      refreshCycles: refreshFlow.requestCount,
      hasChannelInfo: authEvents.some((e) => e.auth?.hasChannelInfo),
      hasAccessToken: authEvents.some((e) => e.auth?.hasAccessToken),
      hasRefreshToken: authEvents.some((e) => e.auth?.hasRefreshToken),
      hasGarenaSnsOpenid: authEvents.some((e) => e.auth?.hasGarenaSnsOpenid),
      hasDfToolsOpenId: authEvents.some((e) => e.auth?.hasOpenId),

      // Token state
      tokenState,

      // Identity mapping
      identity,

      // Refresh flow
      refreshFlow,

      // Timeline
      timeline,

      // Storage
      storageEvents,

      // Domains
      domains: extractUniqueValues(normalized, 'domain'),

      // Legacy compat
      thirdTypes: extractUniqueValues(authEvents, 'thirdType'),
    };
  }

  // ===== D1. Normalize raw event → chuẩn data model =====
  function normalizeEvent(raw) {
    const base = {
      id: raw.requestId || `evt_${raw.timestamp || Date.now()}`,
      timestamp: raw.timestamp || Date.now(),
      type: raw.type || 'unknown',
      isAuth: raw.type?.startsWith('auth_') || false,
    };

    // Network events
    if (raw.type?.includes('_response') || raw.type?.includes('_sent')) {
      return {
        ...base,
        method: raw.method,
        url: raw.url,
        statusCode: raw.statusCode,
        duration: raw.duration,
        auth: {
          hasAccessToken: raw.hasAccessToken || false,
          hasRefreshToken: raw.hasRefreshToken || false,
          hasExpiresIn: raw.hasExpiresIn || false,
          hasGarenaSnsOpenid: raw.hasGarenaSnsOpenid || false,
          hasOpenId: raw.hasOpenId || false,
          hasThirdType: raw.hasThirdType || false,
          thirdType: raw.thirdType || null,
          hasChannelInfo: raw.hasChannelInfo || false,
          channelInfoKeys: raw.channelInfoKeys || null,
          channelInfoHasAccessToken: raw.channelInfoHasAccessToken || false,
          channelInfoHasRefreshToken: raw.channelInfoHasRefreshToken || false,
          isSuccess: raw.isSuccess,
          resultKeys: raw.resultKeys || null,
        },
        identity: {
          garenaOpenIdHash: raw.garenaSnsOpenidHash || null,
          dfToolsOpenIdHash: raw.dfToolsOpenidHash || null,
          channelInfoGarenaOpenIdHash: raw.channelInfoGarenaOpenidHash || null,
          channelInfoDfToolsOpenIdHash: raw.channelInfoOpenIdHash || null,
        },
        refresh: {
          isRequest: false,
          isResponse: false,
          correlatedRequestId: null,
          success: raw.isSuccess,
        },
        dfTools: {
          hasOpenid: raw.hasDfToolsOpenid || false,
          hasToken: raw.hasDfToolsToken || false,
        },
        summary: buildEventSummary(base, raw),
      };
    }

    // Refresh request
    if (raw.type === 'auth_refresh_request') {
      return {
        ...base,
        method: raw.method,
        url: raw.url,
        refresh: {
          isRequest: true,
          isResponse: false,
          hasRefreshTokenInBody: raw.hasRefreshTokenInBody || false,
          bodySummary: raw.bodySummary || null,
        },
        summary: buildEventSummary(base, raw),
      };
    }

    // Storage write
    if (raw.type === 'auth_storage_write') {
      return {
        ...base,
        storage: {
          storageType: raw.storageType || 'unknown',
          key: raw.key || '',
          valueLength: raw.valueLength || 0,
          valuePreview: raw.valuePreview || '',
        },
        summary: buildEventSummary(base, raw),
      };
    }

    // Fallback
    return {
      ...base,
      summary: buildEventSummary(base, raw),
    };
  }

  // ===== D2. Build human-readable summary =====
  function buildEventSummary(base, raw) {
    const parts = [];
    if (base.type === 'auth_refresh_request') {
      parts.push('Refresh request');
    } else if (base.type === 'auth_storage_write') {
      parts.push(`${raw.storageType || 'Storage'} write`);
    } else if (base.type?.includes('fetch_sent')) {
      parts.push(`${raw.method || 'GET'} ${shortenUrl(raw.url)}`);
    } else if (base.type?.includes('xhr_sent')) {
      parts.push(`${raw.method || 'GET'} ${shortenUrl(raw.url)}`);
    } else if (base.type?.includes('fetch_response')) {
      parts.push(`${raw.method || 'GET'} ${shortenUrl(raw.url)} ${raw.statusCode || ''}`);
    } else if (base.type?.includes('xhr_response')) {
      parts.push(`${raw.method || 'GET'} ${shortenUrl(raw.url)} ${raw.statusCode || ''}`);
    } else {
      parts.push(base.type);
    }
    return parts.join(' ');
  }

  function shortenUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 30);
    } catch {
      return url.slice(0, 50);
    }
  }

  // ===== D3. Find latest event with token info =====
  function findLatestTokenEvent(authEvents) {
    let latest = null;
    for (const e of authEvents) {
      if (e.auth && (e.auth.hasAccessToken || e.auth.hasRefreshToken)) {
        if (!latest || e.timestamp > latest.timestamp) {
          latest = e;
        }
      }
    }
    return latest;
  }

  // ===== D4. Compute token state =====
  function computeTokenState(event) {
    if (!event) {
      return {
        accessToken: 'NOT AVAILABLE',
        refreshToken: 'NOT AVAILABLE',
        expiresIn: null,
        lastIssued: null,
        tokenType: null,
      };
    }

    return {
      accessToken: event.auth.hasAccessToken ? 'PRESENT' : 'NOT AVAILABLE',
      refreshToken: event.auth.hasRefreshToken ? 'PRESENT' : 'NOT AVAILABLE',
      expiresIn: event.auth.hasExpiresIn ? event.resultKeys?.includes('expires_in') ? 1296000 : null : null,
      lastIssued: new Date(event.timestamp).toLocaleTimeString('vi-VN'),
      tokenType: 'Bearer',
    };
  }

  // ===== D5. Compute identity mapping =====
  function computeIdentityMapping(authEvents) {
    let garenaHash = null;
    let dfToolsHash = null;
    let channelGarenaHash = null;
    let channelDfToolsHash = null;

    for (const e of authEvents) {
      if (e.identity?.garenaOpenIdHash) garenaHash = e.identity.garenaOpenIdHash;
      if (e.identity?.dfToolsOpenIdHash) dfToolsHash = e.identity.dfToolsOpenIdHash;
      if (e.identity?.channelInfoGarenaOpenIdHash) channelGarenaHash = e.identity.channelInfoGarenaOpenIdHash;
      if (e.identity?.channelInfoDfToolsOpenIdHash) channelDfToolsHash = e.identity.channelInfoDfToolsOpenIdHash;
    }

    // Prefer channel hashes (more specific)
    const finalGarena = channelGarenaHash || garenaHash;
    const finalDfTools = channelDfToolsHash || dfToolsHash;

    let match = 'NOT AVAILABLE';
    if (finalGarena && finalDfTools) {
      match = finalGarena === finalDfTools ? 'MATCH' : 'DIFFERENT';
    } else if (finalGarena || finalDfTools) {
      match = 'INCOMPLETE';
    }

    return {
      garenaHash: finalGarena || '—',
      dfToolsHash: finalDfTools || '—',
      match,
    };
  }

  // ===== D6. Compute refresh flow =====
  function computeRefreshFlow(normalized) {
    const refreshRequests = normalized.filter((e) => e.refresh?.isRequest);
    const refreshResponses = normalized.filter((e) => e.refresh?.isResponse || e.refresh?.correlatedRequestId);

    let requestCount = refreshRequests.length;
    let successCount = 0;
    let failedCount = 0;
    let lastRefreshTime = null;
    let tokenReplacement = 'NOT DETECTED';

    for (const e of refreshResponses) {
      if (e.refresh?.success === true) {
        successCount++;
      } else if (e.refresh?.success === false) {
        failedCount++;
      }
      if (e.timestamp > (lastRefreshTime || 0)) {
        lastRefreshTime = e.timestamp;
      }
    }

    // Determine refresh support status
    const hasRefreshToken = normalized.some(
      (e) => e.auth?.hasRefreshToken || e.refresh?.hasRefreshTokenInBody,
    );
    const hasRefreshRequest = requestCount > 0;
    const hasRefreshSuccess = successCount > 0;

    if (hasRefreshSuccess) {
      tokenReplacement = 'CONFIRMED';
    } else if (hasRefreshRequest) {
      tokenReplacement = 'DETECTED';
    } else if (hasRefreshToken) {
      tokenReplacement = 'NOT YET CONFIRMED';
    } else {
      tokenReplacement = 'NOT DETECTED';
    }

    return {
      requestCount,
      successCount,
      failedCount,
      lastRefreshTime: lastRefreshTime ? new Date(lastRefreshTime).toLocaleTimeString('vi-VN') : null,
      tokenReplacement,
      supported: hasRefreshToken,
    };
  }

  // ===== D7. Build timeline =====
  function buildTimeline(authEvents) {
    // Sort by timestamp
    const sorted = [...authEvents].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map((e) => ({
      timestamp: e.timestamp,
      time: new Date(e.timestamp).toLocaleTimeString('vi-VN'),
      type: e.type,
      summary: e.summary,
      isRefresh: e.refresh?.isRequest || e.refresh?.isResponse,
      isAuthResponse: e.auth !== undefined,
      hasToken: e.auth?.hasAccessToken || e.auth?.hasRefreshToken,
      hasIdentity: e.identity?.garenaOpenIdHash || e.identity?.dfToolsOpenIdHash,
      hasChannelInfo: e.auth?.hasChannelInfo,
    }));
  }

  function extractUniqueValues(events, key) {
    const values = new Set();
    for (const event of events) {
      if (event[key]) values.add(event[key]);
    }
    return Array.from(values);
  }

})();
