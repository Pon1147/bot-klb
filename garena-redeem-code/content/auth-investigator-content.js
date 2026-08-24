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
  const AUTH_STATE_KEY = 'auth_state';
  const AUTH_NOTIF_KEY = 'auth_notifications';
  const MAX_NOTIFICATIONS = 50;

  console.log('[DF Investigator] Auth investigator content script loaded (isolated world)');

  // ===== Inject MAIN world auth-utils.js (shared) =====
  (function injectAuthUtils() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/auth-utils.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== Inject MAIN world auth-investigator.js =====
  (function injectAuthInvestigator() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/auth-investigator.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== Inject MAIN world auth-state-engine.js =====
  (function injectAuthStateEngine() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/auth-state-engine.js');
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

    if (msg?.type === 'GET_AUTH_STATE') {
      chrome.storage.local.get(AUTH_STATE_KEY, (result) => {
        sendResponse({
          ok: true,
          state: result[AUTH_STATE_KEY] || null,
        });
      });
      return true; // async response
    }

    if (msg?.type === 'GET_AUTH_NOTIFICATIONS') {
      chrome.storage.local.get(AUTH_NOTIF_KEY, (result) => {
        sendResponse({
          ok: true,
          notifications: result[AUTH_NOTIF_KEY] || [],
        });
      });
      return true; // async response
    }

    if (msg?.type === 'CLEAR_AUTH_NOTIFICATIONS') {
      chrome.storage.local.set({ [AUTH_NOTIF_KEY]: [] }, () => {
        sendResponse({ ok: true });
      });
      return true; // async response
    }

    if (msg?.type === 'MARK_NOTIF_READ') {
      // Đọc storage → tìm notification → đánh dấu read → lưu lại
      chrome.storage.local.get(AUTH_NOTIF_KEY, (result) => {
        const notifs = result[AUTH_NOTIF_KEY] || [];
        const idx = notifs.findIndex((n) => n.id === msg.notifId);
        if (idx === -1) {
          sendResponse({ ok: false, error: 'not found' });
          return;
        }
        notifs[idx].read = true;
        chrome.storage.local.set({ [AUTH_NOTIF_KEY]: notifs }, () => {
          sendResponse({ ok: true });
        });
      });
      return true; // async response
    }
  });

  // ===== E. Lắng nghe postMessage từ auth-state-engine =====
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== window) return;
    if (event.data?.source !== 'auth-state-engine') return;

    const data = event.data;
    console.log('[Auth State Engine] Received:', data.type, 'at', new Date(data.timestamp).toISOString());

    if (data.type === 'STATE_CHANGE') {
      // State change — persist to storage
      chrome.storage.local.get(AUTH_STATE_KEY, (result) => {
        const state = result[AUTH_STATE_KEY] || {};
        Object.assign(state, {
          sessionId: data.sessionId,
          state: data.newState,
          prevState: data.prevState,
          lastStateChange: data.timestamp,
        });
        chrome.storage.local.set({ [AUTH_STATE_KEY]: state });
      });
      // Also save as event for timeline
      saveEvent({
        type: 'auth_state_change',
        prevState: data.prevState,
        newState: data.newState,
        sessionId: data.sessionId,
        timestamp: data.timestamp,
      });
    }

    if (data.type === 'NOTIFICATION') {
      // New notification — persist to storage
      chrome.storage.local.get(AUTH_NOTIF_KEY, (result) => {
        const notifs = result[AUTH_NOTIF_KEY] || [];
        notifs.unshift({
          id: data.id || `notif_${Date.now()}`,
          type: data.type,
          reason: data.reason,
          sessionId: data.sessionId,
          shortSessionId: data.shortSessionId,
          timestamp: data.timestamp,
          read: false,
        });
        while (notifs.length > MAX_NOTIFICATIONS) notifs.pop();
        chrome.storage.local.set({ [AUTH_NOTIF_KEY]: notifs });
      });
      // Send Discord notification
      sendDiscordNotification(data);
    }
  });

  // ===== Send Discord notification via service worker =====
  function sendDiscordNotification(notif) {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({
      type: 'AUTH_NOTIFICATION',
      notification: notif,
    }).catch(() => {
      console.warn('[Auth State Engine] Failed to send Discord notification');
    });
  }

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
    const tokenState = AuthUtils.computeTokenState(latestTokenEvent);

    // ===== Identity Mapping =====
    const identity = AuthUtils.computeIdentityMapping(authEvents);

    // ===== Refresh Flow =====
    const refreshFlow = AuthUtils.computeRefreshFlow(normalized);

    // ===== Refresh Correlation =====
    const correlatedRefreshPairs = AuthUtils.buildRefreshCorrelation(normalized);

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

      // Refresh correlation
      correlatedRefreshPairs,

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
          expiresIn: raw.expiresIn ?? null,
          accessTokenFingerprint: raw.accessTokenFingerprint || null,
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
          garenaOpenIdHash: raw.garenaSnsOpenidHash || raw.urlGarenaOpenidHash || null,
          dfToolsOpenIdHash: raw.dfToolsOpenidHash || raw.urlDfToolsOpenidHash || null,
          channelInfoGarenaOpenIdHash: raw.channelInfoGarenaOpenidHash || null,
          channelInfoDfToolsOpenIdHash: raw.channelInfoOpenIdHash || null,
        },
        refresh: {
          isRequest: false,
          isResponse: false,
          requestId: raw.requestId || null,
          correlatedRequestId: raw.correlatedRefreshRequest ? raw.requestId : null,
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
          requestId: raw.requestId || null,
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

  // ===== D4-D8: Delegate to AuthUtils =====
  // computeTokenState, computeIdentityMapping, computeRefreshFlow, buildRefreshCorrelation

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

  // ===== D8. Correlate refresh request/response by requestId =====
  function buildRefreshCorrelation(normalized) {
    const requests = normalized.filter((e) => e.refresh?.isRequest);
    const responses = normalized.filter((e) => e.refresh?.isResponse);

    const pairs = [];
    for (const req of requests) {
      const reqId = req.refresh?.requestId;
      if (!reqId) continue;
      const matchingResponse = responses.find(
        (r) => r.refresh?.requestId === reqId || r.refresh?.correlatedRequestId === reqId,
      );

      // Token events within this refresh cycle
      const cycleStart = req.timestamp;
      const cycleEnd = matchingResponse?.timestamp || Date.now();
      const cycleTokenEvents = normalized.filter((e) =>
        e.auth?.hasAccessToken && e.timestamp >= cycleStart && e.timestamp <= cycleEnd,
      );

      let tokenChanged = false;
      let expiryChanged = null;
      if (cycleTokenEvents.length >= 2) {
        const sorted = [...cycleTokenEvents].sort((a, b) => a.timestamp - b.timestamp);
        const last = sorted[sorted.length - 1];
        const prev = sorted[sorted.length - 2];
        tokenChanged = last.auth.accessTokenFingerprint !== prev.auth.accessTokenFingerprint;
        expiryChanged = (last.auth.expiresIn ?? null) !== (prev.auth.expiresIn ?? null);
      }

      pairs.push({
        requestId: reqId,
        requestTime: req.timestamp,
        requestTimeFormatted: new Date(req.timestamp).toLocaleTimeString('vi-VN'),
        requestUrl: req.url || '',
        responseTime: matchingResponse?.timestamp || null,
        responseTimeFormatted: matchingResponse ? new Date(matchingResponse.timestamp).toLocaleTimeString('vi-VN') : null,
        responseStatus: matchingResponse?.statusCode || null,
        duration: matchingResponse ? matchingResponse.timestamp - req.timestamp : null,
        hasResponse: !!matchingResponse,
        success: matchingResponse?.refresh?.success,
        // Per-cycle evidence
        tokenChanged,
        expiryChanged: expiryChanged ?? null,
        cycleFpBefore: cycleTokenEvents.length >= 2
          ? cycleTokenEvents[0].auth.accessTokenFingerprint
          : null,
        cycleFpAfter: cycleTokenEvents.length >= 2
          ? cycleTokenEvents[cycleTokenEvents.length - 1].auth.accessTokenFingerprint
          : null,
        cycleExpiryBefore: cycleTokenEvents.length >= 2
          ? cycleTokenEvents[0].auth.expiresIn
          : null,
        cycleExpiryAfter: cycleTokenEvents.length >= 2
          ? cycleTokenEvents[cycleTokenEvents.length - 1].auth.expiresIn
          : null,
      });
    }
    return pairs;
  }

})();
