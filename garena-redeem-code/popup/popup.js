// ===== GUARD: kiểm tra AuthUtils đã load =====
if (!window.AuthUtils) {
  console.error('[Popup] AuthUtils chưa được load từ auth-utils.js');
  document.body.innerHTML = '<div style="padding:20px;color:red;">Lỗi: AuthUtils không khả dụng</div>';
}

// ===== CONSTANTS =====
const DEFAULT_CODES = [
  'DFSL2793',
  '10KSUBSYOUTUBEDFRTNK',
  '30KSUBSYOUTUBEDFESPNP',
  '85ewN4xYbJfncPKbADR',
  'A5Z1NDW8K3PJLU',
  'DF1314754',
  'DFAMMO08',
  'DFAPEX835',
  'DFARMX46',
  'DFASCEND72',
  'DFAWAKEN56',
  'DFAXIOM33',
  'DFBrilliant165',
  'DFCATALYST87',
  'DFCCOPGIST88',
  'DFCCOPNOW111',
  'DFCCOPPL4Y3R5',
  'DFCCOPTOBE03',
  'DFCCOPWOR1D',
  'DFCL503',
  'DFCOHERENCE35',
  'DFCONCORD82',
  'DFCRAFT427',
  'DFDRAGONBOAT',
  'DFDragon504',
  'DFELEVATE16',
  'DFEMBARK63',
  'DFENERGY33',
  'DFEnergy428',
  'DFExcellent659',
  'DFExceptional305',
  'DFFILE274',
  'DFFantasy742',
  'DFFlash260',
  'DFForever395',
  'DFGENESIS05',
  'DFGalaxy250',
  'DFHOLIDAY421',
  'DFHORIZON91',
  'DFHeroic668',
  'DFHorizon503',
  'DFINSIGHT48',
  'DFMAJORWIN8',
  'DFMagic057',
  'DFNinja874',
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
  'DFRESOLVE19',
  'DFRL1017',
  'DFRainbow356',
  'DFReliable732',
  'DFRemarkable103',
  'DFRocket825',
  'DFSH428',
  'DFSIXTOPACE',
  'DFSL2823',
  'DFSL4791',
  'DFSL5029',
  'DFSL6257',
  'DFSL7789',
  'DFUZI777',
  'DFSL9304',
  'DFSpark119',
  'DFTRNG469',
  'DFTURING09',
  'DFUT2025FINALS1549',
  'DFUT2025FINALS4216',
  'DFUT2025PLAYOFF1276',
  'DFUT2025PLAYOFF2509',
  'DFUT2025PLAYOFF4827',
  'DFUT2025PLAYOFF5732',
  'DFUT2025PLAYOFF5910',
  'DFUT2025PLAYOFF8051',
  'DFUT2025PLAYOFF9163',
  'DFUTS26QL3101C38',
  'DFUTW260412S36',
  'DFUTW260412S95',
  'DFUTW260412S99',
  'DFUltra220',
  'DFVANGUARD76',
  'DFVICTORY11',
  'DFWEAPON91',
  'DFWEEK237',
  'DFWITNESS77',
  'DFWizard309',
  'DFakaonikou',
  'DFanchor945',
  'DFaura371',
  'DFbeacon030',
  'DFceleste516',
  'DFclarity152',
  'DFclover812',
  'DFessence982',
  'DFeternity717',
  'DFharbor738',
  'DFjubilee594',
  'DFmoment479',
  'DFmomentum423',
  'DFoasis407',
  'DFpromise643',
  'DFserene218',
  'DFsolace241',
  'DFsymphony104',
  'DFvivid061',
  'DFvoyage901',
  'GADFZebra',
  'HEDELTAFORCE3630',
  'HEDELTAFORCE4583',
  'HEDELTAFORCE7563',
  'HEDELTAFORCE8032',
  'HEDELTAFORCE8781',
  'HEDELTAFORCE9026',
  'JGHMCmxYa6PLcFgvD9mg',
  'KINGSIXMAJOR',
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
  'MVPSOLDFSIX',
  'N4SQWgxYcHw7gUci3bJy',
  'POC3005S19',
  'POC3005S51',
  'POC3005S52',
  'POC3005S53',
  'POC3005S59',
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
  'SOLMAJORGG9',
  'SOLSIXVIP55',
  'TRILLIONRAID1000',
  'TRILLIONRAID300',
  'TRILLIONRAID600',
  'Top1BXHVN',
  'TrickOrTreat',
  'aCuQjtxY7vXGjxCTBnQU',
  'daichienboba2719',
  'daichienboba6167',
  'daichienboba6228',
  'daichienmobile3325',
  'daichienmobile7095',
  'daichienmobile7362',
  'f2X6e3xY3pJDCE5rT7P',
  'fvzeLrxYajwVviFSTSZ',
  'hjRtrKxYLmcTyYcEy64H',
  'yWHtfsxYGRPaZvAfLN82',
  // Newly added (unique only)
  'DFBAEXP67',
  'DFAMMX96',
  'DFATLA73',
  'DFGKTK34',
  'DFISTARRY939',
  'DFLUISHERE',
  'DFLUVUU282',
  'DFUTWQ230879',
  'DFUTWQ230872',
  'DFUTWQ220857',
  'DFUTWQ230897',
  'DFUTWQ220811',
  'DFUTWQ210862',
  'DFUTWQ220831',
  'DFUTWQ210810',
  'DFUTWQ210833',
  'DFUTWQ200889',
  'DFUTWQ200880',
  'DFUTWQ200838',
  'DFSL1983',
  'SOLDFACE007',
  'VIP999DFSIX',
  'PROSOLMAJOR',
];
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

