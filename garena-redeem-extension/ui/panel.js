(function () {
  'use strict';

  // ============================================================
  // PON1147 REDEEM SYSTEM — UI Panel
  // File này CHỈ chứa UI logic.
  // Main loop delegate sang core/app.js (window.Pon1147.startMission)
  // ============================================================

  // --- Lấy dependencies UI-only ---
  const CONFIG = window.Pon1147?.config;
  const { log } = window.Pon1147?.utils ?? {};

  // --- SVG Icons ---
  const ICONS = {
    play: `<svg class="hud-btn-icon" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2 14,8 4,14"/></svg>`,
    stop: `<svg class="hud-btn-icon" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>`,
    check: `<svg class="hud-log-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3,8 7,12 13,4"/></svg>`,
    x: `<svg class="hud-log-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`,
    warning: `<svg class="hud-log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L15 14H1ZM8 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM7 10h2v3H7Z"/></svg>`,
    clock: `<svg class="hud-log-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><polyline points="8,4 8,8 11,10"/></svg>`,
    info: `<svg class="hud-log-icon" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6"/><rect x="7" y="6" width="2" height="5" rx="1"/><circle cx="8" cy="4.5" r="1"/></svg>`,
  };

  // --- Status mapping ---
  const STATUS_MAP = {
    READY: { label: 'READY', dotClass: 'ready' },
    RUNNING: { label: 'RUNNING', dotClass: 'running' },
    STOPPING: { label: 'STOPPING', dotClass: 'stopping' },
    FINISHED: { label: 'FINISHED', dotClass: 'finished' },
    ERROR: { label: 'ERROR', dotClass: 'error' },
  };

  const LOG_STATUS_MAP = {
    SUCCESS: { cls: 'log-success', icon: ICONS.check },
    USED: { cls: 'log-used', icon: ICONS.warning },
    INVALID: { cls: 'log-invalid', icon: ICONS.x },
    LIMIT_REACHED: { cls: 'log-limit', icon: ICONS.warning },
    EXPIRED: { cls: 'log-expired', icon: ICONS.x },
    VERIFY: { cls: 'log-verify', icon: ICONS.info },
    TEMP_ERROR: { cls: 'log-temp-error', icon: ICONS.x },
    NO_RESPONSE: { cls: 'log-no-response', icon: ICONS.clock },
    OTHER: { cls: 'log-other', icon: ICONS.info },
  };

  const STAT_CLASS_MAP = {
    SUCCESS: 'success',
    USED: 'used',
    INVALID: 'invalid',
    LIMIT_REACHED: 'limit',
    EXPIRED: 'expired',
    VERIFY: 'verify',
    TEMP_ERROR: 'temp-error',
    NO_RESPONSE: 'no-response',
    OTHER: 'other',
  };

  // --- DOM References (cached) ---
  let els = {};

  // --- Build Panel DOM ---
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'garena-redeem-panel';
    // Inline fallback: đảm bảo panel luôn visible ngay cả khi CSS load chậm
    panel.style.cssText = `
      position: fixed !important; top: 20px !important; left: 20px !important;
      z-index: 2147483646 !important; width: 350px !important;
      background: #181C22 !important; color: #F5F5F5 !important;
      font-family: Inter, Segoe UI, sans-serif !important;
      border: 1px solid #2B313A !important;
    `;
    panel.innerHTML = `
      <!-- Header -->
      <div class="hud-header">
        <div class="hud-header-title">PON1147 REDEEM SYSTEM</div>
        <div class="hud-header-sub">Tactical Redeem Console</div>
        <div id="pon1147-loop-badge" style="display:none;padding:2px 8px;background:#58D68D;color:#111;border-radius:3px;font-size:10px;font-weight:700;position:absolute;top:8px;right:8px;">LOOP RUNNING</div>
      </div>

      <!-- Status Bar -->
      <div class="hud-status-bar">
        <div class="hud-status-indicator">
          <div class="hud-status-dot ready" id="hud-dot"></div>
          <span class="hud-status-text" id="hud-status">READY</span>
        </div>
        <div class="hud-current-code" id="hud-code">—</div>
      </div>

      <!-- Progress -->
      <div class="hud-progress-section">
        <div class="hud-progress-label">
          <span>Progress</span>
          <span class="hud-progress-pct" id="hud-pct">0%</span>
        </div>
        <div class="hud-progress-track">
          <div class="hud-progress-fill" id="hud-bar" style="width:0%"></div>
        </div>
        <div class="hud-progress-info">
          <span id="hud-processed">0 / 0</span>
          <span id="hud-remaining">0 remaining</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="hud-stats" id="hud-stats">
        <div class="hud-stat-card">
          <div class="hud-stat-label">OK</div>
          <div class="hud-stat-value success" id="stat-SUCCESS">0</div>
        </div>
        <div class="hud-stat-card">
          <div class="hud-stat-label">USED</div>
          <div class="hud-stat-value used" id="stat-USED">0</div>
        </div>
        <div class="hud-stat-card">
          <div class="hud-stat-label">FAIL</div>
          <div class="hud-stat-value invalid" id="stat-INVALID">0</div>
        </div>
        <div class="hud-stat-card">
          <div class="hud-stat-label">LIMIT</div>
          <div class="hud-stat-value limit" id="stat-LIMIT_REACHED">0</div>
        </div>
        <div class="hud-stat-card">
          <div class="hud-stat-label">EXP</div>
          <div class="hud-stat-value expired" id="stat-EXPIRED">0</div>
        </div>
        <div class="hud-stat-card">
          <div class="hud-stat-label">ERR</div>
          <div class="hud-stat-value temp-error" id="stat-TEMP_ERROR">0</div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="hud-actions">
        <button class="hud-btn primary" id="hud-start">
          ${ICONS.play}
          <span>Start Mission</span>
        </button>
        <button class="hud-btn danger" id="hud-stop" style="display:none;">
          ${ICONS.stop}
          <span>Abort</span>
        </button>
      </div>

      <!-- Live Log -->
      <div class="hud-log" id="hud-log"></div>
    `;

    document.body.appendChild(panel);

    // Ẩn panel mặc định — chỉ hiện khi popup yêu cầu
    panel.style.display = 'none';

    // Cache elements
    els = {
      dot: panel.querySelector('#hud-dot'),
      status: panel.querySelector('#hud-status'),
      code: panel.querySelector('#hud-code'),
      pct: panel.querySelector('#hud-pct'),
      bar: panel.querySelector('#hud-bar'),
      processed: panel.querySelector('#hud-processed'),
      remaining: panel.querySelector('#hud-remaining'),
      log: panel.querySelector('#hud-log'),
      start: panel.querySelector('#hud-start'),
      stop: panel.querySelector('#hud-stop'),
    };
  }

  // --- Watermark ---
  function buildWatermark() {
    if (document.getElementById('pon1147-watermark')) return;

    const wm = document.createElement('div');
    wm.id = 'pon1147-watermark';
    wm.style.cssText = `
      position: fixed !important; bottom: 18px !important; right: 18px !important;
      z-index: 2147483647 !important; display: flex !important; align-items: center !important;
      gap: 8px !important; padding: 10px 14px !important;
      background: #181C22 !important; border: 1px solid #2B313A !important;
      color: #F5F5F5 !important; font-family: Inter, Segoe UI, sans-serif !important;
      font-size: 12px !important; font-weight: 600 !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
    `;
    wm.innerHTML = `
      <span class="wm-brand">PON1147</span>
      <span style="color:var(--hud-text-muted);font-size:11px;">|</span>
      <a class="wm-link" href="https://discord.gg/vz6w6c3Xe3" target="_blank">Discord</a>
    `;

    wm.addEventListener('mouseenter', () => {
      wm.style.transform = 'translateY(-2px)';
    });
    wm.addEventListener('mouseleave', () => {
      wm.style.transform = '';
    });

    document.body.appendChild(wm);
  }

  // --- UI Update Functions (public API cho core/app.js) ---

  /**
   * Cập nhật status indicator.
   * Được core/app.js gọi sau mỗi lần redeem.
   */
  function setStatus(status, currentCode) {
    const s = STATUS_MAP[status];
    if (!s) return;

    els.dot.className = `hud-status-dot ${s.dotClass}`;
    els.status.textContent = s.label;

    if (currentCode) {
      els.code.textContent = currentCode;
      els.code.style.display = '';
    }
  }

  /**
   * Cập nhật progress bar.
   * Được core/app.js gọi sau mỗi lần redeem.
   */
  function setProgress(current, total) {
    if (!els.bar) return;
    const t = total || 0;
    const pct = t > 0 ? Math.round((current / t) * 100) : 0;
    els.bar.style.width = `${pct}%`;
    els.pct.textContent = `${pct}%`;
    els.processed.textContent = `${current} / ${t}`;
    els.remaining.textContent = `${t - current} remaining`;
  }

  /**
   * Cập nhật stat cards.
   * Được core/app.js gọi sau mỗi lần redeem.
   */
  function setStats(results) {
    const counts = results.reduce((a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    }, {});

    // Update mỗi stat card
    for (const [status, count] of Object.entries(counts)) {
      const el = document.getElementById(`stat-${status}`);
      if (el) {
        el.textContent = count;
        el.className = `hud-stat-value ${STAT_CLASS_MAP[status] || 'other'}`;
      }
    }

    // Reset các stats không có trong results
    const knownStatuses = Object.keys(STAT_CLASS_MAP);
    for (const status of knownStatuses) {
      const el = document.getElementById(`stat-${status}`);
      if (el && !counts[status]) {
        el.textContent = '0';
      }
    }
  }

  /**
   * Thêm log entry.
   * Được core/app.js gọi sau mỗi lần redeem.
   */
  function addLog(status, code, message) {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const info = LOG_STATUS_MAP[status] || LOG_STATUS_MAP.OTHER;

    const entry = document.createElement('div');
    entry.className = `hud-log-entry ${info.cls}`;
    entry.innerHTML = `
      <span class="hud-log-time">${time}</span>
      ${info.icon}
      <div class="hud-log-body">
        <span class="hud-log-code">${code}</span>
        <span class="hud-log-msg">${message || ''}</span>
      </div>
    `;

    els.log.appendChild(entry);
    els.log.scrollTop = els.log.scrollHeight;

    // Giới hạn log entries để tránh nặng DOM
    const maxEntries = 200;
    while (els.log.children.length > maxEntries) {
      els.log.removeChild(els.log.firstChild);
    }
  }

  /**
   * Hiển thị panel (gọi từ popup hoặc core/app.js).
   */
  function showPanel() {
    const panel = document.getElementById('garena-redeem-panel');
    if (panel) {
      panel.style.display = '';
      panel.style.zIndex = '2147483646';
    }
  }

  /**
   * Hiển thị badge "LOOP RUNNING" trên panel.
   */
  function showLoopBadge() {
    const badge = document.getElementById('pon1147-loop-badge');
    if (badge) badge.style.display = '';
  }

  /**
   * Ẩn badge "LOOP RUNNING".
   */
  function hideLoopBadge() {
    const badge = document.getElementById('pon1147-loop-badge');
    if (badge) badge.style.display = 'none';
  }

  // --- Button handlers: delegate sang core/app.js ---

  /**
   * Start Mission handler.
   * Chỉ cập nhật UI state, delegate logic sang core/app.js.startMission().
   */
  function onMissionStart() {
    if (els.start.style.display === 'none') return; // Đang chạy rồi

    els.start.style.display = 'none';
    els.stop.style.display = '';
    setStatus('RUNNING');

    els.log.innerHTML = '';
    addLog('INFO', 'SYSTEM', 'Mission initialized');

    // Delegate toàn bộ logic sang core/app.js
    if (window.Pon1147?.startMission) {
      window.Pon1147.startMission();
    } else {
      console.error('[PON1147] core/app.js chưa load — không có startMission');
    }
  }

  /**
   * Abort Mission handler.
   * Set signal dừng, core/app.js sẽ kiểm tra và dừng.
   */
  function onMissionAbort() {
    els.stop.disabled = true;
    setStatus('STOPPING');
    window.Pon1147.shouldStop = true;
  }

  // --- Init ---
  function init() {
    try {
      // Kiểm tra dependencies UI cần thiết
      if (!CONFIG) console.warn('[PON1147] CONFIG not loaded');
      if (!log) console.warn('[PON1147] utils.log not loaded');

      // Load CSS từ extension
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('ui/panel.css');
      document.head.appendChild(link);

      buildPanel();
      buildWatermark();

      // Gắn event listeners
      els.start.addEventListener('click', onMissionStart);
      els.stop.addEventListener('click', onMissionAbort);

      // Hiển thị trạng thái ban đầu
      setStatus('READY');
      setProgress(0, 0);

      console.log('%c[PON1147] Panel initialized', 'color:#59D67C;font-weight:bold;');
    } catch (err) {
      console.error('%c[PON1147] Panel init FAILED:', 'color:#EF5350;font-weight:bold;', err);
    }
  }

  // --- Expose public API ---
  // UI functions cho core/app.js gọi
  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.init = init;
  window.Pon1147.setStatus = setStatus;
  window.Pon1147.setProgress = setProgress;
  window.Pon1147.setStats = setStats;
  window.Pon1147.addLog = addLog;
  window.Pon1147.els = els;
  window.Pon1147.showPanel = showPanel;
  window.Pon1147.showLoopBadge = showLoopBadge;
  window.Pon1147.hideLoopBadge = hideLoopBadge;
})();
