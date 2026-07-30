(() => {
  'use strict';

  console.log('[Garena Redeem] Content script loaded');

  // ===== INJECT DASHBOARD CSS =====
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/dashboard.css');
  document.head.appendChild(link);

  // ===== CONSTANTS =====
  const DEFAULT_CODES = [
    'DFSL9304', 'DFSL6257', 'GARENADFNY2501C158', 'PWC260419S65', 'PWC260419S21',
    'PWC260418S84', 'PWC260418S79', 'PWC260418S72', 'PWC260418S11', 'PWC260419S67',
    'DFCRAFT427', 'DFFILE274', 'DFWEEK237', 'DFTRNG469', 'MOILOOT92',
    'DFSIXVIP888', 'ACESIXMAJOR', 'SOLDFWIN360', 'MOILOOT55', 'MOILOOT68',
    'MOILOOT48', 'MOILOOT02', 'MOILOOT04', 'MOILOOT60', 'MOILOOT45',
    'HEDELTAFORCE7563', 'HEDELTAFORCE8781', 'HEDELTAFORCE8032', 'HEDELTAFORCE9026', 'HEDELTAFORCE3630',
    'HEDELTAFORCE4583', 'GARENADFNY2501E034', 'GARENADFNY2501H258', 'C7S2X9J5D4B1V3Q', 'GARENADFCBT2503Z6T9',
    'GARENADFCBT2503X9D1', 'GARENADFCBT2503C3F4', 'GARENADFID2501V621', 'GARENADFID2501L983', 'GARENADFID2501R572',
    'DELTAFORCEVN_8MD718JT4GR', 'DELTAFORCEVN_95S092Y9T9D', 'DELTAFORCEVN_6AVHJ6MYX6Y', 'DELTAFORCEVN_540VN2S550U',
    'ReturningWarrior3', 'DFUTSCARH', 'DFUTWEAPON', 'DFUTGEARTICKET', 'DFUTINTERMEDIATE',
    'DFUTSUPYPACK', 'DFUTARMAMENT', 'DFPACK293', 'DFDRAGONBOAT', 'DFCL503',
    'DFCONCORD82', 'DFharbor738', 'DFpromise643', 'DFceleste516', 'DFvivid061',
    'DFSH428', 'DFmomentum423', 'DFCATALYST87', 'GADFZebra', 'SsCkDfxY5AkdZqjJLkXq',
    'yWHtfsxYGRPaZvAfLN82', 'DFUTW260412S95', 'DFUTW260412S36', 'DFUTW260412S99', 'DFAWAKEN56',
    'DFakaonikou', 'DFRL1017', 'DFjubilee594', '85ewN4xYbJfncPKbADR', 'DFclarity152',
    'DFUT2025FINALS1549', 'DFUT2025PLAYOFF5910', 'DFUT2025PLAYOFF9163', 'DFUT2025PLAYOFF2509', 'DFUT2025PLAYOFF4827',
    'DFUT2025PLAYOFF8051', 'DFUT2025PLAYOFF5732', 'DFUT2025PLAYOFF1276', 'hjRtrKxYLmcTyYcEy64H', 'f2X6e3xY3pJDCE5rT7P',
    'Bd52XmxyYj2DFGCqnq4', 'msz7hMxxYyGhip8ay7HpK', 'DFOSS260403B33', 'DFsolace241', 'MOBILE0123',
    'DFUTS26QL3101C64', 'DFUTS26QL3101C38', 'DFUTS26QL3001C47', 'DFUTS26QL1', 'DFUTS26QL6',
    'DFUTS26QL5', 'DFCCOPNOW111', 'DFCCOPGIST88', 'DFCCOPWOR1D', 'DFCCOPTOBE03',
    'DFCCOPPL4Y3R5', 'DFOSS260405B69', 'DFOSS260405B58', 'DFOSS260405B36', 'DFOSS260404B63',
    'DFOSS260404B57', 'DFOSS260404B47', 'DFOSS260403B21', 'DFOS7K2M9Q', 'DFOS4XJ8PL',
    'DFOSW4D1YP', 'MOILOOT65', 'MOILOOT79', 'TRILLIONRAID1000', 'TRILLIONRAID600',
    'TRILLIONRAID300', 'POC3105S95', 'POC3105S96', 'POC3105S73', 'POC3105S64',
    'POC3105S31', 'POC3105S90', 'POC3005S19', 'POC3005S52', 'POC3005S99',
    'POC3005S59', 'POC3005S53', 'POC3005S51', 'DFWITNESS77', 'DFOS3FZ9LK',
    'DFOS7Q2VXA', 'DFOS2ZK8VA', 'DFOSL5Q7MN', 'DFOSB4N9RD', 'DFAXIOM33',
    'DFINSIGHT48', 'ReturningWarrior3', 'ReturningWarrior1', 'fvzeLrxYajwVviFSTSZ', 'ReturningWarrior2',
    'N4SQWgxYcHw7gUci3bJy', 'Top1BXHVN', 'aCuQjtxY7vXGjxCTBnQU', 'A5Z1NDW8K3PJLU', '10KSUBSYOUTUBEDFRTNK',
    'daichienboba6228', 'daichienboba2719', 'daichienboba6167', 'DFBrilliant165', 'daichienmobile7095',
    'daichienmobile3325', 'daichienmobile7362', 'DFOutstanding056', 'DF1314754', 'DFReliable732',
    'DFForever395', 'DFExcellent659', 'DFExceptional305', 'DFRemarkable103', 'DFessence982',
    'DFanchor945', 'DFDragon504', 'DFserene218', 'DFSpark119', 'DFUltra220',
    'JGHMCmxYa6PLcFgvD9mg', 'DFMagic057', 'DFGalaxy250', 'DFHorizon503', 'TrickOrTreat',
    'DFNinja874', 'DFRainbow356', 'DFFlash260', 'DFEnergy428', 'DFbeacon030',
    'DFoasis407', 'DFeternity717', 'DFFantasy742', 'DFRocket825', 'DFclover812',
    'DFHeroic668', 'DFWizard309', 'DFvoyage901', 'DFsymphony104', 'DFHORIZON91',
    'DFRESOLVE19', 'DFEMBARK63', 'DFmoment479', 'DFPARAGON41', 'DFASCEND72',
    'DFGENESIS05', 'DFVANGUARD76', 'DFOSS260403B81', 'DFELEVATE16', 'DFUTS26GR2702C44',
    'DFUTS26GR2702C57', 'DFUTS26GR2702C92', 'DFUTS26GR2802C23', 'DFUTS26GR2802C66', 'DFUTS26GR2802C78',
    'DFUTS26GR0103C35', 'DFUTS26GR0103C81', 'DFUTS26GR0103C49', 'DFUTS26GR0703C34', 'DFUTS26GR0703C96',
    'DFUTS26GR1203C72', 'DFUTS26GR1203C83', 'DFUTS26GR1203C46', 'DFUTS26GR1303C65', 'DFUTS26GR1303C39',
    'DFUTS26GR1303C98', 'DFUTS26GR1403C24', 'DFUTS26GR1403C87', 'DFUTS26GR1403C52', 'DFCC0001',
    'DFCCEIEI01', 'DFCCHAHA5', 'DFUTS26GR1503C33', 'DFUTS26GR1503C91', 'DFUTS26GR1503C74',
    'LAISEGAME', 'DFUTS26PL2103C32', 'DFUTS26PL2103C41', 'DFUTS26PL2103C68', 'DFUTS26PL2103C54',
    'DFUTS26PL2103C85', 'DFUTS26PL2103C90', 'DFUTS26PL2203C28', 'DFUTS26PL2203C43', 'DFUTS26PL2203C61',
    'DFUTS26PL2203C77', 'DFUTS26PL2203C86', 'DFUTS26PL2203C95', 'DFVS3S7FR4', 'DFVS8T9SZ4',
    'DFVSH5N4C7', 'DFVSU2X6M8', 'DFVSW1C5D9', 'DFVSE4K7G1', 'DFCCOPWINEIEI',
    'DF425SOL', 'DFWIN777', 'DFHUNTER666', 'DFAIM666', 'DFGOGOGO425',
    'DFGiveMeBrick425', 'DFLuckylucky425', 'DF425BountyS2', 'DF51login51login', 'DFVICTORY11',
    'DFWEAPON91', 'SVBesCxYcsAN6LCD47P', 'L34m5GxYjnPkXzckgdEB', 'XufJgVxYrFCtM5heBT3B', 'DFOSB6T3WZ',
    'DFOS9R2HXC', 'DFOS3Y8KLM', 'JGHMCmxYa', '6PLcFgvD9mg', 'VIP777SIXDF',
    'DFARMX46', 'SIXMAJORMVP', 'DFTURING09', 'DFAMMO08', 'DFSIXMAJOR6',
    'VIP666SOLDF', 'SOLPROMAJOR', 'DFIW26ZX3Q', 'DFIW265M9A', 'DFIW26Y7J3',
    'DFIW266F2V', 'DFIW263T7Z', 'DFIW26H9KP', 'DFIW26R4W8', 'DFIW26C2GX',
    'DFIW26L2WY', 'DFIW26M7Q9', 'DFIW26X3NC', 'DFIW268B5V', 'DFIW26P8X2',
    'DFIW269V3B', 'DFIW264K7M', 'DFIW26Z5RT', 'DFCOHERENCE35', 'DFUTS26GR0803C76',
    'DFUTS26GR0803C21', 'DFUTS26GR0803C67', 'DFUTS26GR0603C42', 'DFRAMADAN1477H', 'DFUTS26QL2901C01',
    'DFUTS26QL2901C02', 'DFUTS26QL3001C29', 'DFUTS26QL2901C03', 'DFUTS26QL3001C82', 'DFUTS26QL3101C91',
    'DFUTS26QL0102C26', 'yU5DpNxYkwx2ck76pcnw', 'DFaura371', 'DFIWTXD01', 'DFIWTXD001',
    'DFIWTXD913', 'DFUT2025FINALS4216', 'PzDArbxYuL2f6RcaWE7T', 'GARENADF2503K8F3', 'GARENADFX9B7Q2',
    'GARENADFQ1H8SZ', 'GARENADFM4Z8YJ', 'DFCantWait1114', 'GARENADFNY25010E034', 'AW88PTR3W9', 'AW88PTRP7D',
    'DFIPPQOCSP', 'DFIPPQIASP', 'DFIPPQARVO', 'DFIPPQWLSP', 'DFIPPQTBAF',
    'DFIPTFGJGFS', 'DFIPTFGASLGI', 'DFIPTFGZSKG', 'DFIZERODAMGS', 'DFIBRAKKESHMG',
    'DFIBRAKKESHLEG', 'DFISPACECITYISG', 'DFISPACECITYMDB', 'DFISPACECITYECMO',
  ];

  const RESPONSE_CODE_MAP = {
    0: { result: 'SUCCESS', reason: 'REDEEMED', label: 'Thành công' },
    400072: { result: 'FAILED', reason: 'USED', label: 'Đã sử dụng' },
  };

  const CONFIG = { maxRetries: 2, delayBetweenCodesMs: 1300, timeoutMs: 5000, submitConfirmMs: 400 };
  const STATUSES = Object.freeze({ NO_CODES: 'NO_CODES', READY: 'READY', RUNNING: 'RUNNING', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED' });
  const CODE_STATUSES = Object.freeze({ PENDING: 'PENDING', PROCESSING: 'PROCESSING', SUCCESS: 'SUCCESS', FAILED: 'FAILED' });

  // ===== STATE HELPERS =====
  const VALID_TRANSITIONS = {
    NO_CODES: ['READY'],
    READY: ['RUNNING'],
    RUNNING: ['PAUSED', 'COMPLETED'],
    PAUSED: ['READY', 'RUNNING'],
    COMPLETED: [],
  };

  function createInitialState(codes) {
    return {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      codes,
      currentIndex: 0,
      currentCode: null,
      status: codes.length > 0 ? 'READY' : 'NO_CODES',
      stats: { total: codes.length, success: 0, failed: 0 },
      logs: [],
      codeStates: codes.map((c) => ({ redeemCode: c, status: 'PENDING', result: null, reason: null })),
    };
  }

  function transition(state, newStatus) {
    const allowed = VALID_TRANSITIONS[state.status];
    if (!allowed?.includes(newStatus)) throw new Error(`Invalid transition: ${state.status} -> ${newStatus}`);
    return { ...state, status: newStatus };
  }

  function computeRemaining(stats) { return stats.total - stats.success - stats.failed; }
  function updateCodeState(state, index, update) {
    return { ...state, codeStates: state.codeStates.map((cs, i) => i === index ? { ...cs, ...update } : cs) };
  }
  function setCurrentCode(state, code) { return { ...state, currentCode: code }; }
  function setCurrentIndex(state, index) { return { ...state, currentIndex: index }; }
  function updateStats(state, successDelta, failedDelta) {
    return { ...state, stats: { ...state.stats, success: state.stats.success + successDelta, failed: state.stats.failed + failedDelta } };
  }
  function appendLog(state, logEntry) {
    const logs = [...state.logs, logEntry];
    return { ...state, logs: logs.length > 200 ? logs.slice(-200) : logs };
  }
  function completeState(state) { return { ...state, status: 'COMPLETED' }; }

  // ===== STORAGE =====
  function getCentralState() {
    return new Promise((resolve) => {
      chrome.storage.local.get('centralState', (result) => resolve(result.centralState || null));
    });
  }

  function setCentralState(state) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ centralState: state }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  // ===== PARSER =====
  function parseRedeemResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'object') {
      return { result: 'FAILED', reason: 'UNKNOWN', responseCode: null, message: 'Invalid response', seq: '', raw: rawResponse };
    }
    const responseCode = Number(rawResponse.code);
    const mapped = RESPONSE_CODE_MAP[responseCode];
    if (mapped) return { result: mapped.result, reason: mapped.reason, responseCode, message: rawResponse.msg || '', seq: rawResponse.seq || '', raw: rawResponse };
    return { result: 'FAILED', reason: 'UNKNOWN', responseCode, message: rawResponse.msg || '', seq: rawResponse.seq || '', raw: rawResponse };
  }

  // ===== CAPTURE =====
  const capture = { responses: [], initialized: false };

  function isValidResponse(data) {
    return data && typeof data === 'object' && 'code' in data && ('msg' in data || 'code_type' in data);
  }

  function initCapture() {
    if (capture.initialized) return;
    capture.initialized = true;
    capture.responses = [];

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      try {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        if (url && url.includes('redeem.df.garena.sg')) {
          const options = args[1] || {};
          const body = options.body;
          let text = '';
          if (body instanceof URLSearchParams) text = body.toString();
          else if (body) text = String(body);

          let foundCode = null;
          for (const code of DEFAULT_CODES) {
            if (text.includes(code)) { foundCode = code; break; }
          }

          if (foundCode) {
            try {
              const response = await originalFetch.apply(this, args);
              const clone = response.clone();
              const t = await clone.text();
              try {
                const jsonData = JSON.parse(t);
                if (isValidResponse(jsonData)) {
                  capture.responses.push({ code: foundCode, data: jsonData, status: response.status, time: Date.now() });
                }
              } catch { /* not JSON */ }
              return response;
            } catch { return originalFetch.apply(this, args); }
          }
        }
        return originalFetch.apply(this, args);
      } catch (err) {
        console.warn('[Capture] Fetch intercept error:', err.message);
        return originalFetch.apply(this, args);
      }
    };

    // Intercept XHR
    if (window.XMLHttpRequest) {
      const origXhrOpen = XMLHttpRequest.prototype.open;
      const origXhrSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (...args) {
        this.__garenaRedeemUrl = args[1];
        return origXhrOpen.apply(this, args);
      };

      XMLHttpRequest.prototype.send = function (...args) {
        const url = this.__garenaRedeemUrl || '';
        if (url.includes('redeem.df.garena.sg')) {
          this.addEventListener('loadend', () => {
            try {
              if (typeof this.responseText === 'string' && this.responseText.trim()) {
                const data = JSON.parse(this.responseText);
                if (isValidResponse(data)) {
                  // Check if body contains a code
                  let bodyText = '';
                  if (args[0]) bodyText = String(args[0]);
                  for (const code of DEFAULT_CODES) {
                    if (bodyText.includes(code)) {
                      capture.responses.push({ code, data, status: this.status, time: Date.now() });
                      break;
                    }
                  }
                }
              }
            } catch { /* not JSON */ }
          });
        }
        return origXhrSend.apply(this, args);
      };
    }
  }

  function getLastResponse() { return capture.responses.length > 0 ? capture.responses[capture.responses.length - 1] : null; }
  function resetCapture() { capture.responses = []; }

  // ===== UTILS =====
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
  function visible(el) { if (!el) return false; const s = window.getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null; }

  // ===== DASHBOARD =====
  let panel, statusDot, statusText, statTotal, statSuccess, statFailed, statRemaining;
  let progressFill, progressText, btnStart, btnStop, logsContainer, currentCodeEl;
  let callbacks = { onStart: null, onStop: null };

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

    // Drag
    let isDragging = false, startX, startY, startLeft, startTop;
    const drag = panel.querySelector('.grd-drag');
    drag.addEventListener('mousedown', (e) => {
      isDragging = true; startX = e.clientX; startY = e.clientY;
      const r = panel.getBoundingClientRect(); startLeft = r.left; startTop = r.top;
      panel.style.transition = 'none'; e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.left = startLeft + e.clientX - startX + 'px';
      panel.style.top = startTop + e.clientY - startY + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; panel.style.transition = ''; });

    btnStart.addEventListener('click', () => callbacks.onStart?.());
    btnStop.addEventListener('click', () => callbacks.onStop?.());
    panel.querySelector('.grd-logs-clear').addEventListener('click', () => { logsContainer.innerHTML = ''; });

    // Subscribe
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.centralState) {
        const newState = changes.centralState.newValue;
        console.log('[Dashboard] Storage changed, rendering...', newState?.status, newState?.stats);
        if (newState) render(newState);
      }
    });

    renderFromStorage();
  }

  const STATUS_CONFIG = {
    NO_CODES: { dotClass: 'grd-no-codes', text: 'Chua san sang' },
    READY: { dotClass: 'grd-ready', text: 'San sang' },
    RUNNING: { dotClass: 'grd-running', text: 'Dang chay' },
    PAUSED: { dotClass: 'grd-paused', text: 'Da tam dung' },
    COMPLETED: { dotClass: 'grd-completed', text: 'Hoan tat' },
  };

  function render(state) {
    if (!state) { console.warn('[Dashboard] No state to render.'); return; }
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
    btnStart.textContent = state.status === 'PAUSED' ? 'Tiep tuc' : 'Bat dau';

    if (state.currentCode) { currentCodeEl.textContent = 'Dang xu ly: ' + state.currentCode; currentCodeEl.classList.add('grd-visible'); }
    else { currentCodeEl.classList.remove('grd-visible'); }

    renderLogs(state.logs);
  }

  function renderLogs(logs) {
    logsContainer.innerHTML = '';
    const toRender = logs.slice(-50);
    for (let i = 0; i < toRender.length; i++) {
      const log = toRender[i];
      const entry = document.createElement('div');
      entry.className = 'grd-log-entry';
      let icon = '', resultClass = '', reasonText = log.reason || 'Unknown';
      if (log.result === 'SUCCESS') { icon = '✔'; resultClass = 'grd-log-success'; reasonText = 'Thanh cong'; }
      else if (log.result === 'FAILED') { icon = '✘'; resultClass = 'grd-log-failed'; reasonText = getReasonLabel(log.reason); }
      entry.classList.add(resultClass);
      entry.innerHTML = `<span class="grd-log-icon">${icon}</span><span class="grd-log-code">${log.redeemCode || ''}</span><span class="grd-log-reason">${reasonText}</span>`;
      logsContainer.appendChild(entry);
    }
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  function getReasonLabel(reason) {
    const labels = { REDEEMED: 'Da nhan thanh cong', USED: 'Da su dung', EXPIRED: 'Het han', INVALID: 'Khong hop le', LIMIT_REACHED: 'Dat gioi han', PRESENT_ERROR: 'Loi trinh bay', VERIFY: 'Can verify', TEMP_ERROR: 'Loi tam thoi', UNKNOWN: 'Khong xac dinh', NO_RESPONSE: 'Khong co phan hoi' };
    return labels[reason] || reason;
  }

  async function renderFromStorage() {
    console.log('[Dashboard] renderFromStorage() called...');
    let state = await getCentralState();
    if (!state) { console.warn('[Dashboard] No state in storage.'); return; }
    if (state.status === 'RUNNING') {
      try { state = transition(state, 'PAUSED'); await setCentralState(state); } catch (e) { console.error('[Dashboard] Persistence transition failed:', e); }
    }
    render(state);
  }

  // ===== REDEEM CONTROLLER =====
  let controller = null;

  class RedeemController {
    constructor() { this.isRunning = false; this.abortFlag = false; }

    async start() {
      if (this.isRunning) return;
      let state = await getCentralState();
      if (!state) return;
      try { state = transition(state, 'RUNNING'); await setCentralState(state); } catch (e) { console.error('[RedeemController] Start failed:', e); return; }
      this.isRunning = true; this.abortFlag = false; initCapture();
      await this.processQueue(state);
    }

    async pause() {
      this.abortFlag = true;
      const state = await getCentralState();
      if (state && state.status === 'RUNNING') {
        try {
          const paused = transition(state, 'PAUSED');
          await setCentralState(paused);
        } catch (e) { console.error('[RedeemController] Pause transition failed:', e); }
      }
    }

    async resume() {
      let state = await getCentralState();
      if (!state || state.status !== 'PAUSED') return;
      try { state = transition(state, 'RUNNING'); await setCentralState(state); } catch (e) { console.error('[RedeemController] Resume failed:', e); return; }
      this.isRunning = true; this.abortFlag = false; initCapture();
      await this.processQueue(state);
    }

    async processQueue(state) {
      while (!this.abortFlag) {
        const nextIndex = this.findNextPending(state);
        if (nextIndex === -1) { state = completeState(state); await setCentralState(state); this.isRunning = false; return; }
        const codeEntry = state.codeStates[nextIndex];
        if (codeEntry.status === 'PENDING') {
          state = setCurrentIndex(state, nextIndex);
          state = setCurrentCode(state, codeEntry.redeemCode);
          state = updateCodeState(state, nextIndex, { status: 'PROCESSING' });
          await setCentralState(state);
          const result = await this.processCode(codeEntry.redeemCode, nextIndex, state.codes.length);
          if (this.abortFlag) return;
          state = await getCentralState();
          if (!state) return;
          await this.handleResponse(state, result, nextIndex);
        }
        await sleep(CONFIG.delayBetweenCodesMs);
      }
      this.isRunning = false;
    }

    findNextPending(state) {
      for (let i = state.currentIndex; i < state.codes.length; i++) { if (state.codeStates[i].status === 'PENDING') return i; }
      for (let i = 0; i < state.currentIndex; i++) { if (state.codeStates[i].status === 'PENDING') return i; }
      return -1;
    }

    async processCode(code, index, total) {
      const maxRetries = CONFIG.maxRetries + 1;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (this.abortFlag) return { result: 'FAILED', reason: 'NO_RESPONSE' };
        try {
          const result = await this.redeemSingle(code);
          if (result.reason === 'TEMP_ERROR' && attempt < maxRetries - 1) { await sleep(1000); continue; }
          return result;
        } catch (err) { if (attempt < maxRetries - 1) { await sleep(1000); continue; } return { result: 'FAILED', reason: 'TEMP_ERROR' }; }
      }
      return { result: 'FAILED', reason: 'TEMP_ERROR' };
    }

    async redeemSingle(code) {
      resetCapture();
      const input = findInput();
      const btn = findButton();
      if (!input || !btn) return { result: 'FAILED', reason: 'PRESENT_ERROR', message: 'UI not found' };

      setValue(input, '');
      await sleep(50);
      setValue(input, code);
      await sleep(80);

      let requestSent = false;
      for (let submitTry = 1; submitTry <= 2; submitTry++) {
        const submitBtn = submitTry === 1 ? btn : findButton();
        if (!submitBtn) break;
        clickRedeem(submitBtn);
        const confirmStart = Date.now();
        while (Date.now() - confirmStart < CONFIG.submitConfirmMs) {
          await sleep(50);
          if (getLastResponse()) { requestSent = true; break; }
        }
        if (requestSent) break;
      }

      if (!requestSent) {
        return { result: 'FAILED', reason: 'NO_RESPONSE', message: 'Click không tạo request' };
      }

      const response = await this.waitForCapturedResponse(CONFIG.timeoutMs);
      if (!response) return { result: 'FAILED', reason: 'NO_RESPONSE', message: 'Timeout không nhận response' };
      return parseRedeemResponse(response);
    }

    waitForCapturedResponse(timeout) {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const last = getLastResponse();
          if (last) { resolve(last.data); return; }
          if (Date.now() - start > timeout) { resolve(null); return; }
          setTimeout(check, 100);
        };
        check();
      });
    }

    async handleResponse(state, parsed, index) {
      if (parsed.result === 'SUCCESS') {
        state = updateCodeState(state, index, { status: 'SUCCESS', result: 'SUCCESS', reason: parsed.reason });
        state = updateStats(state, 1, 0);
      } else if (parsed.result === 'FAILED') {
        state = updateCodeState(state, index, { status: 'FAILED', result: 'FAILED', reason: parsed.reason });
        state = updateStats(state, 0, 1);
      }
      const log = { id: generateId(), redeemCode: state.codeStates[index]?.redeemCode || '', result: parsed.result, reason: parsed.reason, responseCode: parsed.responseCode ?? null, responseMessage: parsed.message || '', responseSeq: parsed.seq || '', timestamp: Date.now() };
      state = appendLog(state, log);
      state = setCurrentCode(state, null);
      await setCentralState(state);
    }
  }

  function findInput() {
    const direct = document.querySelector('.exc-input');
    if (visible(direct)) return direct;
    const inputs = [...document.querySelectorAll('input')];
    return inputs.find(el => visible(el) && !el.disabled && !el.readOnly);
  }

  function findButton() {
    const direct = document.querySelector('.btn-exchange');
    if (visible(direct)) return direct;
    const btns = [...document.querySelectorAll('a,button')];
    return btns.find(el => visible(el) && el.innerText.trim() === 'Đổi');
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function clickRedeem(button) {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function initRedeemController() {
    controller = new RedeemController();
    callbacks.onStart = () => controller.start();
    callbacks.onStop = async () => { await controller.pause(); };
  }

  // ===== BOOTSTRAP =====
  initDashboard();
  initRedeemController();
  console.log('[Garena Redeem] Dashboard + RedeemController initialized.');

})();