// ===== STORAGE HELPERS =====
function setCentralState(state) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ centralState: state }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

function saveCodes(codes) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ redeem_codes: codes }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createInitialState(codes) {
  const total = codes.length;
  return {
    sessionId: generateId(),
    codes,
    currentIndex: 0,
    currentCode: null,
    status: total > 0 ? STATUSES.READY : STATUSES.NO_CODES,
    stats: { total, success: 0, failed: 0 },
    logs: [],
    codeStates: codes.map((c) => ({
      redeemCode: c,
      status: CODE_STATUSES.PENDING,
      result: null,
      reason: null,
    })),
  };
}

// ===== UI =====
const $ = (sel) => document.querySelector(sel);
const codesInput = $('#codesInput');
const btnSave = $('#btnSave');
const btnReset = $('#btnReset');
const webhookUrlInput = $('#webhookUrlInput');
const btnSaveWebhook = $('#btnSaveWebhook');
const codeCounter = $('#codeCounter');
const statusDot = $('#statusDot');
const statusLabel = $('#statusLabel');

// ===== SITE DETECTION =====
/**
 * Detect website hiện tại từ active tab URL → trả về 'playdeltaforce' | 'garena' | null
 */
function detectSiteFromUrl(url) {
  if (!url) return null;
  if (url.includes('playdeltaforce.com')) return 'playdeltaforce';
  if (url.includes('redeem.df.garena.sg')) return 'garena';
  return null;
}

/**
 * Hiển thị/ẩn sections dựa trên site detected.
 * Chỉ show section phù hợp với website hiện tại.
 */
function showSectionForSite(site) {
  const sections = document.querySelectorAll('.section[data-site]');
  sections.forEach((section) => {
    const siteKey = section.getAttribute('data-site');
    if (site && siteKey === site) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });
}

/**
 * Load URL của tab đang active → detect site → show/hide sections.
 */
async function initDynamicUI() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const site = detectSiteFromUrl(tab?.url);
    if (site) {
      console.log('[Popup] Detected site:', site, '— showing relevant section');
      showSectionForSite(site);
    } else {
      console.log('[Popup] Unknown site — showing all sections');
    }
  } catch (err) {
    console.warn('[Popup] Failed to detect site:', err);
  }
}

// ===== classifyCodes: delegate to AuthUtils =====
function classifyCodes(state) {
  if (!window.AuthUtils) {
    console.error('[Popup] AuthUtils chưa được load!');
    return { redeemed: [], dead: [], retryable: [], untested: [] };
  }
  return window.AuthUtils.classifyCodes(state);
}

// ===== Render redeem summary =====
function renderRedeemSummary() {
  chrome.storage.local.get('centralState', (result) => {
    const state = result.centralState;
    if (!state || !Array.isArray(state.codeStates)) {
      return; // chưa có redeem run
    }

    const { redeemed, dead, retryable, untested } = classifyCodes(state);

    document.getElementById('summaryTotal').textContent = state.codeStates.length;
    document.getElementById('summaryRedeemed').textContent = redeemed.length;
    document.getElementById('summaryDead').textContent = dead.length;
    document.getElementById('summaryRetryable').textContent = retryable.length;
    document.getElementById('summaryUntested').textContent = untested.length;

    // Show code lists
    const redeemedSection = document.getElementById('redeemedCodesSection');
    const deadSection = document.getElementById('deadCodesSection');
    const retryableSection = document.getElementById('retryableCodesSection');
    const redeemedList = document.getElementById('redeemedCodesList');
    const deadList = document.getElementById('deadCodesList');
    const retryableList = document.getElementById('retryableCodesList');

    if (redeemed.length > 0) {
      redeemedSection.style.display = '';
      redeemedList.textContent = redeemed.join('\n');
    } else {
      redeemedSection.style.display = 'none';
    }

    if (dead.length > 0) {
      deadSection.style.display = '';
      deadList.textContent = dead.join('\n');
    } else {
      deadSection.style.display = 'none';
    }

    if (retryable.length > 0) {
      retryableSection.style.display = '';
      retryableList.textContent = retryable.join('\n');
    } else {
      retryableSection.style.display = 'none';
    }

    // Update status header
    updateStatusHeader();
  });
}

// ===== INIT: load từ storage + detect site =====
initDynamicUI();
chrome.storage.local.get(['redeem_codes', 'webhookUrl'], (result) => {
  // Load codes
  const codes = result.redeem_codes;
  if (codes && codes.length > 0) {
    codesInput.value = codes.join('\n');
  } else {
    codesInput.value = DEFAULT_CODES.join('\n');
  }
  // Load webhook URL
  if (result.webhookUrl) {
    webhookUrlInput.value = result.webhookUrl;
  }

  // Render redeem summary
  renderRedeemSummary();
  updateCodeCounter();
  updateStatusHeader();
});

// ===== CODE COUNTER =====
codesInput.addEventListener('input', updateCodeCounter);

function updateCodeCounter() {
  if (!codeCounter) return;
  const lines = codesInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);
  codeCounter.textContent = lines.length + (lines.length === 1 ? ' code' : ' codes');
}

// ===== STATUS HEADER =====
function updateStatusHeader() {
  chrome.storage.local.get('centralState', (result) => {
    if (!statusDot || !statusLabel) return;
    const state = result.centralState;
    if (!state) {
      statusDot.className = 'status-dot';
      statusLabel.textContent = 'Ready';
      return;
    }
    const statusMap = {
      NO_CODES: { cls: '', label: 'No Codes' },
      READY: { cls: '', label: 'Ready' },
      RUNNING: { cls: 'running', label: 'Running' },
      PAUSED: { cls: 'paused', label: 'Paused' },
      COMPLETED: { cls: '', label: 'Complete' },
    };
    const cfg = statusMap[state.status] || statusMap.NO_CODES;
    statusDot.className = 'status-dot ' + cfg.cls;
    statusLabel.textContent = cfg.label;
  });
}

