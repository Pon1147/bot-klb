/**
 * Shared auth utilities — dùng chung cho popup.js và auth-investigator-content.js
 * Không phụ thuộc chrome.runtime, chạy được ở cả popup và content script context.
 */

(function () {
  'use strict';

  // ===== State config (dùng chung cho UI banner) =====
  window.AUTH_STATE_CONFIG = {
    UNKNOWN: { icon: '\u{1F512}', dotClass: '', color: 'var(--text-muted)' },
    ACTIVE: { icon: '\u{1F7E2}', dotClass: 'ready', color: 'var(--success)' },
    EXPIRING_SOON: { icon: '\u{1F7E1}', dotClass: 'running', color: 'var(--warning)' },
    EXPIRED: { icon: '\u{1F534}', dotClass: '', color: 'var(--danger)' },
    CONFIRMED_EXPIRED: { icon: '\u{1F534}', dotClass: '', color: 'var(--danger)' },
    REFRESHING: { icon: '\u{1F504}', dotClass: 'paused', color: 'var(--info)' },
    AUTHENTICATING: { icon: '\u{1F7E3}', dotClass: '', color: '#a78bfa' },
  };

  // ===== Notification config (dùng chung cho UI) =====
  window.NOTIF_CONFIG = {
    AUTH_EXPIRED: { icon: '\u{1F534}', label: 'Auth Expired', typeClass: 'auth-expired' },
    AUTH_RESTORED: { icon: '\u{1F7E2}', label: 'Auth Restored', typeClass: 'auth-restore' },
    AUTH_REFRESH_FAILED: { icon: '\u{1F7E1}', label: 'Refresh Failed', typeClass: 'auth-refresh-failed' },
    UNKNOWN: { icon: '\u{26AA}', label: 'Notification', typeClass: '' },
  };

  // ===== Token lifecycle helpers =====
  function formatRemaining(seconds) {
    if (seconds <= 0) return 'EXPIRED';
    const totalMinutes = Math.floor(seconds / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(days + 'd');
    if (hours > 0) parts.push(hours + 'h');
    if (mins > 0 || parts.length === 0) parts.push(mins + 'm');
    return parts.join(' ');
  }

  function formatLifetime(seconds) {
    if (!seconds) return '--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + mins + 'm';
    return mins + 'm';
  }

  // ===== Get timestamp từ normalized hoặc raw event =====
  function getTimestamp(e) {
    if (e.timestamp && typeof e.timestamp === 'number') return e.timestamp;
    return Date.now();
  }

  // ===== Extract auth fields từ event (handle cả normalized và raw format) =====
  // Prefer event.auth if it has meaningful data, fallback to event-level fields
  function getAuth(event) {
    if (event.auth && typeof event.auth === 'object' && Object.keys(event.auth).length > 0) {
      return event.auth;
    }
    return event;
  }

  // Direct accessors that check both normalized and raw formats
  function hasAccessToken(event) {
    return event.auth?.hasAccessToken === true || event.hasAccessToken === true;
  }

  function hasRefreshToken(event) {
    return event.auth?.hasRefreshToken === true || event.hasRefreshToken === true;
  }

  function getExpiresIn(event) {
    return event.auth?.expiresIn ?? event.expiresIn ?? null;
  }

  function getAccessTokenFingerprint(event) {
    return event.auth?.accessTokenFingerprint || event.accessTokenFingerprint || null;
  }

  // ===== Compute token state từ event =====
  function computeTokenState(latestTokenEvent) {
    if (!latestTokenEvent) {
      return {
        accessToken: 'NOT AVAILABLE',
        refreshToken: 'NOT AVAILABLE',
        expiresIn: null,
        lastIssued: null,
        lastIssuedTimestamp: null,
        expiresAt: null,
        remainingSeconds: null,
        isExpired: false,
        expiresAtFormatted: null,
      };
    }

    const auth = getAuth(latestTokenEvent);
    const rawExpiresIn = getExpiresIn(latestTokenEvent);
    const hasValidExpiry = rawExpiresIn != null && rawExpiresIn > 0;
    const timestamp = getTimestamp(latestTokenEvent);

    if (!timestamp || isNaN(timestamp) || timestamp < 1e12) {
      return {
        accessToken: auth.hasAccessToken ? 'PRESENT' : 'NOT AVAILABLE',
        refreshToken: auth.hasRefreshToken ? 'PRESENT' : 'NOT AVAILABLE',
        expiresIn: hasValidExpiry ? rawExpiresIn : null,
        lastIssued: '—',
        lastIssuedTimestamp: null,
        expiresAt: null,
        remainingSeconds: null,
        isExpired: false,
        expiresAtFormatted: null,
      };
    }

    const expiresIn = hasValidExpiry ? rawExpiresIn : null;
    const expiresAt = hasValidExpiry ? timestamp + rawExpiresIn * 1000 : null;
    const remainingSeconds = hasValidExpiry ? (timestamp + rawExpiresIn * 1000) - Date.now() : null;
    const isExpired = hasValidExpiry && remainingSeconds <= 0;

    return {
      accessToken: auth.hasAccessToken ? 'PRESENT' : 'NOT AVAILABLE',
      refreshToken: auth.hasRefreshToken ? 'PRESENT' : 'NOT AVAILABLE',
      expiresIn,
      lastIssued: new Date(timestamp).toLocaleTimeString('vi-VN'),
      lastIssuedTimestamp: timestamp,
      expiresAt,
      remainingSeconds: isExpired ? 0 : remainingSeconds,
      isExpired,
      expiresAtFormatted: hasValidExpiry
        ? new Date(expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null,
    };
  }

  // ===== Compute identity mapping từ events =====
  function computeIdentityMapping(events) {
    let garenaHash = null;
    let dfToolsHash = null;

    for (const event of events) {
      // Handle normalized format (identity nested) and flat format
      const identity = event.identity || {};
      const auth = event.auth || {};
      const gHash = identity.garenaOpenIdHash || identity.channelInfoGarenaOpenIdHash
        || auth.garenaOpenIdHash || auth.channelInfoGarenaOpenIdHash
        || event.garenaSnsOpenidHash || event.urlGarenaOpenidHash || null;
      const dHash = identity.dfToolsOpenIdHash || identity.channelInfoDfToolsOpenIdHash
        || auth.dfToolsOpenIdHash || auth.channelInfoOpenIdHash
        || event.dfToolsOpenidHash || event.urlDfToolsOpenidHash || null;
      if (!garenaHash && gHash) garenaHash = gHash;
      if (!dfToolsHash && dHash) dfToolsHash = dHash;
    }

    // Fallback: flag-only (không có hash)
    if (!garenaHash) {
      const hasGarena = events.some(function (e) {
        return e.auth?.hasGarenaSnsOpenid === true || e.hasGarenaSnsOpenid === true;
      });
      if (hasGarena) garenaHash = '__flag_only__';
    }
    if (!dfToolsHash) {
      const hasDfTools = events.some(function (e) {
        return e.auth?.hasOpenId === true || e.hasDfToolsOpenid === true;
      });
      if (hasDfTools) dfToolsHash = '__flag_only__';
    }

    let match = 'NOT AVAILABLE';
    if (garenaHash && dfToolsHash) {
      match = garenaHash === dfToolsHash ? 'MATCH' : 'DIFFERENT';
    } else if (garenaHash || dfToolsHash) {
      match = 'INCOMPLETE';
    }

    return {
      garenaHash: garenaHash || '—',
      dfToolsHash: dfToolsHash || '—',
      match,
    };
  }

  // ===== Build refresh correlation pairs =====
  function buildRefreshCorrelation(events) {
    const requests = events.filter(function (e) {
      return e.refresh?.isRequest === true;
    });
    const responses = events.filter(function (e) {
      return e.refresh?.isResponse === true || e.correlatedRefreshRequest === true;
    });

    const pairs = [];
    for (const req of requests) {
      const reqId = req.refresh?.requestId;
      if (!reqId) continue;

      const matchingResponse = responses.find(function (r) {
        return r.refresh?.requestId === reqId || r.refresh?.correlatedRequestId === reqId;
      });

      const ts = getTimestamp(req);
      const cycleStart = ts;
      const cycleEnd = matchingResponse ? getTimestamp(matchingResponse) : Date.now();

      const cycleTokenEvents = events.filter(function (e) {
        return hasAccessToken(e) && getTimestamp(e) >= cycleStart && getTimestamp(e) <= cycleEnd;
      });

      let tokenChanged = false;
      let expiryChanged = null;
      if (cycleTokenEvents.length >= 2) {
        const sorted = cycleTokenEvents.slice().sort(function (a, b) { return getTimestamp(a) - getTimestamp(b); });
        const fp1 = getAccessTokenFingerprint(sorted[0]);
        const fp2 = getAccessTokenFingerprint(sorted[1]);
        tokenChanged = fp1 !== fp2;
        const exp1 = getExpiresIn(sorted[0]);
        const exp2 = getExpiresIn(sorted[1]);
        expiryChanged = exp1 !== exp2;
      }

      pairs.push({
        requestId: reqId,
        requestTime: ts,
        requestTimeFormatted: new Date(ts).toLocaleTimeString('vi-VN'),
        responseTime: matchingResponse ? getTimestamp(matchingResponse) : null,
        responseTimeFormatted: matchingResponse ? new Date(getTimestamp(matchingResponse)).toLocaleTimeString('vi-VN') : null,
        responseStatus: matchingResponse?.responseStatus || matchingResponse?.statusCode || null,
        duration: matchingResponse ? getTimestamp(matchingResponse) - ts : null,
        hasResponse: !!matchingResponse,
        success: matchingResponse?.refresh?.success ?? matchingResponse?.isSuccess,
        tokenChanged,
        expiryChanged: expiryChanged ?? null,
      });
    }
    return pairs;
  }

  // ===== Compute refresh flow từ events =====
  function computeRefreshFlow(events) {
    const refreshRequests = events.filter(function (e) {
      return e.type === 'auth_refresh_request' || e.refresh?.isRequest === true;
    });

    const refreshResponses = events.filter(function (e) {
      if (e.refresh?.isResponse === true) return true;
      if (e.correlatedRefreshRequest === true) return true;
      if (e.isRefreshResponse === true) return true;
      return false;
    });

    const hasRefreshToken = events.some(function (e) {
      if (e.auth) return e.auth.hasRefreshToken === true || e.refresh?.hasRefreshTokenInBody === true;
      return e.hasRefreshToken === true || e.hasRefreshTokenInBody === true;
    });

    const successCount = refreshResponses.filter(function (e) {
      return e.refresh?.success === true || e.isSuccess === true;
    }).length;

    const tokenEvents = events.filter(function (e) {
      return hasAccessToken(e);
    });

    const tokenEventsWithFp = events.filter(function (e) {
      return getAccessTokenFingerprint(e);
    });

    let tokenValueChanged = false;
    if (tokenEventsWithFp.length >= 2) {
      const sorted = tokenEventsWithFp.slice().sort(function (a, b) { return getTimestamp(a) - getTimestamp(b); });
      tokenValueChanged = getAccessTokenFingerprint(sorted[0]) !== getAccessTokenFingerprint(sorted[1]);
    }

    const expiryEvents = events.filter(function (e) {
      const exp = getExpiresIn(e);
      return exp != null && exp > 0;
    });

    let expiryUpdated = false;
    if (expiryEvents.length >= 2) {
      const sorted = expiryEvents.slice().sort(function (a, b) { return getTimestamp(a) - getTimestamp(b); });
      expiryUpdated = getExpiresIn(sorted[0]) !== getExpiresIn(sorted[1]);
    }

    const steps = [
      { name: 'Refresh token detected', passed: hasRefreshToken },
      { name: 'Refresh request detected', passed: refreshRequests.length > 0 },
      { name: 'Refresh response detected', passed: successCount > 0 || refreshResponses.length > 0 },
      { name: 'New access token detected', passed: tokenEvents.length > 0 },
      { name: 'Token value changed', passed: tokenValueChanged },
      { name: 'Expiry updated', passed: expiryUpdated },
    ];

    const allPassed = steps.every(function (s) { return s.passed; });
    const somePassed = steps.some(function (s) { return s.passed; });
    const status = allPassed ? 'CONFIRMED' : somePassed ? 'PARTIAL' : 'NOT DETECTED';

    return {
      requestCount: refreshRequests.length,
      successCount,
      failedCount: refreshResponses.length - successCount,
      steps,
      status,
      supported: hasRefreshToken,
    };
  }

  // ===== Classify code states (dùng cho redeem dashboard) =====
  const DEAD_REASONS = new Set(['EXPIRED', 'USED', 'INVALID', 'LIMIT_REACHED', 'VERIFY', 'PRESENT_ERROR']);
  const RETRYABLE_REASONS = new Set(['TEMP_ERROR', 'NO_RESPONSE']);

  function classifyCodes(state) {
    if (!state || !Array.isArray(state.codeStates)) {
      return { redeemed: [], dead: [], retryable: [], untested: [] };
    }

    const redeemed = [], dead = [], retryable = [], untested = [];

    for (const cs of state.codeStates) {
      const code = cs.redeemCode;
      if (cs.status === 'SUCCESS' || cs.result === 'SUCCESS') {
        redeemed.push(code);
      } else if (cs.status === 'PENDING') {
        untested.push(code);
      } else if (cs.status === 'FAILED' && DEAD_REASONS.has(cs.reason)) {
        dead.push(code);
      } else if (RETRYABLE_REASONS.has(cs.reason)) {
        retryable.push(code);
      } else {
        untested.push(code);
      }
    }

    return { redeemed, dead, retryable, untested };
  }

  // ===== Escape HTML =====
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ===== Export =====
  window.AuthUtils = {
    AUTH_STATE_CONFIG: window.AUTH_STATE_CONFIG,
    NOTIF_CONFIG: window.NOTIF_CONFIG,
    formatRemaining,
    formatLifetime,
    getTimestamp,
    getAuth,
    hasAccessToken,
    hasRefreshToken,
    getExpiresIn,
    getAccessTokenFingerprint,
    computeTokenState,
    computeIdentityMapping,
    buildRefreshCorrelation,
    computeRefreshFlow,
    classifyCodes,
    escapeHtml,
  };
})();
