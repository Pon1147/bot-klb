// ===== CONSTANTS =====
const DEFAULT_CODES = [
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

// ===== classifyCodes: phân loại codeStates thành 4 nhóm =====
function classifyCodes(state) {
  if (!state || !Array.isArray(state.codeStates)) {
    return { redeemed: [], dead: [], retryable: [], untested: [] };
  }

  const redeemed = [];
  const dead = [];
  const retryable = [];
  const untested = [];

  const DEAD_REASONS = new Set([
    'EXPIRED',
    'USED',
    'INVALID',
    'LIMIT_REACHED',
    'VERIFY',
    'PRESENT_ERROR',
  ]);
  const RETRYABLE_REASONS = new Set(['TEMP_ERROR', 'NO_RESPONSE']);

  for (const cs of state.codeStates) {
    const code = cs.redeemCode;
    if (cs.status === 'SUCCESS' || cs.result === 'SUCCESS') {
      redeemed.push(code);
      continue;
    }
    if (cs.status === 'PENDING') {
      untested.push(code);
      continue;
    }
    if (cs.status === 'FAILED' && DEAD_REASONS.has(cs.reason)) {
      dead.push(code);
      continue;
    }
    if (RETRYABLE_REASONS.has(cs.reason)) {
      retryable.push(code);
      continue;
    }
    untested.push(code);
  }

  return { redeemed, dead, retryable, untested };
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
  const authEvents = events.filter(
    (e) =>
      e.type?.includes('xhr_response') ||
      e.type?.includes('fetch_response') ||
      e.type === 'storage_write',
  );

  const responseEvents = authEvents.filter((e) => e.type?.includes('_response'));
  const storageEvents = authEvents.filter((e) => e.type === 'storage_write');

  // Identity mapping: so sánh hash của garena_sns_openid và dfTools openid
  const garenaHashes = new Set();
  const dfHashes = new Set();
  let garenaOpenidHash = null;
  let dfOpenidHash = null;

  for (const event of responseEvents) {
    if (event.garenaSnsOpenidHash) garenaHashes.add(event.garenaSnsOpenidHash);
    if (event.dfToolsOpenidHash) dfHashes.add(event.dfToolsOpenidHash);

    // Lấy hash đầu tiên gặp được
    if (!garenaOpenidHash && event.garenaSnsOpenidHash)
      garenaOpenidHash = event.garenaSnsOpenidHash;
    if (!dfOpenidHash && event.dfToolsOpenidHash) dfOpenidHash = event.dfToolsOpenidHash;
  }

  // Xác định mapping
  let identityMatch = 'Chưa đủ dữ liệu';
  let identityMatchClass = 'match-pending';
  if (garenaOpenidHash && dfOpenidHash) {
    if (garenaOpenidHash === dfOpenidHash) {
      identityMatch = 'MATCH (hash giống)';
      identityMatchClass = 'match-yes';
    } else {
      identityMatch = 'DIFFERENT (hash khác)';
      identityMatchClass = 'match-no';
    }
  }

  // Refresh detection: tìm event có cả access_token + refresh_token trong response
  const authResponses = responseEvents.filter(
    (e) => e.hasAccessToken === true && e.hasRefreshToken === true,
  );
  const channelInfoResponses = responseEvents.filter((e) => e.hasChannelInfo === true);
  const storageWrites = storageEvents;

  // Refresh request detection: POST request tới URL có "refresh" hoặc response có access_token mới
  const refreshCandidates = events.filter(
    (e) => e.type?.includes('sent') && (e.url?.includes('refresh') || e.url?.includes('token')),
  );

  // DfTools credential events
  const dfToolsCredentials = responseEvents.filter(
    (e) => e.hasDfToolsOpenid === true && e.hasDfToolsToken === true,
  );

  // Collect domains
  const domains = new Set();
  for (const event of events) {
    if (event.url) {
      try {
        const urlObj = new URL(event.url, location.origin);
        if (urlObj.hostname) domains.add(urlObj.hostname);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    totalEvents: events.length,
    responseEvents: responseEvents.length,
    storageWrites: storageWrites.length,
    refreshCandidates: refreshCandidates.length,
    authResponses: authResponses.length,
    channelInfoResponses: channelInfoResponses.length,
    dfToolsCredentials: dfToolsCredentials.length,
    identityMatch,
    identityMatchClass,
    garenaHash: garenaOpenidHash || '—',
    dfHash: dfOpenidHash || '—',
    thirdTypes: extractUniqueValues(responseEvents, 'thirdType'),
    domains: Array.from(domains),
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
      titleEl.textContent = 'Auth Investigator';
      loadInvestigatorData();
      startInvestigatorRefresh();
    } else {
      titleEl.textContent = 'Garena Redeem';
      if (investigatorRefreshInterval) clearInterval(investigatorRefreshInterval);
    }
  });
});

