# DF Link — Hướng dẫn kiến trúc & triển khai

> **Mục đích tài liệu:** đặc tả công nghệ, logic, luồng, triển khai micro-step, và test case cho hệ thống **link tài khoản Delta Force HQ → Discord bot** (private bot, không thương mại).  
> **Phiên bản:** 2026-08-04 (thêm mục tích hợp Extension chi tiết).  
> **Đối tượng:** developer / LLM code agent.  
> **Thuật ngữ bắt buộc:** **DfTools credential** (openid + token + metadata quan sát được). **Không** gọi "access token" / "OAuth token" cho đến khi Phase 1 (lifecycle) có số liệu.  
> **Nguyên tắc chống hallucination:** phân biệt **observation** (đã thấy trên wire) với **assumption** (chưa test). Cập nhật thuật ngữ / công thức `s` / TTL chỉ sau Phase 1.

---

## 0. Mục tiêu & ràng buộc

### 0.1 Mục tiêu sản phẩm

| Mục tiêu                               | Mô tả                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Non-tech UX                            | User **không** mở F12 / paste console                                       |
| Multi-máy                              | User mạng khác máy dev vẫn link được                                        |
| Dùng bot hằng ngày **không** cần mở HQ | HQ chỉ lúc **link / re-link** (khi credential không còn dùng được)          |
| Credential an toàn                     | Không plaintext at rest; không log full credential; không trả lại sau claim |
| Tách lớp                               | Capture ≠ Claim ≠ DfTools client                                            |
| Private use                            | Server/guild riêng                                                          |

### 0.2 Không phải mục tiêu

- OAuth chính thức Garena/Tencent cho third-party bot.
- Discord Incoming Webhook làm ingestion credential production.
- bcrypt cho credential còn cần dùng lại khi gọi API.
- Giả định credential sống vĩnh viễn trước Phase 1.
- User mở HQ mỗi lần dùng lệnh bot.

### 0.3 Nguyên tắc cốt lõi

1. Credential chỉ có trong **browser session HQ** → cần **client-side capture** lúc bind.
2. **Extension = client-side bridge**, không phải authentication provider / IdP.
3. Discord chỉ **nhận diện user** (claim code), không auth HQ.
4. **HTTPS endpoint cố định** = điều kiện multi-máy; encryption **không** thay endpoint.
5. Mỗi DfTools endpoint có thể dùng **bộ param khác nhau** (observation từ log).
6. Agent **không** nhảy Phase 5 (implement client đầy đủ) trước Phase 1 Research.
7. **Credential reusable** ≠ **Request reusable** (xem R4/R5).

### 0.4 Mental model

```text
User đã login HQ
      ↓
Browser session + DfTools requests
      ↓
Extension quan sát request (MAIN world)
      ↓
Bridge vào hệ thống private (Claim API)
      ↓
Bot decrypt khi cần → DfToolsClient → data trên Discord
```

---

## 1. Công nghệ

### 1.1 Bot (server)

| Thành phần | Gợi ý                      | Ghi chú                                              |
| ---------- | -------------------------- | ---------------------------------------------------- |
| Runtime    | Node.js 20+                |                                                      |
| Bot        | discord.js v14             | `/df-link`                                           |
| HTTP       | Express / Fastify / `http` | `POST /api/df/claim`                                 |
| DB         | better-sqlite3 / Postgres  |                                                      |
| Crypto     | `node:crypto` AES-256-GCM  |                                                      |
| Config     | `.env`                     | `DF_CRED_KEY_V1`, `CLAIM_TTL_SEC`, `PUBLIC_BASE_URL` |

### 1.2 Extension (bridge)

| Thành phần             | Vai trò                                |
| ---------------------- | -------------------------------------- |
| MAIN `page-capture.js` | Chỉ quan sát / extract metadata        |
| Isolated content       | UI, validate message, nhận claim code  |
| Service Worker         | **Duy nhất** được POST Claim API (TLS) |
| Panel                  | Tab Redeem \| Link                     |

### 1.3 Infra multi-máy

