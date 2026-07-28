(function () {
  'use strict';

  // ============================================================
  // PON1147 REDEEM SYSTEM — Popup Controller
  // Dùng chrome.scripting.executeScript để gọi trực tiếp
  // code trên redeem page (không qua message)
  // ============================================================

  // --- DOM elements ---
  const dot = document.getElementById('popup-dot');
  const status = document.getElementById('popup-status');
  const info = document.getElementById('popup-info');
  const startBtn = document.getElementById('popup-start');
  const stopBtn = document.getElementById('popup-stop');

  // --- State ---
  let isRunning = false;
  let redeemTabId = null;

  /**
   * Cập nhật trạng thái popup.
   */
  function setPopupStatus(text, stateClass) {
    status.textContent = text;
    dot.className = `popup-status-dot ${stateClass || ''}`;
  }

  /**
   * Cập nhật quick stats từ localStorage.
   */
  function updatePopupStats() {
    try {
      const raw = localStorage.getItem('garena_redeem_v2_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state?.results) return;

      const counts = state.results.reduce((a, r) => {
        a[r.status] = (a[r.status] || 0) + 1;
        return a;
      }, {});

      document.getElementById('popup-stat-SUCCESS').textContent = counts['SUCCESS'] || 0;
      document.getElementById('popup-stat-USED').textContent = counts['USED'] || 0;
      document.getElementById('popup-stat-INVALID').textContent = counts['INVALID'] || 0;
      document.getElementById('popup-stat-LIMIT_REACHED').textContent = counts['LIMIT_REACHED'] || 0;
    } catch (e) {
      // Ignore parse errors
    }
  }

  /**
   * Tìm tab redeem page (không phải popup tab).
   */
  async function findRedeemTab() {
    try {
      const tabs = await chrome.tabs.query({
        url: ['*://redeem.df.garena.sg/*', '*://redeem.garena.com/*'],
      });
      if (tabs.length === 0) return null;
      // Trả về tab đang active nhất
      return tabs.find(t => t.active) || tabs[0];
    } catch (e) {
      return null;
    }
  }

  /**
   * Execute script trực tiếp trên redeem page.
   */
  async function executeOnPage(func, args = []) {
    const tab = await findRedeemTab();
    if (!tab) return null;

    redeemTabId = tab.id;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: func,
        args: args,
      });
      return results?.[0]?.result ?? null;
    } catch (e) {
      console.warn('[Popup] executeOnPage failed:', e);
      return null;
    }
  }

  /**
   * Show panel trên redeem page.
   */
  async function showPanel() {
    return executeOnPage(() => {
      if (window.Pon1147?.showPanel) {
        window.Pon1147.showPanel();
        return true;
      }
      return false;
    });
  }

  /**
   * Start mission trên redeem page.
   */
  async function startMission() {
    return executeOnPage(() => {
      if (window.Pon1147?.startMission) {
        window.Pon1147.startMission();
        return true;
      }
      return false;
    });
  }

  /**
   * Stop mission trên redeem page.
   */
  async function stopMission() {
    return executeOnPage(() => {
      if (window.Pon1147) {
        window.Pon1147.shouldStop = true;
        return true;
      }
      return false;
    });
  }

  /**
   * Lấy stats từ redeem page.
   */
  async function getStats() {
    return executeOnPage(() => {
      try {
        const raw = localStorage.getItem('garena_redeem_v2_state');
        const state = raw ? JSON.parse(raw) : { results: [] };
        return state.results || [];
      } catch (e) {
        return [];
      }
    });
  }

  /**
   * Refresh stats từ redeem page.
   */
  async function refreshStats() {
    const results = await getStats();
    if (!results) return;

    const counts = results.reduce((a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    }, {});
    document.getElementById('popup-stat-SUCCESS').textContent = counts['SUCCESS'] || 0;
    document.getElementById('popup-stat-USED').textContent = counts['USED'] || 0;
    document.getElementById('popup-stat-INVALID').textContent = counts['INVALID'] || 0;
    document.getElementById('popup-stat-LIMIT_REACHED').textContent = counts['LIMIT_REACHED'] || 0;
  }

  /**
   * Kiểm tra xem tab hiện tại có phải trang redeem không.
   */
  async function checkTab() {
    const tab = await findRedeemTab();
    if (!tab) {
      info.innerHTML = `
        <div class="popup-error">
          Trang hiện tại không phải trang redeem.<br>
          Vui lòng mở <a id="popup-goto-redeem">trang redeem Garena</a> để sử dụng.
        </div>
      `;
      startBtn.disabled = true;
      stopBtn.disabled = true;
      return false;
    }

    startBtn.disabled = false;
    stopBtn.disabled = false;
    info.innerHTML = '<strong>PON1147 Redeem System</strong><br>Đang chạy trên trang redeem Garena.<br>Nhấn <strong>Start Mission</strong> để bắt đầu.';
    return true;
  }

  // --- Event listeners ---

  /**
   * Start Mission: execute script trực tiếp trên redeem page.
   */
  startBtn.addEventListener('click', async () => {
    if (isRunning) return;
    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
    setPopupStatus('RUNNING', 'running');

    // Show panel trước
    await showPanel();
    // Start mission
    await startMission();
  });

  /**
   * Stop Mission: execute script trực tiếp trên redeem page.
   */
  stopBtn.addEventListener('click', async () => {
    isRunning = false;
    startBtn.style.display = '';
    stopBtn.style.display = 'none';
    setPopupStatus('STOPPING', '');

    await stopMission();
  });

  // --- Init ---
  async function init() {
    // Kiểm tra redeem tab
    const isValid = await checkTab();

    // Refresh stats từ redeem page
    if (isValid) {
      await refreshStats();
      // Auto show panel
      await showPanel();
    } else {
      updatePopupStats();
    }
  }

  init();
})();
