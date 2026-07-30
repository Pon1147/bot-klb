import { getCentralState, setCentralState } from '../core/storage.js';
import { transition, computeRemaining } from '../core/state.js';

// ===== DOM REFERENCES =====
let panel, statusDot, statusText, titleEl;
let statTotal, statSuccess, statFailed, statRemaining;
let progressFill, progressText;
let btnStart, btnStop, btnClear;
let logsContainer, currentCodeEl;

// ===== CALLBACKS (set by content/redeem-controller.js) =====
let callbacks = { onStart: null, onStop: null };

export function setCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

export function getCallbacks() {
  return callbacks;
}

// ===== INIT (called by bootstrap.js) =====
export function initDashboard() {
  console.log('[Dashboard] Initializing...');
  if (document.getElementById('garena-redeem-dashboard')) {
    console.log('[Dashboard] Already exists, skipping.');
    return;
  }

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
      <div class="grd-stat">
        <div class="grd-stat-value grd-stat-total">0</div>
        <div class="grd-stat-label">Tổng</div>
      </div>
      <div class="grd-stat">
        <div class="grd-stat-value grd-stat-success">0</div>
        <div class="grd-stat-label">Thành công</div>
      </div>
      <div class="grd-stat">
        <div class="grd-stat-value grd-stat-failed">0</div>
        <div class="grd-stat-label">Thất bại</div>
      </div>
      <div class="grd-stat">
        <div class="grd-stat-value grd-stat-remaining">0</div>
        <div class="grd-stat-label">Còn lại</div>
      </div>
    </div>
    <div class="grd-progress-wrap">
      <div class="grd-progress-bar">
        <div class="grd-progress-fill"></div>
      </div>
      <div class="grd-progress-text">0%</div>
    </div>
    <div class="grd-buttons">
      <button class="grd-btn grd-btn-start" disabled>Bắt đầu</button>
      <button class="grd-btn grd-btn-stop" disabled>Dừng</button>
    </div>
    <div class="grd-logs-header">
      <span class="grd-logs-title">Nhật ký</span>
      <button class="grd-logs-clear">Xóa</button>
    </div>
    <div class="grd-logs"></div>
    <div class="grd-footer">
      <span>Pon1147 Redeem Tool</span>
      <a href="https://discord.gg/vz6w6c3Xe3" target="_blank">Discord</a>
    </div>
  `;

  document.body.appendChild(panel);

  // Cache DOM refs
  statusDot = panel.querySelector('.grd-status-dot');
  statusText = panel.querySelector('.grd-status-text');
  titleEl = panel.querySelector('.grd-title');
  statTotal = panel.querySelector('.grd-stat-total');
  statSuccess = panel.querySelector('.grd-stat-success');
  statFailed = panel.querySelector('.grd-stat-failed');
  statRemaining = panel.querySelector('.grd-stat-remaining');
  progressFill = panel.querySelector('.grd-progress-fill');
  progressText = panel.querySelector('.grd-progress-text');
  btnStart = panel.querySelector('.grd-btn-start');
  btnStop = panel.querySelector('.grd-btn-stop');
  btnClear = panel.querySelector('.grd-logs-clear');
  logsContainer = panel.querySelector('.grd-logs');
  currentCodeEl = panel.querySelector('.grd-current-code');

  // Drag
  setupDrag();

  // Buttons
  btnStart.addEventListener('click', () => callbacks.onStart?.());
  btnStop.addEventListener('click', () => callbacks.onStop?.());
  btnClear.addEventListener('click', () => {
    logsContainer.innerHTML = '';
  });

  // Subscribe to storage changes
  subscribe();

  // Initial render
  renderFromStorage();
}

// ===== DRAG =====
function setupDrag() {
  const drag = panel.querySelector('.grd-drag');
  let isDragging = false, startX, startY, startLeft, startTop;

  drag.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = startLeft + dx + 'px';
    panel.style.top = startTop + dy + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    panel.style.transition = '';
  });
}

// ===== SUBSCRIBE =====
function subscribe() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.centralState) {
      const newState = changes.centralState.newValue;
      console.log('[Dashboard] Storage changed, rendering...', newState?.status, newState?.stats);
      if (newState) render(newState);
    }
  });
}

async function renderFromStorage() {
  console.log('[Dashboard] renderFromStorage() called...');
  let state = await getCentralState();
  if (!state) {
    console.warn('[Dashboard] No state in storage.');
    return;
  }

  // Browser restart: RUNNING -> PAUSED
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

// ===== RENDER =====
const STATUS_CONFIG = {
  NO_CODES: { dotClass: 'grd-no-codes', text: 'Chua san sang' },
  READY: { dotClass: 'grd-ready', text: 'San sang' },
  RUNNING: { dotClass: 'grd-running', text: 'Dang chay' },
  PAUSED: { dotClass: 'grd-paused', text: 'Da tam dung' },
  COMPLETED: { dotClass: 'grd-completed', text: 'Hoan tat' },
};

function render(state) {
  if (!state) {
    console.warn('[Dashboard] No state to render.');
    return;
  }
  console.log('[Dashboard] render() called, status:', state.status);

  const cfg = STATUS_CONFIG[state.status] || STATUS_CONFIG.NO_CODES;
  statusDot.className = `grd-status-dot grd-${cfg.dotClass}`;
  statusText.textContent = cfg.text;

  // Stats
  const remaining = computeRemaining(state.stats);
  statTotal.textContent = state.stats.total;
  statSuccess.textContent = state.stats.success;
  statFailed.textContent = state.stats.failed;
  statRemaining.textContent = remaining;

  // Progress
  const processed = state.stats.success + state.stats.failed;
  const pct = state.stats.total > 0 ? Math.round((processed / state.stats.total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = pct + '%';

  // Buttons
  const canStart = state.status === 'READY' || state.status === 'PAUSED';
  const canStop = state.status === 'RUNNING';
  btnStart.disabled = !canStart;
  btnStop.disabled = !canStop;
  btnStart.textContent = state.status === 'PAUSED' ? 'Tiep tuc' : 'Bat dau';

  // Current code
  if (state.currentCode) {
    currentCodeEl.textContent = 'Dang xu ly: ' + state.currentCode;
    currentCodeEl.classList.add('grd-visible');
  } else {
    currentCodeEl.classList.remove('grd-visible');
  }

  // Logs (append only new ones)
  renderLogs(state.logs);
}

function renderLogs(logs) {
  // Always clear and re-render to handle state resets (new codes saved)
  logsContainer.innerHTML = '';

  const toRender = logs.slice(-50); // Show last 50 logs max

  for (let i = 0; i < toRender.length; i++) {
    const entry = createLogEntry(toRender[i]);
    logsContainer.appendChild(entry);
  }

  // Scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

function createLogEntry(log) {
  const entry = document.createElement('div');
  entry.className = 'grd-log-entry';

  let icon = '';
  let resultClass = '';
  let reasonText = log.reason || 'Unknown';

  if (log.result === 'SUCCESS') {
    icon = '✔';
    resultClass = 'grd-log-success';
    reasonText = 'Thanh cong';
  } else if (log.result === 'FAILED') {
    icon = '✘';
    resultClass = 'grd-log-failed';
    reasonText = getReasonLabel(log.reason);
  }

  entry.classList.add(resultClass);
  entry.innerHTML = `
    <span class="grd-log-icon">${icon}</span>
    <span class="grd-log-code">${log.redeemCode || ''}</span>
    <span class="grd-log-reason">${reasonText}</span>
  `;
  return entry;
}

function getReasonLabel(reason) {
  const labels = {
    REDEEMED: 'Da nhan thanh cong',
    USED: 'Da su dung',
    EXPIRED: 'Het han',
    INVALID: 'Khong hop le',
    LIMIT_REACHED: 'Dat gioi han',
    PRESENT_ERROR: 'Loi trinh bay',
    VERIFY: 'Can verify',
    TEMP_ERROR: 'Loi tam thoi',
    UNKNOWN: 'Khong xac dinh',
    NO_RESPONSE: 'Khong co phan hoi',
  };
  return labels[reason] || reason;
}
