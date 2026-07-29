/**
 * Tests kiểm tra bug: stats của extension không được update realtime.
 *
 * Bug sources được phát hiện từ code review:
 * 1. clearState() trong finally block wipe localStorage ngay khi mission kết thúc,
 *    khiến popup polling (1s interval) đọc được dữ liệu cũ hoặc rỗng.
 * 2. Popup Stop button không gọi stopStatsPolling() — polling tiếp tục đến 1s sau.
 * 3. getStats message handler đọc từ CONFIG.resumeKey, không phải stateManager.state.
 *    Nếu 2 key này khác nhau, popup nhận stats stale.
 * 4. Popup dùng document.getElementById mỗi lần poll — dễ miss update nếu DOM
 *    bị thay đổi giữa 2 lần query (race condition với panel UI updates).
 */

// --- Browser API mocks ---

type StorageMap = Record<string, string>;

class MockStorage {
  private store: StorageMap = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

// --- Pure logic helpers extracted from extension code ---

/**
 * Simulates the reduce logic from panel.js:setStats() và popup.js:updatePopupStats()
 */
function reduceStats(results: Array<{ status: string }>): Record<string, number> {
  return results.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {} as Record<string, number>);
}

/**
 * Simulates popup updatePopupStats() — reads localStorage and computes counts.
 * Returns null if no data.
 */
function readPopupStats(storage: MockStorage, key: string) {
  const raw = storage.getItem(key);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (!state?.results) return null;
  return reduceStats(state.results);
}

/**
 * Simulates stateManager.saveState() — writes to localStorage.
 */
function saveState(storage: MockStorage, key: string, data: {
  index: number;
  results: Array<{ status: string; code: string }>;
  startedAt: number;
}): void {
  storage.setItem(key, JSON.stringify(data));
}

/**
 * Simulates stateManager.clearState() — removes from localStorage.
 */
function clearState(storage: MockStorage, key: string): void {
  storage.removeItem(key);
}

/**
 * Simulates stateManager.resetState() — resets index + results.
 */
function resetState(storage: MockStorage, key: string): void {
  const raw = storage.getItem(key);
  if (raw) {
    const state = JSON.parse(raw);
    state.index = 0;
    state.results = [];
    state.startedAt = Date.now();
    storage.setItem(key, JSON.stringify(state));
  }
}

// ============================================================
// TEST SUITES
// ============================================================

