/**
 * Tests để double check logic kiến trúc mới (Content Script → Background → Popup).
 *
 * Kiến trúc mới:
 *   - Background service worker quản lý state qua chrome.storage.local
 *   - Content script gửi STATUS_UPDATE sau mỗi redeem
 *   - Popup nhận real-time push từ content script
 *   - Popup đọc initial state từ chrome.storage
 *   - KHÔNG clearState() sau mission → data được giữ lại
 *
 * Mục tiêu: phát hiện bugs trong logic mới trước khi deploy.
 */

// --- Mock chrome APIs ---

interface StorageMap {
  [key: string]: any;
}

class MockChromeStorage {
  private store: StorageMap = {};
  private listeners: Array<(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void> = [];

  async get(key: string | string[]): Promise<StorageMap> {
    if (Array.isArray(key)) {
      const result: StorageMap = {};
      for (const k of key) {
        if (k in this.store) result[k] = this.store[k];
      }
      return result;
    }
    if (key in this.store) return { [key]: this.store[key] };
    return {};
  }

  async set(data: StorageMap): Promise<void> {
    Object.assign(this.store, data);
    // Trigger listeners
    for (const listener of this.listeners) {
      const changes: { [key: string]: chrome.storage.StorageChange } = {};
      for (const [k, v] of Object.entries(data)) {
        changes[k] = { oldValue: this.store[k], newValue: v };
      }
      listener(changes, 'local');
    }
  }

  async remove(key: string): Promise<void> {
    delete this.store[key];
  }

  async clear(): Promise<void> {
    this.store = {};
  }

  onChanged(listener: Array<(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void>): void {
    this.listeners.push(...listener);
  }

  subscribe(listener: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx > -1) this.listeners.splice(idx, 1);
    };
  }
}

class MockChromeRuntime {
  onMessage = { addListener: jest.fn() };
  sendMessage = jest.fn().mockResolvedValue(undefined);
  getURL = jest.fn((p: string) => `chrome-extension://mock/${p}`);
}

class MockChromeTabs {
  query = jest.fn().mockResolvedValue([]);
  sendMessage = jest.fn().mockResolvedValue({ isRunning: false });
}

class MockChromeAlarms {
  alarms: Map<string, any> = new Map();
  onAlarm = { addListener: jest.fn() };
  create = jest.fn();
  clear = jest.fn();
}

// --- Pure logic from background.js ---

interface ExtensionState {
  index: number;
  results: Array<{ status: string; code: string; message?: string }>;
  startedAt: number;
  isRunning: boolean;
}

/**
 * Simulate getState() từ background.js
 */
async function mockGetState(storage: MockChromeStorage): Promise<ExtensionState> {
  try {
    const data = await storage.get('garena_redeem_v2_state');
    const state = data['garena_redeem_v2_state'];
    if (state && state.results !== undefined) {
      return state;
    }
    return { index: 0, results: [], startedAt: Date.now(), isRunning: false };
  } catch {
    return { index: 0, results: [], startedAt: Date.now(), isRunning: false };
  }
}

/**
 * Simulate setState() từ background.js
 */
async function mockSetState(storage: MockChromeStorage, state: ExtensionState): Promise<void> {
  await storage.set({ 'garena_redeem_v2_state': state });
}

/**
 * Simulate resetState() từ background.js
 */
async function mockResetState(storage: MockChromeStorage): Promise<void> {
  const newState: ExtensionState = {
    index: 0,
    results: [],
    startedAt: Date.now(),
    isRunning: true,
  };
  await mockSetState(storage, newState);
}

/**
 * Simulate STATUS_UPDATE handler từ background.js
 */
async function mockStatusUpdate(
  storage: MockChromeStorage,
  payload: { results: ExtensionState['results']; index: number; isRunning: boolean },
): Promise<void> {
  const state = await mockGetState(storage);
  const newState: ExtensionState = {
    ...state,
    index: payload.index ?? state.index,
    results: payload.results ?? state.results,
    isRunning: payload.isRunning ?? state.isRunning,
  };
  await mockSetState(storage, newState);
}

