(function () {
  'use strict';

  // ============================================================
  // PON1147 REDEEM SYSTEM — Core Application
  // File này là entry point chính,orchestrates tất cả modules.
  // KHÔNG chứa UI code — UI nằm ở ui/panel.js
  // ============================================================

  // --- Lấy dependencies từ các module đã load ---
  const CONFIG = window.Pon1147?.config;
  const { sleep, log } = window.Pon1147?.utils ?? {};
  const CODES = window.Pon1147?.codes ?? [];
  const { redeemOne } = window.Pon1147?.redeem ?? {};
  // KHÔNG destructure — stateManager phải giữ saveState/clearState
  const stateManager = window.Pon1147?.state ?? {};
  const { RedeemNetwork } = window.Pon1147?.network ?? {};

  // ============================================================
  // MAIN LOOP — Chạy khi user nhấn "Start Mission" từ panel
  // ============================================================

  /**
   * Bắt đầu mission redeem — vòng lặp chính.
   * Được gọi từ ui/panel.js khi user click button start.
   */
  function startMission() {
    console.error('[startMission] Checking deps:', {
      hasConfig: !!CONFIG,
      hasSleep: !!sleep,
      hasLog: !!log,
      hasRedeem: !!redeemOne,
      hasState: !!stateManager,
      codesLen: CODES?.length ?? 0,
      stateObj: !!stateManager?.state,
      stateKeys: stateManager ? Object.keys(stateManager) : 'N/A',
    });
    if (!CONFIG || !sleep || !log || !redeemOne || !stateManager || !CODES.length) {
      console.error('[PON1147] Thiếu dependencies để start mission');
      return;
    }

    // Đảm bảo results luôn là array
    if (!Array.isArray(stateManager.state?.results)) {
      stateManager.state = { ...stateManager.state, results: [] };
    }
    const startIndex = stateManager.state?.index ?? 0;
    console.error('[startMission] Loop bắt đầu — index:', startIndex, 'total:', CODES.length);

    // Hiển thị badge trên panel để xác nhận loop đang chạy
    console.error('[startMission] About to show badge and start IIFE');
    if (window.Pon1147?.showLoopBadge) window.Pon1147.showLoopBadge();

    (async () => {
      try {
        console.error('[startMission] Loop IIFE entered — startIndex:', startIndex);
        for (let i = startIndex; i < CODES.length; i++) {
          // Kiểm tra xem có nên dừng không
          if (window.Pon1147?.shouldStop) {
            console.error('[startMission] Breaking due to shouldStop');
            log('INFO', 'Mission bị dừng bởi người dùng');
            if (window.Pon1147?.setStatus) window.Pon1147.setStatus('STOPPING');
            break;
          }

          const code = CODES[i];

          // Cập nhật UI current code
          if (window.Pon1147?.setStatus) window.Pon1147.setStatus('RUNNING', code);

          // Redeem code này
          let res;
          try {
            res = await redeemOne(code, i + 1, CODES.length);
          } catch (err) {
            console.error('[startMission] redeemOne threw:', err);
            res = { stt: `${i + 1}/${CODES.length}`, code, status: 'ERROR', message: err?.message || String(err) };
          }

          // Lưu kết quả và tiến trình
          stateManager.state.results = stateManager.state.results || [];
          stateManager.state.results.push(res);
          stateManager.state.index = i + 1;
          stateManager.saveState();

          // Cập nhật UI
          if (window.Pon1147?.setProgress) window.Pon1147.setProgress(i + 1, CODES.length);
          if (window.Pon1147?.setStats) window.Pon1147.setStats(stateManager.state.results);

          const level = res.status === 'SUCCESS' ? 'SUCCESS' : 'WARN';
          log(level, res.status, code);
          if (window.Pon1147?.addLog) window.Pon1147.addLog(res.status, code, res.message);

          // Đợi giữa các lần redeem
          await sleep(CONFIG.delayBetweenCodesMs);
        }
      } finally {
        // Mission kết thúc (tự nhiên hoặc bị dừng)
        if (window.Pon1147?.setStatus) window.Pon1147.setStatus('FINISHED');
        if (window.Pon1147?.setProgress) window.Pon1147.setProgress(CODES.length, CODES.length);

        const total = (stateManager.state?.results || []).length;
        if (window.Pon1147?.addLog) window.Pon1147.addLog('INFO', 'COMPLETE', `${total} codes đã xử lý`);

        console.table(
          (stateManager.state?.results || []).reduce((a, r) => {
            a[r.status] = (a[r.status] || 0) + 1;
            return a;
          }, {}),
        );
        log('INFO', 'Mission hoàn tất', `${total} codes`);

        // Restore hooks và clear state
        if (window.Pon1147?.network?.restoreHooks) window.Pon1147.network.restoreHooks();
        try { stateManager.clearState(); } catch(e) { console.error('[startMission] clearState failed:', e); }

        // Reset signal dừng
        window.Pon1147.shouldStop = false;
        isMissionRunning = false;
        isRunning = false;
        window.Pon1147.isRunning = false;
      }
      // Ẩn badge loop (ngoài try/finally — luôn chạy)
      if (window.Pon1147?.hideLoopBadge) window.Pon1147.hideLoopBadge();
    })();
  }

  /**
   * Dừng mission đang chạy.
   * Được gọi từ ui/panel.js khi user click button abort.
   */
  function abortMission() {
    console.error('[abortMission] Setting shouldStop = true');
    window.Pon1147.shouldStop = true;
    if (window.Pon1147?.setStatus) window.Pon1147.setStatus('STOPPING');
    if (window.Pon1147?.els?.stop) window.Pon1147.els.stop.disabled = true;
  }

  // --- Khởi tạo: đăng ký network hooks ---
  if (RedeemNetwork?.start) {
    RedeemNetwork.start();
    console.log('%c[PON1147] Network hooks đã khởi tạo', 'color:#4fc3f7;font-weight:bold;');
  }

  // --- Message listener: giao tiếp với popup ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.error('[MessageListener] Received:', msg.action, 'from:', sender?.id);
    if (msg.action === 'startMission') {
      if (isMissionRunning) {
        console.error('[MessageListener] startMission called but already running, skipping');
        sendResponse({ ok: true, skipped: true });
        return true;
      }
      console.error('[MessageListener] Calling startMission, shouldStop before:', !!window.Pon1147?.shouldStop);
      isMissionRunning = true;
      isRunning = true;
      window.Pon1147.isRunning = true;
      startMission();
      sendResponse({ ok: true });
    } else if (msg.action === 'stopMission') {
      console.error('[MessageListener] Calling abortMission');
      abortMission();
      sendResponse({ ok: true });
    } else if (msg.action === 'showPanel') {
      console.error('[MessageListener] Calling showPanel');
      // Gọi showPanel từ ui/panel.js
      if (window.Pon1147?.showPanel) {
        window.Pon1147.showPanel();
      }
      sendResponse({ ok: true });
    } else if (msg.action === 'getStats') {
      // Popup hỏi stats
      try {
        const raw = localStorage.getItem(CONFIG.resumeKey);
        const state = raw ? JSON.parse(raw) : { results: [] };
        sendResponse({ results: state.results || [] });
      } catch (e) {
        sendResponse({ results: [] });
      }
    }
    return true; // Keep message channel open for async response
  });

  // --- Guard prevent duplicate startMission ---
  let isMissionRunning = false;
  let isRunning = false;

  // --- Expose public API cho ui/panel.js ---
  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.startMission = function missionWrapper() {
    if (isMissionRunning) {
      console.error('[startMission] Already running, skipping duplicate call');
      return;
    }
    isMissionRunning = true;
    return startMission();
  };
  window.Pon1147.abortMission = abortMission;

  console.log('%c[PON1147] Core app đã khởi tạo — ' + CODES.length + ' codes sẵn sàng', 'color:#59D67C;font-weight:bold;');
})();