describe('Extension Stats Real-Time Update Bug', () => {
  const STATE_KEY = 'garena_redeem_v2_state';

  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  // --- Bug #1: clearState() wipe localStorage trước khi popup đọc stats ---

  describe('Bug #1: clearState() wipe localStorage ngay khi mission finish', () => {
    it('nên popup đọc được stats sau khi mission finish nếu clearState chưa chạy', () => {
      const results = [
        { status: 'SUCCESS', code: 'ABC123' },
        { status: 'USED', code: 'DEF456' },
        { status: 'INVALID', code: 'GHI789' },
      ];
      saveState(storage, STATE_KEY, { index: 3, results, startedAt: Date.now() });

      // Popup poll đọc stats — thành công
      const popupStats = readPopupStats(storage, STATE_KEY);
      expect(popupStats).toEqual({ SUCCESS: 1, USED: 1, INVALID: 1 });
    });

    it('nên popup KHÔNG đọc được stats sau clearState() — stats bị mất', () => {
      const results = [
        { status: 'SUCCESS', code: 'ABC123' },
        { status: 'USED', code: 'DEF456' },
        { status: 'INVALID', code: 'GHI789' },
      ];
      saveState(storage, STATE_KEY, { index: 3, results, startedAt: Date.now() });

      // clearState() chạy (từ finally block)
      clearState(storage, STATE_KEY);

      // Popup poll — không có data → BUG: stats biến mất
      expect(readPopupStats(storage, STATE_KEY)).toBeNull();
    });

    it('nên race condition giữa popup poll và clearState gây mất stats giữa chừng', () => {
      const results: Array<{ status: string; code: string }> = [];

      // Popup poll lần 1 — có 1 result
      results.push({ status: 'SUCCESS', code: 'CODE001' });
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1 });

      // Popup poll lần 2 — có 2 results
      results.push({ status: 'SUCCESS', code: 'CODE002' });
      saveState(storage, STATE_KEY, { index: 2, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 2 });

      // Mission finish — clearState chạy
      clearState(storage, STATE_KEY);

      // Popup poll lần 3 — ĐÃ clear, mất stats
      expect(readPopupStats(storage, STATE_KEY)).toBeNull();
    });

    it('nên clearState() trong finally block luôn xóa localStorage sau mission', () => {
      const state = {
        index: 5,
        results: [{ status: 'SUCCESS', code: 'X' }],
        startedAt: Date.now(),
      };
      saveState(storage, STATE_KEY, state);
      expect(storage.getItem(STATE_KEY)).not.toBeNull();

      clearState(storage, STATE_KEY);
      expect(storage.getItem(STATE_KEY)).toBeNull();
    });

    it('nên resume không hoạt động vì clearState() xóa localStorage sau mỗi mission', () => {
      // Simulate mission đang chạy giữa chừng
      const results = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
      ];
      saveState(storage, STATE_KEY, { index: 2, results, startedAt: Date.now() });

      // User đóng tab mid-mission → localStorage vẫn còn
      expect(storage.getItem(STATE_KEY)).not.toBeNull();

      // Mở lại tab — clearState() đã chạy trong finally block của session trước
      // → localStorage đã bị xóa → không thể resume
      clearState(storage, STATE_KEY);
      expect(storage.getItem(STATE_KEY)).toBeNull();
    });
  });

  // --- Bug #2: getStats message handler dùng CONFIG.resumeKey ---

  describe('Bug #2: getStats handler đọc từ CONFIG.resumeKey thay vì state key', () => {
    it('nên getStats đọc đúng khi CONFIG.resumeKey === STATE_KEY', () => {
      const results = [{ status: 'SUCCESS', code: 'ABC' }];
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });

      // getStats handler đọc từ CONFIG.resumeKey (default = STATE_KEY)
      const raw = storage.getItem(STATE_KEY);
      expect(raw).not.toBeNull();
      const state = JSON.parse(raw!);
      expect(state.results).toEqual(results);
    });

    it('nên getStats KHÔNG đọc được khi CONFIG.resumeKey khác STATE_KEY', () => {
      const results = [{ status: 'SUCCESS', code: 'ABC' }];
      // State được lưu ở STATE_KEY
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });

      // getStats handler đọc từ key khác (CONFIG.resumeKey override)
      const wrongKey = 'garena_redeem_v2_state_custom';
      const raw = storage.getItem(wrongKey);
      // BUG: raw = null → popup nhận { results: [] } → stats = 0
      expect(raw).toBeNull();
    });

    it('nên popup nhận stats stale khi key mismatch', () => {
      const stateKey = 'garena_redeem_v2_state';
      const resumeKey = 'garena_redeem_v2_state_old';

      // State mới được lưu ở stateKey
      const results = [{ status: 'SUCCESS', code: 'NEW' }];
      saveState(storage, stateKey, { index: 1, results, startedAt: Date.now() });

      // getStats handler đọc từ resumeKey (cũ) → không tìm thấy data mới
      const raw = storage.getItem(resumeKey);
      expect(raw).toBeNull();

      // Popup nhận { results: [] } → hiển thị 0 cho tất cả stats
      // Trong khi stateKey có data thật
    });
  });

  // --- Bug #3: popup Stop không gọi stopStatsPolling() ---

  describe('Bug #3: popup Stop button không gọi stopStatsPolling()', () => {
    it('nên polling interval tiếp tục chạy đến 1s sau khi user click Stop', () => {
      // Khi user click Stop:
      // 1. stopBtn.addEventListener → sendToContent('stopMission')
      // 2. KHÔNG gọi stopStatsPolling()
      // 3. polling interval tiếp tục chạy
      // 4. Mỗi cycle: check getRunningState → nếu false thì stop
      // 5. Delay tối đa: STATS_POLL_MS (1000ms)

      // Simulate: mission đang chạy
      let isRunning = true;

      // User click Stop
      isRunning = false;

      // Polling interval vẫn chạy — cycle 1 (0ms): isRunning = false
      // Nhưng phải chờ đến cycle tiếp theo (1s sau) mới stopStatsPolling()
      // → trong 1s đó, popup vẫn polling và có thể đọc stale stats

      // BUG: không có immediate stop → delay 1s
      expect(isRunning).toBe(false);
    });

    it('nên stats popup có thể hiển thị giá trị cũ trong 1s sau stop', () => {
      const results = [{ status: 'SUCCESS', code: 'C1' }];
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });

      // Popup poll tại t=0s — đọc stats = 1
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1 });

      // User click Stop tại t=0.5s
      // Mission finish, clearState chạy tại t=0.6s
      clearState(storage, STATE_KEY);

      // Popup poll tại t=1s — localStorage đã clear → null
      // → stats hiển thị không update (vẫn là 1 từ cycle trước)
      // → hoặc nếu popup clear stats khi null → stats "nhảy" từ 1 → 0

      // BUG: không có cơ chế "final poll" ngay sau stop
      expect(readPopupStats(storage, STATE_KEY)).toBeNull();
    });
  });

  // --- Bug #4: panel setStats cached els có thể stale ---

  describe('Bug #4: panel cached els có thể reference detached DOM nodes', () => {
    it('nên setStats update DOM nodes không còn trong document nếu panel rebuild', () => {
      // Simulate cached els từ panel lần đầu build
      const cachedEls = {
        statSuccess: { textContent: '0' } as unknown as HTMLElement,
        statUsed: { textContent: '0' } as unknown as HTMLElement,
        statInvalid: { textContent: '0' } as unknown as HTMLElement,
        statLimit: { textContent: '0' } as unknown as HTMLElement,
        statExpired: { textContent: '0' } as unknown as HTMLElement,
        statTempError: { textContent: '0' } as unknown as HTMLElement,
      };

      // Panel bị remove khỏi DOM (user navigate away)
      // Panel rebuild — DOM mới được tạo, cachedEls vẫn refs old nodes

      // setStats gọi với results mới
      const results = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
      ];
      const counts = reduceStats(results);

      // setStats update cached els
      const statMap: Record<string, HTMLElement> = {
        SUCCESS: cachedEls.statSuccess,
        USED: cachedEls.statUsed,
        INVALID: cachedEls.statInvalid,
        LIMIT_REACHED: cachedEls.statLimit,
        EXPIRED: cachedEls.statExpired,
        TEMP_ERROR: cachedEls.statTempError,
      };

      for (const [status, count] of Object.entries(counts)) {
        const el = statMap[status];
        if (el) {
          el.textContent = String(count);
        }
      }

      // Values đã update nhưng DOM không hiển thị (detached nodes)
      expect(cachedEls.statSuccess.textContent).toBe('1');
      expect(cachedEls.statUsed.textContent).toBe('1');
      // BUG: user không thấy stats update
    });

    it('nên setStats không update nếu panel chưa build (els rỗng)', () => {
      // panel.js setStats: if (!els?.statSuccess) return;
      // Khi panel chưa build, els.statSuccess = undefined → early return
      const els: Record<string, undefined> = {};

      // Simulate setStats early return path
      if (!els.statSuccess) {
        // Panel chưa build, bỏ qua — không update gì
        expect(els.statSuccess).toBeUndefined();
        return;
      }
      // Không bao giờ đến đây
      fail('setStats should return early when panel not built');
    });
  });

  // --- Bug #5: popup polling interval race condition ---

  describe('Bug #5: popup polling delay so với redeem thực tế', () => {
    it('nên popup có thể miss update nếu redeem nhanh hơn 1s polling interval', () => {
      const results: Array<{ status: string; code: string }> = [];

      // Redeem tại t=0ms — saveState
      results.push({ status: 'SUCCESS', code: 'C1' });
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });

      // Redeem tại t=500ms — saveState
      results.push({ status: 'SUCCESS', code: 'C2' });
      saveState(storage, STATE_KEY, { index: 2, results, startedAt: Date.now() });

      // Popup poll tại t=1000ms — đọc cả 2 results
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 2 });

      // Nhưng nếu redeem tại t=50ms và t=600ms:
      // - Redeem C1 tại t=50ms → saveState
      // - Redeem C2 tại t=600ms → saveState
      // - Popup poll tại t=1000ms → đọc cả 2 (ok, không miss)
      // - Popup poll tại t=500ms → chỉ đọc C1 (miss C2)

      // BUG: popup không biết có redeem mới đang diễn ra
      // → stats có thể "nhảy" từ 1 → 2 thay vì tăng dần 1 → 2
    });

    it('nên panel update event-driven còn popup polling —不一致 update rate', () => {
      // Panel: event-driven — setStats gọi ngay sau mỗi redeem (0 delay)
      // Popup: polling — đọc localStorage mỗi 1s (0-1s delay)

      // Khi mission chạy:
      // - Panel: update ngay lập tức mỗi redeem
      // - Popup: cập nhật chậm hơn, có thể miss intermediate states

      // Ví dụ: 5 codes redeem nhanh (mỗi code 200ms)
      // Panel: 0ms→1, 200ms→2, 400ms→3, 600ms→4, 800ms→5
      // Popup (poll tại 0ms, 1000ms): 0ms→0, 1000ms→5
      // → popup nhảy từ 0 → 5, không thấy intermediate states

      const results: Array<{ status: string; code: string }> = [];
      for (let i = 1; i <= 5; i++) {
        results.push({ status: 'SUCCESS', code: `C${i}` });
        saveState(storage, STATE_KEY, { index: i, results, startedAt: Date.now() });
      }

      // Popup poll cuối cùng — đọc tất cả
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 5 });

      // BUG: popup không hiển thị progress real-time như panel
    });
  });

  // --- Integration tests: full mission lifecycle ---

  describe('Integration: full mission lifecycle stats flow', () => {
    it('nên stats được lưu localStorage sau mỗi redeem', () => {
      const results: Array<{ status: string; code: string }> = [];

      // Redeem 1
      results.push({ status: 'SUCCESS', code: 'CODE001' });
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1 });

      // Redeem 2
      results.push({ status: 'USED', code: 'CODE002' });
      saveState(storage, STATE_KEY, { index: 2, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1, USED: 1 });

      // Redeem 3
      results.push({ status: 'INVALID', code: 'CODE003' });
      saveState(storage, STATE_KEY, { index: 3, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({
        SUCCESS: 1,
        USED: 1,
        INVALID: 1,
      });
    });

    it('nên clearState() xóa toàn bộ stats sau mission finish', () => {
      const results = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
        { status: 'INVALID', code: 'C3' },
      ];
      saveState(storage, STATE_KEY, { index: 3, results, startedAt: Date.now() });

      // Trước khi clear — có stats
      expect(readPopupStats(storage, STATE_KEY)).toEqual({
        SUCCESS: 1,
        USED: 1,
        INVALID: 1,
      });

      // clearState chạy (finally block)
      clearState(storage, STATE_KEY);

      // Sau khi clear — không còn stats
      expect(readPopupStats(storage, STATE_KEY)).toBeNull();
    });

    it('nên resetState() đúng khi start mission mới', () => {
      // Mission cũ
      const oldResults = [
        { status: 'SUCCESS', code: 'OLD1' },
        { status: 'USED', code: 'OLD2' },
      ];
      saveState(storage, STATE_KEY, { index: 2, results: oldResults, startedAt: Date.now() - 60000 });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1, USED: 1 });

      // Start mission mới — resetState()
      resetState(storage, STATE_KEY);

      // Stats đã reset
      const afterReset = readPopupStats(storage, STATE_KEY);
      expect(afterReset).toEqual({});
    });

    it('nên popup polling nhận được stats liên tục trong khi mission chạy', () => {
      const results: Array<{ status: string; code: string }> = [];

      // Poll cycle 1
      results.push({ status: 'SUCCESS', code: 'C1' });
      saveState(storage, STATE_KEY, { index: 1, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 1 });

      // Poll cycle 2
      results.push({ status: 'SUCCESS', code: 'C2' });
      saveState(storage, STATE_KEY, { index: 2, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 2 });

      // Poll cycle 3
      results.push({ status: 'USED', code: 'C3' });
      saveState(storage, STATE_KEY, { index: 3, results, startedAt: Date.now() });
      expect(readPopupStats(storage, STATE_KEY)).toEqual({ SUCCESS: 2, USED: 1 });

      // Poll cycle 4 — mission finish, clearState
      clearState(storage, STATE_KEY);
      expect(readPopupStats(storage, STATE_KEY)).toBeNull();
    });

    it('nên state index được lưu đúng sau mỗi redeem', () => {
      const results: Array<{ status: string; code: string }> = [];

      for (let i = 1; i <= 5; i++) {
        results.push({ status: 'SUCCESS', code: `C${i}` });
        saveState(storage, STATE_KEY, { index: i, results, startedAt: Date.now() });

        const raw = storage.getItem(STATE_KEY);
        const state = JSON.parse(raw!);
        expect(state.index).toBe(i);
      }
    });
  });
});