- **Dùng:** Named Tunnel / VPS / PaaS — HTTPS cố định.
- **Không:** localhost, quick tunnel đổi URL, Discord webhook ingestion.

### 1.4 Prototype

Console userscript = research only. Không `no-cors` production.

---

## 2. Kiến trúc 3 lớp

```text
LAYER 1 Extension     capture → handoff → SW → Claim API
LAYER 2 Claim API     SECURITY BOUNDARY — không gọi business DfTools
LAYER 3 DfToolsClient decrypt → profile → API — không biết nguồn credential
```

### 2.1 Phân quyền Extension

```text
MAIN world
   │ capture only — KHÔNG POST claim
   ▼ postMessage
Isolated content
   │ UI + validate shape
   ▼ runtime.sendMessage
Service Worker
   │ HTTPS POST claim
   ▼
Claim API
```

### 2.2 Injection / test

`DfToolsClient` **không** phụ thuộc extension. Có thể:

```text
Fixture credential → DB / in-memory binding → DfToolsClient → API
```

để test Layer 3 không chạy browser.

### 2.3 Sequence (tóm tắt)

```text
/df-link → claim_code → mở HQ → extension capture candidate
  → SW POST claim → atomic consume + encrypt + persist
  → DM Linked OK

Hằng ngày: lệnh Discord → decrypt → DfToolsClient → data
  (không mở HQ trừ khi re-link)
```

---

## 3. Mô hình dữ liệu

### 3.1 Claim session (ephemeral, security-critical)

| Field             | Luật                                 |
| ----------------- | ------------------------------------ |
| `code`            | Random, entropy đủ                   |
| `discord_user_id` | Bound user                           |
| `expires_at`      | Short-lived (ví dụ 10–15 phút)       |
| `status`          | `pending` \| `consumed` \| `expired` |

**Bắt buộc:** random + short-lived + **one-time** + bound Discord user.  
**Consume phải atomic** (transaction): không để 2 request cùng pass validate rồi cả hai ghi binding.

### 3.2 AccountBinding (production persistent)

```text
df_account_bindings
├── id
├── discord_user_id
├── provider              -- 'garena'
├── platform              -- 'df_hq'
├── openid                -- identifier (không phải auth secret; vẫn hạn chế log)
├── cred_nonce            -- 12 bytes
├── cred_ciphertext
├── cred_tag              -- 16 bytes
├── key_version
├── status                -- active | expired | revoked
├── captured_at
├── last_ok_at
├── last_error
├── created_at
└── updated_at
```

**Không** bắt buộc field production `source_endpoint` trên bảng này.

### 3.3 Telemetry research (tách, optional)

```text
credential_capture_events   -- không lưu full credential
├── id
├── discord_user_id?
├── endpoint                -- tên endpoint quan sát
├── captured_at
├── credential_fingerprint  -- hash ngắn / len — không phải secret
└── notes
```

AccountBinding ≠ research log.

### 3.4 DfTools credential — model tạm (research fixture)

Observation có thể có: `token`, `openid`, `u`, `a`, `ts`, `s`, `game_id`, …

**Chưa commit model persistent cuối cùng trước R4/R5.**

Hướng phân tách **dự kiến** (chỉ sau Phase 1 xác nhận):

```text
Persistent credential (ứng viên)
├── openid
└── token
    (+ field nào chứng minh reusable dài hạn)

Request context (per call, có thể generate lại)
├── ts
├── s          -- có thể là signature theo request
├── u, a
└── endpoint-specific params
```

Nếu `s = f(token, ts, params)` → **không** lưu `s` như secret lâu dài; client regenerate.

JSON research / encrypt blob trước R5 có thể chứa full quan sát được; schema production thắt lại sau số liệu.

### 3.5 Endpoint profiles (Layer 3)

```text
Observation:
  GetManufactureRecommendationList → openid + token + …
  GetPrivateRoomKey              → u + a + ts + s
```

```ts
DfToolsClient.request(discordUserId, endpointKey, extra?)
// Không: call_df_api(singleToken)
```

