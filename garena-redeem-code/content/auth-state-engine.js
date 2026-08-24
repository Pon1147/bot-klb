/**
 * Auth State Engine — MAIN world
 *
 * Central state machine tracking authentication lifecycle.
 * Receives events from auth-investigator interceptors,
 * emits state changes via postMessage.
 *
 * States:
 *   UNKNOWN → ACTIVE → EXPIRING_SOON → EXPIRED → CONFIRMED_EXPIRED
 *                     ↕ REFRESHING
 *   (new fingerprint) → AUTHENTICATING → ACTIVE
 *
 * Discord notifications: AUTH_EXPIRED, AUTH_RESTORED, AUTH_REFRESH_FAILED
 * Only 3 notification types — no raw tokens, no credentials.
 */

(function () {
  'use strict';

  const SOURCE = 'auth-state-engine';
  const STORAGE_KEY = 'auth_state';
  const NOTIF_KEY = 'auth_notifications';
  const MAX_NOTIFICATIONS = 50;

  // ===== State Machine =====
  const AUTH_STATES = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    ACTIVE: 'ACTIVE',
    EXPIRING_SOON: 'EXPIRING_SOON',
    EXPIRED: 'EXPIRED',
    REFRESHING: 'REFRESHING',
    AUTHENTICATING: 'AUTHENTICATING',
    CONFIRMED_EXPIRED: 'CONFIRMED_EXPIRED',
  });

  const NOTIFICATION_TYPES = Object.freeze({
    AUTH_EXPIRED: 'AUTH_EXPIRED',
    AUTH_RESTORED: 'AUTH_RESTORED',
    AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED',
  });

  // Warning threshold: 10 minutes before expiry
  const EXPIRY_WARNING_SECONDS = 600;

  // Rate limit: tối thiểu 5 phút giữa các notifications cùng type per session
  const NOTIF_RATE_LIMIT_MS = 5 * 60 * 1000;
  const lastSentByType = {};

  // Reset rate limit khi session thay đổi
  function resetRateLimitForNewSession() {
    Object.keys(lastSentByType).forEach((k) => delete lastSentByType[k]);
  }

  // ===== Utility =====
  function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function shortId(sessionId) {
    return '#' + (sessionId || '').slice(-4);
  }

  // ===== State persistence =====
  function saveState(state) {
    if (!chrome.runtime?.id) return;
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: state });
    } catch { /* context invalidated */ }
  }

  function loadState() {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        resolve(createInitialState());
        return;
      }
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        resolve(result[STORAGE_KEY] || createInitialState());
      });
    });
  }

  function createInitialState() {
    return {
      sessionId: null,
      state: AUTH_STATES.UNKNOWN,
      fingerprint: null,
      expiresIn: null,
      expiresAt: null,
      hasRefreshToken: false,
      expiredNotified: false,
      lastStateChange: Date.now(),
      lastTokenIssued: null,
    };
  }

  // ===== Notification persistence =====
  function saveNotification(notif) {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(NOTIF_KEY, (result) => {
      const notifs = result[NOTIF_KEY] || [];
      notifs.unshift(notif);
      while (notifs.length > MAX_NOTIFICATIONS) notifs.pop();
      chrome.storage.local.set({ [NOTIF_KEY]: notifs });
    });
  }

  // ===== Emit events to content script =====
  function emit(type, payload) {
    window.postMessage({
      source: SOURCE,
      type,
      ...payload,
      timestamp: Date.now(),
    }, window.location.origin);
  }

  // ===== State transition (with guard for terminal states) =====
  const TERMINAL_STATES = new Set([AUTH_STATES.CONFIRMED_EXPIRED]);

  function transitionTo(newState, extra = {}) {
    // Guard: không transition ra khỏi terminal state (trừ AUTHENTICATING hoặc ACTIVE cho recovery)
    if (TERMINAL_STATES.has(engine.state) && newState !== AUTH_STATES.AUTHENTICATING && newState !== AUTH_STATES.ACTIVE) {
      console.log(`[Auth State Engine] Blocked transition: ${engine.state} -> ${newState}`);
      return;
    }

    const prevState = engine.state;
    if (prevState === newState) {
      // Không emit nếu state không thay đổi
      Object.assign(engine, extra);
      saveState(engine);
      return;
    }

    engine.state = newState;
    engine.lastStateChange = Date.now();
    Object.assign(engine, extra);
    saveState(engine);
    emit('STATE_CHANGE', {
      prevState,
      newState,
      sessionId: engine.sessionId,
      shortSessionId: shortId(engine.sessionId),
    });
  }

  // ===== Check if fingerprint changed =====
  function fingerprintChanged(newFp) {
    return newFp && newFp !== engine.fingerprint;
  }

  // ===== Calculate remaining time =====
  function getRemainingSeconds() {
    if (!engine.expiresAt) return null;
    return Math.max(0, engine.expiresAt - Date.now());
  }

  // ===== Determine if expiring soon =====
  function isExpiringSoon() {
    const remaining = getRemainingSeconds();
    return remaining !== null && remaining > 0 && remaining <= EXPIRY_WARNING_SECONDS;
  }

  // ===== Send Discord notification (with rate limiting) =====
  function sendNotification(type, reason, details) {
    // Rate limit: skip nếu đã gửi notification cùng type trong 5 phút
    const now = Date.now();
    const lastSent = lastSentByType[type];
    if (lastSent && (now - lastSent) < NOTIF_RATE_LIMIT_MS) {
      console.log(`[Auth State Engine] Rate limited: ${type} (sent ${Math.round((now - lastSent) / 1000)}s ago)`);
      return;
    }
    lastSentByType[type] = now;

    saveNotification({
      id: generateSessionId(),
      type,
      reason: reason || type,
      sessionId: engine.sessionId,
      shortSessionId: shortId(engine.sessionId),
      details: details || {},
      timestamp: Date.now(),
      read: false,
    });
    emit('NOTIFICATION', { type, reason, sessionId: engine.sessionId, shortSessionId: shortId(engine.sessionId) });
  }

  // ===== Token fingerprint extraction =====
  function extractFingerprint(event) {
    return event.auth?.accessTokenFingerprint || event.accessTokenFingerprint || null;
  }

  // ===== Handle: New token detected =====
  function onTokenDetected(event) {
    // Skip if we're in REFRESHING state — onRefreshResponse handles it
    if (engine.state === AUTH_STATES.REFRESHING) return;

    const fp = extractFingerprint(event);
    const expiresIn = event.auth?.expiresIn ?? event.expiresIn ?? null;
    const hasRefresh = event.auth?.hasRefreshToken ?? event.hasRefreshToken ?? false;
    const hasToken = event.auth?.hasAccessToken ?? event.hasAccessToken ?? false;

    if (engine.hasRefreshToken !== hasRefresh) {
      engine.hasRefreshToken = hasRefresh;
    }

    // Check if this event has any meaningful token data
    const hasTokenData = fp !== null || (expiresIn != null && expiresIn > 0) || hasToken;
    if (!hasTokenData) return;

    // New session (different fingerprint)
    if (fingerprintChanged(fp)) {
      const wasExpired = [
        AUTH_STATES.EXPIRED,
        AUTH_STATES.CONFIRMED_EXPIRED,
        AUTH_STATES.AUTHENTICATING,
      ].includes(engine.state);

      engine.sessionId = generateSessionId();
      engine.fingerprint = fp;
      engine.expiredNotified = false;
      resetRateLimitForNewSession();

      if (wasExpired) {
        transitionTo(AUTH_STATES.AUTHENTICATING, {
          expiresIn,
          lastTokenIssued: event.timestamp,
        });
        setTimeout(() => {
          if (engine.state === AUTH_STATES.AUTHENTICATING) {
            engine.expiresAt = (event.timestamp || Date.now()) + (expiresIn || 0) * 1000;
            transitionTo(AUTH_STATES.ACTIVE, {
              expiresIn,
              expiresAt: engine.expiresAt,
            });
            // Gửi AUTH_RESTORED vì trước đó user đã bị expired
            sendNotification(NOTIFICATION_TYPES.AUTH_RESTORED, 'SESSION_RESTORED', {
              sessionId: engine.sessionId,
              shortSessionId: shortId(engine.sessionId),
              expiresIn,
            });
          }
        }, 500);
      } else {
        engine.fingerprint = fp;
        engine.expiresAt = (event.timestamp || Date.now()) + (expiresIn || 0) * 1000;
        transitionTo(AUTH_STATES.ACTIVE, {
          expiresIn,
          expiresAt: engine.expiresAt,
          lastTokenIssued: event.timestamp,
        });
      }
      return;
    }

    // Same fingerprint (or no fingerprint) — update expiry/token data
    if (expiresIn != null && expiresIn > 0) {
      const newExpiresAt = (event.timestamp || Date.now()) + expiresIn * 1000;
      const isNewer = !engine.expiresAt || newExpiresAt > engine.expiresAt;

      if (isNewer) {
        engine.fingerprint = fp || engine.fingerprint;
        engine.expiresIn = expiresIn;
        engine.expiresAt = newExpiresAt;
        engine.lastTokenIssued = event.timestamp;

        if (engine.state !== AUTH_STATES.ACTIVE && engine.state !== AUTH_STATES.EXPIRING_SOON) {
          transitionTo(AUTH_STATES.ACTIVE, {
            expiresIn,
            expiresAt: engine.expiresAt,
          });
        } else {
          saveState(engine);
        }
      }
    } else if (hasToken && engine.state === AUTH_STATES.UNKNOWN) {
      // We have a token but no expiry — still mark as active
      engine.fingerprint = fp || engine.fingerprint;
      transitionTo(AUTH_STATES.ACTIVE, {
        lastTokenIssued: event.timestamp,
      });
    }
  }

  // ===== Handle: Refresh request detected =====
  function onRefreshRequest(event) {
    if (
      engine.state === AUTH_STATES.ACTIVE ||
      engine.state === AUTH_STATES.EXPIRING_SOON
    ) {
      transitionTo(AUTH_STATES.REFRESHING, {
        lastStateChange: Date.now(),
      });
    }
  }

  // ===== Handle: Refresh response detected =====
  function onRefreshResponse(event) {
    if (engine.state !== AUTH_STATES.REFRESHING) return;

    const fp = extractFingerprint(event);
    const expiresIn = event.auth?.expiresIn ?? event.expiresIn ?? null;
    const success = event.refresh?.success ?? event.isSuccess ?? null;

    if (success === true || (event.statusCode >= 200 && event.statusCode < 300)) {
      // Refresh succeeded
      if (fingerprintChanged(fp)) {
        // New token after refresh
        engine.sessionId = generateSessionId();
        engine.fingerprint = fp;
        engine.expiredNotified = false;
        resetRateLimitForNewSession();
        engine.expiresAt = (event.timestamp || Date.now()) + (expiresIn || 0) * 1000;
        transitionTo(AUTH_STATES.ACTIVE, {
          expiresIn,
          expiresAt: engine.expiresAt,
          lastTokenIssued: event.timestamp,
        });
      } else {
        // Same token, updated expiry
        engine.expiresIn = expiresIn;
        engine.expiresAt = (event.timestamp || Date.now()) + (expiresIn || 0) * 1000;
        transitionTo(AUTH_STATES.ACTIVE, {
          expiresIn,
          expiresAt: engine.expiresAt,
        });
      }
    } else if (success === false) {
      // Refresh failed
      transitionTo(AUTH_STATES.EXPIRED, {
        expiredNotified: false,
      });
      sendNotification(NOTIFICATION_TYPES.AUTH_REFRESH_FAILED, 'REFRESH_FAILED', {
        sessionId: engine.sessionId,
        statusCode: event.statusCode,
      });
    } else {
      // Unknown response — stay refreshing, will timeout
    }
  }

  // ===== Handle: API response (general) =====
  function onApiResponse(event) {
    const statusCode = event.statusCode;

    // Successful response — confirms active session
    if (statusCode >= 200 && statusCode < 300) {
      if (
        engine.state === AUTH_STATES.EXPIRED ||
        engine.state === AUTH_STATES.CONFIRMED_EXPIRED
      ) {
        // Session recovered without explicit token event
        engine.sessionId = generateSessionId();
        engine.expiredNotified = false;
        resetRateLimitForNewSession();
        transitionTo(AUTH_STATES.ACTIVE, {
          lastStateChange: Date.now(),
        });
        sendNotification(NOTIFICATION_TYPES.AUTH_RESTORED, 'API_RECOVERED', {
          sessionId: engine.sessionId,
          shortSessionId: shortId(engine.sessionId),
        });
      } else if (engine.state === AUTH_STATES.REFRESHING) {
        // API succeeded during refresh — good sign
        transitionTo(AUTH_STATES.ACTIVE, {
          lastStateChange: Date.now(),
        });
      }
      return;
    }

    // 401 — potential token expiration
    if (statusCode === 401) {
      // Check multiple locations for body data (auth-investigator puts data in different places)
      const body = event.body || event.data || event.auth || {};
      const isTokenExpired =
        typeof body === 'object' && (
          body.error === 'TOKEN_EXPIRED' ||
          body.error === 'token_expired' ||
          body.message?.toLowerCase().includes('expired') ||
          body.ret === -1 ||
          body.code === -1
        );

      if (isTokenExpired) {
        if (engine.state === AUTH_STATES.REFRESHING) {
          transitionTo(AUTH_STATES.CONFIRMED_EXPIRED, { expiredNotified: false });
          sendNotification(NOTIFICATION_TYPES.AUTH_REFRESH_FAILED, 'TOKEN_EXPIRED', {
            sessionId: engine.sessionId,
          });
        } else if (engine.state !== AUTH_STATES.CONFIRMED_EXPIRED) {
          transitionTo(AUTH_STATES.CONFIRMED_EXPIRED, { expiredNotified: false });
          sendNotification(NOTIFICATION_TYPES.AUTH_EXPIRED, 'TOKEN_EXPIRED', {
            sessionId: engine.sessionId,
            shortSessionId: shortId(engine.sessionId),
            reason: 'TOKEN_EXPIRED',
          });
        }
      } else if (engine.state !== AUTH_STATES.CONFIRMED_EXPIRED) {
        transitionTo(AUTH_STATES.EXPIRED, { expiredNotified: false });
      }
      return;
    }
  }

  // ===== Handle: 401 response specifically =====
  function onAuthFailure(event) {
    if (event.statusCode !== 401) return;
    if (engine.state === AUTH_STATES.CONFIRMED_EXPIRED) return;

    const body = event.body || event.data || event.auth || {};
    const isTokenExpired =
      typeof body === 'object' && (
        body.error === 'TOKEN_EXPIRED' ||
        body.error === 'token_expired' ||
        body.message?.toLowerCase().includes('expired') ||
        body.ret === -1 ||
        body.code === -1
      );

    if (isTokenExpired) {
      transitionTo(AUTH_STATES.CONFIRMED_EXPIRED, { expiredNotified: false });
      sendNotification(NOTIFICATION_TYPES.AUTH_EXPIRED, 'TOKEN_EXPIRED', {
        sessionId: engine.sessionId,
        shortSessionId: shortId(engine.sessionId),
        reason: 'TOKEN_EXPIRED',
      });
    }
  }

  // ===== Handle: Storage write (auth-related) =====
  function onStorageWrite(event) {
    // Storage writes may indicate token refresh or new login
    // We don't change state based on storage alone — wait for API confirmation
    // But we log it for the investigator
  }

  // ===== Handle: Callback URL (Garena login redirect) =====
  function onCallbackUrl(event) {
    const fp = extractFingerprint(event);
    if (fp) {
      engine.sessionId = generateSessionId();
      engine.fingerprint = fp;
      engine.expiredNotified = false;
      resetRateLimitForNewSession();
      transitionTo(AUTH_STATES.ACTIVE, {
        expiresIn: event.expiresIn ?? null,
        lastTokenIssued: event.timestamp,
      });
    }
  }

  // ===== Periodic expiry check =====
  function checkExpiry() {
    if (
      engine.state !== AUTH_STATES.ACTIVE &&
      engine.state !== AUTH_STATES.EXPIRING_SOON
    ) {
      return;
    }

    const remaining = getRemainingSeconds();

    if (remaining === null) return;

    if (remaining <= 0) {
      // Client-clock based expiry detection
      if (
        engine.state !== AUTH_STATES.EXPIRED &&
        engine.state !== AUTH_STATES.CONFIRMED_EXPIRED
      ) {
        transitionTo(AUTH_STATES.EXPIRED, {
          expiredNotified: false,
        });
        // Don't send notification here — wait for API confirmation
        // The 401 response will trigger the notification
      }
    } else if (remaining <= EXPIRY_WARNING_SECONDS) {
      if (engine.state !== AUTH_STATES.EXPIRING_SOON) {
        transitionTo(AUTH_STATES.EXPIRING_SOON);
      }
    }
  }

  // ===== Main event handler =====
  function handleEvent(event) {
    switch (event.type) {
      case 'TOKEN_DETECTED':
      case 'auth_callback_garena_token':
        onTokenDetected(event);
        break;

      case 'auth_xhr_response':
      case 'auth_fetch_response':
        // These events can be: token detection + refresh response + API response
        onTokenDetected(event);
        if (event.isRefreshResponse || event.correlatedRefreshRequest) {
          onRefreshResponse(event);
        }
        if (event.statusCode) {
          onApiResponse(event);
        }
        break;

      case 'auth_callback_garena':
        onTokenDetected(event);
        onCallbackUrl(event);
        break;

      case 'auth_refresh_request':
        onRefreshRequest(event);
        break;

      case 'auth_refresh_response':
        onRefreshResponse(event);
        if (event.statusCode) {
          onApiResponse(event);
        }
        break;

      case 'auth_api_response':
        onApiResponse(event);
        break;

      case 'auth_401':
        onAuthFailure(event);
        break;

      case 'auth_storage_write':
        onStorageWrite(event);
        break;

      default:
        break;
    }
  }

  // ===== Listen for events from auth-investigator =====
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== window) return;
    if (event.data?.source !== 'auth-investigator') return;

    handleEvent(event.data);
  });

  // ===== Periodic expiry check (every 30s) =====
  setInterval(checkExpiry, 30000);

  // ===== Initial state load =====
  loadState().then((state) => {
    engine = state;
    // If we have an active state with expiry, verify it
    if (engine.state === AUTH_STATES.ACTIVE && engine.expiresAt) {
      const remaining = engine.expiresAt - Date.now();
      if (remaining <= 0) {
        transitionTo(AUTH_STATES.EXPIRED);
      } else if (remaining <= EXPIRY_WARNING_SECONDS) {
        transitionTo(AUTH_STATES.EXPIRING_SOON);
      }
    }
  });

  // ===== Public API for debugging =====
  window.__authStateEngine = {
    getState: () => ({ ...engine }),
    getNotifications: () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(NOTIF_KEY, (result) => {
          resolve(result[NOTIF_KEY] || []);
        });
      });
    },
    clearNotifications: () => {
      chrome.storage.local.set({ [NOTIF_KEY]: [] });
    },
    AUTH_STATES,
    NOTIFICATION_TYPES,
  };

  // ===== Engine state object =====
  let engine = createInitialState();

  console.log('[Auth State Engine] Initialized');
})();
