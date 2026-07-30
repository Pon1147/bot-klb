// @deprecated — NOT loaded by manifest. Use content/content.js (monolithic) instead.
import { CONFIG } from '../core/constants.js';
import { getCentralState, setCentralState } from '../core/storage.js';
import {
  transition,
  updateCodeState,
  setCurrentCode,
  setCurrentIndex,
  updateStats,
  appendLog,
  completeState,
} from '../core/state.js';
import { parseRedeemResponse } from '../core/parser.js';
import { generateId, sleep, visible } from '../core/utils.js';
import { setCallbacks } from './dashboard.js';
import { ResponseCapture } from '../core/capture.js';

const capture = new ResponseCapture();

// Selectors for Garena redeem page
const SELECTORS = {
  codeInput: 'input[placeholder*="code"], input[placeholder*="Code"], input#cdkCode, input[name*="code"]',
  redeemBtn: 'button:has-text("Redeem"), button:has-text("Đổi"), button[class*="redeem"], button[class*="Redeem"]',
};

class RedeemController {
  constructor() {
    this.isRunning = false;
    this.abortFlag = false;
  }

  async start() {
    if (this.isRunning) return;

    let state = await getCentralState();
    if (!state) return;

    try {
      state = transition(state, 'RUNNING');
      await setCentralState(state);
    } catch (e) {
      console.error('[RedeemController] Start failed:', e);
      return;
    }

    this.isRunning = true;
    this.abortFlag = false;
    capture.init();

    await this.processQueue(state);
  }

  pause() {
    this.abortFlag = true;
  }

  async resume() {
    let state = await getCentralState();
    if (!state || state.status !== 'PAUSED') return;

    try {
      state = transition(state, 'RUNNING');
      await setCentralState(state);
    } catch (e) {
      console.error('[RedeemController] Resume failed:', e);
      return;
    }

    this.isRunning = true;
    this.abortFlag = false;
    capture.init();

    await this.processQueue(state);
  }

  async processQueue(state) {
    while (!this.abortFlag) {
      // Always read fresh state each iteration
      state = await getCentralState();
      if (!state) return;

      const nextIndex = this.findNextPending(state);

      if (nextIndex === -1) {
        // No more pending codes
        state = completeState(state);
        await setCentralState(state);
        this.isRunning = false;
        return;
      }

      const codeEntry = state.codeStates[nextIndex];

      // If code is still PENDING, process it
      if (codeEntry.status === 'PENDING') {
        state = setCurrentIndex(state, nextIndex);
        state = setCurrentCode(state, codeEntry.redeemCode);
        state = updateCodeState(state, nextIndex, { status: 'PROCESSING' });
        await setCentralState(state);

        const result = await this.processCode(codeEntry.redeemCode, nextIndex, state.codes.length);

        if (this.abortFlag) return;

        await this.handleResponse(state, result, nextIndex);
      }
      // If PROCESSING, skip (response may still be pending)

      await sleep(CONFIG.delayBetweenCodesMs);
    }

    this.isRunning = false;
  }

  findNextPending(state) {
    for (let i = state.currentIndex; i < state.codes.length; i++) {
      if (state.codeStates[i].status === 'PENDING') return i;
    }
    // Wrap around
    for (let i = 0; i < state.currentIndex; i++) {
      if (state.codeStates[i].status === 'PENDING') return i;
    }
    return -1;
  }

  async processCode(code, index, total) {
    const maxRetries = CONFIG.maxRetries + 1; // initial + retries

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.abortFlag) return { result: 'FAILED', reason: 'NO_RESPONSE' };

      try {
        const result = await this.redeemSingle(code);
        if (result.reason === 'TEMP_ERROR' && attempt < maxRetries - 1) {
          await sleep(1000);
          continue;
        }
        return result;
      } catch (err) {
        if (attempt < maxRetries - 1) {
          await sleep(1000);
          continue;
        }
        return { result: 'FAILED', reason: 'TEMP_ERROR' };
      }
    }

    return { result: 'FAILED', reason: 'TEMP_ERROR' };
  }

  async redeemSingle(code) {
    // Reset capture before each attempt
    capture.reset(code);

    // Wait for UI to be ready
    const input = await waitForUI('input');
    const btn = await waitForUI('button');

    if (!input || !btn) {
      return { result: 'FAILED', reason: 'PRESENT_ERROR', message: 'UI not found' };
    }

    // Input code
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Click button — dispatchEvent avoids javascript: href navigation (CSP violation)
    await sleep(200);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Wait for captured response
    const response = await this.waitForCapturedResponse(CONFIG.timeoutMs);

    if (!response) {
      return { result: 'FAILED', reason: 'NO_RESPONSE', message: 'No response received' };
    }

    // Parse response
    const parsed = parseRedeemResponse(response);
    return parsed;
  }

  waitForCapturedResponse(timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const last = capture.getLastResponse();
        if (last) {
          resolve(last.data);
          return;
        }
        if (Date.now() - start > timeout) {
          resolve(null);
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  async handleResponse(state, parsed, index) {
    // Always read latest state from storage before updating to avoid stale data race
    state = await getCentralState();
    if (!state) return;

    const isSuccess = parsed.result === 'SUCCESS';
    const isFailed = parsed.result === 'FAILED';

    if (isSuccess) {
      state = updateCodeState(state, index, {
        status: 'SUCCESS',
        result: 'SUCCESS',
        reason: parsed.reason,
      });
      state = updateStats(state, 1, 0);
    } else if (isFailed) {
      state = updateCodeState(state, index, {
        status: 'FAILED',
        result: 'FAILED',
        reason: parsed.reason,
      });
      state = updateStats(state, 0, 1);
    }

    // Append log
    const log = {
      id: generateId(),
      redeemCode: state.codeStates[index]?.redeemCode || '',
      result: parsed.result,
      reason: parsed.reason,
      responseCode: parsed.responseCode ?? null,
      responseMessage: parsed.message || '',
      responseSeq: parsed.seq || '',
      timestamp: Date.now(),
    };
    state = appendLog(state, log);

    // Clear current code
    state = setCurrentCode(state, null);

    await setCentralState(state);
  }
}

// ===== UI HELPERS =====
function waitForUI(type, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(null);
        return;
      }

      let el = null;
      if (type === 'input') {
        // Try multiple selectors
        const selectors = [
          'input[placeholder*="code"]',
          'input[placeholder*="Code"]',
          'input#cdkCode',
          'input[name*="code"]',
          'input[type="text"]',
        ];
        for (const sel of selectors) {
          const found = document.querySelector(sel);
          if (visible(found)) { el = found; break; }
        }
      } else if (type === 'button') {
        const selectors = [
          'button:has-text("Redeem")',
          'button:has-text("Đổi")',
          'button[class*="redeem"]',
          'button[class*="Redeem"]',
        ];
        for (const sel of selectors) {
          try {
            const found = document.querySelector(sel);
            if (visible(found)) { el = found; break; }
          } catch { /* skip invalid selectors */ }
        }
        // Fallback: any button that's visible
        if (!el) {
          const buttons = document.querySelectorAll('button');
          for (const b of buttons) {
            if (visible(b) && b.textContent.trim()) { el = b; break; }
          }
        }
      }

      if (el) {
        clearInterval(interval);
        resolve(el);
      }
    }, 200);
  });
}

// ===== EXPORT =====
let controller = null;

export function initRedeemController() {
  controller = new RedeemController();
  setCallbacks({
    onStart: () => controller.start(),
    onStop: () => { controller.pause(); },
  });
  return controller;
}

export function getController() {
  return controller;
}