### 3.6 openid

- Coi là **identifier**, không phải authentication secret.
- Lưu plaintext để index được chấp nhận.
- **Vẫn không log** nếu không cần (tránh "plaintext OK → log thoải mái").

---

## 4. Mã hóa at rest (AES-256-GCM)

|       |                                                     |
| ----- | --------------------------------------------------- |
| Algo  | `aes-256-gcm`                                       |
| Key   | 32 bytes, `DF_CRED_KEY_V1`, ngoài DB, `key_version` |
| Nonce | 12 bytes random mỗi lần encrypt                     |
| Tag   | 16 bytes                                            |
| AAD   | `garena\|df_hq\|{discord_user_id}\|{openid}`        |

**Không bcrypt** cho credential cần decrypt.

Encrypt chỉ trong Claim API sau validate; decrypt chỉ trong DfToolsClient; never log plaintext; never return credential trong HTTP response.

---

## 5. Claim API (security boundary)

```http
POST {PUBLIC_BASE_URL}/api/df/claim
Content-Type: application/json
```

### 5.1 Requirements

```text
claim_code: random | short-lived | one-time | bound Discord user
transport: TLS only
body: Content-Type validation, max body size, timeout
rate limit: IP + code attempts + create-claim spam
consume: ATOMIC với persist (không async gap double-consume)
at rest: encrypt immediately
response: never credential
logs: never full token / s
```

### 5.2 Atomic consume (explicit)

```text
BEGIN
  SELECT claim WHERE code=? AND status='pending' AND expires_at>now
    -- lock / immediate transaction
  UPDATE claim SET status='consumed'
  INSERT/UPDATE binding (encrypted)
COMMIT
```

Hai POST song song cùng code → chỉ một thành công.

### 5.3 Response

| HTTP    | Body             |
| ------- | ---------------- |
| 200     | `{ "ok": true }` |
| 400     | `invalid_body`   |
| 401     | `invalid_code`   |
| 413/400 | body quá lớn     |
| 429     | rate limited     |
| 500     | `server_error`   |

### 5.4 Binding ACTIVE vs capture candidate

```text
MVP capture (extension):
  credential CANDIDATE đầu tiên có openid + token
  (chưa gọi là "credential hợp lệ production")

MVP binding ACTIVE:
  chỉ sau khi server-side validation thành công
  với ÍT NHẤT một endpoint đã xác định trong Phase 1
```

Không đánh dấu "hợp lệ mãi" chỉ vì parse được query string.

---

## 6. Discord `/df-link`

| Lệnh     | Việc                             |
| -------- | -------------------------------- |
| `start`  | Claim code + hướng dẫn + mở HQ   |
| `status` | Mask identifier, status, last_ok |
| `unlink` | revoked                          |
| `manual` | Optional tech fallback           |

Hằng ngày: lệnh data **không** mở HQ; hết hạn → bảo re-link.

---

## 7. Extension — tổng quan

- MAIN: capture **candidate** only (không POST claim).
- Isolated content: UI tab Link + bridge message.
- SW: **duy nhất** POST Claim API.
- Không hardcode localhost webhook; dùng `PUBLIC_BASE_URL` (options / storage).
- Không log token preview production.
- Chi tiết tích hợp vào extension redeem hiện có → **§14**.

---

## 8. Multi-máy

`PUBLIC_BASE_URL` HTTPS cố định. Encryption không sửa lỗi khác mạng.

---

## 9. Phase order (khóa agent)

```text
Phase 1 — Research          ← bắt buộc trước client đầy đủ
Phase 2 — Architecture
Phase 3 — Security
Phase 4 — UX
Phase 5 — Implementation
```

**Song song được:** skeleton Claim API + public URL (test handoff).  
**Cấm:** hardcode "token = access_token", hardcode mọi endpoint một auth shape, ship TTL vĩnh viễn trước số liệu.

### Phase 1 — Năm câu hỏi bắt buộc