// ===== SAVE CODES =====
btnSave.addEventListener('click', async () => {
  const raw = codesInput.value.trim();
  if (!raw) {
    alert('Vui lòng nhập ít nhất 1 code!');
    return;
  }

  const codes = [
    ...new Set(
      raw
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c),
    ),
  ];
  if (codes.length === 0) {
    alert('Vui lòng nhập ít nhất 1 code!');
    return;
  }

  // Save codes to redeem_codes key
  await saveCodes(codes);
  console.log('[Popup] Codes saved:', codes.length);

  // Reset session: new sessionId, reset stats/logs, status = READY
  const newState = createInitialState(codes);
  await setCentralState(newState);
  console.log('[Popup] CentralState set, status:', newState.status, 'total:', newState.stats.total);

  // Re-render summary
  renderRedeemSummary();

  btnSave.textContent = '✅ Đã lưu!';
  btnSave.style.background = '#22c55e';
  setTimeout(() => {
    btnSave.textContent = '💾 Lưu codes';
    btnSave.style.background = '';
  }, 1500);
});

// ===== SAVE WEBHOOK URL =====
btnSaveWebhook.addEventListener('click', () => {
  const url = webhookUrlInput.value.trim();
  if (!url) {
    alert('Vui lòng nhập Webhook URL!');
    return;
  }
  if (!url.startsWith('https://discord.com/api/webhooks/')) {
    alert('URL không hợp lệ. Phải có dạng: https://discord.com/api/webhooks/.../...');
    return;
  }
  chrome.storage.local.set({ webhookUrl: url }, () => {
    btnSaveWebhook.textContent = '✅ Đã lưu!';
    btnSaveWebhook.style.background = '#22c55e';
    // Ẩn input để tránh lộ URL
    webhookUrlInput.value = '';
    setTimeout(() => {
      btnSaveWebhook.textContent = '💾 Lưu Webhook URL';
      btnSaveWebhook.style.background = '';
    }, 1500);
  });
});

// ===== RESET TO DEFAULT (KHÔNG auto-save) =====
btnReset.addEventListener('click', () => {
  if (!confirm('Reset về codes mặc định?')) return;
  codesInput.value = DEFAULT_CODES.join('\n');
  btnReset.textContent = '✅ Done!';
  setTimeout(() => {
    btnReset.textContent = '🔄 Reset default';
  }, 1500);
});

// ===== Helper: extract unique values from array of objects =====
function extractUniqueValues(events, key) {
  const values = new Set();
  for (const event of events) {
    if (event[key]) values.add(event[key]);
  }
  return Array.from(values);
}

