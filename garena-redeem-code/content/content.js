(() => {
  'use strict';

  console.log('[Garena Redeem] Content script loaded');

  // ===== INJECT DASHBOARD CSS =====
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/dashboard.css');
  document.head.appendChild(link);

  // ===== INJECT PAGE-CONTEXT CAPTURE SCRIPT =====
  // Content script runs in isolated world — cannot intercept page XHR/fetch.
  // Inject a <script> tag so the interceptor runs in page context.
  (function injectPageCapture() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/page-capture.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== INJECT REDEEM SHARED UTILS =====
  // Shared constants, state helpers, storage, parser, capture, utils
  (function injectRedeemShared() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/redeem-shared.js');
    script.onload = () => { script.remove(); };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== INJECT DASHBOARD UI =====
  // Dashboard render và UI logic
  (function injectDashboardUI() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/dashboard-ui.js');
    script.onload = () => { script.remove(); };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== INJECT REDEEM ENGINE =====
  // Tách logic redeem ra redeem-engine.js để giảm content.js God Object
  (function injectRedeemEngine() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/redeem-engine.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== UI HELPERS (DOM interaction) =====
  function findInput() {
    const direct = document.querySelector('.exc-input');
    if (visible(direct)) return direct;
    const inputs = [...document.querySelectorAll('input')];
    return inputs.find((el) => visible(el) && !el.disabled && !el.readOnly);
  }

  function findButton() {
    const direct = document.querySelector('.btn-exchange');
    if (visible(direct)) return direct;
    const btns = [...document.querySelectorAll('a,button')];
    return btns.find((el) => visible(el) && el.innerText.trim() === 'Đổi');
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function clickRedeem(button) {
    // Use dispatchEvent to trigger onclick handler without triggering javascript: href navigation (CSP violation)
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    );
  }

  // ===== REDEEM ENGINE — instance =====
  let redeemEngine = null;

  function initRedeemEngine() {
    // Inject dependencies vào RedeemEngine
    redeemEngine = new window.RedeemEngine({
      capture: capture,
      CONFIG: CONFIG,
      CODE_STATES: CODE_STATES,
      sleep: sleep,
      findInput: findInput,
      findButton: findButton,
      setValue: setValue,
      clickRedeem: clickRedeem,
      parseRedeemResponse: parseRedeemResponse,
      getCentralState: getCentralState,
      setCentralState: setCentralState,
      transition: transition,
      completeState: completeState,
      setCurrentIndex: setCurrentIndex,
      setCurrentCode: setCurrentCode,
      updateCodeState: updateCodeState,
      updateStats: updateStats,
      appendLog: appendLog,
      generateId: generateId,
    });
  }

  function initRedeemController() {
    initRedeemEngine();
    // Connect callbacks từ dashboard-ui.js
    window.callbacks.onStart = () => redeemEngine.start();
    window.callbacks.onStop = async () => {
      await redeemEngine.pause();
    };
  }

  // ===== BOOTSTRAP =====
  initRedeemController();
  window.initDashboard(); // Từ dashboard-ui.js
  console.log('[Garena Redeem] Dashboard + RedeemEngine initialized.');
})();