| ID     | Câu hỏi                                                                    | Ý nghĩa                                 |
| ------ | -------------------------------------------------------------------------- | --------------------------------------- |
| **R1** | Credential có **reuse ngoài browser** không?                               | Bot server-side có sống được không      |
| **R2** | Dùng được **endpoint khác** endpoint đã capture không?                     | Scope                                   |
| **R3** | **Expire** sau bao lâu? (T+10m / 1h / 24h)                                 | Tần suất re-link                        |
| **R4** | Request nào **replay nguyên vẹn** (cùng URL/param) được?                   | Request reusable vs credential reusable |
| **R5** | `ts` / `s` / `u` / `a` là **static credential** hay **request-generated**? | Có lưu DB / có phải sign lại mỗi call   |

Sau Phase 1 mới khóa:

```text
Final persistent credential model
Request signing strategy (nếu có)
TTL / status=expired policy
Thuật ngữ có được nâng lên tương đương session token hay không
```

---

## 10. Roadmap gắn phase

1. **Phase 1:** trả lời R1–R5 bằng test có kiểm soát (fixture + HTTP client).
2. **Phase 2–3:** AccountBinding (không nhét research log), encrypt, claim atomic, rate limit, body limits.
3. **Phase 4:** `/df-link`, panel, DM.
4. **Phase 5:** Extension port + DfToolsClient theo profile đã chứng minh; ACTIVE sau validation call.

---

## 11. Test cases

### Research (R1–R5)

| ID  | Case                                                           | Ghi nhận                  |
| --- | -------------------------------------------------------------- | ------------------------- |
| R1  | Gọi lại API ngoài browser với openid+token (+ param cần thiết) | reusable?                 |
| R2  | Endpoint khác profile                                          | scope                     |
| R3  | T+10m, 1h, 24h                                                 | expiry                    |
| R4  | Replay nguyên URL/param đã capture                             | request reusable?         |
| R5  | Đổi ts giữ s; đổi param; cùng token request mới                | s/ts static hay generated |

### Claim & crypto

| ID  | Case                            | Expected                                |
| --- | ------------------------------- | --------------------------------------- |
| C01 | Happy path                      | 200, encrypted DB, no token in response |
| C02 | Invalid / expired / double code | 401; atomic: chỉ 1 consume              |
| C03 | Body thiếu / quá lớn            | 400/413                                 |
| C04 | Parallel double POST same code  | đúng 1 binding                          |
| C05 | AAD mismatch / tamper           | decrypt fail                            |
| C06 | No full credential in logs      | pass                                    |

### Network / extension / product

| ID  | Expected                                      |
| --- | --------------------------------------------- |
| N02 | PUBLIC_BASE_URL từ mạng ngoài trả lời         |
| E02 | MAIN không gọi claim URL                      |
| E03 | Link non-tech không F12                       |
| P01 | Sau bind ACTIVE, lệnh bot **không** bắt mở HQ |
| P02 | Hết hạn → re-link rõ ràng                     |

---

## 12. Quyết định chốt

| Chủ đề        | Quyết định                                          |
| ------------- | --------------------------------------------------- |
| Tên           | **DfTools credential** đến hết Phase 1              |
| Extension     | Bridge; MAIN không POST                             |
| Claim         | Atomic one-time TTL bound user + TLS + limits       |
| DB production | AccountBinding **không** bắt buộc `source_endpoint` |
| Research log  | Event tách, không full secret                       |
| openid        | Identifier, hạn chế log                             |
| `ts`/`s`      | Không commit persistent cho đến R5                  |
| Capture MVP   | **Candidate** openid+token                          |
| ACTIVE        | Sau validation server-side (≥1 endpoint đã biết)    |
| Multi-máy     | HTTPS cố định                                       |
| bcrypt        | Không                                               |
| Agent         | Không Phase 5 client đầy đủ trước R1–R5             |

---

## 13. Checklist

```text
[ ] R1–R5 có ghi chú kết quả
[ ] Final credential model (sau R5) đã cập nhật section 3.4
[ ] DF_CRED_KEY_V1
[ ] PUBLIC_BASE_URL https cố định
[ ] Claim atomic + rate limit + max body
[ ] AccountBinding không nhầm research log
[ ] Extension MAIN → SW only
[ ] Không log full credential
[ ] P01: dùng bot không mở HQ liên tục
```

