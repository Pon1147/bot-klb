/**
 * Redeem Shared Utilities — dùng chung cho content.js và redeem-engine.js
 *
 * Chứa: RESPONSE_CODE_MAP, CODE_STATES, CONFIG, state helpers, storage, parser, capture, utils
 */

(function () {
  'use strict';

  // ===== Redeem response code mapping =====
  window.RESPONSE_CODE_MAP = {
    0: { result: 'SUCCESS', reason: 'REDEEMED', label: 'Thành công' },
    400001: { result: 'FAILED', reason: 'INVALID', label: 'Code không hợp lệ' },
    400002: { result: 'FAILED', reason: 'EXPIRED', label: 'Code hết hạn' },
    400003: { result: 'FAILED', reason: 'INVALID', label: 'Không tìm thấy code' },
    400054: { result: 'FAILED', reason: 'INVALID', label: 'Code không khớp' },
    400067: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Đạt giới hạn nhóm' },
    400070: { result: 'FAILED', reason: 'EXPIRED', label: 'Code hết hạn' },
    400071: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Đạt giới hạn nhận' },
    400072: { result: 'FAILED', reason: 'USED', label: 'Đã sử dụng' },
    400073: { result: 'FAILED', reason: 'VERIFY', label: 'Cần xác minh' },
  };

  // ===== Redeem code states (enum) =====
  window.CODE_STATES = Object.freeze({
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',
  });

  // ===== Config =====
  window.CONFIG = {
    maxRetries: 2,
    delayBetweenCodesMs: 1300,
    timeoutMs: 5000,
    submitConfirmMs: 400,
  };

  // ===== State helpers =====
  const VALID_TRANSITIONS = {
    NO_CODES: ['READY'],
    READY: ['RUNNING'],
    RUNNING: ['PAUSED', 'COMPLETED'],
    PAUSED: ['READY', 'RUNNING'],
    COMPLETED: [],
  };

  window.VALID_TRANSITIONS = VALID_TRANSITIONS;

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
    if (!allowed?.includes(newStatus)) {
      throw new Error(`Invalid transition: ${state.status} -> ${newStatus}`);
    }
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

  // Export state helpers
  window.createInitialState = createInitialState;
  window.transition = transition;
  window.computeRemaining = computeRemaining;
  window.updateCodeState = updateCodeState;
  window.setCurrentCode = setCurrentCode;
  window.setCurrentIndex = setCurrentIndex;
  window.updateStats = updateStats;
  window.appendLog = appendLog;
  window.completeState = completeState;

  // ===== Storage =====
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

  window.getCentralState = getCentralState;
  window.setCentralState = setCentralState;

  // ===== Parser =====
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

    if (mapped) {
      return {
        result: mapped.result,
        reason: mapped.reason,
        responseCode,
        message: rawResponse.msg || '',
        seq: rawResponse.seq || '',
        raw: rawResponse,
      };
    }

    return {
      result: 'FAILED',
      reason: 'UNKNOWN',
      responseCode,
      message: rawResponse.msg || '',
      seq: rawResponse.seq || '',
      raw: rawResponse,
    };
  }

  window.parseRedeemResponse = parseRedeemResponse;

  // ===== Capture =====
  const capture = { responses: [], initialized: false, _currentCode: null, requestMap: new Map() };

  function initCapture() {
    if (capture.initialized) return;
    capture.initialized = true;
    capture.responses = [];
    capture.requestMap = new Map();

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

      // Map requestId → response for quick lookup
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

  // Export capture
  window.capture = capture;
  window.initCapture = initCapture;
  window.getLastResponse = getLastResponse;
  window.resetCapture = resetCapture;

  // ===== Utils =====
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

  window.sleep = sleep;
  window.generateId = generateId;
  window.visible = visible;

  // ===== classifyCodes =====
  const DEAD_REASONS = new Set(['EXPIRED', 'USED', 'INVALID', 'LIMIT_REACHED', 'VERIFY', 'PRESENT_ERROR']);
  const RETRYABLE_REASONS = new Set(['TEMP_ERROR']);

  function classifyCodes(state) {
    if (!state || !Array.isArray(state.codeStates)) {
      return { redeemed: [], dead: [], retryable: [], untested: [] };
    }

    const redeemed = [], dead = [], retryable = [], untested = [];

    for (const cs of state.codeStates) {
      const code = cs.redeemCode;

      if (cs.status === 'SUCCESS' || cs.result === 'SUCCESS') {
        redeemed.push(code);
        continue;
      }

      if (cs.status === 'PENDING') {
        untested.push(code);
        continue;
      }

      if (cs.status === 'FAILED' && DEAD_REASONS.has(cs.reason)) {
        dead.push(code);
        continue;
      }

      if (RETRYABLE_REASONS.has(cs.reason)) {
        retryable.push(code);
        continue;
      }

      // TIMEOUT/CANCELLED/unknown — đưa vào untested
      untested.push(code);
    }

    return { redeemed, dead, retryable, untested };
  }

  window.classifyCodes = classifyCodes;
})();
