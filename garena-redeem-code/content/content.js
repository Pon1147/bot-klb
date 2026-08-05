(() => {
  'use strict';

  console.log('[Garena Redeem] Content script loaded');

  // ===== INJECT DASHBOARD CSS =====
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/dashboard.css');
  document.head.appendChild(link);

  // ===== INJECT PAGE-CONTEXT CAPTURE SCRIPT =====
  // Content script runs in isolated world — cannot intercept page XHR/fetch.
  // Inject a <script> tag so the interceptor runs in page context.
  (function injectPageCapture() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/page-capture.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();

  const DEFAULT_CODES = [
    '10KSUBSYOUTUBEDFRTNK',
    '30KSUBSYOUTUBEDFESPNP',
    '6PLcFgvD9mg',
    '85ewN4xYbJfncPKbADR',
    '8rjGXBxYBrNS4ennshJP',
    'A5Z1NDW8K3PJLJ',
    'A5Z1NDW8K3PJLU',
    'ACESIXMAJOR',
    'aCuQjtxY7vXGjxCTBnQU',
    'AW88PTR3W9',
    'AW88PTRP7D',
    'Bd52XmxyYj2DFGCqnq4',
    'C7S2X9J5D4B1V3Q',
    'daichienboba2719',
    'daichienboba6167',
    'daichienboba6228',
    'daichienmobile3325',
    'daichienmobile7095',
    'daichienmobile7362',
    'DELTAFORCEVN_540VN2S550U',
    'DELTAFORCEVN_6AVHJ6MYX6Y',
    'DELTAFORCEVN_8MD718JT4GR',
    'DELTAFORCEVN_95S092Y9T9D',
    'DF1314754',
    'DF425BountyS2',
    'DF425SOL',
    'DF51login51login',
    'DFAIM666',
    'DFakaonikou',
    'DFAMMO08',
    'DFanchor945',
    'DFARMX46',
    'DFASCEND72',
    'DFaura371',
    'DFAWAKEN56',
    'DFAXIOM33',
    'DFbeacon030',
    'DFBrilliant165',
    'DFCantWait1114',
    'DFCATALYST87',
    'DFCC0001',
    'DFCCEIEI01',
    'DFCCHAHA5',
    'DFCCOPGIST88',
    'DFCCOPNOW111',
    'DFCCOPPL4Y3R5',
    'DFCCOPTOBE03',
    'DFCCOPWINEIEI',
    'DFCCOPWOR1D',
    'DFceleste516',
    'DFCL503',
    'DFclarity152',
    'DFclover812',
    'DFCOHERENCE35',
    'DFCONCORD82',
    'DFCRAFT427',
    'DFDragon504',
    'DFDRAGONBOAT',
    'DFELEVATE16',
    'DFEMBARK63',
    'DFEnergy428',
    'DFessence982',
    'DFeternity717',
    'DFExcellent659',
    'DFExceptional305',
    'DFFantasy742',
    'DFFILE274',
    'DFFlash260',
    'DFForever395',
    'DFGalaxy250',
    'DFGENESIS05',
    'DFGiveMeBrick425',
    'DFGOGOGO425',
    'DFharbor738',
    'DFHeroic668',
    'DFHorizon503',
    'DFHORIZON91',
    'DFHUNTER666',
    'DFIBRAKKESHLEG',
    'DFIBRAKKESHMG',
    'DFINSIGHT48',
    'DFIPPQARVO',
    'DFIPPQIASP',
    'DFIPPQOCSP',
    'DFIPPQTBAF',
    'DFIPPQWLSP',
    'DFIPTFGASLGI',
    'DFIPTFGJGFS',
    'DFIPTFGZSKG',
    'DFISPACECITYECMO',
    'DFISPACECITYISG',
    'DFISPACECITYMDB',
    'DFIW263T7Z',
    'DFIW264K7M',
    'DFIW265M9A',
    'DFIW266F2V',
    'DFIW268B5V',
    'DFIW269V3B',
    'DFIW26C2GX',
    'DFIW26H9KP',
    'DFIW26L2WY',
    'DFIW26M7Q9',
    'DFIW26P8X2',
    'DFIW26R4W8',
    'DFIW26X3NC',
    'DFIW26Y7J3',
    'DFIW26Z5RT',
    'DFIW26ZX3Q',
    'DFIWDAY1OPOP',
    'DFIWDAY1START',
    'DFIWDAY3WAW',
    'DFIWTXD001',
    'DFIWTXD01',
    'DFIWTXD913',
    'DFIZERODAMGS',
    'DFjubilee594',
    'DFLuckylucky425',
    'DFMagic057',
    'DFmoment479',
    'DFmomentum423',
    'DFnewversiongift',
    'DFNinja874',
    'DFoasis407',
    'DFOS2ZK8VA',
    'DFOS3FZ9LK',
    'DFOS3Y8KLM',
    'DFOS4XJ8PL',
    'DFOS7K2M9Q',
    'DFOS7Q2VXA',
    'DFOS9R2HXC',
    'DFOSB4N9RD',
    'DFOSB6T3WZ',
    'DFOSL5Q7MN',
    'DFOSS260403B21',
    'DFOSS260403B33',
    'DFOSS260403B81',
    'DFOSS260404B47',
    'DFOSS260404B57',
    'DFOSS260404B63',
    'DFOSS260405B36',
    'DFOSS260405B58',
    'DFOSS260405B69',
    'DFOSW4D1YP',
    'DFOutstanding056',
    'DFPACK293',
    'DFPARAGON41',
    'DFpromise643',
    'DFRainbow356',
    'DFRAMADAN1477H',
    'DFReliable732',
    'DFRemarkable103',
    'DFRESOLVE19',
    'DFRL1017',
    'DFRocket825',
    'DFserene218',
    'DFSH428',
    'DFSIXMAJOR6',
    'DFSIXTOPACE',
    'DFSIXVIP888',
    'DFSL502SOL',
    'DFSL6257',
    'DFSL9304',
    'DFsolace241',
    'DFSpark119',
    'DFsymphony104',
    'DFTRNG469',
    'DFTURING09',
    'DFUltra220',
    'DFUT2025FINALS1549',
    'DFUT2025FINALS4216',
    'DFUT2025GROUP6698',
    'DFUT2025GROUP7752',
    'DFUT2025PLAYOFF1276',
    'DFUT2025PLAYOFF2509',
    'DFUT2025PLAYOFF4827',
    'DFUT2025PLAYOFF5732',
    'DFUT2025PLAYOFF5910',
    'DFUT2025PLAYOFF8051',
    'DFUT2025PLAYOFF9163',
    'DFUTARMAMENT',
    'DFUTGEARTICKET',
    'DFUTINTERMEDIATE',
    'DFUTS26GR0103C35',
    'DFUTS26GR0103C49',
    'DFUTS26GR0103C81',
    'DFUTS26GR0603C42',
    'DFUTS26GR0703C34',
    'DFUTS26GR0703C96',
    'DFUTS26GR0803C21',
    'DFUTS26GR0803C67',
    'DFUTS26GR0803C76',
    'DFUTS26GR1203C46',
    'DFUTS26GR1203C72',
    'DFUTS26GR1203C83',
    'DFUTS26GR1303C39',
    'DFUTS26GR1303C65',
    'DFUTS26GR1303C98',
    'DFUTS26GR1403C24',
    'DFUTS26GR1403C52',
    'DFUTS26GR1403C87',
    'DFUTS26GR1503C33',
    'DFUTS26GR1503C74',
    'DFUTS26GR1503C91',
    'DFUTS26GR2702C44',
    'DFUTS26GR2702C57',
    'DFUTS26GR2702C92',
    'DFUTS26GR2802C23',
    'DFUTS26GR2802C66',
    'DFUTS26GR2802C78',
    'DFUTS26PL2103C32',
    'DFUTS26PL2103C41',
    'DFUTS26PL2103C54',
    'DFUTS26PL2103C68',
    'DFUTS26PL2103C85',
    'DFUTS26PL2103C90',
    'DFUTS26PL2203C28',
    'DFUTS26PL2203C43',
    'DFUTS26PL2203C61',
    'DFUTS26PL2203C77',
    'DFUTS26PL2203C86',
    'DFUTS26PL2203C95',
    'DFUTS26QL0102C26',
    'DFUTS26QL1',
    'DFUTS26QL2901C01',
    'DFUTS26QL2901C02',
    'DFUTS26QL2901C03',
    'DFUTS26QL3001C29',
    'DFUTS26QL3001C47',
    'DFUTS26QL3001C82',
    'DFUTS26QL3101C38',
    'DFUTS26QL3101C64',
    'DFUTS26QL3101C91',
    'DFUTS26QL5',
    'DFUTS26QL6',
    'DFUTSCARH',
    'DFUTSUPPYPACK',
    'DFUTSUPYPACK',
    'DFUTW260412S36',
    'DFUTW260412S95',
    'DFUTW260412S99',
    'DFUTWEAPON',
    'DFVANGUARD76',
    'DFVICTORY11',
    'DFvivid061',
    'DFvoyage901',
    'DFVS3S7FR4',
    'DFVS8T9SZ4',
    'DFVSE4K7G1',
    'DFVSH5N4C7',
    'DFVSU2X6M8',
    'DFVSW1C5D9',
    'DFWEAPON91',
    'DFWEEK237',
    'DFWIN777',
    'DFWITNESS77',
    'DFWizard309',
    'eHjNfTxYKV5GAFxMD5MA',
    'f2X6e3xY3pJDCE5rT7P',
    'fvzeLrxYajwVviFSTSZ',
    'GADFZebra',
    'GARENADF2503K8F3',
    'GARENADFCBT2503C3F4',
    'GARENADFCBT2503X9D1',
    'GARENADFCBT2503Z6T9',
    'GARENADFID2501L983',
    'GARENADFID2501R572',
    'GARENADFID2501V621',
    'GARENADFM4Z8YJ',
    'GARENADFNY25010E034',
    'GARENADFNY2501C158',
    'GARENADFNY2501E034',
    'GARENADFNY2501H258',
    'GARENADFQ1H8SZ',
    'GARENADFX9B7Q2',
    'HEDELTAFORCE3630',
    'HEDELTAFORCE4583',
    'HEDELTAFORCE7563',
    'HEDELTAFORCE8032',
    'HEDELTAFORCE8781',
    'HEDELTAFORCE9026',
    'hjRtrKxYLmcTyYcEy64H',
    'JGHMCmxYa',
    'JGHMCmxYa6PLcFgvD9mg',
    'L34m5GxYjnPkXzckgdEB',
    'LAISEGAME',
    'MOBILE0123',
    'MOILOOT02',
    'MOILOOT04',
    'MOILOOT45',
    'MOILOOT48',
    'MOILOOT55',
    'MOILOOT60',
    'MOILOOT65',
    'MOILOOT68',
    'MOILOOT79',
    'MOILOOT92',
    'msz7hMxxYyGhip8ay7HpK',
    'MVPSOLDFSIX',
    'N4SQWgxYcHw7gUci3bJy',
    'POC3005S19',
    'POC3005S51',
    'POC3005S52',
    'POC3005S53',
    'POC3005S59',
    'POC3005S99',
    'POC3105S31',
    'POC3105S64',
    'POC3105S73',
    'POC3105S90',
    'POC3105S95',
    'POC3105S96',
    'PWC260418S11',
    'PWC260418S72',
    'PWC260418S79',
    'PWC260418S84',
    'PWC260419S21',
    'PWC260419S65',
    'PWC260419S67',
    'PzDArbxYuL2f6RcaWE7T',
    'ReturningWarrior1',
    'ReturningWarrior2',
    'ReturningWarrior3',
    'SIXMAJORMVP',
    'SOLDFWIN360',
    'SOLMAJORGG9',
    'SOLPROMAJOR',
    'SsCkDfxY5AkdZqjJLkXq',
    'SVBesCxYcsAN6LCD47P',
    'Tf7aVcxYfAV97gAHQTP6',
    'Top1BXHVN',
    'TrickOrTreat',
    'TRILLIONRAID1000',
    'TRILLIONRAID300',
    'TRILLIONRAID600',
    'VIP666SOLDF',
    'VIP777SIXDF',
    'wTr3cyxY6QZBRf779Xpa',
    'XufJgVxYrFCtM5heBT3B',
    'yU5DpNxYkwx2ck76pcnw',
    'yWHtfsxYGRPaZvAfLN82',
  ];

  const RESPONSE_CODE_MAP = {
    0: { result: 'SUCCESS', reason: 'REDEEMED', label: 'Thành công' },
    400001: { result: 'FAILED', reason: 'INVALID', label: 'Code không hợp lệ' },
    400002: { result: 'FAILED', reason: 'EXPIRED', label: 'Code hết hạn' },
    400003: { result: 'FAILED', reason: 'INVALID', label: 'Không tìm thấy code' },
    400054: { result: 'FAILED', reason: 'INVALID', label: 'Code không khớp' },
    400067: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Đạt giới hạn nhóm' },
    400071: { result: 'FAILED', reason: 'LIMIT_REACHED', label: 'Đạt giới hạn nhận' },
    400072: { result: 'FAILED', reason: 'USED', label: 'Đã sử dụng' },
    400073: { result: 'FAILED', reason: 'VERIFY', label: 'Cần xác minh' },
  };

  const CONFIG = {
    maxRetries: 2,
    delayBetweenCodesMs: 1300,
    timeoutMs: 5000,
    submitConfirmMs: 400,
  };
  const STATUSES = Object.freeze({
    NO_CODES: 'NO_CODES',
    READY: 'READY',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
  });
  const CODE_STATUSES = Object.freeze({
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
  });

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
      codeStates: codes.map((c) => ({
        redeemCode: c,
        status: 'PENDING',
        result: null,
        reason: null,
      })),
    };
  }

  function transition(state, newStatus) {
    const allowed = VALID_TRANSITIONS[state.status];
    if (!allowed?.includes(newStatus))
      throw new Error(`Invalid transition: ${state.status} -> ${newStatus}`);
    return { ...state, status: newStatus };
  }

  function computeRemaining(stats) {
    return stats.total - stats.success - stats.failed;
  }
  function updateCodeState(state, index, update) {
    return {
      ...state,
      codeStates: state.codeStates.map((cs, i) => (i === index ? { ...cs, ...update } : cs)),
    };
  }
  function setCurrentCode(state, code) {
    return { ...state, currentCode: code };
  }
  function setCurrentIndex(state, index) {
    return { ...state, currentIndex: index };
  }
  function updateStats(state, successDelta, failedDelta) {
    return {
      ...state,
      stats: {
        ...state.stats,
        success: state.stats.success + successDelta,
        failed: state.stats.failed + failedDelta,
      },
    };
  }
  function appendLog(state, logEntry) {
    const logs = [...state.logs, logEntry];
    return { ...state, logs: logs.length > 200 ? logs.slice(-200) : logs };
  }
  function completeState(state) {
    return { ...state, status: 'COMPLETED' };
  }

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
      return {
        result: 'FAILED',
        reason: 'UNKNOWN',
        responseCode: null,
        message: 'Invalid response',
        seq: '',
        raw: rawResponse,
      };
    }
    const responseCode = Number(rawResponse.code);
    const mapped = RESPONSE_CODE_MAP[responseCode];
    if (mapped)
      return {
        result: mapped.result,
        reason: mapped.reason,
        responseCode,
        message: rawResponse.msg || '',
        seq: rawResponse.seq || '',
        raw: rawResponse,
      };
    return {
      result: 'FAILED',
      reason: 'UNKNOWN',
      responseCode,
      message: rawResponse.msg || '',
      seq: rawResponse.seq || '',
      raw: rawResponse,
    };
  }

  // ===== CAPTURE (page-context via postMessage) =====
  // The page-capture.js script runs in PAGE CONTEXT and intercepts XHR/fetch there.
  // It posts responses back via window.postMessage. Content script only listens.
  const capture = { responses: [], initialized: false, _currentCode: null };

  function initCapture() {
    if (capture.initialized) return;
    capture.initialized = true;
    capture.responses = [];

    window.addEventListener('message', (e) => {
      // Security: only accept messages from our own window
      if (e.source !== window) return;
      if (e.data?.source !== 'garena-redeem-capture') return;
      const { data, url } = e.data;
      if (data && typeof data === 'object' && 'code' in data) {
        capture.responses.push({
          code: capture._currentCode || 'unknown',
          data: data,
          status: 200,
          time: Date.now(),
        });
        console.log(
          '[Capture] Received via postMessage:',
          data.code,
          'msg=' + (data.msg || data.message || ''),
          'url=' + (url || ''),
        );
      }
    });
  }

  function getLastResponse() {
    return capture.responses.length > 0 ? capture.responses[capture.responses.length - 1] : null;
  }
  function resetCapture(code) {
    capture.responses = [];
    capture._currentCode = code || null;
  }

  // ===== UTILS =====
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function visible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
  }

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
    let isDragging = false,
      startX,
      startY,
      startLeft,
      startTop;
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

    btnStart.addEventListener('click', () => callbacks.onStart?.());
    btnStop.addEventListener('click', () => callbacks.onStop?.());
    panel.querySelector('.grd-logs-clear').addEventListener('click', () => {
      logsContainer.innerHTML = '';
    });

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
    btnStart.textContent = state.status === 'PAUSED' ? 'Tiep tuc' : 'Bat dau';

    if (state.currentCode) {
      currentCodeEl.textContent = 'Dang xu ly: ' + state.currentCode;
      currentCodeEl.classList.add('grd-visible');
    } else {
      currentCodeEl.classList.remove('grd-visible');
    }

    renderLogs(state.logs);
  }

  function renderLogs(logs) {
    logsContainer.innerHTML = '';
    const toRender = logs.slice(-50);
    for (let i = 0; i < toRender.length; i++) {
      const log = toRender[i];
      const entry = document.createElement('div');
      entry.className = 'grd-log-entry';
      let icon = '',
        resultClass = '',
        reasonText = log.reason || 'Unknown';
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
      entry.innerHTML = `<span class="grd-log-icon">${icon}</span><span class="grd-log-code">${log.redeemCode || ''}</span><span class="grd-log-reason">${reasonText}</span>`;
      logsContainer.appendChild(entry);
    }
    logsContainer.scrollTop = logsContainer.scrollHeight;
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

  async function renderFromStorage() {
    console.log('[Dashboard] renderFromStorage() called...');
    let state = await getCentralState();
    if (!state) {
      console.warn('[Dashboard] No state in storage.');
      return;
    }
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

  // ===== REDEEM CONTROLLER =====
  let controller = null;

  class RedeemController {
    constructor() {
      this.isRunning = false;
      this.abortFlag = false;
    }

    async start() {
      if (this.isRunning) return;
      let state = await getCentralState();
      if (!state) return;
      try {
        state = transition(state, 'RUNNING');
        await setCentralState(state);
      } catch (e) {
        console.error('[RedeemController] Start failed:', e);
        return;
      }
      this.isRunning = true;
      this.abortFlag = false;
      initCapture();
      await this.processQueue(state);
    }

    async pause() {
      this.abortFlag = true;
      const state = await getCentralState();
      if (state && state.status === 'RUNNING') {
        try {
          const paused = transition(state, 'PAUSED');
          await setCentralState(paused);
        } catch (e) {
          console.error('[RedeemController] Pause transition failed:', e);
        }
      }
    }

    async resume() {
      let state = await getCentralState();
      if (!state || state.status !== 'PAUSED') return;
      try {
        state = transition(state, 'RUNNING');
        await setCentralState(state);
      } catch (e) {
        console.error('[RedeemController] Resume failed:', e);
        return;
      }
      this.isRunning = true;
      this.abortFlag = false;
      initCapture();
      await this.processQueue(state);
    }

    async processQueue(state) {
      while (!this.abortFlag) {
        // Always read fresh state each iteration
        state = await getCentralState();
        if (!state) return;

        const nextIndex = this.findNextPending(state);
        if (nextIndex === -1) {
          state = completeState(state);
          await setCentralState(state);
          this.isRunning = false;
          return;
        }
        const codeEntry = state.codeStates[nextIndex];
        if (codeEntry.status === 'PENDING') {
          state = setCurrentIndex(state, nextIndex);
          state = setCurrentCode(state, codeEntry.redeemCode);
          state = updateCodeState(state, nextIndex, { status: 'PROCESSING' });
          await setCentralState(state);
          const result = await this.processCode(
            codeEntry.redeemCode,
            nextIndex,
            state.codes.length,
          );
          if (this.abortFlag) return;
          await this.handleResponse(state, result, nextIndex);
        }
        await sleep(CONFIG.delayBetweenCodesMs);
      }
      this.isRunning = false;
    }

    findNextPending(state) {
      for (let i = state.currentIndex; i < state.codes.length; i++) {
        if (state.codeStates[i].status === 'PENDING') return i;
      }
      for (let i = 0; i < state.currentIndex; i++) {
        if (state.codeStates[i].status === 'PENDING') return i;
      }
      return -1;
    }

    async processCode(code, index, total) {
      const maxRetries = CONFIG.maxRetries + 1;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (this.abortFlag) return { result: 'FAILED', reason: 'NO_RESPONSE' };
        try {
          const result = await this.redeemSingle(code);
          if (result.reason === 'TEMP_ERROR' && attempt < maxRetries - 1) {
            await sleep(1000);
            continue;
          }
          return result;
        } catch (err) {
          if (attempt < maxRetries - 1) {
            await sleep(1000);
            continue;
          }
          return { result: 'FAILED', reason: 'TEMP_ERROR' };
        }
      }
      return { result: 'FAILED', reason: 'TEMP_ERROR' };
    }

    async redeemSingle(code) {
      resetCapture(code);
      console.log(
        '[Redeem] Starting redeem for code:',
        code,
        '_currentCode:',
        capture._currentCode,
      );
      const input = findInput();
      const btn = findButton();
      if (!input || !btn)
        return { result: 'FAILED', reason: 'PRESENT_ERROR', message: 'UI not found' };

      setValue(input, '');
      await sleep(50);
      setValue(input, code);
      await sleep(80);

      // Click the button — waitForCapturedResponse handles the full wait (up to timeoutMs)
      let clicked = false;
      for (let submitTry = 1; submitTry <= 2; submitTry++) {
        const submitBtn = submitTry === 1 ? btn : findButton();
        if (!submitBtn) break;
        console.log('[Redeem] Click attempt', submitTry);
        clickRedeem(submitBtn);
        clicked = true;
        await sleep(200); // small delay to let page process before response arrives
        if (getLastResponse()) {
          console.log('[Redeem] Response captured during click delay');
          break;
        }
      }

      if (!clicked) {
        return { result: 'FAILED', reason: 'NO_RESPONSE', message: 'Không tìm thấy nút redeem' };
      }

      console.log('[Redeem] Waiting for response (timeout:', CONFIG.timeoutMs, 'ms)...');
      const response = await this.waitForCapturedResponse(CONFIG.timeoutMs);
      if (!response) {
        console.warn('[Redeem] TIMEOUT — capture.responses.length =', capture.responses.length);
        return { result: 'FAILED', reason: 'NO_RESPONSE', message: 'Timeout không nhận response' };
      }
      console.log('[Redeem] Response received:', JSON.stringify(response).slice(0, 200));
      return parseRedeemResponse(response);
    }

    waitForCapturedResponse(timeout) {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const last = getLastResponse();
          if (last) {
            console.log('[Redeem] Found captured response after', Date.now() - start, 'ms');
            resolve(last.data);
            return;
          }
          if (Date.now() - start > timeout) {
            console.warn(
              '[Redeem] waitForCapturedResponse TIMEOUT after',
              Date.now() - start,
              'ms, responses:',
              capture.responses.length,
            );
            resolve(null);
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });
    }

    async handleResponse(state, parsed, index) {
      // Always read latest state from storage before updating to avoid stale data race
      state = await getCentralState();
      if (!state) return;

      if (parsed.result === 'SUCCESS') {
        state = updateCodeState(state, index, {
          status: 'SUCCESS',
          result: 'SUCCESS',
          reason: parsed.reason,
        });
        state = updateStats(state, 1, 0);
      } else if (parsed.result === 'FAILED') {
        state = updateCodeState(state, index, {
          status: 'FAILED',
          result: 'FAILED',
          reason: parsed.reason,
        });
        state = updateStats(state, 0, 1);
      }
      const log = {
        id: generateId(),
        redeemCode: state.codeStates[index]?.redeemCode || '',
        result: parsed.result,
        reason: parsed.reason,
        responseCode: parsed.responseCode ?? null,
        responseMessage: parsed.message || '',
        responseSeq: parsed.seq || '',
        timestamp: Date.now(),
      };
      state = appendLog(state, log);
      state = setCurrentCode(state, null);
      await setCentralState(state);
    }
  }

  function findInput() {
    const direct = document.querySelector('.exc-input');
    if (visible(direct)) return direct;
    const inputs = [...document.querySelectorAll('input')];
    return inputs.find((el) => visible(el) && !el.disabled && !el.readOnly);
  }

  function findButton() {
    const direct = document.querySelector('.btn-exchange');
    if (visible(direct)) return direct;
    const btns = [...document.querySelectorAll('a,button')];
    return btns.find((el) => visible(el) && el.innerText.trim() === 'Đổi');
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function clickRedeem(button) {
    // Use dispatchEvent to trigger onclick handler without triggering javascript: href navigation (CSP violation)
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    );
  }

  function initRedeemController() {
    controller = new RedeemController();
    callbacks.onStart = () => controller.start();
    callbacks.onStop = async () => {
      await controller.pause();
    };
  }

  // ===== BOOTSTRAP =====
  initDashboard();
  initRedeemController();
  console.log('[Garena Redeem] Dashboard + RedeemController initialized.');
})();
