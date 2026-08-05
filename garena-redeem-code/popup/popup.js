// ===== CONSTANTS =====
const DEFAULT_CODES = [
    "10KSUBSYOUTUBEDFRTNK",
    "30KSUBSYOUTUBEDFESPNP",
    "6PLcFgvD9mg",
    "85ewN4xYbJfncPKbADR",
    "8rjGXBxYBrNS4ennshJP",
    "A5Z1NDW8K3PJLJ",
    "A5Z1NDW8K3PJLU",
    "ACESIXMAJOR",
    "aCuQjtxY7vXGjxCTBnQU",
    "AW88PTR3W9",
    "AW88PTRP7D",
    "Bd52XmxyYj2DFGCqnq4",
    "C7S2X9J5D4B1V3Q",
    "daichienboba2719",
    "daichienboba6167",
    "daichienboba6228",
    "daichienmobile3325",
    "daichienmobile7095",
    "daichienmobile7362",
    "DELTAFORCEVN_540VN2S550U",
    "DELTAFORCEVN_6AVHJ6MYX6Y",
    "DELTAFORCEVN_8MD718JT4GR",
    "DELTAFORCEVN_95S092Y9T9D",
    "DF1314754",
    "DF425BountyS2",
    "DF425SOL",
    "DF51login51login",
    "DFAIM666",
    "DFakaonikou",
    "DFAMMO08",
    "DFanchor945",
    "DFARMX46",
    "DFASCEND72",
    "DFaura371",
    "DFAWAKEN56",
    "DFAXIOM33",
    "DFbeacon030",
    "DFBrilliant165",
    "DFCantWait1114",
    "DFCATALYST87",
    "DFCC0001",
    "DFCCEIEI01",
    "DFCCHAHA5",
    "DFCCOPGIST88",
    "DFCCOPNOW111",
    "DFCCOPPL4Y3R5",
    "DFCCOPTOBE03",
    "DFCCOPWINEIEI",
    "DFCCOPWOR1D",
    "DFceleste516",
    "DFCL503",
    "DFclarity152",
    "DFclover812",
    "DFCOHERENCE35",
    "DFCONCORD82",
    "DFCRAFT427",
    "DFDragon504",
    "DFDRAGONBOAT",
    "DFELEVATE16",
    "DFEMBARK63",
    "DFEnergy428",
    "DFessence982",
    "DFeternity717",
    "DFExcellent659",
    "DFExceptional305",
    "DFFantasy742",
    "DFFILE274",
    "DFFlash260",
    "DFForever395",
    "DFGalaxy250",
    "DFGENESIS05",
    "DFGiveMeBrick425",
    "DFGOGOGO425",
    "DFharbor738",
    "DFHeroic668",
    "DFHorizon503",
    "DFHORIZON91",
    "DFHUNTER666",
    "DFIBRAKKESHLEG",
    "DFIBRAKKESHMG",
    "DFINSIGHT48",
    "DFIPPQARVO",
    "DFIPPQIASP",
    "DFIPPQOCSP",
    "DFIPPQTBAF",
    "DFIPPQWLSP",
    "DFIPTFGASLGI",
    "DFIPTFGJGFS",
    "DFIPTFGZSKG",
    "DFISPACECITYECMO",
    "DFISPACECITYISG",
    "DFISPACECITYMDB",
    "DFIW263T7Z",
    "DFIW264K7M",
    "DFIW265M9A",
    "DFIW266F2V",
    "DFIW268B5V",
    "DFIW269V3B",
    "DFIW26C2GX",
    "DFIW26H9KP",
    "DFIW26L2WY",
    "DFIW26M7Q9",
    "DFIW26P8X2",
    "DFIW26R4W8",
    "DFIW26X3NC",
    "DFIW26Y7J3",
    "DFIW26Z5RT",
    "DFIW26ZX3Q",
    "DFIWDAY1OPOP",
    "DFIWDAY1START",
    "DFIWDAY3WAW",
    "DFIWTXD001",
    "DFIWTXD01",
    "DFIWTXD913",
    "DFIZERODAMGS",
    "DFjubilee594",
    "DFLuckylucky425",
    "DFMagic057",
    "DFmoment479",
    "DFmomentum423",
    "DFnewversiongift",
    "DFNinja874",
    "DFoasis407",
    "DFOS2ZK8VA",
    "DFOS3FZ9LK",
    "DFOS3Y8KLM",
    "DFOS4XJ8PL",
    "DFOS7K2M9Q",
    "DFOS7Q2VXA",
    "DFOS9R2HXC",
    "DFOSB4N9RD",
    "DFOSB6T3WZ",
    "DFOSL5Q7MN",
    "DFOSS260403B21",
    "DFOSS260403B33",
    "DFOSS260403B81",
    "DFOSS260404B47",
    "DFOSS260404B57",
    "DFOSS260404B63",
    "DFOSS260405B36",
    "DFOSS260405B58",
    "DFOSS260405B69",
    "DFOSW4D1YP",
    "DFOutstanding056",
    "DFPACK293",
    "DFPARAGON41",
    "DFpromise643",
    "DFRainbow356",
    "DFRAMADAN1477H",
    "DFReliable732",
    "DFRemarkable103",
    "DFRESOLVE19",
    "DFRL1017",
    "DFRocket825",
    "DFserene218",
    "DFSH428",
    "DFSIXMAJOR6",
    "DFSIXTOPACE",
    "DFSIXVIP888",
    "DFSL502SOL",
    "DFSL6257",
    "DFSL9304",
    "DFsolace241",
    "DFSpark119",
    "DFsymphony104",
    "DFTRNG469",
    "DFTURING09",
    "DFUltra220",
    "DFUT2025FINALS1549",
    "DFUT2025FINALS4216",
    "DFUT2025GROUP6698",
    "DFUT2025GROUP7752",
    "DFUT2025PLAYOFF1276",
    "DFUT2025PLAYOFF2509",
    "DFUT2025PLAYOFF4827",
    "DFUT2025PLAYOFF5732",
    "DFUT2025PLAYOFF5910",
    "DFUT2025PLAYOFF8051",
    "DFUT2025PLAYOFF9163",
    "DFUTARMAMENT",
    "DFUTGEARTICKET",
    "DFUTINTERMEDIATE",
    "DFUTS26GR0103C35",
    "DFUTS26GR0103C49",
    "DFUTS26GR0103C81",
    "DFUTS26GR0603C42",
    "DFUTS26GR0703C34",
    "DFUTS26GR0703C96",
    "DFUTS26GR0803C21",
    "DFUTS26GR0803C67",
    "DFUTS26GR0803C76",
    "DFUTS26GR1203C46",
    "DFUTS26GR1203C72",
    "DFUTS26GR1203C83",
    "DFUTS26GR1303C39",
    "DFUTS26GR1303C65",
    "DFUTS26GR1303C98",
    "DFUTS26GR1403C24",
    "DFUTS26GR1403C52",
    "DFUTS26GR1403C87",
    "DFUTS26GR1503C33",
    "DFUTS26GR1503C74",
    "DFUTS26GR1503C91",
    "DFUTS26GR2702C44",
    "DFUTS26GR2702C57",
    "DFUTS26GR2702C92",
    "DFUTS26GR2802C23",
    "DFUTS26GR2802C66",
    "DFUTS26GR2802C78",
    "DFUTS26PL2103C32",
    "DFUTS26PL2103C41",
    "DFUTS26PL2103C54",
    "DFUTS26PL2103C68",
    "DFUTS26PL2103C85",
    "DFUTS26PL2103C90",
    "DFUTS26PL2203C28",
    "DFUTS26PL2203C43",
    "DFUTS26PL2203C61",
    "DFUTS26PL2203C77",
    "DFUTS26PL2203C86",
    "DFUTS26PL2203C95",
    "DFUTS26QL0102C26",
    "DFUTS26QL1",
    "DFUTS26QL2901C01",
    "DFUTS26QL2901C02",
    "DFUTS26QL2901C03",
    "DFUTS26QL3001C29",
    "DFUTS26QL3001C47",
    "DFUTS26QL3001C82",
    "DFUTS26QL3101C38",
    "DFUTS26QL3101C64",
    "DFUTS26QL3101C91",
    "DFUTS26QL5",
    "DFUTS26QL6",
    "DFUTSCARH",
    "DFUTSUPPYPACK",
    "DFUTSUPYPACK",
    "DFUTW260412S36",
    "DFUTW260412S95",
    "DFUTW260412S99",
    "DFUTWEAPON",
    "DFVANGUARD76",
    "DFVICTORY11",
    "DFvivid061",
    "DFvoyage901",
    "DFVS3S7FR4",
    "DFVS8T9SZ4",
    "DFVSE4K7G1",
    "DFVSH5N4C7",
    "DFVSU2X6M8",
    "DFVSW1C5D9",
    "DFWEAPON91",
    "DFWEEK237",
    "DFWIN777",
    "DFWITNESS77",
    "DFWizard309",
    "eHjNfTxYKV5GAFxMD5MA",
    "f2X6e3xY3pJDCE5rT7P",
    "fvzeLrxYajwVviFSTSZ",
    "GADFZebra",
    "GARENADF2503K8F3",
    "GARENADFCBT2503C3F4",
    "GARENADFCBT2503X9D1",
    "GARENADFCBT2503Z6T9",
    "GARENADFID2501L983",
    "GARENADFID2501R572",
    "GARENADFID2501V621",
    "GARENADFM4Z8YJ",
    "GARENADFNY25010E034",
    "GARENADFNY2501C158",
    "GARENADFNY2501E034",
    "GARENADFNY2501H258",
    "GARENADFQ1H8SZ",
    "GARENADFX9B7Q2",
    "HEDELTAFORCE3630",
    "HEDELTAFORCE4583",
    "HEDELTAFORCE7563",
    "HEDELTAFORCE8032",
    "HEDELTAFORCE8781",
    "HEDELTAFORCE9026",
    "hjRtrKxYLmcTyYcEy64H",
    "JGHMCmxYa",
    "JGHMCmxYa6PLcFgvD9mg",
    "L34m5GxYjnPkXzckgdEB",
    "LAISEGAME",
    "MOBILE0123",
    "MOILOOT02",
    "MOILOOT04",
    "MOILOOT45",
    "MOILOOT48",
    "MOILOOT55",
    "MOILOOT60",
    "MOILOOT65",
    "MOILOOT68",
    "MOILOOT79",
    "MOILOOT92",
    "msz7hMxxYyGhip8ay7HpK",
    "MVPSOLDFSIX",
    "N4SQWgxYcHw7gUci3bJy",
    "POC3005S19",
    "POC3005S51",
    "POC3005S52",
    "POC3005S53",
    "POC3005S59",
    "POC3005S99",
    "POC3105S31",
    "POC3105S64",
    "POC3105S73",
    "POC3105S90",
    "POC3105S95",
    "POC3105S96",
    "PWC260418S11",
    "PWC260418S72",
    "PWC260418S79",
    "PWC260418S84",
    "PWC260419S21",
    "PWC260419S65",
    "PWC260419S67",
    "PzDArbxYuL2f6RcaWE7T",
    "ReturningWarrior1",
    "ReturningWarrior2",
    "ReturningWarrior3",
    "SIXMAJORMVP",
    "SOLDFWIN360",
    "SOLMAJORGG9",
    "SOLPROMAJOR",
    "SsCkDfxY5AkdZqjJLkXq",
    "SVBesCxYcsAN6LCD47P",
    "Tf7aVcxYfAV97gAHQTP6",
    "Top1BXHVN",
    "TrickOrTreat",
    "TRILLIONRAID1000",
    "TRILLIONRAID300",
    "TRILLIONRAID600",
    "VIP666SOLDF",
    "VIP777SIXDF",
    "wTr3cyxY6QZBRf779Xpa",
    "XufJgVxYrFCtM5heBT3B",
    "yU5DpNxYkwx2ck76pcnw",
    "yWHtfsxYGRPaZvAfLN82"
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

// ===== INIT: load từ storage =====
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