// ===== Compute stats from events (client-side) =====
function computeStatsFromEvents(events) {
  // Handle both normalized events (from auth-investigator-content.js)
  // and raw events (from auth-investigator.js MAIN world)
  const authEvents = events.filter((e) => {
    const type = e.type || '';
    // Normalized format: { type: 'auth_xhr_response', auth: {...} }
    if (type.includes('auth_')) return true;
    // Raw format: { type: 'xhr_response', hasAccessToken: ... }
    if (type.includes('xhr_response') || type.includes('fetch_response')) return true;
    if (type === 'storage_write' || type === 'auth_refresh_request') return true;
    return false;
  });

  const responseEvents = authEvents.filter((e) => {
    const type = e.type || '';
    if (type.includes('_response')) return true;
    // Normalized: check nested auth object
    if (e.auth && typeof e.auth === 'object') return true;
    return false;
  });

  const storageEvents = authEvents.filter((e) => {
    const type = e.type || '';
    if (type === 'storage_write') return true;
    // Normalized: check nested storage object
    if (e.storage && typeof e.storage === 'object') return true;
    return false;
  });

  // Identity mapping — delegate to AuthUtils
  let identity = { garenaHash: '—', dfToolsHash: '—', match: 'Chưa đủ dữ liệu' };
  let garenaHash = '—';
  let dfToolsHash = '—';
  let identityMatch = 'Chưa đủ dữ liệu';
  let identityMatchClass = 'match-pending';
  let tokenState = { accessToken: 'NOT AVAILABLE', refreshToken: 'NOT AVAILABLE', expiresIn: null, lastIssued: null, lastIssuedTimestamp: null, expiresAt: null, remainingSeconds: null, isExpired: false, expiresAtFormatted: null };
  let refreshFlow = { requestCount: 0, successCount: 0, failedCount: 0, steps: [], status: 'NOT DETECTED', supported: false };
  let correlatedPairs = [];

  try {
    if (window.AuthUtils) {
      identity = window.AuthUtils.computeIdentityMapping(events);
      garenaHash = identity.garenaHash;
      dfToolsHash = identity.dfToolsHash;
      identityMatch =
        identity.match === 'MATCH'
          ? 'MATCH'
          : identity.match === 'DIFFERENT'
            ? 'DIFFERENT'
            : 'Chưa đủ dữ liệu';
      identityMatchClass =
        identity.match === 'MATCH'
          ? 'match-yes'
          : identity.match === 'DIFFERENT'
            ? 'match-no'
            : 'match-pending';

      const latestTokenEvent = tokenEvents.length > 0 ? tokenEvents[tokenEvents.length - 1] : null;
      tokenState = window.AuthUtils.computeTokenState(latestTokenEvent);
      refreshFlow = window.AuthUtils.computeRefreshFlow(events);
      correlatedPairs = window.AuthUtils.buildRefreshCorrelation(events);
    }
  } catch (err) {
    console.error('[Popup] AuthUtils error:', err);
  }

  // Collect domains
  const domains = new Set();
  for (const event of events) {
    const url = event.url || '';
    if (url) {
      try {
        const urlObj = new URL(url, location.origin);
        if (urlObj.hostname) domains.add(urlObj.hostname);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    authEvents: authEvents.length,
    responseEvents: responseEvents.length,
    channelInfoResponses: responseEvents.filter((e) => e.auth?.hasChannelInfo || e.hasChannelInfo)
      .length,
    hasAccessToken: tokenEvents.length > 0,
    hasRefreshToken: events.some((e) => e.auth?.hasRefreshToken || e.hasRefreshToken),
    hasGarenaOpenId: events.some((e) => e.auth?.hasGarenaSnsOpenid || e.hasGarenaSnsOpenid),
    hasDfToolsOpenId: events.some((e) => e.auth?.hasOpenId || e.hasDfToolsOpenid),
    garenaHash: garenaHash || '—',
    dfToolsHash: dfToolsHash || '—',
    identityMatch,
    identityMatchClass,
    tokenState,
    refreshFlow: {
      requestCount: refreshFlow.requestCount,
      successCount: refreshFlow.successCount,
      failedCount: refreshFlow.failedCount,
      steps: refreshFlow.steps,
      status: refreshFlow.status,
      supported: refreshFlow.supported,
    },
    correlatedPairs,
    domains: Array.from(domains),
    events: authEvents,
  };
}

// ===== TAB SWITCHING =====
document.querySelectorAll('.segment-btn').forEach((tab) => {
  tab.addEventListener('click', () => {
    // Remove active from all tabs
    document.querySelectorAll('.segment-btn').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

    // Activate selected tab
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById('tab-' + tabId).classList.add('active');

    // Update header title
    const titleEl = document.getElementById('headerTitle');
    if (tabId === 'investigator') {
      titleEl.textContent = 'Auth State Engine';
      loadAuthStateData();
      startAuthStateRefresh();
    } else {
      titleEl.textContent = 'Garena Redeem';
      if (authStateRefreshInterval) clearInterval(authStateRefreshInterval);
    }
  });

  // ===== Sub-tab Navigation (Auth State Engine) =====
  document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.sub-tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const subTabId = 'subtab-' + btn.dataset.subtab;
      document.getElementById(subTabId).classList.add('active');

      // Load data khi switch sang tab
      if (btn.dataset.subtab === 'timeline') {
        loadTimelineData();
      } else if (btn.dataset.subtab === 'refresh') {
        loadRefreshData();
      } else if (btn.dataset.subtab === 'network') {
        loadNetworkData();
      } else if (btn.dataset.subtab === 'storage') {
        loadStorageData();
      }
    });
  });

  // ===== Network Filters =====
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderNetworkEvents(getCachedEvents(), chip.dataset.filter);
    });
  });

  // ===== Event Inspector Modal =====
  const modalOverlayEl = document.getElementById('modalOverlay');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalBodyEl = document.getElementById('modalBody');
  const modalCloseEl = document.getElementById('modalClose');

  if (modalCloseEl) {
    modalCloseEl.addEventListener('click', () => {
      modalOverlayEl.classList.remove('active');
    });
  }
  if (modalOverlayEl) {
    modalOverlayEl.addEventListener('click', (e) => {
      if (e.target === modalOverlayEl) {
        modalOverlayEl.classList.remove('active');
      }
    });
  }

  // ===== Clear Events Button =====
  const btnClearEvents = document.getElementById('btnClearEvents');
  if (btnClearEvents) {
    btnClearEvents.addEventListener('click', () => {
      if (!confirm('Xóa tất cả auth events?')) return;
      chrome.storage.local.set({ auth_events: [] }, () => {
        loadTimelineData();
      });
    });
  }
});

// ===== Cached events cho network filter =====
let cachedEvents = [];

function getCachedEvents() {
  return cachedEvents;
}

// ===== AUTH STATE ENGINE DATA LOADING =====
function loadAuthStateData() {
  // Load auth state directly from storage (popup cannot message content script)
  chrome.storage.local.get(['auth_state', 'auth_events'], (result) => {
    const state = result.auth_state;
    if (state) {
      updateAuthStateBanner(state);
      renderAuthStateOverviewFromState(state);
    }

    // Also render token state from events
    const events = result.auth_events || [];
    if (events.length === 0) return;
    const stats = computeStatsFromEvents(events);
    renderTokenState(stats.tokenState);
  });
}

function renderAuthStateOverview(stats) {
  const sessionIdEl = document.getElementById('authSessionId');
  const tokenStateEl = document.getElementById('authTokenState');
  const refreshSupportEl = document.getElementById('authRefreshSupport');
  const expiresInEl = document.getElementById('authExpiresIn');

  if (sessionIdEl) {
    sessionIdEl.textContent = stats.tokenState?.lastIssued ? 'ACTIVE' : '—';
  }
  if (tokenStateEl) {
    tokenStateEl.textContent = stats.tokenState?.accessToken === 'PRESENT' ? '✓' : '—';
  }
  if (refreshSupportEl) {
    refreshSupportEl.textContent = stats.hasRefreshToken ? '✓' : '—';
  }
  if (expiresInEl && stats.tokenState?.expiresIn) {
    expiresInEl.textContent = formatRemaining(stats.tokenState.remainingSeconds || 0);
  }
}