// ===== AUTH INVESTIGATOR DATA LOADING =====
function loadInvestigatorData() {
  // Debug: đọc toàn bộ storage để kiểm tra
  chrome.storage.local.get(null, (allStorage) => {
    console.log('[Popup] Full storage keys:', Object.keys(allStorage));
    console.log('[Popup] auth_events present:', 'auth_events' in allStorage);
    console.log('[Popup] auth_events value:', allStorage.auth_events);

    const events = allStorage.auth_events || [];
    console.log('[Popup] Loaded', events.length, 'events from storage');

    if (events.length === 0) {
      document.getElementById('totalEvents').textContent = '0';
      document.getElementById('eventsList').innerHTML =
        '<div class="empty-state">Chưa có events. Mở HQ page và login Garena.</div>';
      return;
    }

    const stats = computeStatsFromEvents(events);
    console.log('[Popup] Stats:', stats);
    renderInvestigatorStats(stats);
    renderInvestigatorEvents(events);
  });
}

// ===== AUTO-REFRESH INVESTIGATOR =====
let investigatorRefreshInterval = null;

function renderInvestigatorStats(stats) {
  if (!stats) return;

  document.getElementById('totalEvents').textContent = stats.totalEvents || 0;
  document.getElementById('authCalls').textContent = stats.responseEvents || 0;
  document.getElementById('hasRefreshToken').textContent = stats.authResponses || 0;
  document.getElementById('hasChannelInfo').textContent = stats.channelInfoResponses || 0;

  // Identity mapping với hash
  const garenaEl = document.getElementById('garenaOpenId');
  const dfEl = document.getElementById('dfToolsOpenid');
  const matchEl = document.getElementById('matchResult');

  garenaEl.textContent = stats.garenaHash;
  garenaEl.className =
    'mapping-value ' + (stats.garenaHash !== '—' ? 'match-yes' : 'match-pending');

  dfEl.textContent = stats.dfHash;
  dfEl.className = 'mapping-value ' + (stats.dfHash !== '—' ? 'match-yes' : 'match-pending');

  matchEl.textContent = stats.identityMatch;
  matchEl.className = 'mapping-value ' + stats.identityMatchClass;

  // Domains
  const domainListEl = document.getElementById('domainList');
  if (stats.domains && stats.domains.length > 0) {
    domainListEl.innerHTML = stats.domains
      .map((d) => `<span class="domain-tag">${escapeHtml(d)}</span>`)
      .join('');
  } else {
    domainListEl.textContent = 'Chưa có dữ liệu';
  }
}

function renderInvestigatorEvents(events) {
  const eventsListEl = document.getElementById('eventsList');

  if (events.length === 0) {
    eventsListEl.innerHTML =
      '<div class="empty-state">Chưa có events. Mở HQ page và login Garena để bắt đầu.</div>';
    return;
  }

  const toRender = events.slice(0, 50);
  eventsListEl.innerHTML = toRender.map(renderEventItem).join('');

  // Bind click to expand
  eventsListEl.querySelectorAll('.event-item').forEach((item) => {
    item.addEventListener('click', () => item.classList.toggle('expanded'));
  });
}

