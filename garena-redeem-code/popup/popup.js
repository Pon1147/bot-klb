// ===== CONSTANTS =====
const DEFAULT_CODES = [
  'DFSL5029',
  '30KSUBSYOUTUBEDFESPNP',
  'wTr3cyxY6QZBRf779Xpa',
  'eHjNfTxYKV5GAFxMD5MA',
  '8rjGXBxYBrNS4ennshJP',
  'Tf7aVcxYfAV97gAHQTP6',
  'DFSL9304',
  'DFSL6257',
  'GARENADFNY2501C158',
  'PWC260419S65',
  'PWC260419S21',
  'PWC260418S84',
  'PWC260418S79',
  'PWC260418S72',
  'PWC260418S11',
  'PWC260419S67',
  'DFCRAFT427',
  'DFFILE274',
  'DFWEEK237',
  'DFTRNG469',
  'MOILOOT92',
  'DFSIXVIP888',
  'ACESIXMAJOR',
  'SOLDFWIN360',
  'MOILOOT55',
  'MOILOOT68',
  'MOILOOT48',
  'MOILOOT02',
  'MOILOOT04',
  'MOILOOT60',
  'MOILOOT45',
  'HEDELTAFORCE7563',
  'HEDELTAFORCE8781',
  'HEDELTAFORCE8032',
  'HEDELTAFORCE9026',
  'HEDELTAFORCE3630',
  'HEDELTAFORCE4583',
  'GARENADFNY2501E034',
  'GARENADFNY2501H258',
  'C7S2X9J5D4B1V3Q',
  'GARENADFCBT2503Z6T9',
  'GARENADFCBT2503X9D1',
  'GARENADFCBT2503C3F4',
  'GARENADFID2501V621',
  'GARENADFID2501L983',
  'GARENADFID2501R572',
  'DELTAFORCEVN_8MD718JT4GR',
  'DELTAFORCEVN_95S092Y9T9D',
  'DELTAFORCEVN_6AVHJ6MYX6Y',
  'DELTAFORCEVN_540VN2S550U',
  'DFUTSUPPYPACK',
  'ReturningWarrior3',
  'DFUTSCARH',
  'DFUTWEAPON',
  'DFUTGEARTICKET',
  'DFUTINTERMEDIATE',
  'DFUTSUPYPACK',
  'DFUTARMAMENT',
  'DFPACK293',
  'DFDRAGONBOAT',
  'DFCL503',
  'DFCONCORD82',
  'DFharbor738',
  'DFpromise643',
  'DFceleste516',
  'DFvivid061',
  'DFSH428',
  'DFmomentum423',
  'DFCATALYST87',
  'GADFZebra',
  'SsCkDfxY5AkdZqjJLkXq',
  'yWHtfsxYGRPaZvAfLN82',
  'DFUTW260412S95',
  'DFUTW260412S36',
  'DFUTW260412S99',
  'DFAWAKEN56',
  'DFakaonikou',
  'DFRL1017',
  'DFjubilee594',
  '85ewN4xYbJfncPKbADR',
  'DFclarity152',
  'DFUT2025FINALS1549',
  'DFUT2025PLAYOFF5910',
  'DFUT2025PLAYOFF9163',
  'DFUT2025PLAYOFF2509',
  'DFUT2025PLAYOFF4827',
  'DFUT2025PLAYOFF8051',
  'DFUT2025PLAYOFF5732',
  'DFUT2025PLAYOFF1276',
  'hjRtrKxYLmcTyYcEy64H',
  'f2X6e3xY3pJDCE5rT7P',
  'Bd52XmxyYj2DFGCqnq4',
  'msz7hMxxYyGhip8ay7HpK',
  'DFOSS260403B33',
  'DFsolace241',
  'MOBILE0123',
  'DFUTS26QL3101C64',
  'DFUTS26QL3101C38',
  'DFUTS26QL3001C47',
  'DFUTS26QL1',
  'DFUTS26QL6',
  'DFUTS26QL5',
  'DFCCOPNOW111',
  'DFCCOPGIST88',
  'DFCCOPWOR1D',
  'DFCCOPTOBE03',
  'DFCCOPPL4Y3R5',
  'DFOSS260405B69',
  'DFOSS260405B58',
  'DFOSS260405B36',
  'DFOSS260404B63',
  'DFOSS260404B57',
  'DFOSS260404B47',
  'DFOSS260403B21',
  'DFOS7K2M9Q',
  'DFOS4XJ8PL',
  'DFOSW4D1YP',
  'MOILOOT65',
  'MOILOOT79',
  'TRILLIONRAID1000',
  'TRILLIONRAID600',
  'TRILLIONRAID300',
  'POC3105S95',
  'POC3105S96',
  'POC3105S73',
  'POC3105S64',
  'POC3105S31',
  'POC3105S90',
  'POC3005S19',
  'POC3005S52',
  'POC3005S99',
  'POC3005S59',
  'POC3005S53',
  'POC3005S51',
  'DFWITNESS77',
  'DFOS3FZ9LK',
  'DFOS7Q2VXA',
  'DFOS2ZK8VA',
  'DFOSL5Q7MN',
  'DFOSB4N9RD',
  'DFAXIOM33',
  'DFINSIGHT48',
  'DFSL502SOL',
  'SOLMAJORGG9',
  'DFSIXTOPACE',
  'MVPSOLDFSIX',
  'ReturningWarrior1',
  'fvzeLrxYajwVviFSTSZ',
  'ReturningWarrior2',
  'N4SQWgxYcHw7gUci3bJy',
  'A5Z1NDW8K3PJLJ',
  'Top1BXHVN',
  'aCuQjtxY7vXGjxCTBnQU',
  'A5Z1NDW8K3PJLU',
  '10KSUBSYOUTUBEDFRTNK',
  'daichienboba6228',
  'daichienboba2719',
  'daichienboba6167',
  'DFBrilliant165',
  'daichienmobile7095',
  'daichienmobile3325',
  'daichienmobile7362',
  'DFOutstanding056',
  'DF1314754',
  'DFReliable732',
  'DFForever395',
  'DFExcellent659',
  'DFExceptional305',
  'DFRemarkable103',
  'DFessence982',
  'DFanchor945',
  'DFDragon504',
  'DFserene218',
  'DFSpark119',
  'DFUltra220',
  'JGHMCmxYa6PLcFgvD9mg',
  'DFUT2025GROUP7752',
  'DFUT2025GROUP6698',
  'DFMagic057',
  'DFGalaxy250',
  'DFHorizon503',
  'TrickOrTreat',
  'DFNinja874',
  'DFRainbow356',
  'DFFlash260',
  'DFEnergy428',
  'DFbeacon030',
  'DFoasis407',
  'DFeternity717',
  'DFFantasy742',
  'DFRocket825',
  'DFclover812',
  'DFHeroic668',
  'DFWizard309',
  'DFvoyage901',
  'DFsymphony104',
  'DFHORIZON91',
  'DFRESOLVE19',
  'DFEMBARK63',
  'DFmoment479',
  'DFPARAGON41',
  'DFASCEND72',
  'DFGENESIS05',
  'DFVANGUARD76',
  'DFOSS260403B81',
  'DFELEVATE16',
  'DFUTS26GR2702C44',
  'DFUTS26GR2702C57',
  'DFUTS26GR2702C92',
  'DFUTS26GR2802C23',
  'DFUTS26GR2802C66',
  'DFUTS26GR2802C78',
  'DFUTS26GR0103C35',
  'DFUTS26GR0103C81',
  'DFUTS26GR0103C49',
  'DFUTS26GR0703C34',
  'DFUTS26GR0703C96',
  'DFUTS26GR1203C72',
  'DFUTS26GR1203C83',
  'DFUTS26GR1203C46',
  'DFUTS26GR1303C65',
  'DFUTS26GR1303C39',
  'DFUTS26GR1303C98',
  'DFUTS26GR1403C24',
  'DFUTS26GR1403C87',
  'DFUTS26GR1403C52',
  'DFCC0001',
  'DFCCEIEI01',
  'DFCCHAHA5',
  'DFUTS26GR1503C33',
  'DFUTS26GR1503C91',
  'DFUTS26GR1503C74',
  'LAISEGAME',
  'DFUTS26PL2103C32',
  'DFUTS26PL2103C41',
  'DFUTS26PL2103C68',
  'DFUTS26PL2103C54',
  'DFUTS26PL2103C85',
  'DFUTS26PL2103C90',
  'DFUTS26PL2203C28',
  'DFUTS26PL2203C43',
  'DFUTS26PL2203C61',
  'DFUTS26PL2203C77',
  'DFUTS26PL2203C86',
  'DFUTS26PL2203C95',
  'DFVS3S7FR4',
  'DFVS8T9SZ4',
  'DFVSH5N4C7',
  'DFVSU2X6M8',
  'DFVSW1C5D9',
  'DFVSE4K7G1',
  'DFCCOPWINEIEI',
  'DF425SOL',
  'DFWIN777',
  'DFHUNTER666',
  'DFAIM666',
  'DFGOGOGO425',
  'DFGiveMeBrick425',
  'DFLuckylucky425',
  'DF425BountyS2',
  'DF51login51login',
  'DFVICTORY11',
  'DFWEAPON91',
  'SVBesCxYcsAN6LCD47P',
  'L34m5GxYjnPkXzckgdEB',
  'XufJgVxYrFCtM5heBT3B',
  'DFOSB6T3WZ',
  'DFOS9R2HXC',
  'DFOS3Y8KLM',
  'JGHMCmxYa',
  '6PLcFgvD9mg',
  'VIP777SIXDF',
  'DFARMX46',
  'SIXMAJORMVP',
  'DFTURING09',
  'DFAMMO08',
  'DFSIXMAJOR6',
  'VIP666SOLDF',
  'SOLPROMAJOR',
  'DFIW26ZX3Q',
  'DFIW265M9A',
  'DFIW26Y7J3',
  'DFIW266F2V',
  'DFIW263T7Z',
  'DFIW26H9KP',
  'DFIW26R4W8',
  'DFIW26C2GX',
  'DFIW26L2WY',
  'DFIW26M7Q9',
  'DFIW26X3NC',
  'DFIW268B5V',
  'DFIW26P8X2',
  'DFIW269V3B',
  'DFIW264K7M',
  'DFIW26Z5RT',
  'DFCOHERENCE35',
  'DFUTS26GR0803C76',
  'DFUTS26GR0803C21',
  'DFUTS26GR0803C67',
  'DFUTS26GR0603C42',
  'DFRAMADAN1477H',
  'DFUTS26QL2901C01',
  'DFUTS26QL2901C02',
  'DFUTS26QL3001C29',
  'DFUTS26QL2901C03',
  'DFUTS26QL3001C82',
  'DFUTS26QL3101C91',
  'DFUTS26QL0102C26',
  'yU5DpNxYkwx2ck76pcnw',
  'DFaura371',
  'DFIWTXD01',
  'DFIWTXD001',
  'DFIWTXD913',
  'DFUT2025FINALS4216',
  'PzDArbxYuL2f6RcaWE7T',
  'GARENADF2503K8F3',
  'GARENADFX9B7Q2',
  'GARENADFQ1H8SZ',
  'GARENADFM4Z8YJ',
  'DFCantWait1114',
  'GARENADFNY25010E034',
  'AW88PTR3W9',
  'AW88PTRP7D',
  'DFIPPQOCSP',
  'DFIPPQIASP',
  'DFIPPQARVO',
  'DFIPPQWLSP',
  'DFIPPQTBAF',
  'DFIPTFGJGFS',
  'DFIPTFGASLGI',
  'DFIPTFGZSKG',
  'DFIZERODAMGS',
  'DFIBRAKKESHMG',
  'DFIBRAKKESHLEG',
  'DFISPACECITYISG',
  'DFISPACECITYMDB',
  'DFISPACECITYECMO',
  'DFnewversiongift',
  'DFIWDAY1START',
  'DFIWDAY1OPOP',
  'DFIWDAY3WAW',
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

// ===== INIT: load từ storage, chỉ dùng DEFAULT_CODES khi storage rỗng =====
chrome.storage.local.get('redeem_codes', (result) => {
  const codes = result.redeem_codes;
  if (codes && codes.length > 0) {
    codesInput.value = codes.join('\n');
  } else {
    codesInput.value = DEFAULT_CODES.join('\n');
  }
});

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

  btnSave.textContent = '✅ Đã lưu!';
  btnSave.style.background = '#22c55e';
  setTimeout(() => {
    btnSave.textContent = '💾 Lưu codes';
    btnSave.style.background = '';
  }, 1500);
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
