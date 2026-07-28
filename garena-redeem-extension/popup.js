(function () {
  'use strict';

  // ============================================================
  // PON1147 REDEEM SYSTEM — Popup Controller
  // Gửi message cho content script (chạy cùng context với window.Pon1147)
  // ============================================================

  // --- DOM elements ---
  const dot = document.getElementById('popup-dot');
  const status = document.getElementById('popup-status');
  const info = document.getElementById('popup-info');
  const startBtn = document.getElementById('popup-start');
  const stopBtn = document.getElementById('popup-stop');

  // --- State ---
  let isRunning = false;

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
   * Tìm redeem tab (tránh popup tab).
   */
  async function findRedeemTab() {
    try {
      const allTabs = await chrome.tabs.query({});
      console.log('[Popup] All tabs:', allTabs.map(t => ({ id: t.id, url: t.url?.slice(0, 60) })));
      const tabs = await chrome.tabs.query({
        url: ['*://redeem.df.garena.sg/*', '*://redeem.garena.com/*'],
      });
      console.log('[Popup] Redeem tabs found:', tabs.length, tabs.map(t => t.id));
      if (tabs.length === 0) return null;
      return tabs.find(t => t.active) || tabs[0];
    } catch (e) {
      console.error('[Popup] findRedeemTab error:', e.message);
      return null;
    }
  }

  /**
   * Gửi message cho content script trên redeem tab.
   */
  async function sendToContent(action, timeout = 3000) {
    const tab = await findRedeemTab();
    console.log('[Popup] sendToContent:', action, 'tab found:', !!tab, 'tabId:', tab?.id);
    if (!tab) {
      console.error('[Popup] Không tìm thấy redeem tab!');
      return false;
    }
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { action });
      console.log('[Popup] ✅ Message sent successfully:', action, 'result:', result);
      return true;
    } catch (e) {
      console.error('[Popup] ❌ Gửi message thất bại:', e.message);
      console.error('[Popup] Tab details:', { id: tab.id, url: tab.url?.slice(0, 80), status: tab.status });
      return false;
    }
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
          Vui lòng mở <a id="popup-goto-redeem" style="color:#4FC3F7;cursor:pointer;text-decoration:underline;">trang redeem Garena</a> để sử dụng.
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
   * Start Mission: gửi message cho content script.
   */
  startBtn.addEventListener('click', async () => {
    if (isRunning) return;
    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
    setPopupStatus('RUNNING', 'running');

    // Gửi message cho content script — nó sẽ show panel + chạy loop
    await sendToContent('startMission');
  });

  /**
   * Stop Mission: gửi message cho content script.
   */
  stopBtn.addEventListener('click', async () => {
    isRunning = false;
    startBtn.style.display = '';
    stopBtn.style.display = 'none';
    setPopupStatus('STOPPING', '');

    await sendToContent('stopMission');
  });

  // --- Init ---
  async function init() {
    // Marker: đảm bảo popup.js thực sự chạy
    const marker = document.getElementById('popup-dot');
    const jsMarker = document.getElementById('popup-js-marker');
    if (marker) {
      marker.style.background = '#58D68D'; // xanh lá = popup.js chạy
      if (jsMarker) jsMarker.textContent = 'JS: OK';
      console.log('[Popup] ✅ popup.js loaded and running');
    } else {
      if (jsMarker) jsMarker.textContent = 'JS: ERR';
      console.error('[Popup] ❌ popup.js loaded but DOM elements missing!');
    }
    console.log('[Popup] Initializing...');
    const isValid = await checkTab();
    console.log('[Popup] checkTab result:', isValid);

    if (isValid) {
      // Auto show panel
      console.log('[Popup] Calling showPanel...');
      await sendToContent('showPanel');
      // Auto refresh stats
      try {
        const tab = await findRedeemTab();
        if (tab) {
          const resp = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
          if (resp?.results) {
            const counts = resp.results.reduce((a, r) => {
              a[r.status] = (a[r.status] || 0) + 1;
              return a;
            }, {});
            document.getElementById('popup-stat-SUCCESS').textContent = counts['SUCCESS'] || 0;
            document.getElementById('popup-stat-USED').textContent = counts['USED'] || 0;
            document.getElementById('popup-stat-INVALID').textContent = counts['INVALID'] || 0;
            document.getElementById('popup-stat-LIMIT_REACHED').textContent = counts['LIMIT_REACHED'] || 0;
          }
        }
      } catch (e) {
        // Fallback localStorage
        updatePopupStats();
      }
    } else {
      updatePopupStats();
    }
  }

  init();
})();