function renderEventItem(event) {
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
  if (type?.includes('storage_write')) return 'auth-called';
  if (type?.includes('xhr_sent')) return 'xhr-sent';
  if (type?.includes('fetch_sent')) return 'fetch-sent';
  if (type?.includes('xhr_response')) return 'xhr-response';
  if (type?.includes('fetch_response')) return 'fetch-response';
  if (type?.includes('no_data')) return 'auth-rejected';
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
  if (event.duration)
    lines.push(
      `<span class="field-key">Duration:</span><span class="field-value">${event.duration}ms</span>`,
    );
  if (event.isSuccess !== undefined)
    lines.push(
      `<span class="field-key">Success:</span><span class="field-value">${event.isSuccess ? '✓' : '✗'}</span>`,
    );

  // Auth fields
  if (event.hasAccessToken !== undefined)
    lines.push(
      `<span class="field-key">access_token:</span><span class="field-value">${event.hasAccessToken ? '✓' : '✗'}</span>`,
    );
  if (event.hasRefreshToken !== undefined)
    lines.push(
      `<span class="field-key">refresh_token:</span><span class="field-value">${event.hasRefreshToken ? '✓' : '✗'}</span>`,
    );
  if (event.hasExpiresIn !== undefined)
    lines.push(
      `<span class="field-key">expires_in:</span><span class="field-value">${event.hasExpiresIn ? '✓' : '✗'}</span>`,
    );
  if (event.hasGarenaSnsOpenid !== undefined)
    lines.push(
      `<span class="field-key">garena_sns_openid:</span><span class="field-value">${event.hasGarenaSnsOpenid ? '✓' : '✗'}</span>`,
    );
  if (event.hasOpenId !== undefined)
    lines.push(
      `<span class="field-key">open_id:</span><span class="field-value">${event.hasOpenId ? '✓' : '✗'}</span>`,
    );
  if (event.hasDfToolsOpenid !== undefined)
    lines.push(
      `<span class="field-key">df_openid:</span><span class="field-value">${event.hasDfToolsOpenid ? '✓' : '✗'}</span>`,
    );
  if (event.hasDfToolsToken !== undefined)
    lines.push(
      `<span class="field-key">df_token:</span><span class="field-value">${event.hasDfToolsToken ? '✓' : '✗'}</span>`,
    );

  // Hashed OpenID
  if (event.garenaSnsOpenidHash)
    lines.push(
      `<span class="field-key">garena_hash:</span><span class="field-value">${escapeHtml(event.garenaSnsOpenidHash)}</span>`,
    );
  if (event.dfToolsOpenidHash)
    lines.push(
      `<span class="field-key">df_hash:</span><span class="field-value">${escapeHtml(event.dfToolsOpenidHash)}</span>`,
    );

  // Channel info
  if (event.hasChannelInfo)
    lines.push(
      `<span class="field-key">channel_info:</span><span class="field-value">✓ (${(event.channelInfoKeys || []).join(', ')})</span>`,
    );
  if (event.channelInfoHasAccessToken)
    lines.push(`<span class="field-key">ci_access_token:</span><span class="field-value">✓</span>`);
  if (event.channelInfoHasRefreshToken)
    lines.push(
      `<span class="field-key">ci_refresh_token:</span><span class="field-value">✓</span>`,
    );

  // Third type
  if (event.thirdType)
    lines.push(
      `<span class="field-key">third_type:</span><span class="field-value">${escapeHtml(event.thirdType)}</span>`,
    );

  // Storage write
  if (event.type === 'storage_write') {
    lines.push(
      `<span class="field-key">Storage:</span><span class="field-value">${escapeHtml(event.storageType)}</span>`,
    );
    lines.push(
      `<span class="field-key">Key:</span><span class="field-value">${escapeHtml(event.key)}</span>`,
    );
    lines.push(
      `<span class="field-key">Value:</span><span class="field-value"><${event.valueLength}chars></span>`,
    );
  }

  // Keys
  if (event.resultKeys && event.resultKeys.length > 0)
    lines.push(
      `<span class="field-key">Keys:</span><span class="field-value">${event.resultKeys.join(', ')}</span>`,
    );

  return lines.join('<br>') || '(no data)';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ===== CLEAR EVENTS (Auth Investigator) =====
const btnClear = document.getElementById('btnClear');
if (btnClear) {
  btnClear.addEventListener('click', () => {
    if (!confirm('Xóa tất cả auth events?')) return;
    chrome.storage.local.set({ auth_events: [] }, () => {
      loadInvestigatorData();
    });
  });
}

// ===== AUTO-REFRESH INVESTIGATOR =====
function startInvestigatorRefresh() {
  if (investigatorRefreshInterval) clearInterval(investigatorRefreshInterval);
  investigatorRefreshInterval = setInterval(loadInvestigatorData, 5000);
}