function renderAuthStateOverviewFromState(state) {
  const sessionIdEl = document.getElementById('authSessionId');
  const tokenStateEl = document.getElementById('authTokenState');
  const refreshSupportEl = document.getElementById('authRefreshSupport');
  const expiresInEl = document.getElementById('authExpiresIn');

  if (sessionIdEl) {
    sessionIdEl.textContent = state.sessionId ? '#' + state.sessionId.slice(-4) : '—';
  }
  if (tokenStateEl) {
    tokenStateEl.textContent = state.fingerprint ? '✓' : '—';
  }
  if (refreshSupportEl) {
    refreshSupportEl.textContent = state.hasRefreshToken ? '✓' : '—';
  }
  if (expiresInEl) {
    if (state.expiresAt) {
      const remaining = Math.max(0, (state.expiresAt - Date.now()) / 1000);
      expiresInEl.textContent = formatRemaining(remaining);
    } else if (state.expiresIn) {
      expiresInEl.textContent = formatRemaining(state.expiresIn);
    } else {
      expiresInEl.textContent = '—';
    }
  }
}

// ===== Auth State Banner =====
function updateAuthStateBanner(state) {
  if (!state) return;

  const bannerEl = document.getElementById('authStateBanner');
  const iconEl = document.getElementById('bannerIcon');
  const titleEl = document.getElementById('bannerTitle');
  const subtitleEl = document.getElementById('bannerSubtitle');

  if (!bannerEl) return;

  bannerEl.className = 'auth-state-banner';
  const config = AUTH_STATE_CONFIG[state.state] || AUTH_STATE_CONFIG.UNKNOWN;
  bannerEl.classList.add('state-' + state.state.toLowerCase());

  if (iconEl) iconEl.textContent = config.icon;
  if (titleEl) {
    titleEl.textContent = state.state;
    titleEl.style.color = config.color || 'var(--text-muted)';
  }
  if (subtitleEl) {
    let remaining = '—';
    if (state.expiresAt) {
      remaining = formatRemaining(Math.max(0, (state.expiresAt - Date.now()) / 1000));
    } else if (state.expiresIn) {
      remaining = formatRemaining(state.expiresIn);
    }
    subtitleEl.textContent =
      state.state === 'ACTIVE'
        ? `Session ${state.sessionId ? '#' + state.sessionId.slice(-4) : '—'} · Expires in ${remaining}`
        : 'Theo dõi auth lifecycle';
  }
}

// AUTH_STATE_CONFIG loaded from auth-utils.js

// ===== Notifications =====
function loadNotifications() {
  // Read directly from storage (popup cannot message content script)
  chrome.storage.local.get('auth_notifications', (result) => {
    renderNotifications(result.auth_notifications || []);
  });
}

function renderNotifications(notifs) {
  const el = document.getElementById('notificationsList');
  if (!el) return;

  if (!notifs || notifs.length === 0) {
    el.innerHTML = '<div class="empty-state">No notifications yet.</div>';
    return;
  }

  el.innerHTML = notifs
    .map((n) => {
      const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.UNKNOWN;
      const time = new Date(n.timestamp).toLocaleTimeString('vi-VN');
      const shortId = n.shortSessionId || (n.sessionId ? '#' + n.sessionId.slice(-4) : '—');

      return `
      <div class="notification-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}">
        <span class="notification-icon">${config.icon}</span>
        <div class="notification-body">
          <div class="notification-header">
            <span class="notification-type ${config.typeClass}">${config.label}</span>
            <span class="notification-time">${time}</span>
          </div>
          <div class="notification-reason">${escapeHtml(n.reason || n.type)}</div>
          <div class="notification-session">Session: ${shortId}</div>
        </div>
      </div>
    `;
    })
    .join('');

  el.querySelectorAll('.notification-item').forEach((item) => {
    item.addEventListener('click', () => {
      const notifId = item.dataset.notifId;
      chrome.runtime.sendMessage({ type: 'MARK_NOTIF_READ', notifId }, () => {
        item.classList.remove('unread');
      });
    });
  });
}

// NOTIF_CONFIG loaded from auth-utils.js

// ===== AUTO-REFRESH AUTH STATE =====
let authStateRefreshInterval = null;

function startAuthStateRefresh() {
  if (authStateRefreshInterval) clearInterval(authStateRefreshInterval);
  authStateRefreshInterval = setInterval(() => {
    const investigatorTab = document.getElementById('tab-investigator');
    if (investigatorTab?.classList.contains('active')) {
      loadAuthStateData();
      // Load notifications when on investigator tab
      const notifEl = document.getElementById('notificationsList');
      if (notifEl) loadNotifications();
    }
  }, 5000);
}

function renderTokenState(ts) {
  const el = document.getElementById('tokenState');
  if (!el) return;

  if (!ts.lastIssued) {
    el.innerHTML = '<div class="empty-state">No token data.</div>';
    return;
  }

  const hasValidExpiry = ts.expiresAt != null && ts.expiresAt > 0;
  const isExpired = ts.isExpired || false;
  const remaining = hasValidExpiry ? ts.remainingSeconds : null;
  const remainingClass = isExpired
    ? 'match-no'
    : hasValidExpiry && remaining < 3600
      ? 'match-pending'
      : 'match-yes';
  const remainingText = !hasValidExpiry ? '—' : isExpired ? 'EXPIRED' : formatRemaining(remaining);

  el.innerHTML = `
    <div class="token-row"><span class="token-label">Issued</span><span class="token-value">${ts.lastIssued}</span></div>
    <div class="token-row"><span class="token-label">Lifetime</span><span class="token-value">${hasValidExpiry ? formatLifetime(ts.expiresIn) : '—'}</span></div>
    <div class="token-row"><span class="token-label">Expires</span><span class="token-value">${hasValidExpiry ? ts.expiresAtFormatted : '—'}</span></div>
    <div class="token-row"><span class="token-label">Remaining</span><span class="token-value ${remainingClass}" id="tokenRemaining">${remainingText}</span></div>
  `;
}