---

## 14. Tích hợp vào Extension (Garena Redeem → DF Toolbox)

Tài liệu này map **1:1** lên repo extension redeem hiện có (`garena-redeem-code`), không viết extension từ zero nếu không cần.

### 14.1 Hiện trạng extension redeem (baseline)

```text
garena-redeem-code/
├── manifest.json
├── background/service-worker.js     # onInstalled + storage init
├── content/
│   ├── content.js                   # dashboard UI + RedeemController (~1000 dòng)
│   ├── page-capture.js              # MAIN world: hook XHR/fetch redeem API
│   └── dashboard.css
├── popup/                           # quản lý danh sách code
└── assets/
```

**Pattern đã có (tái sử dụng):**

| Pattern redeem                      | Dùng cho Link                                |
| ----------------------------------- | -------------------------------------------- |
| `page-capture.js` inject MAIN world | Hook DfTools thay vì RedeemCDKey             |
| `postMessage({ source, data })`     | Gửi credential candidate lên content         |
| Floating dashboard + CSS            | Thêm tab bar Redeem \| Link                  |
| `chrome.storage.local`              | Lưu `claimBaseUrl` (không lưu token lâu)     |
| Service worker                      | Thêm listener `DF_CLAIM` → `fetch` Claim API |

**Khác biệt quan trọng:**

| Redeem                        | Link                                         |
| ----------------------------- | -------------------------------------------- |
| Host: `redeem.df.garena.sg`   | Host: `playdeltaforce.com` (HQ)              |
| Bắt **response** JSON redeem  | Bắt **request URL query** (openid, token, …) |
| Logic xử lý hết trong content | Credential **chỉ** SW POST đi server         |
| Không cần Discord claim code  | Cần ô nhập claim code từ `/df-link`          |

### 14.2 Target structure (sau gộp)

```text
df-toolbox/   (đổi name extension)
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── bootstrap.js              # (optional) route theo hostname
│   ├── shell/
│   │   ├── panel.css             # dashboard.css mở rộng tab bar
│   │   └── panel-shell.js        # inject shell + 2 tab
│   ├── redeem/
│   │   ├── content.js            # logic redeem cũ (đổi path import)
│   │   └── page-capture.js       # capture redeem (như cũ)
│   └── link/
│       ├── panel.js              # UI tab Link
│       ├── bridge.js             # listen postMessage + sendMessage SW
│       └── page-capture.js       # MAIN: hook DfTools
├── popup/
└── assets/
```

**Cách gộp tối thiểu (ít đụng file hơn):** giữ `content/content.js` một file, thêm tab UI + module link; thêm `content/link-page-capture.js`; mở rộng SW. Chấp nhận được cho private MVP.

### 14.3 manifest.json — micro-steps

1. Đổi `name` → ví dụ `DF Toolbox` / `Garena DF Tools`.
2. Thêm `host_permissions`:
   - Giữ: `https://redeem.df.garena.sg/*`, `https://*.playerinfinite.com/*`
   - Thêm: `https://www.playdeltaforce.com/*` (và host HQ thật nếu khác)
   - Thêm: origin của `PUBLIC_BASE_URL` (Claim API), ví dụ `https://df-bot.example.com/*`
3. `content_scripts`: **hai entry** (hoặc một entry multi-match + bootstrap):

```json
"content_scripts": [
  {
    "matches": ["https://redeem.df.garena.sg/*"],
    "js": ["content/content.js"],
    "run_at": "document_idle"
  },
  {
    "matches": ["https://www.playdeltaforce.com/*"],
    "js": ["content/link-content.js"],
    "run_at": "document_idle"
  }
]
```

4. `web_accessible_resources`:

```json
"web_accessible_resources": [
  {
    "resources": ["content/page-capture.js", "content/dashboard.css"],
    "matches": ["https://redeem.df.garena.sg/*"]
  },
  {
    "resources": ["content/link-page-capture.js", "content/dashboard.css"],
    "matches": ["https://www.playdeltaforce.com/*"]
  }
]
```

