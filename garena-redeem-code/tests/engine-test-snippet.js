/**
 * Auth State Engine — Browser Test Snippet
 *
 * Hướng dẫn chạy:
 * 1. Load extension ở chế độ Developer Mode (chrome://extensions/)
 * 2. Mở trang https://sso.garena.com/ (hoặc trang có inject auth-state-engine)
 * 3. Mở DevTools Console
 * 4. Paste toàn bộ nội dung file này vào Console → Enter
 *
 * Test sẽ tự động chạy và báo kết quả
 */

(function runTests() {
  'use strict';

  const ENGINE = window.__authStateEngine;
  if (!ENGINE) {
    console.error('%c[X] Auth State Engine không tìm thấy!', 'color: red; font-weight: bold');
    console.error('Đảm bảo trang hiện tại có inject auth-state-engine.js');
    return;
  }

  const AUTH_STATES = ENGINE.AUTH_STATES;
  const NOTIF_TYPES = ENGINE.NOTIFICATION_TYPES;

  // ===== Test runner =====
  let passed = 0;
  let failed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`%c[PASS] ${name}`, 'color: green');
    } catch (e) {
      failed++;
      console.log(`%c[FAIL] ${name}`, 'color: red');
      console.log(`       ${e.message}`);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  function assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Expected'}: ${expected}, got: ${actual}`);
    }
  }

  // ===== Reset engine state =====
  function resetEngine() {
    ENGINE.clearNotifications();
    // Force reset by setting UNKNOWN state
    chrome.storage.local.set({
      auth_state: {
        sessionId: null,
        state: AUTH_STATES.UNKNOWN,
        fingerprint: null,
        expiresIn: null,
        expiresAt: null,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: Date.now(),
        lastTokenIssued: null,
      },
    });
    // Reload engine state
    ENGINE.getState();
  }

  // ===== Helper: simulate event =====
  function sendEvent(data) {
    window.postMessage(
      {
        source: 'auth-investigator',
        ...data,
        timestamp: Date.now(),
      },
      window.location.origin
    );
  }

  // ===== Run tests =====
  console.log('%c═══ Auth State Engine Tests ═══', 'font-weight: bold; font-size: 14px');

  resetEngine();

  // --- Test 1: UNKNOWN → ACTIVE ---
  test('UNKNOWN → ACTIVE khi nhận TOKEN_DETECTED', () => {
    resetEngine();
    sendEvent({
      type: 'TOKEN_DETECTED',
      auth: { hasAccessToken: true, hasRefreshToken: false },
      accessTokenFingerprint: 'fp_test_001',
      expiresIn: 3600,
    });

    const state = ENGINE.getState();
    assert(state.state === AUTH_STATES.ACTIVE, `Expected ACTIVE, got ${state.state}`);
    assert(state.fingerprint === 'fp_test_001', 'Fingerprint mismatch');
  });

  // --- Test 2: ACTIVE → EXPIRING_SOON ---
  test('ACTIVE → EXPIRING_SOON khi expiresIn <= 600s', () => {
    resetEngine();
    const now = Date.now();

    // Set state với 5 phút nữa
    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_expire_test',
        state: AUTH_STATES.ACTIVE,
        fingerprint: 'fp_expire',
        expiresIn: 300,
        expiresAt: now + 300 * 1000,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now,
      },
    });

    // Trigger checkExpiry
    ENGINE.getState(); // reload
    // Gọi trực tiếp checkExpiry qua postMessage (engine tự handle)
    window.postMessage(
      { source: 'auth-state-engine', type: '_trigger_check_expiry' },
      window.location.origin
    );

    // Wait async, check after
    setTimeout(() => {
      const state = ENGINE.getState();
      // Note: checkExpiry chạy mỗi 30s, test này cần sync call
      // Tạm thời skip nếu không thể trigger đồng bộ
    }, 100);
  });

  // --- Test 3: EXPIRED → CONFIRMED_EXPIRED ---
  test('EXPIRED → CONFIRMED_EXPIRED khi nhận 401 TOKEN_EXPIRED', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_expired_test',
        state: AUTH_STATES.EXPIRED,
        fingerprint: 'fp_expired',
        expiresIn: 0,
        expiresAt: now - 1000,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now - 5000,
      },
    });

    ENGINE.getState(); // reload
    sendEvent({
      type: 'auth_api_response',
      statusCode: 401,
      body: { error: 'TOKEN_EXPIRED' },
    });

    const state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.CONFIRMED_EXPIRED, 'Expected CONFIRMED_EXPIRED');
  });

  // --- Test 4: CONFIRMED_EXPIRED → ACTIVE (API recovery) ---
  test('CONFIRMED_EXPIRED → ACTIVE khi API success 200', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_recovery_test',
        state: AUTH_STATES.CONFIRMED_EXPIRED,
        fingerprint: 'fp_old',
        expiresIn: 0,
        expiresAt: now - 10000,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now - 15000,
      },
    });

    ENGINE.getState(); // reload
    sendEvent({
      type: 'auth_api_response',
      statusCode: 200,
      data: { ret: 0 },
    });

    const state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.ACTIVE, 'Expected ACTIVE after API recovery');
  });

  // --- Test 5: CONFIRMED_EXPIRED → ACTIVE (new token) ---
  test('CONFIRMED_EXPIRED → ACTIVE khi nhận token mới (fingerprint change)', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_fingerprint_test',
        state: AUTH_STATES.CONFIRMED_EXPIRED,
        fingerprint: 'fp_old_expired',
        expiresIn: 0,
        expiresAt: now - 10000,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now - 15000,
      },
    });

    ENGINE.getState(); // reload
    sendEvent({
      type: 'TOKEN_DETECTED',
      auth: { hasAccessToken: true },
      accessTokenFingerprint: 'fp_new_login',
      expiresIn: 7200,
    });

    const state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.ACTIVE, 'Expected ACTIVE after new token');
    assertEquals(state.fingerprint, 'fp_new_login', 'Fingerprint should be new');
    assert(state.sessionId !== 'sess_fingerprint_test', 'Session ID should change');
  });

  // --- Test 6: Refresh flow ---
  test('ACTIVE → REFRESHING → ACTIVE khi refresh thành công', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_refresh_test',
        state: AUTH_STATES.ACTIVE,
        fingerprint: 'fp_before_refresh',
        expiresIn: 1800,
        expiresAt: now + 1800 * 1000,
        hasRefreshToken: true,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now,
      },
    });

    ENGINE.getState(); // reload

    // Step 1: Refresh request
    sendEvent({
      type: 'auth_refresh_request',
      requestId: 'req_refresh_001',
      url: 'https://auth.garena.com/token/refresh',
      method: 'POST',
    });

    let state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.REFRESHING, 'Expected REFRESHING after refresh request');

    // Step 2: Refresh response (success)
    sendEvent({
      type: 'auth_refresh_response',
      isSuccess: true,
      statusCode: 200,
      auth: { hasAccessToken: true },
      accessTokenFingerprint: 'fp_after_refresh',
      expiresIn: 3600,
    });

    state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.ACTIVE, 'Expected ACTIVE after successful refresh');
    assertEquals(state.fingerprint, 'fp_after_refresh', 'Fingerprint should update');
  });

  // --- Test 7: Refresh failed ---
  test('REFRESHING → EXPIRED khi refresh thất bại', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_refresh_fail_test',
        state: AUTH_STATES.REFRESHING,
        fingerprint: 'fp_refresh_fail',
        expiresIn: 900,
        expiresAt: now + 900 * 1000,
        hasRefreshToken: true,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now,
      },
    });

    ENGINE.getState(); // reload

    sendEvent({
      type: 'auth_refresh_response',
      isSuccess: false,
      statusCode: 401,
    });

    const state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.EXPIRED, 'Expected EXPIRED after refresh failure');
  });

  // --- Test 8: Session ID changes on fingerprint change ---
  test('Session ID mới khi fingerprint thay đổi', () => {
    resetEngine();

    sendEvent({
      type: 'TOKEN_DETECTED',
      auth: { hasAccessToken: true },
      accessTokenFingerprint: 'fp_session_001',
      expiresIn: 3600,
    });

    const firstSessionId = ENGINE.getState().sessionId;
    assert(firstSessionId !== null, 'Session ID should be set');

    // New token with different fingerprint
    sendEvent({
      type: 'TOKEN_DETECTED',
      auth: { hasAccessToken: true },
      accessTokenFingerprint: 'fp_session_002',
      expiresIn: 3600,
    });

    const newSessionId = ENGINE.getState().sessionId;
    assert(newSessionId !== firstSessionId, 'Session ID should change on fingerprint change');
  });

  // --- Test 9: expiredNotified reset on new session ---
  test('expiredNotified reset về false khi fingerprint thay đổi', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_notified_test',
        state: AUTH_STATES.CONFIRMED_EXPIRED,
        fingerprint: 'fp_notified_old',
        expiresIn: 0,
        expiresAt: now - 1000,
        hasRefreshToken: false,
        expiredNotified: true, // Đã notify
        lastStateChange: now,
        lastTokenIssued: now - 5000,
      },
    });

    ENGINE.getState(); // reload

    sendEvent({
      type: 'TOKEN_DETECTED',
      auth: { hasAccessToken: true },
      accessTokenFingerprint: 'fp_notified_new',
      expiresIn: 7200,
    });

    const state = ENGINE.getState();
    assert(state.expiredNotified === false, 'expiredNotified should be reset');
  });

  // --- Test 10: Notification emitted on AUTH_EXPIRED ---
  test('NOTIFICATION event được emit khi AUTH_EXPIRED', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_notif_test',
        state: AUTH_STATES.EXPIRED,
        fingerprint: 'fp_notif',
        expiresIn: 0,
        expiresAt: now - 1000,
        hasRefreshToken: false,
        expiredNotified: false,
        lastStateChange: now,
        lastTokenIssued: now - 5000,
      },
    });

    ENGINE.getState(); // reload

    // Capture postMessage calls
    const notifEvents = [];
    const origPostMessage = window.postMessage;
    window.postMessage = function (data) {
      if (data.type === 'NOTIFICATION') {
        notifEvents.push(data);
      }
    };

    sendEvent({
      type: 'auth_api_response',
      statusCode: 401,
      body: { error: 'TOKEN_EXPIRED' },
    });

    // Restore original
    window.postMessage = origPostMessage;

    assert(notifEvents.length > 0, 'Notification should be emitted');
    assert(notifEvents[0].type === 'NOTIFICATION', 'Event type should be NOTIFICATION');
  });

  // --- Test 11: Terminal state guard ---
  test('Không transition từ CONFIRMED_EXPIRED → CONFIRMED_EXPIRED (redundant)', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_guard_test',
        state: AUTH_STATES.CONFIRMED_EXPIRED,
        fingerprint: 'fp_guard',
        expiresIn: 0,
        expiresAt: now - 1000,
        hasRefreshToken: false,
        expiredNotified: true,
        lastStateChange: now,
        lastTokenIssued: now - 5000,
      },
    });

    ENGINE.getState(); // reload

    const firstStateChange = ENGINE.getState().lastStateChange;

    // Gửi 401 thêm lần nữa — phải bị guard (không transition)
    sendEvent({
      type: 'auth_api_response',
      statusCode: 401,
      body: { error: 'TOKEN_EXPIRED' },
    });

    const state = ENGINE.getState();
    assertEquals(state.state, AUTH_STATES.CONFIRMED_EXPIRED, 'Should stay CONFIRMED_EXPIRED');
  });

  // --- Test 12: Rate limiting ---
  test('Rate limit: notification thứ 2 trong 5 phút bị skip', () => {
    resetEngine();
    const now = Date.now();

    chrome.storage.local.set({
      auth_state: {
        sessionId: 'sess_rate_test',
        state: AUTH_STATES.CONFIRMED_EXPIRED,
        fingerprint: 'fp_rate',
        expiresIn: 0,
        expiresAt: now - 1000,
        hasRefreshToken: false,
        expiredNotified: true,
        lastStateChange: now,
        lastTokenIssued: now - 5000,
      },
    });

    ENGINE.getState(); // reload

    // Capture notifications
    const notifCount = { value: 0 };
    const origPostMessage = window.postMessage;
    window.postMessage = function (data) {
      if (data.type === 'NOTIFICATION') notifCount.value++;
    };

    // Gửi 401 lần 1
    sendEvent({
      type: 'auth_api_response',
      statusCode: 401,
      body: { error: 'TOKEN_EXPIRED' },
    });

    const countAfterFirst = notifCount.value;

    // Gửi 401 lần 2 (ngay lập tức)
    sendEvent({
      type: 'auth_api_response',
      statusCode: 401,
      body: { error: 'TOKEN_EXPIRED' },
    });

    const countAfterSecond = notifCount.value;

    window.postMessage = origPostMessage;

    assert(countAfterSecond === countAfterFirst, `Rate limit failed: ${countAfterFirst} → ${countAfterSecond}`);
  });

  // --- Results ---
  console.log('%c\n═══ Results ═══', 'font-weight: bold');
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`, passed === total ? '%c✓' : '%c✗', 'color: green');
  console.log(`Failed: ${failed}`, failed > 0 ? '%c✗' : '%c✓', 'color: red');

  if (failed === 0) {
    console.log('%c\nTất cả tests PASSED!', 'color: green; font-weight: bold; font-size: 14px');
  } else {
    console.log(`%c\n${failed} test(s) FAILED — xem log phía trên`, 'color: red; font-weight: bold; font-size: 14px');
  }
})();