// escapeHtml loaded from auth-utils.js

// ===== CLEAR EVENTS (Auth Investigator) =====
const btnClear = document.getElementById('btnClear');
if (btnClear) {
  btnClear.addEventListener('click', () => {
    if (!confirm('Xóa tất cả auth events?')) return;
    chrome.storage.local.set({ auth_events: [] }, () => {
      loadAuthStateData();
    });
  });
}

// ===== Clear notifications =====
const btnClearNotifs = document.getElementById('btnClearNotifs');
if (btnClearNotifs) {
  btnClearNotifs.addEventListener('click', () => {
    if (!confirm('Xóa tất cả notifications?')) return;
    chrome.storage.local.set({ auth_notifications: [] }, () => {
      loadNotifications();
    });
  });
}

// formatRemaining / formatLifetime loaded from auth-utils.js

// ===== Countdown ticker =====
let tokenTickerInterval = null;

function startTokenTicker() {
  if (tokenTickerInterval) clearInterval(tokenTickerInterval);
  tokenTickerInterval = setInterval(() => {
    chrome.storage.local.get(null, (allStorage) => {
      const events = allStorage.auth_events || [];
      if (events.length === 0) return;
      const stats = computeStatsFromEvents(events);
      const ts = stats.tokenState;
      const el = document.getElementById('tokenRemaining');
      if (!el || !ts.lastIssued) return;
      if (ts.isExpired) {
        el.textContent = 'EXPIRED';
        el.className = 'token-value match-no';
        clearInterval(tokenTickerInterval);
        tokenTickerInterval = null;
      } else {
        el.textContent = formatRemaining(ts.remainingSeconds);
      }
    });
  }, 1000);
}

// ===== Load & Render Timeline =====
function loadTimelineData() {
  chrome.storage.local.get('auth_events', (result) => {
    const events = result.auth_events || [];
    cachedEvents = events;
    renderTimeline(events);
  });
}

function renderTimeline(events) {
  const el = document.getElementById('timelineList');
  if (!el) return;

  if (!events || events.length === 0) {
    el.innerHTML = '<div class="empty-state">Chưa có events.</div>';
    return;
  }

  const sorted = [...events].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  el.innerHTML = sorted
    .slice(0, 100)
    .map((e, i) => renderTimelineItem(e, sorted.length - 1 - i))
    .join('');

  // Bind click để mở modal
  el.querySelectorAll('.timeline-item').forEach((item) => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      openEventModal(sorted[idx], sorted[idx].raw || {});
    });
  });
}

function renderTimelineItem(e, index) {
  const icon = getTimelineEmoji(e);
  const typeClass = getTimelineTypeClass(e);
  return `
    <div class="timeline-item" data-index="${index}">
      <span class="timeline-time">${e.time || '--:--:--'}</span>
      <span class="timeline-icon ${icon}">${icon}</span>
      <div class="timeline-body">
        <div class="timeline-type ${typeClass}">${escapeHtml(e.type || 'unknown')}</div>
        <div class="timeline-summary">${escapeHtml(e.summary || '')}</div>
      </div>
    </div>
  `;
}

function getTimelineEmoji(e) {
  if (e.isRefresh) return '↻';
  if (e.hasToken) return '🔑';
  if (e.hasIdentity) return '🆔';
  if (e.hasChannelInfo) return '📋';
  return '●';
}

function getTimelineTypeClass(e) {
  if (e.isRefresh) return 'refresh-request';
  if (e.hasToken) return 'fetch-response';
  return '';
}

// ===== Load & Render Refresh Data =====
function loadRefreshData() {
  chrome.storage.local.get('auth_events', (result) => {
    const events = result.auth_events || [];
    const stats = computeStatsFromEvents(events);
    renderRefreshFlow(stats.refreshFlow);
    renderRefreshCorrelation(stats.correlatedPairs || []);
  });
}

function renderRefreshFlow(flow) {
  const el = document.getElementById('refreshFlow');
  if (!el) return;

  if (!flow || !flow.steps) {
    el.innerHTML = '<div class="empty-state">Chưa có refresh data.</div>';
    return;
  }

  const statusClass =
    flow.status === 'CONFIRMED'
      ? 'match-yes'
      : flow.status === 'PARTIAL'
        ? 'match-pending'
        : 'match-no';

  const stepsHtml = flow.steps
    .map((step) => {
      const icon = step.passed ? '✓' : '✗';
      const stepClass = step.passed ? 'match-yes' : 'match-no';
      return `
      <div class="checklist-row">
        <span class="checklist-icon ${stepClass}">${icon}</span>
        <span class="checklist-label">${escapeHtml(step.name)}</span>
      </div>
    `;
    })
    .join('');

  el.innerHTML = `
    <div class="token-row"><span class="token-label">Refresh Support</span><span class="token-value ${flow.supported ? 'match-yes' : ''}">${flow.supported ? 'DETECTED' : 'NOT DETECTED'}</span></div>
    <div class="token-row"><span class="token-label">Requests</span><span class="token-value">${flow.requestCount || 0}</span></div>
    <div class="token-row"><span class="token-label">Successful</span><span class="token-value match-yes">${flow.successCount || 0}</span></div>
    <div class="token-row"><span class="token-label">Failed</span><span class="token-value ${flow.failedCount > 0 ? 'match-no' : ''}">${flow.failedCount || 0}</span></div>
    <div class="token-row"><span class="token-label">Last refresh</span><span class="token-value">${flow.lastRefreshTime || '—'}</span></div>
    <div class="section-divider"></div>
    <div class="checklist-section">${stepsHtml}</div>
    <div class="section-divider"></div>
    <div class="token-row"><span class="token-label">Status</span><span class="token-value ${statusClass}">${flow.status || 'NOT DETECTED'}</span></div>
  `;
}

