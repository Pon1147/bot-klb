// ===== Pure Helper Functions =====
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEAD_REASONS = new Set(['ALREADY_REDEEMED', 'INVALID', 'EXPIRED']);
const RETRYABLE_REASONS = new Set(['TEMP_ERROR', 'NO_RESPONSE']);

function classifyCodes(state) {
  if (!state || !Array.isArray(state.codeStates)) {
    return { redeemed: [], dead: [], retryable: [], untested: [] };
  }
  const redeemed = [];
  const dead = [];
  const retryable = [];
  const untested = [];
  for (const cs of state.codeStates) {
    const code = cs.redeemCode;
    if (cs.status === 'SUCCESS' || cs.result === 'SUCCESS') {
      redeemed.push(code);
    } else if (cs.status === 'PENDING') {
      untested.push(code);
    } else if (cs.status === 'FAILED' && DEAD_REASONS.has(cs.reason)) {
      dead.push(code);
    } else if (RETRYABLE_REASONS.has(cs.reason)) {
      retryable.push(code);
    } else {
      untested.push(code);
    }
  }
  return { redeemed, dead, retryable, untested };
}

// ===== CONSTANTS =====
const DEFAULT_CODES = [
  'DFCRLKAD84',
  'DFAMMO4284',
  'DFVN2Q9C7X4N',
  'dJ8qArxYTQDbjzVc2WQw',
  'ga_aurora',
  'ga_deltainto2027',
  'ga_giftfromtaj',
  'ga_martelo',
  'ga_zenith',
  'WELCOMEDFMY',
  'CRAZYPARTY0453',
  'CRAZYPARTY1710',
  'CRAZYPARTY2234',
  'CRAZYPARTY226',
  'CRAZYPARTY2706',
  'CRAZYPARTY3482',
  'DETONATIONGOGO',
  'DFLAVBMB35',
  'DFTURBRK41',
  'HITTHEROADTODFI',
  'POCISHERE',
  'POCS2S2',
  'POCSEEYOUTMR',
  'SRTHAYDACDF',
  'WHOISPOCKING',
  'DFCHANCE66',
  'DFTHKOL55',
  'DFTHKOL88',
  'AKHIPFIRERIP',
  'AUGTUTO',
  'DAISUAK12YOR',
  'DFFSSWT274',
  'DFVN7KQ9M2X8',
  'DFVNB6X3N8Q1',
  'G3TIT',
  'P90FFF',
  'QBZTUGIAN',
  'SG552MICRO',
  'SKSMINHUN',
  'SMGLONGKAKA',
  'VUADIVUANHAY',
  '11ResCupDF',
  '22DFResCup',
  '812RCB',
  'DFASSAULT55',
  'DFCOHERENCE35',
  'DFENERGY33',
  'DFSL2823',
  'DFSL4791',
  'DFSL6257',
  'DFSL9304',
  'DFSTEALTH44',
  'DFUZI777',
  'DeltaForceRC777',
  'MOILOOT23',
  'MOILOOT98',
  'RCA812',
  'RCL813',
  'SsCkDfxY5AkdZqiJLkXq',
  'DFVITRAT63',
  'DFVNHackclaw1',
  'DFVNNox5',
  'DFVNSineva6',
  'DFVNToxik4',
  'DFVNUluru3',
  'DFVNVyron2',
  'DFakaonikou',
  'f2X6e3xY3pJDCE5rT7P',
  'hjRtrKxYLmcTyYcEy64H',
  'yWHtfsxYGRPaZvAfLN82',
  'ANIMALCUPGUN',
  'ANIMALCUPTANK',
  'DFADVN74',
  'DFAMMO08',
  'DFAMMX96',
  'DFANIMALCUP',
  'DFAPEX835',
  'DFARMX46',
  'DFASCEND72',
  'DFATLA73',
  'DFAWAKEN56',
  'DFAXIOM33',
  'DFBAEXP67',
  'DFBLKT42',
  'DFCARRAT52',
  'DFCATALYST87',
  'DFCCOPGIST88',
  'DFCCOPNOW111',
  'DFCCOPPL4Y3R5',
  'DFCCOPTOBE03',
  'DFCCOPWOR1D',
  'DFCONCORD82',
  'DFCRAFT427',
  'DFDRAGONBOAT',
  'DFELEVATE16',
  'DFEMBARK63',
  'DFFILE274',
  'DFGENESIS05',
  'DFGKTK34',
  'DFHOLIDAY421',
  'DFHORIZON91',
  'DFINSIGHT48',
  'DFISTARRY939',
  'DFLUISHERE',
  'DFLUVUU282',
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
  'DFPACK293',
  'DFPARAGON41',
  'DFRESOLVE19',
  'DFRIDEORDIE4078',
  'DFRIDEORDIE5215',
  'DFSL1629',
  'DFSL1983',
  'DFSL2793',
  'DFSL3145',
  'DFSL4412',
  'DFSL5029',
  'DFSL7183',
  'DFSL7789',
  'DFSL8019',
  'DFSL9108',
  'DFTRNG469',
  'DFTURING09',
  'DFUTW260412S36',
  'DFUTW260412S95',
  'DFUTW260412S99',
  'DFUTWQ200838',
  'DFUTWQ200880',
  'DFUTWQ200889',
  'DFUTWQ210810',
  'DFUTWQ210833',
  'DFUTWQ210862',
  'DFUTWQ220811',
  'DFUTWQ220831',
  'DFUTWQ220857',
  'DFUTWQ230872',
  'DFUTWQ230879',
  'DFUTWQ230897',
  'DFUZIRAT47',
  'DFVANGUARD76',
  'DFVICTORY11',
  'DFWEAPON91',
  'DFWEEK237',
  'DFWITNESS77',
  'DFWPNX36',
  'HEDELTAFORCE3630',
  'HEDELTAFORCE4583',
  'HEDELTAFORCE7563',
  'HEDELTAFORCE8032',
  'HEDELTAFORCE8781',
  'HEDELTAFORCE9026',
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
  'PWC260419S84',
  'TRILLIONRAID1000',
  'TRILLIONRAID300',
  'TRILLIONRAID600',
  'WELCOMETODF',
  '8RUW6wxY4kty9EpswSzD',
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
      if (chrome.runtime?.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

function saveCodes(codes) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ redeem_codes: codes }, () => {
      if (chrome.runtime?.lastError) reject(chrome.runtime.lastError);
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
const codeCounter = $('#codeCounter');
const statusDot = $('#statusDot');
const statusLabel = $('#statusLabel');

// ===== PAGINATION & VIEW MODE ELEMENTS =====
const PAGE_SIZE = 6;
let currentViewMode = 'paged'; // 'paged' | 'raw'
let currentPage = 1;
let currentCodes = [];
let searchQuery = '';
let statusFilter = 'ALL';
const codeStatesMap = new Map(); // code -> { status, reason }

const codesSubtitle = $('#codesSubtitle');
const btnModePaged = $('#btnModePaged');
const btnModeRaw = $('#btnModeRaw');
const codesPagedView = $('#codesPagedView');
const codesRawView = $('#codesRawView');
const codesSearchInput = $('#codesSearchInput');
const codesFilterStatus = $('#codesFilterStatus');
const codeCardsList = $('#codeCardsList');
const paginationInfo = $('#paginationInfo');
const btnFirstPage = $('#btnFirstPage');
const btnPrevPage = $('#btnPrevPage');
const btnNextPage = $('#btnNextPage');
const btnLastPage = $('#btnLastPage');
const pageCurrentDisplay = $('#pageCurrentDisplay');
const pageTotalDisplay = $('#pageTotalDisplay');

function updateCodeStatesMap(centralState) {
  codeStatesMap.clear();
  if (centralState && Array.isArray(centralState.codeStates)) {
    centralState.codeStates.forEach((cs) => {
      let badgeStatus = 'UNTESTED';
      if (cs.status === CODE_STATUSES.SUCCESS) {
        badgeStatus = 'REDEEMED';
      } else if (cs.status === CODE_STATUSES.FAILED) {
        const isRetry =
          cs.reason &&
          (cs.reason.includes('bảo trì') ||
            cs.reason.includes('quá nhanh') ||
            cs.reason.includes('thử lại') ||
            cs.reason.includes('maintenance') ||
            cs.reason.includes('rate limit'));
        badgeStatus = isRetry ? 'RETRYABLE' : 'DEAD';
      }
      codeStatesMap.set(cs.redeemCode.trim(), { status: badgeStatus, reason: cs.reason });
    });
  }
}

function getFilteredCodes() {
  return currentCodes.filter((code) => {
    if (searchQuery && !code.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'ALL') {
      const info = codeStatesMap.get(code);
      const codeStatus = info ? info.status : 'UNTESTED';
      if (codeStatus !== statusFilter) return false;
    }
    return true;
  });
}

function renderPaginatedCodes() {
  if (!codeCardsList) return;
  const filtered = getFilteredCodes();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (codesSubtitle) {
    codesSubtitle.textContent = `${currentCodes.length} mã trong danh sách`;
  }

  if (totalItems === 0) {
    codeCardsList.innerHTML = `
      <div class="code-empty-state">
        <span style="font-size: 24px;">🔍</span>
        <div>Không tìm thấy mã code nào phù hợp</div>
      </div>
    `;
    if (paginationInfo) paginationInfo.textContent = '0 / 0 mã';
    if (pageCurrentDisplay) pageCurrentDisplay.textContent = '0';
    if (pageTotalDisplay) pageTotalDisplay.textContent = '0';
    if (btnFirstPage) btnFirstPage.disabled = true;
    if (btnPrevPage) btnPrevPage.disabled = true;
    if (btnNextPage) btnNextPage.disabled = true;
    if (btnLastPage) btnLastPage.disabled = true;
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, totalItems);
  const pageItems = filtered.slice(start, end);

  const statusLabels = {
    UNTESTED: { cls: 'untested', text: 'Chưa test' },
    REDEEMED: { cls: 'redeemed', text: 'Đã nhận' },
    DEAD: { cls: 'dead', text: 'Hết hạn/Hỏng' },
    RETRYABLE: { cls: 'retryable', text: 'Thử lại' },
  };

  codeCardsList.innerHTML = pageItems
    .map((code, idx) => {
      const globalIdx = currentCodes.indexOf(code) + 1;
      const idxDisplay =
        globalIdx > 0
          ? `#${String(globalIdx).padStart(3, '0')}`
          : `#${String(start + idx + 1).padStart(3, '0')}`;
      const info = codeStatesMap.get(code);
      const st = info ? info.status : 'UNTESTED';
      const badge = statusLabels[st] || statusLabels.UNTESTED;

      return `
        <div class="code-card-item">
          <div class="code-card-left">
            <span class="code-card-index">${idxDisplay}</span>
            <span class="code-card-text" title="${escapeHtml(code)}">${escapeHtml(code)}</span>
          </div>
          <div class="code-card-right">
            <span class="code-status-pill ${badge.cls}">${badge.text}</span>
            <button class="code-copy-btn" data-code="${escapeHtml(code)}" title="Copy mã">📋</button>
          </div>
        </div>
      `;
    })
    .join('');

  // Copy click handler
  codeCardsList.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const codeToCopy = btn.getAttribute('data-code');
      try {
        await navigator.clipboard.writeText(codeToCopy);
        btn.textContent = '✓';
        btn.style.color = '#00e599';
        setTimeout(() => {
          btn.textContent = '📋';
          btn.style.color = '';
        }, 1200);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  });

  // Update bottom pagination bar
  if (paginationInfo) {
    paginationInfo.textContent = `${start + 1} - ${end} / ${totalItems} mã`;
  }
  if (pageCurrentDisplay) pageCurrentDisplay.textContent = currentPage;
  if (pageTotalDisplay) pageTotalDisplay.textContent = totalPages;

  if (btnFirstPage) btnFirstPage.disabled = currentPage === 1;
  if (btnPrevPage) btnPrevPage.disabled = currentPage === 1;
  if (btnNextPage) btnNextPage.disabled = currentPage === totalPages;
  if (btnLastPage) btnLastPage.disabled = currentPage === totalPages;
}

function switchViewMode(mode) {
  currentViewMode = mode;
  if (mode === 'paged') {
    btnModePaged?.classList.add('active');
    btnModeRaw?.classList.remove('active');
    codesPagedView?.classList.remove('hidden');
    codesRawView?.classList.add('hidden');
    renderPaginatedCodes();
  } else {
    btnModeRaw?.classList.add('active');
    btnModePaged?.classList.remove('active');
    codesRawView?.classList.remove('hidden');
    codesPagedView?.classList.add('hidden');
    if (codesInput) {
      codesInput.value = currentCodes.join('\n');
      updateCodeCounter();
    }
  }
}

// Event listeners for view mode & pagination
btnModePaged?.addEventListener('click', () => switchViewMode('paged'));
btnModeRaw?.addEventListener('click', () => switchViewMode('raw'));

btnFirstPage?.addEventListener('click', () => {
  currentPage = 1;
  renderPaginatedCodes();
});
btnPrevPage?.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderPaginatedCodes();
  }
});
btnNextPage?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredCodes().length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage++;
    renderPaginatedCodes();
  }
});
btnLastPage?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredCodes().length / PAGE_SIZE));
  currentPage = totalPages;
  renderPaginatedCodes();
});

codesSearchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  currentPage = 1;
  renderPaginatedCodes();
});

codesFilterStatus?.addEventListener('change', (e) => {
  statusFilter = e.target.value;
  currentPage = 1;
  renderPaginatedCodes();
});

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
  const sections = document.querySelectorAll('[data-site]');
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


// ===== Render redeem summary =====
function renderRedeemSummary() {
  chrome.storage.local.get('centralState', (result) => {
    const state = result.centralState;
    if (!state || !Array.isArray(state.codeStates)) {
      renderPaginatedCodes();
      return; // chưa có redeem run
    }

    updateCodeStatesMap(state);
    renderPaginatedCodes();

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
chrome.storage.local.get(['redeem_codes'], (result) => {
  // Load codes
  const storedCodes = Array.isArray(result.redeem_codes) ? result.redeem_codes : [];
  const mergedCodes = [...new Set([...DEFAULT_CODES, ...storedCodes])];
  const codes = mergedCodes;
  currentCodes = codes;
  if (mergedCodes.length !== storedCodes.length) {
    saveCodes(mergedCodes);
  }
  if (codes && codes.length > 0) {
    codesInput.value = codes.join('\n');
  } else {
    codesInput.value = DEFAULT_CODES.join('\n');
  }
  // Render redeem summary & pagination
  renderRedeemSummary();
  renderPaginatedCodes();
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
  currentCodes = codes;
  console.log('[Popup] Codes saved:', codes.length);

  // Reset session: new sessionId, reset stats/logs, status = READY
  const newState = createInitialState(codes);
  await setCentralState(newState);
  console.log('[Popup] CentralState set, status:', newState.status, 'total:', newState.stats.total);

  // Re-render summary & pagination
  renderRedeemSummary();
  renderPaginatedCodes();
  updateCodeCounter();

  btnSave.textContent = '✅ Đã lưu!';
  btnSave.style.background = '#10b981';
  setTimeout(() => {
    btnSave.textContent = 'Save Codes';
    btnSave.style.background = '';
  }, 1500);
});

// Shortcut: Ctrl+S / Cmd+S để lưu nhanh codes trong textarea
codesInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    btnSave.click();
  }
});

// ===== RESET TO DEFAULT (KHÔNG auto-save) =====
btnReset.addEventListener('click', () => {
  if (!confirm('Reset về codes mặc định?')) return;
  currentCodes = [...DEFAULT_CODES];
  codesInput.value = DEFAULT_CODES.join('\n');
  updateCodeCounter();
  renderPaginatedCodes();
  btnReset.textContent = '✅ Done!';
  setTimeout(() => {
    btnReset.textContent = '🔄 Reset default';
  }, 1500);
});

// ===== HƯỚNG DẪN / GUIDE BUTTON =====
document.getElementById('openWelcomeBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  chrome.tabs.create({ url: 'welcome/welcome.html' });
});