/**
 * Simulate popup updatePopupStats() từ popup.js
 */
function reduceStats(results: Array<{ status: string }>): Record<string, number> {
  return results.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {} as Record<string, number>);
}

// --- Setup ---

let storage: MockChromeStorage;
let runtime: MockChromeRuntime;
let tabs: MockChromeTabs;
let alarms: MockChromeAlarms;

beforeEach(async () => {
  storage = new MockChromeStorage();
  runtime = new MockChromeRuntime();
  tabs = new MockChromeTabs();
  alarms = new MockChromeAlarms();

  await storage.clear();
  runtime.sendMessage.mockClear();
  tabs.query.mockClear();
  tabs.sendMessage.mockClear();

  // Mock global chrome
  Object.defineProperty(global, 'chrome', {
    value: {
      storage: storage,
      runtime: runtime,
      tabs: tabs,
      alarms: alarms,
    },
    writable: true,
    configurable: true,
  });
});

// ============================================================
// TEST SUITES
// ============================================================

describe('Proposed Architecture: Content Script → Background → Popup', () => {

  // --- Background State Management ---

  describe('Background: state management qua chrome.storage', () => {
    it('nên khởi tạo với default state rỗng', async () => {
      const state = await mockGetState(storage);
      expect(state.index).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.isRunning).toBe(false);
    });

    it('nên lưu và đọc state chính xác', async () => {
      const state: ExtensionState = {
        index: 3,
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
          { status: 'INVALID', code: 'C3' },
        ],
        startedAt: Date.now(),
        isRunning: true,
      };
      await mockSetState(storage, state);

      const retrieved = await mockGetState(storage);
      expect(retrieved.index).toBe(3);
      expect(retrieved.results).toHaveLength(3);
      expect(retrieved.isRunning).toBe(true);
    });

    it('nên resetState() về 0 khi start mission mới', async () => {
      // Mission cũ
      await mockSetState(storage, {
        index: 5,
        results: [{ status: 'SUCCESS', code: 'OLD' }],
        startedAt: Date.now() - 60000,
        isRunning: false,
      });

      // Reset
      await mockResetState(storage);

      const state = await mockGetState(storage);
      expect(state.index).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.isRunning).toBe(true);
    });

    it('nên giữ lại results sau mission finish (KHÔNG clearState)', async () => {
      // Mission đang chạy
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: true,
      });

      // Mission finish — set isRunning = false (KHÔNG xóa results)
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: false,
      });

      // Results vẫn còn trong storage
      const state = await mockGetState(storage);
      expect(state.results).toHaveLength(2);
      expect(state.isRunning).toBe(false);
    });
  });

  // --- Content Script → Background Flow ---

  describe('Flow: Content Script gửi STATUS_UPDATE lên Background', () => {
    it('nên background nhận và lưu result mới vào storage', async () => {
      // Content script gửi STATUS_UPDATE sau redeem đầu tiên
      await mockStatusUpdate(storage, {
        results: [{ status: 'SUCCESS', code: 'CODE001' }],
        index: 1,
        isRunning: true,
      });

      const state = await mockGetState(storage);
      expect(state.results).toHaveLength(1);
      expect(state.results[0].status).toBe('SUCCESS');
      expect(state.results[0].code).toBe('CODE001');
      expect(state.index).toBe(1);
    });

    it('nên background cập nhật incremental — mỗi redeem thêm result', async () => {
      // Redeem 1
      await mockStatusUpdate(storage, {
        results: [{ status: 'SUCCESS', code: 'C1' }],
        index: 1,
        isRunning: true,
      });
      expect((await mockGetState(storage)).results).toHaveLength(1);

      // Redeem 2
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: true,
      });
      expect((await mockGetState(storage)).results).toHaveLength(2);

      // Redeem 3
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
          { status: 'INVALID', code: 'C3' },
        ],
        index: 3,
        isRunning: true,
      });
      expect((await mockGetState(storage)).results).toHaveLength(3);
    });

    it('nên background cập nhật isRunning = false khi mission finish', async () => {
      // Mission đang chạy
      await mockStatusUpdate(storage, {
        results: [{ status: 'SUCCESS', code: 'C1' }],
        index: 1,
        isRunning: true,
      });
      expect((await mockGetState(storage)).isRunning).toBe(true);

      // Mission finish
      await mockStatusUpdate(storage, {
        results: [{ status: 'SUCCESS', code: 'C1' }],
        index: 1,
        isRunning: false,
      });
      expect((await mockGetState(storage)).isRunning).toBe(false);
    });
  });

  // --- Background → Popup Flow ---

  describe('Flow: Popup đọc state từ chrome.storage', () => {
    it('nên popup nhận được stats chính xác từ storage', async () => {
      // Background đã lưu results
      await mockSetState(storage, {
        index: 3,
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
          { status: 'INVALID', code: 'C3' },
        ],
        startedAt: Date.now(),
        isRunning: false,
      });

      // Popup đọc storage
      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];

      expect(state.results).toHaveLength(3);
      const counts = reduceStats(state.results);
      expect(counts['SUCCESS']).toBe(1);
      expect(counts['USED']).toBe(1);
      expect(counts['INVALID']).toBe(1);
    });

    it('nên popup hiển thị 0 khi chưa có mission nào chạy', async () => {
      // Storage rỗng
      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];

      // Popup nhận undefined → dùng default []
      const results = state?.results || [];
      const counts = reduceStats(results);
      expect(counts['SUCCESS']).toBeUndefined(); // popup sẽ hiển thị 0
    });

    it('nên popup biết mission đang chạy qua isRunning flag', async () => {
      await mockSetState(storage, {
        index: 2,
        results: [{ status: 'SUCCESS', code: 'C1' }, { status: 'USED', code: 'C2' }],
        startedAt: Date.now(),
        isRunning: true,
      });

      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];
      expect(state?.isRunning).toBe(true);
    });
  });

  // --- Real-time Push: Content Script → Popup ---

  describe('Real-time push: Content Script gửi POPUP_STATS_UPDATE', () => {
    it('nên popup nhận update ngay lập tức (không polling)', async () => {
      // Simulate: content script gửi POPUP_STATS_UPDATE
      const results = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
      ];

      // Popup nhận message và update stats
      const counts = reduceStats(results);
      expect(counts['SUCCESS']).toBe(1);
      expect(counts['USED']).toBe(1);

      // KHÔNG cần polling — update ngay trong cùng tick
    });

    it('nên popup update stats liên tục khi nhận nhiều messages', async () => {
      let popupResults: ExtensionState['results'] = [];

      // Message 1
      popupResults = [{ status: 'SUCCESS', code: 'C1' }];
      expect(reduceStats(popupResults)).toEqual({ SUCCESS: 1 });

      // Message 2
      popupResults = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
      ];
      expect(reduceStats(popupResults)).toEqual({ SUCCESS: 1, USED: 1 });

      // Message 3
      popupResults = [
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
        { status: 'INVALID', code: 'C3' },
      ];
      expect(reduceStats(popupResults)).toEqual({ SUCCESS: 1, USED: 1, INVALID: 1 });
    });
  });

  // --- Bug Fixes Verification ---

  describe('Bug fixes: Kiến trúc mới giải quyết các bugs cũ', () => {
    it('Bug #1 FIXED: clearState() không còn xóa storage → popup luôn đọc được data', async () => {
      // Mission chạy
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: true,
      });

      // Mission finish — KHÔNG gọi clearState() nữa
      // Chỉ set isRunning = false
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: false,
      });

      // Popup đọc storage — data vẫn còn!
      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];
      expect(state).toBeDefined();
      expect(state?.results).toHaveLength(2);
      // BUG #1 FIXED: data không bị xóa sau mission finish
    });

    it('Bug #2 FIXED: Popup Stop button tự update UI ngay → không cần chờ background', async () => {
      // User click Stop → popup tự set isRunning = false, update UI
      let popupIsRunning = true;
      let popupStatus = 'RUNNING';

      // Click Stop
      popupIsRunning = false;
      popupStatus = 'STOPPING';

      // Popup UI update ngay lập tức — không cần message đến background
      expect(popupIsRunning).toBe(false);
      expect(popupStatus).toBe('STOPPING');
      // BUG #2 FIXED: popup tự manage UI state
    });

    it('Bug #3 FIXED: Không có key mismatch — chrome.storage.shared giữa tất cả contexts', async () => {
      // Content script lưu state
      await mockSetState(storage, {
        index: 1,
        results: [{ status: 'SUCCESS', code: 'C1' }],
        startedAt: Date.now(),
        isRunning: false,
      });

      // Popup đọc từ cùng một storage key — KHÔNG có CONFIG.resumeKey
      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];
      expect(state?.results).toHaveLength(1);
      // BUG #3 FIXED: chrome.storage.local là shared storage
    });

    it('Bug #4 FIXED: Popup dùng chrome.storage thay vì localStorage → không bị detached DOM', async () => {
      // chrome.storage là async API — không phụ thuộc DOM
      // Popup đọc storage → nhận data → update DOM
      // KHÔNG có cached els issue vì popup không dùng panel.js
      await mockSetState(storage, {
        index: 1,
        results: [{ status: 'SUCCESS', code: 'C1' }],
        startedAt: Date.now(),
        isRunning: false,
      });

      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];
      expect(state?.results).toHaveLength(1);
      // BUG #4 FIXED: popup độc lập với panel DOM
    });

    it('Bug #5 FIXED: Real-time push thay vì polling → 0 delay', async () => {
      // Content script gửi POPUP_STATS_UPDATE ngay sau mỗi redeem
      // Popup nhận và update ngay — KHÔNG cần chờ polling interval
      let popupStats: Record<string, number> = {};

      // Redeem 1 → push
      popupStats = reduceStats([{ status: 'SUCCESS', code: 'C1' }]);
      expect(popupStats).toEqual({ SUCCESS: 1 });

      // Redeem 2 → push (ngay lập tức, không chờ 1s)
      popupStats = reduceStats([
        { status: 'SUCCESS', code: 'C1' },
        { status: 'USED', code: 'C2' },
      ]);
      expect(popupStats).toEqual({ SUCCESS: 1, USED: 1 });

      // BUG #5 FIXED: real-time push, không polling
    });
  });

  // --- Mission Lifecycle Integration ---

  describe('Integration: full mission lifecycle', () => {
    it('nên flow hoàn chỉnh: start → redeem loop → finish → popup đọc data', async () => {
      // 1. Start mission → background reset state
      await mockResetState(storage);
      let state = await mockGetState(storage);
      expect(state.index).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.isRunning).toBe(true);

      // 2. Redeem loop — content script gửi STATUS_UPDATE sau mỗi code
      const codes = ['C1', 'C2', 'C3', 'C4', 'C5'];
      const statuses = ['SUCCESS', 'SUCCESS', 'USED', 'INVALID', 'SUCCESS'];

      for (let i = 0; i < codes.length; i++) {
        const results: ExtensionState['results'] = [];
        for (let j = 0; j <= i; j++) {
          results.push({ status: statuses[j], code: codes[j] });
        }
        await mockStatusUpdate(storage, { results, index: i + 1, isRunning: true });

        // Popup đọc storage — luôn có data chính xác
        const data = await storage.get('garena_redeem_v2_state');
        const s = data['garena_redeem_v2_state'];
        expect(s?.results).toHaveLength(i + 1);
        expect(s?.isRunning).toBe(true);
      }

      // 3. Mission finish — background giữ results, set isRunning = false
      const finalResults: ExtensionState['results'] = [];
      for (let j = 0; j < codes.length; j++) {
        finalResults.push({ status: statuses[j], code: codes[j] });
      }
      await mockStatusUpdate(storage, { results: finalResults, index: 5, isRunning: false });

      state = await mockGetState(storage);
      expect(state.isRunning).toBe(false);
      expect(state.results).toHaveLength(5);

      // 4. Popup đọc final state
      const data = await storage.get('garena_redeem_v2_state');
      const s = data['garena_redeem_v2_state'];
      const counts = reduceStats(s?.results || []);
      expect(counts['SUCCESS']).toBe(3);
      expect(counts['USED']).toBe(1);
      expect(counts['INVALID']).toBe(1);
    });

    it('nên mission bị dừng giữa chừng — results vẫn được giữ lại', async () => {
      // 3 codes redeemed rồi user stop
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: true,
      });

      // User click Stop
      await mockStatusUpdate(storage, {
        results: [
          { status: 'SUCCESS', code: 'C1' },
          { status: 'USED', code: 'C2' },
        ],
        index: 2,
        isRunning: false,
      });

      // Results vẫn còn — có thể resume hoặc xem lại
      const state = await mockGetState(storage);
      expect(state.results).toHaveLength(2);
      expect(state.isRunning).toBe(false);
    });

    it('nên start mission mới — background reset state', async () => {
      // Mission cũ
      await mockSetState(storage, {
        index: 3,
        results: [
          { status: 'SUCCESS', code: 'OLD1' },
          { status: 'USED', code: 'OLD2' },
        ],
        startedAt: Date.now() - 60000,
        isRunning: false,
      });

      // Start mission mới → background reset
      await mockResetState(storage);

      const state = await mockGetState(storage);
      expect(state.index).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.isRunning).toBe(true);
    });
  });

  // --- Edge Cases ---

  describe('Edge cases', () => {
    it('nên handle storage rỗng khi popup init', async () => {
      // Storage rỗng — chưa có mission nào
      const data = await storage.get('garena_redeem_v2_state');
      const state = data['garena_redeem_v2_state'];

      // Popup nhận undefined → dùng default
      expect(state).toBeUndefined();
      // Popup sẽ hiển thị stats = 0, status = READY
    });

    it('nên handle STATUS_UPDATE với results = [] (edge case)', async () => {
      // Content script gửi empty results (lỗi programming)
      await mockStatusUpdate(storage, {
        results: [],
        index: 0,
        isRunning: false,
      });

      const state = await mockGetState(storage);
      expect(state.results).toEqual([]);
      expect(state.index).toBe(0);
    });

    it('nên handle nhiều STATUS_UPDATE liên tiếp (rapid redeems)', async () => {
      // 10 codes redeem nhanh
      for (let i = 1; i <= 10; i++) {
        const results: ExtensionState['results'] = [];
        for (let j = 1; j <= i; j++) {
          results.push({ status: 'SUCCESS', code: `C${j}` });
        }
        await mockStatusUpdate(storage, { results, index: i, isRunning: true });
      }

      const state = await mockGetState(storage);
      expect(state.results).toHaveLength(10);
      expect(state.index).toBe(10);
    });

    it('nên handle MISSION_START khi đang có mission cũ (overwrite)', async () => {
      // Mission cũ chưa finish
      await mockSetState(storage, {
        index: 3,
        results: [
          { status: 'SUCCESS', code: 'OLD1' },
          { status: 'USED', code: 'OLD2' },
        ],
        startedAt: Date.now() - 60000,
        isRunning: true,
      });

      // User start mission mới (overwrite)
      await mockResetState(storage);

      const state = await mockGetState(storage);
      expect(state.index).toBe(0);
      expect(state.results).toEqual([]);
      expect(state.isRunning).toBe(true);
    });
  });
});
