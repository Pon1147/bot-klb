/**
 * Dashboard UI — render và update Garena Redeem dashboard
 *
 * Tách khỏi content.js để giảm God Object.
 * Dependencies: computeRemaining, getCentralState, setCentralState, transition, renderLogs, getReasonLabel
 */

(function () {
  'use strict';

  // ===== DOM elements =====
  let panel, statusDot, statusText, statTotal, statSuccess, statFailed, statRemaining;
  let progressFill, progressText, btnStart, btnStop, logsContainer, currentCodeEl;
  let callbacks = { onStart: null, onStop: null };

  // ===== STATUS CONFIG =====
  const STATUS_CONFIG = {
    NO_CODES: { dotClass: 'grd-no-codes', text: 'Chưa sẵn sàng' },
    READY: { dotClass: 'grd-ready', text: 'Sẵn sàng' },
    RUNNING: { dotClass: 'grd-running', text: 'Đang chạy' },
    PAUSED: { dotClass: 'grd-paused', text: 'Đã tạm dừng' },
    COMPLETED: { dotClass: 'grd-completed', text: 'Hoàn tất' },
  };

  // ===== REASON LABELS =====
  const REASON_LABELS = {
    REDEEMED: 'Đã nhận thành công',
    USED: 'Đã sử dụng',
    EXPIRED: 'Hết hạn',
    INVALID: 'Không hợp lệ',
    LIMIT_REACHED: 'Đạt giới hạn',
    PRESENT_ERROR: 'Lỗi trình bày',
    VERIFY: 'Cần xác minh',
    TEMP_ERROR: 'Lỗi tạm thời',
    UNKNOWN: 'Không xác định',
    NO_RESPONSE: 'Không có phản hồi',
  };

  function getReasonLabel(reason) {
    return REASON_LABELS[reason] || reason;
  }

  // ===== INIT DASHBOARD =====
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
        <div class="grd-stat"><div class="grd-stat-value grd-stat-total">0</div><div class="grd-stat-label">Tổng</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-success">0</div><div class="grd-stat-label">Thành công</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-failed">0</div><div class="grd-stat-label">Thất bại</div></div>
        <div class="grd-stat"><div class="grd-stat-value grd-stat-remaining">0</div><div class="grd-stat-label">Còn lại</div></div>
      </div>
      <div class="grd-progress-wrap">
        <div class="grd-progress-bar"><div class="grd-progress-fill"></div></div>
        <div class="grd-progress-text">0%</div>
      </div>
      <div class="grd-buttons">
        <button class="grd-btn grd-btn-start" disabled>Bắt đầu</button>
        <button class="grd-btn grd-btn-stop" disabled>Dừng</button>
      </div>
      <div class="grd-logs-header"><span class="grd-logs-title">Nhật ký</span><button class="grd-logs-clear">Xóa</button></div>
      <div class="grd-logs"></div>
      <div class="grd-footer"><span>Pon1147 Redeem Tool</span><a href="https://discord.gg/vz6w6c3Xe3" target="_blank">Discord</a></div>
    `;

    document.documentElement.appendChild(panel);

    // Cache DOM elements
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

    // Drag functionality
    initDrag(panel);

    // Button listeners
    btnStart.addEventListener('click', () => callbacks.onStart?.());
    btnStop.addEventListener('click', () => callbacks.onStop?.());
    panel.querySelector('.grd-logs-clear').addEventListener('click', () => {
      logsContainer.innerHTML = '';
    });

    // Subscribe to STATE_CHANGE events via EventBus
    window.EventBus.on('STATE_CHANGE', (data) => {
      console.log('[Dashboard] STATE_CHANGE received, rendering...', data?.status, data?.stats);
      if (data) render(data);
    });

    renderFromStorage();
  }

  // ===== DRAG FUNCTIONALITY =====
  function initDrag(panel) {
    let isDragging = false, startX, startY, startLeft, startTop;
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
  }

  // ===== RENDER DASHBOARD =====
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
    btnStart.textContent = state.status === 'PAUSED' ? 'Tiếp tục' : 'Bắt đầu';

    if (state.currentCode) {
      currentCodeEl.textContent = 'Đang xử lý: ' + state.currentCode;
      currentCodeEl.classList.add('grd-visible');
    } else {
      currentCodeEl.classList.remove('grd-visible');
    }

    renderLogs(state.logs);
  }

  // ===== RENDER LOGS =====
  function renderLogs(logs) {
    logsContainer.innerHTML = '';
    const toRender = logs.slice(-50);
    for (let i = 0; i < toRender.length; i++) {
      const log = toRender[i];
      const entry = document.createElement('div');
      entry.className = 'grd-log-entry';
      let icon = '', resultClass = '', reasonText = log.reason || 'Unknown';

      if (log.result === 'SUCCESS') {
        icon = '✔';
        resultClass = 'grd-log-success';
        reasonText = 'Thành công';
      } else if (log.result === 'FAILED') {
        icon = '✘';
        resultClass = 'grd-log-failed';
        reasonText = getReasonLabel(log.reason);
      }

      entry.classList.add(resultClass);
      entry.innerHTML = `<span class="grd-log-icon">${icon}</span><span class="grd-log-code">${log.redeemCode || ''}</span><span class="grd-log-reason">${reasonText}</span>`;
      logsContainer.appendChild(entry);
    }
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // ===== RENDER FROM STORAGE =====
  async function renderFromStorage() {
    console.log('[Dashboard] renderFromStorage() called...');
    let state = await getCentralState();
    if (!state) {
      console.warn('[Dashboard] No state in storage.');
      return;
    }

    // Auto-pause if was running (page reloaded)
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

  // ===== EXPORT =====
  window.initDashboard = initDashboard;
  window.callbacks = callbacks;
})();