5. `permissions`: giữ `storage`; thêm không bắt buộc `alarms` trừ khi cần.

6. **Không** nhúng `PUBLIC_BASE_URL` cứng vào manifest nếu có thể — lưu `chrome.storage.local.claimBaseUrl` (options page hoặc hardcode build private một lần).

### 14.4 link-page-capture.js (MAIN world) — micro-steps

Port từ userscript research + pattern `page-capture.js` redeem.

1. IIFE `'use strict'`.
2. `const SOURCE = 'df-link-capture'`.
3. Helper `isDfToolsUrl(url)` → `url.includes('DfTools')` (chỉnh nếu host API khác path).
4. Helper `extractCredential(url)`:
   - `const p = new URL(url, location.origin).searchParams`
   - Lấy `openid`, `token`, optional `ts`, `s`, `u`, `a`, `game_id`, …
   - Nếu thiếu `openid` hoặc `token` → return null
   - Return plain object **candidate** (không gọi là “valid production”).
5. Hook `XMLHttpRequest.prototype.open/send`: khi URL DfTools và extract được → `postMessage`.
6. Hook `window.fetch`: tương tự (URL từ `Request` hoặc string).
7. Optional: `performance.getEntriesByType('resource')` scan một lần lúc inject (trang đã load).
8. `postMessage` shape:

```js
window.postMessage(
  {
    source: 'df-link-capture',
    type: 'CREDENTIAL_CANDIDATE',
    credential: { openid, token, ts, s, u, a /* … */ },
    endpoint: 'GetManufactureRecommendationList', // từ path
    capturedAt: Date.now(),
  },
  window.location.origin,
); // ưu tiên origin cụ thể, tránh '*'
```

9. **Cấm trong file này:** `fetch(claimUrl)`, đọc claim code, `chrome.*`, log full token.

### 14.5 Inject MAIN script từ content (như redeem)

Trong `link-content.js` / bootstrap HQ:

```js
function injectLinkCapture() {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('content/link-page-capture.js');
  s.onload = () => s.remove();
  (document.documentElement || document.head).appendChild(s);
}
injectLinkCapture();
```

### 14.6 link-content.js — bridge + panel

**A. Lắng nghe candidate**

```js
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const d = event.data;
  if (!d || d.source !== 'df-link-capture') return;
  if (d.type !== 'CREDENTIAL_CANDIDATE') return;
  if (!d.credential?.openid || !d.credential?.token) return;
  // giữ trong biến module-level; UI hiện "Đã bắt credential"
  state.candidate = d.credential;
  state.endpoint = d.endpoint;
  renderLinkPanel();
});
```

**B. UI tab Link (tối thiểu)**

```text
[ Redeem ] [ Link ]
---
Claim code: [____________]
Trạng thái capture: Chưa có / Đã bắt (openid •••1234)
[ Liên kết Discord ]
Kết quả: …
```

**C. Nút Liên kết → SW**

```js
async function submitClaim() {
  const code = input.value.trim();
  if (!code || !state.candidate) return showError('…');
  const res = await chrome.runtime.sendMessage({
    type: 'DF_CLAIM',
    code,
    credential: state.candidate,
    source_endpoint: state.endpoint,
  });
  // res: { ok: true } | { ok: false, error: 'invalid_code' | 'network' | … }
}
```

**D. Không** `chrome.storage` full token; optional clear `state.candidate` sau claim OK.

### 14.7 service-worker.js — thêm Claim

Giữ `onInstalled` redeem. Thêm:

