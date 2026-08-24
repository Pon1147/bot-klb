(() => {
  'use strict';

  console.log('[Garena Redeem] Content script loaded');

  // ===== INJECT DASHBOARD CSS =====
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/dashboard.css');
  document.head.appendChild(link);

  // ===== INJECT PAGE-CONTEXT CAPTURE SCRIPT =====
  // Content script runs in isolated world â€” cannot intercept page XHR/fetch.
  // Inject a <script> tag so the interceptor runs in page context.
  (function injectPageCapture() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/page-capture.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== INJECT REDEEM ENGINE =====
  // TÃ¡ch logic redeem ra redeem-engine.js Ä‘á»ƒ giáº£m content.js God Object
  (function injectRedeemEngine() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/redeem-engine.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();

  // ===== Redeem response code mapping =====
  const RESPONSE_CODE_MAP = {
    0: { result: 'SUCCESS', reason: 'REDEEMED', label: 'ThÃ nh cÃ´ng' },
    400001: { result: 'FAILED', reason: 'INVALID', label: 'Code khÃ´ng há»£p lá»‡' },
    400002: { result: 'FAILED', reason: 'EXPIRED', label: 'Code háº¿t háº¡n' },
    400003: { result: 'FAILED', reason: 'INVALID', label: 'KhÃ´ng tÃ¬m tháº¥y code' },
    400054: { result: 'FAILED', reason: 'INVALID', label: 'Code khÃ´ng khá»›p' },
    400067: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Äáº¡t giá»›i háº¡n nhÃ³m' },
    400070: { result: 'FAILED', reason: 'EXPIRED', label: 'Code háº¿t háº¡n' },
    400071: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Äáº¡t giá»›i háº¡n nháº­n' },
    400072: { result: 'FAILED', reason: 'USED', label: 'ÄÃ£ sá»­ dá»¥ng' },
    400073: { result: 'FAILED', reason: 'VERIFY', label: 'Cáº§n xÃ¡c minh' },
  };

  // ===== Redeem code states (enum) =====
  const CODE_STATES = Object.freeze({
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',
  });

  const CONFIG = {
    maxRetries: 2,
    delayBetweenCodesMs: 1300,
    timeoutMs: 5000,
    submitConfirmMs: 400,
  };

  // ===== STATE HELPERS =====
  const VALID_TRANSITIONS = {
    NO_CODES: ['READY'],
    READY: ['RUNNING'],
    RUNNING: ['PAUSED', 'COMPLETED'],
    PAUSED: ['READY', 'RUNNING'],
    COMPLETED: [],
  };

  function createInitialState(codes) {
    return {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      codes,
      currentIndex: 0,
      currentCode: null,
      status: codes.length > 0 ? 'READY' : 'NO_CODES',
      stats: { total: codes.length, success: 0, failed: 0 },
      logs: [],
      codeStates: codes.map((c) => ({
        redeemCode: c,
        status: 'PENDING',
        result: null,
        reason: null,
      })),
    };
  }

  function transition(state, newStatus) {
    const allowed = VALID_TRANSITIONS[state.status];
    if (!allowed?.includes(newStatus))
      throw new Error(`Invalid transition: ${state.status} -> ${newStatus}`);
    return { ...state, status: newStatus };
  }

  function computeRemaining(stats) {
    return stats.total - stats.success - stats.failed;
  }
  function updateCodeState(state, index, update) {
    return {
      ...state,
      codeStates: state.codeStates.map((cs, i) => (i === index ? { ...cs, ...update } : cs)),
    };
  }
  function setCurrentCode(state, code) {
    return { ...state, currentCode: code };
  }
  function setCurrentIndex(state, index) {
    return { ...state, currentIndex: index };
  }
  function updateStats(state, successDelta, failedDelta) {
    return {
      ...state,
      stats: {
        ...state.stats,
        success: state.stats.success + successDelta,
        failed: state.stats.failed + failedDelta,
      },
    };
  }
  function appendLog(state, logEntry) {
    const logs = [...state.logs, logEntry];
    return { ...state, logs: logs.length > 200 ? logs.slice(-200) : logs };
  }
  function completeState(state) {
    return { ...state, status: 'COMPLETED' };
  }

  // ===== STORAGE =====
  function getCentralState() {
    return new Promise((resolve) => {
      chrome.storage.local.get('centralState', (result) => resolve(result.centralState || null));
    });
  }

  function setCentralState(state) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ centralState: state }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  // ===== PARSER =====
  function parseRedeemResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'object') {
      return {
        result: 'FAILED',
        reason: 'UNKNOWN',
        responseCode: null,
        message: 'Invalid response',
        seq: '',
        raw: rawResponse,
      };
    }
    const responseCode = Number(rawResponse.code);
    const mapped = RESPONSE_CODE_MAP[responseCode];
    if (mapped)
      return {
        result: mapped.result,
        reason: mapped.reason,
        responseCode,
        message: rawResponse.msg || '',
        seq: rawResponse.seq || '',
        raw: rawResponse,
      };
    return {
      result: 'FAILED',
      reason: 'UNKNOWN',
      responseCode,
      message: rawResponse.msg || '',
      seq: rawResponse.seq || '',
      raw: rawResponse,
    };
  }

  // ===== CAPTURE (page-context via postMessage) =====
  // The page-capture.js script runs in PAGE CONTEXT and intercepts XHR/fetch there.
  // It posts responses back via window.postMessage. Content script only listens.
  const capture = { responses: [], initialized: false, _currentCode: null };

  function initCapture() {
    if (capture.initialized) return;
    capture.initialized = true;
    capture.responses = [];
    capture.requestMap = new Map(); // requestId â†’ { code, requestId, ... }

    window.addEventListener('message', (e) => {
      // Security: only accept messages from our own window
      if (e.source !== window) return;
      if (e.data?.source !== 'garena-redeem-capture') return;

      // Handle normalized NetworkEvent format
      const event = e.data.event;
      const data = e.data.data;

      if (!event || !data) return;
      if (typeof data !== 'object' || !('code' in data)) return;

      const { requestId, timestamp, status } = event;

      // Store response with requestId for correlation
      capture.responses.push({
        requestId,
        code: capture._currentCode || 'unknown',
        data: data,
        status: status || 200,
        time: timestamp || Date.now(),
      });

      // Map requestId â†’ response for quick lookup
      capture.requestMap.set(requestId, {
        code: capture._currentCode || 'unknown',
        data: data,
        status: status || 200,
        time: timestamp || Date.now(),
      });

      console.log(
        '[Capture] Received via postMessage:',
        data.code,
        'msg=' + (data.msg || data.message || ''),
        'requestId=' + requestId,
      );
    });
  }

  function getLastResponse() {
    return capture.responses.length > 0 ? capture.responses[capture.responses.length - 1] : null;
  }
  function resetCapture(code) {
    capture.responses = [];
    capture._currentCode = code || null;
  }

  // ===== UTILS =====
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function visible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
  }

  // ===== PhÃ¢n loáº¡i codeStates thÃ nh 4 nhÃ³m =====
  function classifyCodes(state) {
    if (!state || !Array.isArray(state.codeStates)) {
      return {
        redeemed: [],
        dead: [],
        retryable: [],
        untested: [],
      };
    }

    const redeemed = [];
    const dead = [];
    const retryable = [];
    const untested = [];

    const DEAD_REASONS = new Set([
      'EXPIRED',
      'USED',
      'INVALID',
      'LIMIT_REACHED',
      'VERIFY',
      'PRESENT_ERROR',
    ]);
    const RETRYABLE_REASONS = new Set(['TEMP_ERROR']);

    for (const cs of state.codeStates) {
      const code = cs.redeemCode;

      if (cs.status === CODE_STATES.SUCCESS || cs.result === CODE_STATES.SUCCESS) {
        redeemed.push(code);
        continue;
      }

      if (cs.status === CODE_STATES.PENDING) {
        untested.push(code);
        continue;
      }

      if (cs.status === CODE_STATES.FAILED && DEAD_REASONS.has(cs.reason)) {
        dead.push(code);
        continue;
      }

      if (RETRYABLE_REASONS.has(cs.reason)) {
        retryable.push(code);
        continue;
      }

      // TIMEOUT/CANCELLED/unknown â€” Ä‘Æ°a vÃ o untested Ä‘á»ƒ user xem xÃ©t
      untested.push(code);
    }

    return {
      redeemed,
      dead,
      retryable,
      untested,
    };
  }

  // ===== DASHBOARD =====
  let panel, statusDot, statusText, statTotal, statSuccess, statFailed, statRemaining;
  let progressFill, progressText, btnStart, btnStop, logsContainer, currentCodeEl;
  let callbacks = { onStart: null, onStop: null };

  function initDashboard() {
    if (document.getElementById('garena-redeem-dashboard')) return;
    console.log('[Dashboard] Initializing...');

    panel = document.createElement('div');
    panel.id = 'garena-redeem-dashboard';
    panel.innerHTML = `
      <div class="grd-drag"></div>
      <div class="grd-current-code"></div>
      <div class="grd-header">
        <div class="grd-status-dot"></div>
        <span class="grd-title">Garena Redeem</span>
        <span class="grd-status-text"></span>
      </div>
      <div class="grd-stats">
        <div class="grd-stat"><div class="grd-stat-value grd-stat-total">0</div><div class="grd-stat-label">Tá»•ng</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-success">0</div><div class="grd-stat-label">ThÃ nh cÃ´ng</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-failed">0</div><div class="grd-stat-label">Tháº¥t báº¡i</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-remaining">0</div><div class="grd-stat-label">CÃ²n láº¡i</div></div>
      </div>
      <div class="grd-progress-wrap">
        <div class="grd-progress-bar"><div class="grd-progress-fill"></div></div>
        <div class="grd-progress-text">0%</div>
      </div>
      <div class="grd-buttons">
        <button class="grd-btn grd-btn-start" disabled>Báº¯t Ä‘áº§u</button>
        <button class="grd-btn grd-btn-stop" disabled>Dá»«ng</button>
      </div>
      <div class="grd-logs-header"><span class="grd-logs-title">Nháº­t kÃ½</span><button class="grd-logs-clear">XÃ³a</button></div>
      <div class="grd-logs"></div>
      <div class="grd-footer"><span>Pon1147 Redeem Tool</span><a href="https://discord.gg/vz6w6c3Xe3" target="_blank">Discord</a></div>
    `;

    document.documentElement.appendChild(panel);

    statusDot = panel.querySelector('.grd-status-dot');
    statusText = panel.querySelector('.grd-status-text');
    statTotal = panel.querySelector('.grd-stat-total');
    statSuccess = panel.querySelector('.grd-stat-success');
    statFailed = panel.querySelector('.grd-stat-failed');
    statRemaining = panel.querySelector('.grd-stat-remaining');
    progressFill = panel.querySelector('.grd-progress-fill');
    progressText = panel.querySelector('.grd-progress-text');
    btnStart = panel.querySelector('.grd-btn-start');
    btnStop = panel.querySelector('.grd-btn-stop');
    logsContainer = panel.querySelector('.grd-logs');
    currentCodeEl = panel.querySelector('.grd-current-code');

    // Drag
    let isDragging = false,
      startX,
      startY,
      startLeft,
      startTop;
    const drag = panel.querySelector('.grd-drag');
    drag.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const r = panel.getBoundingClientRect();
      startLeft = r.left;
      startTop = r.top;
      panel.style.transition = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.left = startLeft + e.clientX - startX + 'px';
      panel.style.top = startTop + e.clientY - startY + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.transition = '';
    });

    btnStart.addEventListener('click', () => callbacks.onStart?.());
    btnStop.addEventListener('click', () => callbacks.onStop?.());
    panel.querySelector('.grd-logs-clear').addEventListener('click', () => {
      logsContainer.innerHTML = '';
    });

    // Subscribe
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.centralState) {
        const newState = changes.centralState.newValue;
        console.log('[Dashboard] Storage changed, rendering...', newState?.status, newState?.stats);
        if (newState) render(newState);
      }
    });

    renderFromStorage();
  }

  const STATUS_CONFIG = {
    NO_CODES: { dotClass: 'grd-no-codes', text: 'ChÆ°a sáºµn sÃ ng' },
    READY: { dotClass: 'grd-ready', text: 'Sáºµn sÃ ng' },
    RUNNING: { dotClass: 'grd-running', text: 'Äang cháº¡y' },
    PAUSED: { dotClass: 'grd-paused', text: 'ÄÃ£ táº¡m dá»«ng' },
    COMPLETED: { dotClass: 'grd-completed', text: 'HoÃ n táº¥t' },
  };

  function render(state) {
    if (!state) {
      console.warn('[Dashboard] No state to render.');
      return;
    }
    console.log('[Dashboard] render() called, status:', state.status);
    const cfg = STATUS_CONFIG[state.status] || STATUS_CONFIG.NO_CODES;
    statusDot.className = `grd-status-dot grd-${cfg.dotClass}`;
    statusText.textContent = cfg.text;

    const remaining = computeRemaining(state.stats);
    statTotal.textContent = state.stats.total;
    statSuccess.textContent = state.stats.success;
    statFailed.textContent = state.stats.failed;
    statRemaining.textContent = remaining;

    const processed = state.stats.success + state.stats.failed;
    const pct = state.stats.total > 0 ? Math.round((processed / state.stats.total) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressText.textContent = pct + '%';

    const canStart = state.status === 'READY' || state.status === 'PAUSED';
    const canStop = state.status === 'RUNNING';
    btnStart.disabled = !canStart;
    btnStop.disabled = !canStop;
    btnStart.textContent = state.status === 'PAUSED' ? 'Tiáº¿p tá»¥c' : 'Báº¯t Ä‘áº§u';

    if (state.currentCode) {
      currentCodeEl.textContent = 'Äang xá»­ lÃ½: ' + state.currentCode;
      currentCodeEl.classList.add('grd-visible');
    } else {
      currentCodeEl.classList.remove('grd-visible');
    }

    renderLogs(state.logs);
  }

  function renderLogs(logs) {
    logsContainer.innerHTML = '';
    const toRender = logs.slice(-50);
    for (let i = 0; i < toRender.length; i++) {
      const log = toRender[i];
      const entry = document.createElement('div');
      entry.className = 'grd-log-entry';
      let icon = '',
        resultClass = '',
        reasonText = log.reason || 'Unknown';
      if (log.result === 'SUCCESS') {
        icon = 'âœ”';
        resultClass = 'grd-log-success';
        reasonText = 'ThÃ nh cÃ´ng';
      } else if (log.result === 'FAILED') {
        icon = 'âœ˜';
        resultClass = 'grd-log-failed';
        reasonText = getReasonLabel(log.reason);
      }
      entry.classList.add(resultClass);
      entry.innerHTML = `<span class="grd-log-icon">${icon}</span><span class="grd-log-code">${log.redeemCode || ''}</span><span class="grd-log-reason">${reasonText}</span>`;
      logsContainer.appendChild(entry);
    }
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  function getReasonLabel(reason) {
    const labels = {
      REDEEMED: 'ÄÃ£ nháº­n thÃ nh cÃ´ng',
      USED: 'ÄÃ£ sá»­ dá»¥ng',
      EXPIRED: 'Háº¿t háº¡n',
      INVALID: 'KhÃ´ng há»£p lá»‡',
      LIMIT_REACHED: 'Äáº¡t giá»›i háº¡n',
      PRESENT_ERROR: 'Lá»—i trÃ¬nh bÃ y',
      VERIFY: 'Cáº§n xÃ¡c minh',
      TEMP_ERROR: 'Lá»—i táº¡m thá»i',
      UNKNOWN: 'KhÃ´ng xÃ¡c Ä‘á»‹nh',
      NO_RESPONSE: 'KhÃ´ng cÃ³ pháº£n há»“i',
    };
    return labels[reason] || reason;
  }

  async function renderFromStorage() {
    console.log('[Dashboard] renderFromStorage() called...');
    let state = await getCentralState();
    if (!state) {
      console.warn('[Dashboard] No state in storage.');
      return;
    }
    if (state.status === 'RUNNING') {
      try {
        state = transition(state, 'PAUSED');
        await setCentralState(state);
      } catch (e) {
        console.error('[Dashboard] Persistence transition failed:', e);
      }
    }
    render(state);
  }

  // ===== REDEEM ENGINE — instance =====
  let redeemEngine = null;

  function initRedeemEngine() {
    // Inject dependencies vÃ o RedeemEngine
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
    return btns.find((el) => visible(el) && el.innerText.trim() === 'Äá»•i');
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

  function initRedeemController() {
    initRedeemEngine();
    callbacks.onStart = () => redeemEngine.start();
    callbacks.onStop = async () => {
      await redeemEngine.pause();
    };
  }

  // ===== BOOTSTRAP =====
  initDashboard();
  initRedeemController();
  console.log('[Garena Redeem] Dashboard + RedeemController initialized.');
})();