function renderRefreshCorrelation(pairs) {
  const el = document.getElementById('refreshCorrelationList');
  if (!el) return;

  if (!pairs || pairs.length === 0) {
    el.innerHTML = '<div class="empty-state">No refresh events.</div>';
    return;
  }

  el.innerHTML = pairs
    .map((pair) => {
      const durationStr = pair.duration != null ? pair.duration + 'ms' : '—';
      const statusClass =
        pair.success === true ? 'match-yes' : pair.success === false ? 'match-no' : 'match-pending';
      const statusText =
        pair.success === true ? '200 OK' : pair.success === false ? 'FAILED' : 'PENDING';

      const evidenceRows = [];
      if (pair.tokenChanged !== undefined) {
        const tokenClass = pair.tokenChanged ? 'match-yes' : 'match-pending';
        const tokenText = pair.tokenChanged ? 'fingerprint changed' : 'no change';
        evidenceRows.push(
          `<div class="evidence-row"><span class="evidence-label">Token changed:</span><span class="evidence-value ${tokenClass}">${pair.tokenChanged ? '✓' : '—'} ${tokenText}</span></div>`,
        );
      }
      if (pair.expiryChanged !== null) {
        const expiryClass = pair.expiryChanged ? 'match-yes' : 'match-pending';
        const expiryText = pair.expiryChanged
          ? `${pair.cycleExpiryBefore}s → ${pair.cycleExpiryAfter}s`
          : `${pair.cycleExpiryBefore}s (no change)`;
        evidenceRows.push(
          `<div class="evidence-row"><span class="evidence-label">Expiry updated:</span><span class="evidence-value ${expiryClass}">${pair.expiryChanged ? '✓' : '—'} ${expiryText}</span></div>`,
        );
      }

      const evidenceHtml =
        evidenceRows.length > 0
          ? `<div class="refresh-pair-evidence">${evidenceRows.join('')}</div>`
          : '';

      return `
      <div class="refresh-pair">
        <div class="refresh-pair-header">
          <span class="request-id">req_${(pair.requestId || '').slice(-8)}</span>
          <span class="pair-status ${statusClass}">${statusText}</span>
        </div>
        <div class="refresh-pair-timeline">
          <div class="pair-step">
            <span class="step-time">${pair.requestTimeFormatted || '—'}</span>
            <span class="step-label">REFRESH_REQUEST</span>
          </div>
          <div class="pair-connector"><span class="connector-duration">${durationStr}</span></div>
          <div class="pair-step ${!pair.hasResponse ? 'pending' : ''}">
            <span class="step-time">${pair.responseTimeFormatted || '—'}</span>
            <span class="step-label">${pair.responseStatus ? 'REFRESH_RESPONSE status=' + pair.responseStatus : 'REFRESH_RESPONSE'}</span>
          </div>
          ${
            pair.hasResponse
              ? `
          <div class="pair-connector"><span class="connector-arrow">▼</span></div>
          <div class="pair-step">
            <span class="step-label">ACCESS_TOKEN_UPDATED</span>
          </div>`
              : ''
          }
        </div>
        ${evidenceHtml}
      </div>
    `;
    })
    .join('');
}

// ===== Load & Render Network Events =====
function loadNetworkData() {
  chrome.storage.local.get('auth_events', (result) => {
    const events = result.auth_events || [];
    cachedEvents = events;
    const activeFilter = document.querySelector('.chip.active');
    renderNetworkEvents(events, activeFilter ? activeFilter.dataset.filter : 'all');
  });
}

function renderNetworkEvents(events, filter) {
  const el = document.getElementById('networkEventsList');
  if (!el) return;

  const filtered = (events || []).filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'response') return e.type?.includes('_response');
    if (filter === 'refresh') return e.type === 'auth_refresh_request';
    return true;
  });

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state">Chưa có network events.</div>';
    return;
  }

  el.innerHTML = filtered
    .slice(0, 50)
    .map((e) => renderNetworkEventItem(e))
    .join('');

  el.querySelectorAll('.event-item').forEach((item) => {
    item.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });
  });
}

function renderNetworkEventItem(event) {
  const typeClass = getEventClass(event.type);
  const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('vi-VN') : '--:--:--';
  const summary = getEventSummary(event);

  return `
    <div class="event-item">
      <div class="event-header">
        <span class="event-type ${typeClass}">${escapeHtml(event.type)}</span>
        <span class="event-time">${time}</span>
      </div>
      <div class="event-body">${summary}</div>
    </div>
  `;
}

function getEventClass(type) {
  if (type === 'auth_refresh_request') return 'refresh-request';
  if (type?.includes('storage_write')) return 'auth-storage';
  if (type?.includes('xhr_sent')) return 'xhr-sent';
  if (type?.includes('xhr_response')) return 'xhr-response';
  if (type?.includes('fetch_sent')) return 'fetch-sent';
  if (type?.includes('fetch_response')) return 'fetch-response';
  return '';
}