```js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'DF_CLAIM') return;

  (async () => {
    try {
      const { claimBaseUrl } = await chrome.storage.local.get('claimBaseUrl');
      const base = claimBaseUrl || 'https://YOUR_FIXED_HOST'; // private build
      const body = {
        code: msg.code,
        openid: msg.credential.openid,
        token: msg.credential.token,
        ts: msg.credential.ts,
        s: msg.credential.s,
        u: msg.credential.u,
        a: msg.credential.a,
        source_endpoint: msg.source_endpoint,
      };
      const r = await fetch(`${base.replace(/\/$/, '')}/api/df/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      sendResponse({
        ok: r.ok && data.ok === true,
        error: data.error || (!r.ok ? 'http_' + r.status : undefined),
      });
    } catch (e) {
      sendResponse({ ok: false, error: 'network' });
    }
  })();

  return true; // async sendResponse
});
```

**Cấm:** log `msg.credential.token`.

### 14.8 Cấu hình PUBLIC_BASE_URL trong extension

| Cách                                                      | Khi nào                         |
| --------------------------------------------------------- | ------------------------------- |
| Hardcode trong SW (private build)                         | Server bạn bè, URL ít đổi       |
| `chrome.storage.local.claimBaseUrl` + options/popup field | Đổi tunnel/domain không rebuild |
| Build-time replace `@@CLAIM_BASE_URL@@`                   | CI                              |

User non-tech **không** sửa URL mỗi lần link — chỉ dán claim code.

### 14.9 Gộp UI một dashboard hai tab

Micro-steps trên trang **redeem** (giữ UX cũ):

1. Shell có tab; tab Redeem = UI hiện tại.
2. Tab Link trên trang redeem: chỉ hiện hướng dẫn “Mở HQ để link” (capture không chạy trên redeem host).

Micro-steps trên trang **HQ**:

1. Chỉ mount tab Link (hoặc full shell với Redeem disabled + deep link sang redeem.garena).
2. Inject `link-page-capture.js`.
3. Panel claim code + status.

Không bắt buộc một `content.js` chạy cả hai host; **hai content script entry** sạch hơn.

### 14.10 Thứ tự implement extension (sau / song song Phase 1 tối thiểu)

```text
E1. manifest: hosts + web_accessible link-page-capture
E2. link-page-capture.js (MAIN) + inject
E3. link-content.js: message listener + state candidate (UI thô)
E4. SW: DF_CLAIM fetch (cần PUBLIC_BASE_URL + Claim API đã lên)
E5. Panel UI claim code + error mapping
E6. (Optional) tab shell gộp redeem
E7. QA: E02 MAIN không fetch claim; E03 non-tech path
```

**Phụ thuộc server:** E4 cần Claim API + HTTPS cố định. Có thể mock SW response để test UI trước.

### 14.11 Checklist tích hợp extension

```text
[ ] manifest matches HQ + claim API origin
[ ] link-page-capture chỉ postMessage, không POST claim
[ ] content chỉ nhận message đúng source + origin
[ ] SW unique path DF_CLAIM
[ ] claimBaseUrl không phải localhost trên bản user
[ ] Không storage lâu full token
[ ] Không console.log token
[ ] Redeem path không bị regress
[ ] Trên HQ: bắt được candidate sau khi trang gọi DfTools
[ ] Claim sai code → UI invalid_code; đúng → ok + user kiểm tra DM
```

### 14.12 Mapping userscript research → extension

| Userscript               | Extension                        |
| ------------------------ | -------------------------------- |
| `@@WEBHOOK_URL@@`        | `claimBaseUrl` / SW              |
| `@@CLAIM_CODE@@`         | Input panel                      |
| `mode: 'no-cors'`        | Bỏ — SW `fetch` bình thường      |
| `send()` ngay trong page | `postMessage` → content → SW     |
| `log token preview`      | Tắt production                   |
| perf-scan + xhr + fetch  | Giữ trong `link-page-capture.js` |

### 14.13 Điều không làm trong extension

- Không decrypt / không gọi DfTools business API từ extension.
- Không embed Discord bot token.
- Không coi candidate là ACTIVE binding (server quyết định).
- Không yêu cầu user mở HQ mỗi ngày (chỉ lúc link/re-link).

---

_Master instruction cho agent. Observation ≠ assumption. Cập nhật access-token / công thức `s` / TTL chỉ khi Phase 1 có số liệu._
