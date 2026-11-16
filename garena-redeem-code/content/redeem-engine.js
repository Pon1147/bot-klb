(function () {
  'use strict';

  class RedeemEngine {
    constructor(deps) {
      this.capture = deps.capture;
      this.CONFIG = deps.CONFIG;
      this.CODE_STATES = deps.CODE_STATES;
      this.sleep = deps.sleep;
      this.findInput = deps.findInput;
      this.findButton = deps.findButton;
      this.setValue = deps.setValue;
      this.clickRedeem = deps.clickRedeem;
      this.parseRedeemResponse = deps.parseRedeemResponse;
      this.getCentralState = deps.getCentralState;
      this.setCentralState = deps.setCentralState;
      this.transition = deps.transition;
      this.completeState = deps.completeState;
      this.setCurrentIndex = deps.setCurrentIndex;
      this.setCurrentCode = deps.setCurrentCode;
      this.updateCodeState = deps.updateCodeState;
      this.updateStats = deps.updateStats;
      this.appendLog = deps.appendLog;
      this.generateId = deps.generateId;

      this.isRunning = false;
      this.abortFlag = false;
    }

    async start() {
      if (this.isRunning) return;
      let state = await this.getCentralState();
      if (!state) return;

      try {
        state = this.transition(state, 'RUNNING');
        await this.setCentralState(state);
      } catch (e) {
        console.error('[RedeemEngine] Start failed:', e);
        return;
      }

      this.isRunning = true;
      this.abortFlag = false;
      this.capture.initCapture();
      await this.processQueue(state);
    }

    async pause() {
      this.abortFlag = true;
      const state = await this.getCentralState();
      if (state && state.status === 'RUNNING') {
        try {
          const paused = this.transition(state, 'PAUSED');
          await this.setCentralState(paused);
        } catch (e) {
          console.error('[RedeemEngine] Pause failed:', e);
        }
      }
    }

    async resume() {
      let state = await this.getCentralState();
      if (!state || state.status !== 'PAUSED') return;

      try {
        state = this.transition(state, 'RUNNING');
        await this.setCentralState(state);
      } catch (e) {
        console.error('[RedeemEngine] Resume failed:', e);
        return;
      }

      this.isRunning = true;
      this.abortFlag = false;
      this.capture.initCapture();
      await this.processQueue(state);
    }

    async processQueue(state) {
      while (!this.abortFlag) {
        state = await this.getCentralState();
        if (!state) return;

        const nextIndex = this.findNextPending(state);
        if (nextIndex === -1) {
          state = this.completeState(state);
          await this.setCentralState(state);
          this.isRunning = false;
          return;
        }

        const codeEntry = state.codeStates[nextIndex];
        if (codeEntry.status === this.CODE_STATES.PENDING) {
          state = this.setCurrentIndex(state, nextIndex);
          state = this.setCurrentCode(state, codeEntry.redeemCode);
          state = this.updateCodeState(state, nextIndex, { status: 'PROCESSING' });
          await this.setCentralState(state);

          const result = await this.processCode(codeEntry.redeemCode, nextIndex, state.codes.length);
          if (this.abortFlag) return;

          await this.handleResponse(state, result, nextIndex);
        }

        await this.sleep(this.CONFIG.delayBetweenCodesMs);
      }
      this.isRunning = false;
    }

    findNextPending(state) {
      for (let i = state.currentIndex; i < state.codes.length; i++) {
        if (state.codeStates[i].status === this.CODE_STATES.PENDING) return i;
      }
      for (let i = 0; i < state.currentIndex; i++) {
        if (state.codeStates[i].status === this.CODE_STATES.PENDING) return i;
      }
      return -1;
    }

    async processCode(code, index, total) {
      const maxRetries = this.CONFIG.maxRetries + 1;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (this.abortFlag) return { result: this.CODE_STATES.CANCELLED, reason: 'CANCELLED' };

        try {
          const result = await this.redeemSingle(code);

          if (result.result === this.CODE_STATES.TIMEOUT) {
            return result;
          }

          if (result.reason === 'TEMP_ERROR' && attempt < maxRetries - 1) {
            await this.sleep(1000);
            continue;
          }

          return result;
        } catch (err) {
          if (attempt < maxRetries - 1) {
            await this.sleep(1000);
            continue;
          }
          return { result: this.CODE_STATES.FAILED, reason: 'TEMP_ERROR' };
        }
      }
      return { result: this.CODE_STATES.FAILED, reason: 'TEMP_ERROR' };
    }

    async redeemSingle(code) {
      this.capture.resetCapture(code);
      console.log('[RedeemEngine] Starting redeem for code:', code);

      const input = this.findInput();
      const btn = this.findButton();
      if (!input || !btn) {
        return { result: this.CODE_STATES.FAILED, reason: 'PRESENT_ERROR', message: 'UI not found' };
      }

      this.setValue(input, '');
      await this.sleep(50);
      this.setValue(input, code);
      await this.sleep(80);

      const waiter = this.waitForCapturedResponse(this.CONFIG.timeoutMs);
      let clicked = false;

      for (let submitTry = 1; submitTry <= 2; submitTry++) {
        const submitBtn = submitTry === 1 ? btn : this.findButton();
        if (!submitBtn) break;

        console.log('[RedeemEngine] Click attempt', submitTry);
        this.clickRedeem(submitBtn);
        clicked = true;

        const existing = this.capture.getLastResponse();
        if (existing) {
          console.log('[RedeemEngine] Response captured during click delay');
          break;
        }

        await this.sleep(200);
      }

      if (!clicked) {
        return { result: this.CODE_STATES.FAILED, reason: 'PRESENT_ERROR', message: 'Không tìm thấy nút redeem' };
      }

      console.log('[RedeemEngine] Waiting for response (timeout:', this.CONFIG.timeoutMs, 'ms)...');
      const response = await waiter;

      if (!response) {
        console.warn('[RedeemEngine] TIMEOUT — capture.responses.length =', this.capture.responses.length);
        return { result: this.CODE_STATES.TIMEOUT, reason: 'TIMEOUT', message: 'Timeout không nhận response' };
      }

      console.log('[RedeemEngine] Response received:', JSON.stringify(response).slice(0, 200));
      return this.parseRedeemResponse(response);
    }

    waitForCapturedResponse(timeout) {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const last = this.capture.getLastResponse();
          if (last) {
            console.log('[RedeemEngine] Found captured response after', Date.now() - start, 'ms');
            resolve(last.data);
            return;
          }

          if (Date.now() - start > timeout) {
            console.warn(
              '[RedeemEngine] TIMEOUT after',
              Date.now() - start,
              'ms, responses:',
              this.capture.responses.length,
            );
            resolve(null);
            return;
          }

          setTimeout(check, 100);
        };
        check();
      });
    }

    async handleResponse(state, parsed, index) {
      state = await this.getCentralState();
      if (!state) return;

      if (parsed.result === this.CODE_STATES.SUCCESS) {
        state = this.updateCodeState(state, index, {
          status: this.CODE_STATES.SUCCESS,
          result: this.CODE_STATES.SUCCESS,
          reason: parsed.reason,
        });
        state = this.updateStats(state, 1, 0);
      } else if (parsed.result === this.CODE_STATES.FAILED) {
        state = this.updateCodeState(state, index, {
          status: this.CODE_STATES.FAILED,
          result: this.CODE_STATES.FAILED,
          reason: parsed.reason,
        });
        state = this.updateStats(state, 0, 1);
      } else if (parsed.result === this.CODE_STATES.TIMEOUT) {
        state = this.updateCodeState(state, index, {
          status: this.CODE_STATES.TIMEOUT,
          result: this.CODE_STATES.TIMEOUT,
          reason: parsed.reason,
        });
      }

      const log = {
        id: this.generateId(),
        redeemCode: state.codeStates[index]?.redeemCode || '',
        result: parsed.result,
        reason: parsed.reason,
        responseCode: parsed.responseCode ?? null,
        responseMessage: parsed.message || '',
        responseSeq: parsed.seq || '',
        timestamp: Date.now(),
      };

      state = this.appendLog(state, log);
      state = this.setCurrentCode(state, null);
      await this.setCentralState(state);
    }
  }

  window.RedeemEngine = RedeemEngine;
})();