function getEventSummary(event) {
  const lines = [];
  if (event.url)
    lines.push(
      `<span class="field-key">URL:</span><span class="field-value">${escapeHtml(event.url)}</span>`,
    );
  if (event.method)
    lines.push(
      `<span class="field-key">Method:</span><span class="field-value">${escapeHtml(event.method)}</span>`,
    );
  if (event.statusCode)
    lines.push(
      `<span class="field-key">Status:</span><span class="field-value">${event.statusCode}</span>`,
    );

  if (event.type === 'auth_refresh_request') {
    lines.push(
      `<span class="field-key">Refresh req:</span><span class="field-value" style="color:var(--green)">✓</span>`,
    );
  }
  if (event.isRefreshResponse === true)
    lines.push(
      `<span class="field-key">Refresh resp:</span><span class="field-value" style="color:var(--green)">✓ correlated</span>`,
    );

  if (event.hasAccessToken !== undefined)
    lines.push(
      `<span class="field-key">access_token:</span><span class="field-value">${event.hasAccessToken ? '✓' : '✗'}</span>`,
    );
  if (event.hasRefreshToken !== undefined)
    lines.push(
      `<span class="field-key">refresh_token:</span><span class="field-value">${event.hasRefreshToken ? '✓' : '✗'}</span>`,
    );
  if (event.hasGarenaSnsOpenid !== undefined)
    lines.push(
      `<span class="field-key">garena_sns_openid:</span><span class="field-value">${event.hasGarenaSnsOpenid ? '✓' : '✗'}</span>`,
    );
  if (event.hasOpenId !== undefined)
    lines.push(
      `<span class="field-key">open_id:</span><span class="field-value">${event.hasOpenId ? '✓' : '✗'}</span>`,
    );
  if (event.hasChannelInfo)
    lines.push(
      `<span class="field-key">channel_info:</span><span class="field-value">✓ (${(event.channelInfoKeys || []).join(', ')})</span>`,
    );
  if (event.resultKeys?.length > 0)
    lines.push(
      `<span class="field-key">Keys:</span><span class="field-value">${event.resultKeys.join(', ')}</span>`,
    );

  return lines.join('<br>') || '(no data)';
}

// ===== Load & Render Storage Events =====
function loadStorageData() {
  chrome.storage.local.get('auth_events', (result) => {
    const events = result.auth_events || [];
    const storageEvents = events.filter(
      (e) => e.type === 'auth_storage_write' || e.type === 'auth_storage',
    );
    renderStorageEvents(storageEvents);
  });
}

function renderStorageEvents(events) {
  const el = document.getElementById('storageEventsList');
  if (!el) return;

  if (!events || events.length === 0) {
    el.innerHTML = '<div class="empty-state">Chưa có storage events.</div>';
    return;
  }

  el.innerHTML = events
    .map(
      (e) => `
    <div class="storage-row">
      <span class="storage-time">${new Date(e.timestamp).toLocaleTimeString('vi-VN')}</span>
      <span class="storage-type">${escapeHtml(e.storageType || 'Storage')}</span>
      <span class="storage-key">${escapeHtml(e.key || '')}</span>
    </div>
  `,
    )
    .join('');
}

// ===== Event Inspector Modal =====
function openEventModal(event, raw) {
  if (!modalTitleEl || !modalBodyEl) return;

  modalTitleEl.textContent = event.type || 'Event';
  const lines = [];

  lines.push(detailRow('Type', event.type));
  lines.push(
    detailRow('Time', event.timestamp ? new Date(event.timestamp).toLocaleString('vi-VN') : '—'),
  );
  lines.push(detailRow('Request ID', event.requestId || '—'));

  if (event.method) lines.push(detailRow('Method', event.method));
  if (event.url) lines.push(detailRow('URL', event.url));
  if (event.statusCode) lines.push(detailRow('Status', event.statusCode));

  // Auth fields
  const authFields = [
    ['access_token', event.hasAccessToken],
    ['refresh_token', event.hasRefreshToken],
    ['garena_sns_openid', event.hasGarenaSnsOpenid],
    ['open_id', event.hasOpenId],
    ['expires_in', event.expiresIn ?? '—'],
    ['third_type', event.thirdType],
  ];
  const hasAuthFields = authFields.some(([, v]) => v !== undefined);
  if (hasAuthFields) {
    lines.push('');
    lines.push('<div class="detail-section-title">Auth Fields</div>');
    authFields.forEach(([key, val]) => {
      if (val !== undefined) {
        lines.push(detailRow(key, val ? '✓' : '✗'));
      }
    });
  }

  // Hashes
  if (event.garenaSnsOpenidHash || event.dfToolsOpenidHash) {
    lines.push('');
    lines.push('<div class="detail-section-title">Identity Hashes</div>');
    if (event.garenaSnsOpenidHash) lines.push(detailRow('Garena hash', event.garenaSnsOpenidHash));
    if (event.dfToolsOpenidHash) lines.push(detailRow('DfTools hash', event.dfToolsOpenidHash));
  }

  // Storage
  if (event.type === 'auth_storage_write') {
    lines.push('');
    lines.push('<div class="detail-section-title">Storage</div>');
    lines.push(detailRow('Type', event.storageType));
    lines.push(detailRow('Key', event.key));
    lines.push(detailRow('Value', `<${event.valueLength || 0} chars>`));
  }

  modalBodyEl.innerHTML = lines.join('');
  modalOverlayEl.classList.add('active');
}

function detailRow(key, value) {
  return `<div class="detail-row"><span class="detail-key">${escapeHtml(key)}</span><span class="detail-value">${escapeHtml(String(value))}</span></div>`;
}
