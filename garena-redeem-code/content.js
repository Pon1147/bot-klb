// ===== CONTENT SCRIPT: Garena Redeem Code =====
// Inject dashboard panel lên trang + redeem logic

(() => {
  'use strict';

  console.log(
    '%c[Garena Redeem] Content script loaded!',
    'color: #22c55e; font-weight: bold; font-size: 12px;',
  );
  console.log('[Garena Redeem] Current URL:', window.location.href);

  // ===== DASHBOARD PANEL =====
  // Inject floating dashboard lên trang web
  const DASHBOARD_ID = 'garena-redeem-dashboard';
  let dashUpdate = null; // Callback để update dashboard từ redeem loop

  function injectDashboard() {
    if (document.getElementById(DASHBOARD_ID)) return; // Tránh inject nhiều lần

    const style = document.createElement('style');
    style.textContent = `
      #${DASHBOARD_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        max-height: 500px;
        z-index: 2147483646;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        background: rgba(15, 17, 23, 0.92);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(59, 130, 246, 0.2);
        color: #e4e6f0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        user-select: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      #${DASHBOARD_ID}.dashboard-hidden {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
      }

      /* Drag handle */
      #${DASHBOARD_ID} .dash-drag-handle {
        height: 6px;
        cursor: grab;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      #${DASHBOARD_ID} .dash-drag-handle:active { cursor: grabbing; }

      /* Header */
      #${DASHBOARD_ID} .dash-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 8px;
      }
      #${DASHBOARD_ID} .dash-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${DASHBOARD_ID} .dash-header-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      #${DASHBOARD_ID} .dash-header-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.3px;
      }
      #${DASHBOARD_ID} .dash-header-status {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
      }
      #${DASHBOARD_ID} .dash-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #8b8fa3;
      }
      #${DASHBOARD_ID} .dash-status-dot.running {
        background: #22c55e;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
        animation: dash-pulse 1.5s infinite;
      }
      #${DASHBOARD_ID} .dash-status-dot.stopped {
        background: #ef4444;
      }
      @keyframes dash-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* Stats */
      #${DASHBOARD_ID} .dash-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: 6px 14px;
      }
      #${DASHBOARD_ID} .dash-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 2px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 8px;
      }
      #${DASHBOARD_ID} .dash-stat-value {
        font-size: 18px;
        font-weight: 800;
        line-height: 1;
      }
      #${DASHBOARD_ID} .dash-stat-label {
        font-size: 9px;
        color: #8b8fa3;
        margin-top: 3px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #${DASHBOARD_ID} .dash-stat-success .dash-stat-value { color: #22c55e; }
      #${DASHBOARD_ID} .dash-stat-fail .dash-stat-value { color: #ef4444; }
      #${DASHBOARD_ID} .dash-stat-remaining .dash-stat-value { color: #3b82f6; }

      /* Progress */
      #${DASHBOARD_ID} .dash-progress {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 14px 8px;
      }
      #${DASHBOARD_ID} .dash-progress-bg {
        flex: 1;
        height: 5px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 3px;
        overflow: hidden;
      }
      #${DASHBOARD_ID} .dash-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #3b82f6, #a855f7);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      #${DASHBOARD_ID} .dash-progress-text {
        font-size: 10px;
        font-weight: 700;
        color: #3b82f6;
        min-width: 32px;
        text-align: right;
      }

      /* Buttons */
      #${DASHBOARD_ID} .dash-controls {
        display: flex;
        gap: 6px;
        padding: 0 14px 8px;
      }
      #${DASHBOARD_ID} .dash-btn {
        flex: 1;
        padding: 8px 0;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      #${DASHBOARD_ID} .dash-btn:active { transform: scale(0.97); }
      #${DASHBOARD_ID} .dash-btn-start {
        background: #22c55e;
        color: #fff;
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
      }
      #${DASHBOARD_ID} .dash-btn-start:hover:not(:disabled) {
        background: #16a34a;
      }
      #${DASHBOARD_ID} .dash-btn-start:disabled {
        background: #374151;
        color: #6b7280;
        cursor: not-allowed;
        box-shadow: none;
      }
      #${DASHBOARD_ID} .dash-btn-stop {
        background: #ef4444;
        color: #fff;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      }
      #${DASHBOARD_ID} .dash-btn-stop:hover:not(:disabled) {
        background: #dc2626;
      }
      #${DASHBOARD_ID} .dash-btn-stop:disabled {
        background: #374151;
        color: #6b7280;
        cursor: not-allowed;
        box-shadow: none;
      }

      /* Logs */
      #${DASHBOARD_ID} .dash-logs-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 14px;
      }
      #${DASHBOARD_ID} .dash-logs-title {
        font-size: 10px;
        font-weight: 700;
        color: #8b8fa3;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      #${DASHBOARD_ID} .dash-logs-clear {
        background: none;
        border: none;
        font-size: 12px;
        cursor: pointer;
        opacity: 0.4;
        transition: opacity 0.2s;
        padding: 2px 4px;
        border-radius: 3px;
      }
      #${DASHBOARD_ID} .dash-logs-clear:hover { opacity: 1; background: rgba(255,255,255,0.06); }
      #${DASHBOARD_ID} .dash-logs {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 0;
      }
      #${DASHBOARD_ID} .dash-logs::-webkit-scrollbar { width: 3px; }
      #${DASHBOARD_ID} .dash-logs::-webkit-scrollbar-track { background: transparent; }
      #${DASHBOARD_ID} .dash-logs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      #${DASHBOARD_ID} .dash-log-placeholder {
        text-align: center;
        padding: 16px 0;
        color: #8b8fa3;
        font-size: 11px;Hienej 
        font-style: italic;
      }
      #${DASHBOARD_ID} .dash-log-entry {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        font-size: 10px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        animation: dash-logSlide 0.2s ease;
      }
      @keyframes dash-logSlide {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #${DASHBOARD_ID} .dash-log-entry:last-child { border-bottom: none; }
      #${DASHBOARD_ID} .dash-log-index { color: #8b8fa3; min-width: 28px; font-weight: 600; }
      #${DASHBOARD_ID} .dash-log-code { color: #e4e6f0; font-weight: 600; word-break: break-all; flex: 1; }
      #${DASHBOARD_ID} .dash-log-status {
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        flex-shrink: 0;
      }
      #${DASHBOARD_ID} .dash-log-status.SUCCESS { background: rgba(34,197,94,0.15); color: #22c55e; }
      #${DASHBOARD_ID} .dash-log-status.FAILED { background: rgba(239,68,68,0.15); color: #ef4444; }
      #${DASHBOARD_ID} .dash-log-status.EXPIRED { background: rgba(245,158,11,0.15); color: #f59e0b; }
      #${DASHBOARD_ID} .dash-log-status.USED { background: rgba(168,85,247,0.15); color: #a855f7; }
      #${DASHBOARD_ID} .dash-log-status.INVALID { background: rgba(239,68,68,0.15); color: #ef4444; }
      #${DASHBOARD_ID} .dash-log-status.LIMIT_REACHED { background: rgba(239,68,68,0.15); color: #ef4444; }
      #${DASHBOARD_ID} .dash-log-status.UNKNOWN { background: rgba(139,143,163,0.15); color: #8b8fa3; }
      #${DASHBOARD_ID} .dash-log-msg {
        color: #8b8fa3;
        font-size: 9px;
        width: 100%;
        padding-left: 34px;
        word-break: break-word;
      }

      /* Footer */
      #${DASHBOARD_ID} .dash-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 14px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 10px;
        font-weight: 600;
      }
      #${DASHBOARD_ID} .dash-footer-icon {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      #${DASHBOARD_ID} .dash-footer-text { color: #8b8fa3; }
      #${DASHBOARD_ID} .dash-footer-discord {
        color: #22c55e;
        text-decoration: none;
        font-weight: 700;
        margin-left: 4px;
      }
      #${DASHBOARD_ID} .dash-footer-discord:hover { text-decoration: underline; }

      /* Close button */
      #${DASHBOARD_ID} .dash-close {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.8);
        border: none;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      #${DASHBOARD_ID} .dash-close:hover { background: #dc2626; }
    `;
    document.head.appendChild(style);

    // Tạo panel HTML
    const panel = document.createElement('div');
    panel.id = DASHBOARD_ID;
    panel.innerHTML = `
      <div class="dash-drag-handle"></div>
      <div class="dash-header">
        <div class="dash-header-left">
          <div class="dash-header-icon" data-src="icon_48.png"></div>
          <span class="dash-header-title">Garena Redeem</span>
        </div>
        <div class="dash-header-status">
          <span class="dash-status-dot" id="dashStatusDot"></span>
          <span class="dash-status-text" id="dashStatusText">Sẵn sàng</span>
        </div>
      </div>

      <div class="dash-stats">
        <div class="dash-stat">
          <span class="dash-stat-value" id="dashStatTotal">0</span>
          <span class="dash-stat-label">Tổng</span>
        </div>
        <div class="dash-stat dash-stat-success">
          <span class="dash-stat-value" id="dashStatSuccess">0</span>
          <span class="dash-stat-label">Thành công</span>
        </div>
        <div class="dash-stat dash-stat-fail">
          <span class="dash-stat-value" id="dashStatFailed">0</span>
          <span class="dash-stat-label">Thất bại</span>
        </div>
        <div class="dash-stat dash-stat-remaining">
          <span class="dash-stat-value" id="dashStatRemaining">0</span>
          <span class="dash-stat-label">Còn lại</span>
        </div>
      </div>

      <div class="dash-progress">
        <div class="dash-progress-bg">
          <div class="dash-progress-fill" id="dashProgressBar"></div>
        </div>
        <span class="dash-progress-text" id="dashProgressText">0%</span>
      </div>

      <div class="dash-controls">
        <button class="dash-btn dash-btn-start" id="dashBtnStart">&#9654; Bắt đầu</button>
        <button class="dash-btn dash-btn-stop" id="dashBtnStop" disabled>&#9632; Dừng</button>
      </div>

      <div class="dash-logs-header">
        <span class="dash-logs-title">&#128221; Nhật ký</span>
        <button class="dash-logs-clear" id="dashBtnClearLogs">&#128465;</button>
      </div>
      <div class="dash-logs" id="dashLogsContainer">
        <div class="dash-log-placeholder">Chưa có log nào...</div>
      </div>

      <div class="dash-footer">
        <div class="dash-footer-icon" data-src="icon_16.png"></div>
        <span class="dash-footer-text">Pon1147 Redeem Tool</span>
        <a href="https://discord.gg/vz6w6c3Xe3" target="_blank" class="dash-footer-discord">Join Discord</a>
      </div>
    `;
    document.body.appendChild(panel);
    console.log('[Garena Redeem] Dashboard panel appended to DOM');

    // ===== Set icon background-image từ chrome.runtime.getURL =====
    panel.querySelectorAll('[data-src]').forEach((el) => {
      const url = chrome.runtime.getURL(`icons/${el.dataset.src}`);
      console.log(`[Garena Redeem] Icon: ${el.dataset.src} → ${url}`);
      el.style.backgroundImage = `url('${url}')`;
    });
    // ===== DRAG FUNCTIONALITY =====
    const dragHandle = panel.querySelector('.dash-drag-handle');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      dragHandle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = `${e.clientX - dragOffsetX}px`;
      panel.style.top = `${e.clientY - dragOffsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
    });

    // ===== DASHBOARD STATE & UI =====
    let dashState = {
      total: 0,
      success: 0,
      failed: 0,
      logs: [],
    };

    const $ = (id) => panel.querySelector(`#${id}`);

    function updateDashStats() {
      const remaining = Math.max(0, dashState.total - dashState.success - dashState.failed);
      const progress =
        dashState.total > 0
          ? Math.round(((dashState.success + dashState.failed) / dashState.total) * 100)
          : 0;

      $('dashStatTotal').textContent = dashState.total;
      $('dashStatSuccess').textContent = dashState.success;
      $('dashStatFailed').textContent = dashState.failed;
      $('dashStatRemaining').textContent = remaining;
      $('dashProgressBar').style.width = `${progress}%`;
      $('dashProgressText').textContent = `${progress}%`;
    }

    function setDashStatus(state, text) {
      const dot = $('dashStatusDot');
      dot.className = 'dash-status-dot';
      if (state === 'running') dot.classList.add('running');
      else if (state === 'stopped' || state === 'finished') dot.classList.add('stopped');
      $('dashStatusText').textContent = text;

      $('dashBtnStart').disabled = state === 'running';
      $('dashBtnStop').disabled = state !== 'running';
    }

    function addDashLog(index, code, status, message) {
      const placeholder = panel.querySelector('.dash-log-placeholder');
      if (placeholder) placeholder.remove();

      const entry = document.createElement('div');
      entry.className = 'dash-log-entry';
      entry.innerHTML = `
        <span class="dash-log-index">#${index}</span>
        <span class="dash-log-code">${code}</span>
        <span class="dash-log-status ${status}">${status}</span>
      `;
      $('dashLogsContainer').appendChild(entry);

      if (message) {
        const msg = document.createElement('div');
        msg.className = 'dash-log-msg';
        msg.textContent = message;
        $('dashLogsContainer').appendChild(msg);
      }

      $('dashLogsContainer').scrollTop = $('dashLogsContainer').scrollHeight;
    }

    function clearDashLogs() {
      $('dashLogsContainer').innerHTML =
        '<div class="dash-log-placeholder">Chưa có log nào...</div>';
      dashState.logs = [];
      dashState.success = 0;
      dashState.failed = 0;
      dashState.total = 0;
      updateDashStats();
    }

    // ===== DASHBOARD EVENT LISTENERS =====
    // Gọi trực tiếp module-level functions (cùng closure scope)
    const btnStart = $('dashBtnStart');
    const btnStop = $('dashBtnStop');
    const btnClear = $('dashBtnClearLogs');

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        console.log('[Garena Redeem] Start button clicked, isRunning:', isRunning);
        if (isRunning) return;
        if (!window.location.hostname.includes('redeem.df.garena.sg')) {
          setDashStatus('idle', 'Sai trang');
          addDashLog(0, '-', 'ERROR', 'Mở redeem.df.garena.sg');
          return;
        }
        runRedeem();
        setDashStatus('running', 'Đang chạy...');
      });
    } else {
      console.error('[Garena Redeem] dashBtnStart not found!');
    }

    if (btnStop) {
      btnStop.addEventListener('click', () => {
        console.log('[Garena Redeem] Stop button clicked');
        currentAbort = true;
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', clearDashLogs);
    }

    // ===== HELPER: UPDATE FROM REDEEM RESULTS =====
    function handleRedeemMessage(message) {
      switch (message.type) {
        case 'CODES_LOADED':
          dashState.total = message.total;
          updateDashStats();
          break;

        case 'CODE_RESULT':
          if (message.status === 'SUCCESS') dashState.success++;
          else dashState.failed++;
          updateDashStats();
          addDashLog(message.index, message.code, message.status, message.message);
          break;

        case 'REDEEM_FINISHED':
          setDashStatus('finished', 'Hoàn tất');
          $('dashBtnStart').disabled = false;
          $('dashBtnStop').disabled = true;
          break;

        case 'REDEEM_STOPPED':
          setDashStatus('stopped', 'Đã dừng');
          $('dashBtnStart').disabled = false;
          $('dashBtnStop').disabled = true;
          break;

        case 'ERROR':
          setDashStatus('idle', 'Lỗi');
          $('dashBtnStart').disabled = false;
          $('dashBtnStop').disabled = true;
          addDashLog(0, '-', 'ERROR', message.message);
          break;

        case 'NOT_ON_PAGE':
          setDashStatus('idle', 'Sai trang');
          $('dashBtnStart').disabled = true;
          $('dashBtnStop').disabled = true;
          addDashLog(0, '-', 'ERROR', 'Mở https://redeem.df.garena.sg/vi/cdkgarena.html');
          break;
      }
    }

    // ===== LISTEN FOR MESSAGES FROM SERVICE WORKER =====
    // Chỉ update dashboard, KHÔNG sendResponse để không chặn listener MESSAGE HANDLER
    chrome.runtime.onMessage.addListener((message) => {
      handleRedeemMessage(message);
    });

    // ===== INIT =====
    setDashStatus('idle', 'Sẵn sàng');
    updateDashStats();

    // Kiểm tra trang
    if (!window.location.hostname.includes('redeem.df.garena.sg')) {
      setDashStatus('idle', 'Sai trang');
      $('dashBtnStart').disabled = true;
      $('dashBtnStop').disabled = true;
      addDashLog(0, '-', 'ERROR', 'Mở redeem.df.garena.sg để bắt đầu');
    }

    // Trả về callback để redeem loop update dashboard
    dashUpdate = handleRedeemMessage;
  }

  // ===== CẤU HÌNH =====
  const CONFIG = {
    maxRetries: 2,
    delayBetweenCodesMs: 1300,
    timeoutMs: 8500,
    submitConfirmMs: 400,
  };

  // ===== TRẠNG THÁI =====
  let isRunning = false;
  let currentAbort = false;
  let codes = [];
  let currentIndex = 0;
  let results = [];

  // ===== LOAD CODES =====
  // Luôn load từ DEFAULT_CODES (code_redeem.js) — không lưu codes vào chrome.storage
  function loadCodes() {
    if (typeof DEFAULT_CODES === 'undefined' || !Array.isArray(DEFAULT_CODES)) {
      console.error('[Garena Redeem] DEFAULT_CODES not found or invalid! code_redeem.js may have failed to load.');
      // Fallback: codes rỗng để tránh crash
      return Promise.resolve([]);
    }
    console.log('[Garena Redeem] Loaded', DEFAULT_CODES.length, 'codes from DEFAULT_CODES');
    return Promise.resolve(DEFAULT_CODES);
  }

  // Codes mặc định — load từ code_redeem.js (injected above)
  // DEFAULT_CODES là global const từ file riêng

  // ===== UTILS =====
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ===== CLASSIFIER =====
  // Phân loại kết quả redeem dựa trên response object hoặc message text
  const classify = (input) => {
    if (input && typeof input === 'object' && 'code' in input) {
      switch (input.code) {
        case 0:
          return 'SUCCESS';

        case 400067:
        case 400068:
          return 'LIMIT_REACHED';

        case 400070:
          return 'EXPIRED';

        case 400073:
          return 'PRESENT_ERROR';

        case 400054:
          return 'INVALID';

        case 400072:
          return 'USED';

        default:
          return 'UNKNOWN';
      }
    }

    const t = String(input || '').toLowerCase();

    if (/^ok$|thành công|success/.test(t)) return 'SUCCESS';

    if (
      /error_hint_400067|error_hint_400068|reached the redemption limit|limit of cdkey group|đạt giới hạn/.test(
        t,
      )
    ) {
      return 'LIMIT_REACHED';
    }

    if (/error_hint_400070|hết hạn|expired/.test(t)) return 'EXPIRED';

    if (/error_hint_400073|current cdkey present error/.test(t)) {
      return 'PRESENT_ERROR';
    }

    if (/error_hint_400054|không hợp lệ|invalid|sai|current cdk does not match/.test(t)) {
      return 'INVALID';
    }

    if (/error_hint_400072|đã.*(nhận|sử dụng)|already|used/.test(t)) {
      return 'USED';
    }

    if (/captcha|xác minh|verification/.test(t)) return 'VERIFY';

    if (/lỗi mạng|network|rate|quá nhanh|too fast/.test(t)) {
      return 'TEMP_ERROR';
    }

    return 'UNKNOWN';
  };

  // ===== DOM HELPERS =====
  // Kiểm tra element có hiển thị không
  const visible = (el) =>
    el &&
    getComputedStyle(el).display !== 'none' &&
    getComputedStyle(el).visibility !== 'hidden' &&
    el.getBoundingClientRect().width > 0;

  // Tìm element đầu tiên khớp selector
  const selectors = {
    input: ['input.exc-input', 'input[type="text"]', 'input.spr'],
    button: ['a.btn-exchange', 'button.btn-exchange', 'a[href*="javascript"]', 'button', 'a'],
    dialog: ['[role="dialog"]', '.ant-modal', '.modal'],
    close: ['.ant-modal-close', '.close'],
  };

  const find = (sels, pred = () => true) => {
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        if (visible(el) && pred(el)) return el;
      }
    }
    return null;
  };

  // ===== POLLING: Chờ UI redeem hiện lên (SPA) =====
  // Trang là SPA — input/button có thể chưa render khi content script load
  let cachedInput = null;
  let cachedButton = null;

  const waitForUI = (timeoutMs = 10000) =>
    new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const input = find(selectors.input);
        const btn = find(selectors.button, (el) =>
          /đổi|redeem|exchange|confirm|xác nhận/i.test(el.textContent || ''),
        );
        if (input && btn) {
          cachedInput = input;
          cachedButton = btn;
          console.log('[Garena Redeem] UI found! input:', input, 'button:', btn);
          resolve(true);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          console.warn('[Garena Redeem] UI not found after timeout');
          console.warn('[Garena Redeem] inputs:', document.querySelectorAll('input').length);
          console.warn(
            '[Garena Redeem] buttons/links:',
            document.querySelectorAll('a, button').length,
          );
          resolve(false);
          return;
        }
        setTimeout(check, 300);
      };
      check();
    });

  // Chờ dialog hiện lên — polling 80ms
  const lastDialogText = { value: '' };
  const dialogObserver = new MutationObserver(() => {
    const d = find(selectors.dialog);
    if (d) lastDialogText.value = (d.textContent || '').trim() || lastDialogText.value;
  });
  dialogObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  const waitForDialog = (timeout) =>
    new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const d = find(selectors.dialog);
        if (d && d.textContent.trim()) resolve(d.textContent.trim());
        else if (Date.now() - start > timeout) resolve(lastDialogText.value || '');
        else setTimeout(check, 80);
      };
      check();
    });

  // ===== NETWORK INTERCEPTOR =====
  // Intercept fetch và XHR để bắt response redeem
  let currentAttempt = null;

  const isRedeemResponse = (url = '', data) => {
    if (!data || typeof data !== 'object' || data.code === undefined) return false;
    const u = url.toLowerCase();
    return (
      /\/redeem|\/exc|\/cdkey|\/gift/i.test(u) ||
      (/\/api\/v[0-9]\//.test(u) && /\/redeem|\/exc|\/cdkey/.test(u))
    );
  };

  const createAttempt = () => ({
    startTime: Date.now(),
    done: false,
    resolve: null,
    promise: null,
  });

  const resolveIfMatch = (payload) => {
    if (!currentAttempt || currentAttempt.done) return;
    if (Date.now() - currentAttempt.startTime > CONFIG.timeoutMs) return;
    currentAttempt.done = true;
    currentAttempt.resolve(payload);
  };

  // Intercept fetch
  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const res = await originalFetch(...args);
      res
        .clone()
        .json()
        .then((d) => {
          if (isRedeemResponse(url, d)) resolveIfMatch({ source: 'fetch', data: d, url });
        })
        .catch(() => {});
      return res;
    };
  }

  // Intercept XHR
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...a) {
    this.__url = a[1];
    return originalXhrOpen.apply(this, a);
  };

  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('loadend', () => {
      try {
        const d = JSON.parse(this.responseText);
        if (isRedeemResponse(this.__url, d))
          resolveIfMatch({ source: 'xhr', data: d, url: this.__url });
      } catch (e) {}
    });
    return originalXhrSend.apply(this, a);
  };

  // ===== REDEEM ONE CODE =====
  // Redeem một code duy nhất, retry nếu network error
  const redeemOne = async (code, idx, total) => {
    // Đảm bảo UI đã render (chỉ cần lần đầu)
    if (!cachedInput || !cachedButton) {
      const uiReady = await waitForUI(10000);
      if (!uiReady) {
        return {
          index: `${idx}/${total}`,
          code,
          status: 'UNKNOWN',
          message: 'Không tìm thấy UI redeem',
        };
      }
    }

    for (let att = 1; att <= CONFIG.maxRetries + 1; att++) {
      lastDialogText.value = '';
      // Kiểm tra abort
      if (currentAbort) return null;

      // Refresh cached elements (SPA có thể re-render)
      const input = cachedInput && visible(cachedInput) ? cachedInput : find(selectors.input);
      const btn = find(selectors.button, (el) =>
        /đổi|redeem|exchange|confirm|xác nhận/i.test(el.textContent || ''),
      );

      if (!input || !btn) {
        // Fallback: thử waitForUI lại
        const uiReady = await waitForUI(5000);
        if (!uiReady) {
          return {
            index: `${idx}/${total}`,
            code,
            status: 'UNKNOWN',
            message: 'Không tìm thấy UI redeem',
          };
        }
      }

      // Set value programmatically (vượt qua React proxy)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, code);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await sleep(300);

      // Tạo attempt mới cho request này
      currentAttempt = createAttempt();
      currentAttempt.promise = new Promise((r) => {
        currentAttempt.resolve = r;
      });

      // Click button và chờ kết quả
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(CONFIG.submitConfirmMs);

      // Race: network result HOẶC dialog text
      let result;

      try {
        result = await Promise.race([
          currentAttempt.promise,
          sleep(CONFIG.timeoutMs).then(() => null),
        ]);
      } catch {
        result = null;
      }

      // Ưu tiên network data (có {code, msg}) thay vì dialog text
      const netData = result?.data ?? null;

      let status;
      let message;

      if (netData && typeof netData === 'object') {
        // API response là source of truth
        status = classify(netData);
        message = netData.msg ?? `code:${netData.code}`;
      } else {
        // Chỉ dùng dialog khi KHÔNG có network response
        message = lastDialogText.value || 'Timeout';
        status = classify(message);
      }

      // Retry chỉ khi TEMP_ERROR (network transient)
      if (status === 'TEMP_ERROR' && att <= CONFIG.maxRetries) {
        await sleep(1600);
        continue;
      }

      // Đóng dialog nếu mở
      const closeEl = find(selectors.close);
      if (closeEl) closeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(300);

      currentAttempt = null;
      return { index: `${idx}/${total}`, code, status, message };
    }

    currentAttempt = null;
    return { index: `${idx}/${total}`, code, status: 'FAILED', message: 'Đã retry hết lần' };
  };

  // ===== MAIN REDEEM LOOP =====
  // Vòng lặp redeem chính — chạy tuần tự từng code
  const runRedeem = async () => {
    isRunning = true;
    currentAbort = false;

    // Load codes
    codes = await loadCodes();
    if (codes.length === 0) {
      sendMessageToPopup({ type: 'ERROR', message: 'Không có code nào để redeem' });
      isRunning = false;
      return;
    }

    // Báo popup đã load codes
    sendMessageToPopup({ type: 'CODES_LOADED', total: codes.length });

    currentIndex = 0;
    results = [];

    try {
      for (let i = 0; i < codes.length; i++) {
        if (currentAbort) {
          sendMessageToPopup({ type: 'REDEEM_STOPPED' });
          return;
        }

        const res = await redeemOne(codes[i], i + 1, codes.length);
        if (!res) continue; // bị abort

        currentIndex = i + 1;
        results.push(res);

        // Gửi kết quả về popup
        sendMessageToPopup({
          type: 'CODE_RESULT',
          index: res.index,
          code: res.code,
          status: res.status,
          message: res.message,
        });

        // Delay giữa các code
        await sleep(CONFIG.delayBetweenCodesMs);
      }

      // Hoàn tất
      sendMessageToPopup({ type: 'REDEEM_FINISHED' });
    } catch (error) {
      sendMessageToPopup({ type: 'ERROR', message: error.message });
    }

    isRunning = false;
  };

  // ===== MESSAGE HANDLER =====
  // Nhận tin nhắn từ popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { command } = message;

    if (command === 'START_REDEEM') {
      // Kiểm tra đang ở trang đúng không
      if (!window.location.hostname.includes('redeem.df.garena.sg')) {
        sendResponse({ error: 'NOT_ON_PAGE' });
        return true; // async response
      }

      if (isRunning) {
        sendResponse({ error: 'ALREADY_RUNNING' });
        return true;
      }

      runRedeem();
      sendResponse({ ok: true });
      return true;
    }

    if (command === 'STOP_REDEEM') {
      currentAbort = true;
      sendResponse({ ok: true });
      return true;
    }

    if (command === 'GET_STATUS') {
      sendResponse({
        isRunning,
        currentIndex,
        total: codes.length,
        results,
      });
      return true;
    }

    sendResponse({ ok: true });
  });

  // ===== HELPER: SEND MESSAGE TO POPUP + UPDATE DASHBOARD =====
  // Gửi cho popup (nếu mở) + update dashboard trực tiếp
  function sendMessageToPopup(payload) {
    // Update dashboard (nếu đã inject)
    if (dashUpdate) dashUpdate(payload);
    // Gửi cho popup (nếu đang mở)
    chrome.runtime.sendMessage(payload).catch(() => {
      // Popup có thể đã đóng — bỏ qua lỗi
    });
  }

  // ===== INJECT CODES SCRIPT =====
  // Load DEFAULT_CODES từ file riêng (code_redeem.js)
  (function injectCodesScript() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('code_redeem.js');
    s.onload = () => console.log('[Garena Redeem] code_redeem.js loaded');
    s.onerror = () => console.error('[Garena Redeem] Failed to load code_redeem.js');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ===== INJECT DASHBOARD =====
  try {
    injectDashboard();
    console.log(
      '%c[Garena Redeem] Dashboard injected successfully!',
      'color: #3b82f6; font-weight: bold;',
    );
  } catch (e) {
    console.error('[Garena Redeem] Dashboard injection failed:', e);
    alert('Lỗi inject dashboard: ' + e.message);
  }
})();
