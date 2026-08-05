# DF Link — Hướng dẫn kiến trúc & triển khai (Discord Webhook)

> **Mục đích tài liệu:** đặc tả công nghệ, logic, luồng, triển khai micro-step, và test case cho hệ thống **link tài khoản Delta Force HQ → Discord bot** (private bot, không thương mại).
> **Phiên bản:** 2026-08-05 (chuyển handoff sang Discord Webhook — bỏ Claim API HTTP + tunnel).
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
| **Không phụ thuộc public server**      | Không tunnel, không VPS, không Claim API HTTP                               |

### 0.2 Không phải mục tiêu

- OAuth chính thức Garena/Tencent cho third-party bot.
- bcrypt cho credential còn cần dùng lại khi gọi API.
- Giả định credential sống vĩnh viễn trước Phase 1.
- User mở HQ mỗi lần dùng lệnh bot.
- Public HTTP endpoint / Cloudflare Tunnel / Named Tunnel.

### 0.3 Nguyên tắc cốt lõi

1. Credential chỉ có trong **browser session HQ** → cần **client-side capture** lúc bind.
2. **Extension = client-side bridge**, không phải authentication provider / IdP.
3. Discord chỉ **nhận diện user** (claim code), không auth HQ.
4. **Discord Webhook** = kênh handoff cố định (URL không đổi).
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
Extension POST → Discord Webhook (cố định)
      ↓
Bot nhận message → validate claim_code → encrypt + persist
      ↓
Bot decrypt khi cần → DfToolsClient → data trên Discord
```

---

## 1. Công nghệ

### 1.1 Bot (server)

| Thành phần    | Gợi ý                         | Ghi chú                                                    |
| ------------- | ----------------------------- | ---------------------------------------------------------- |
| Runtime       | Node.js 20+                   |                                                            |
| Bot           | discord.js v14                | `/df-link`                                                 |
| DB            | better-sqlite3 / Postgres     |                                                            |
| Crypto        | `node:crypto` AES-256-GCM     |                                                            |
| Config        | `.env`                        | `DF_CRED_KEY_V1`, `CLAIM_TTL_SEC`, `DF_WEBHOOK_SECRET`     |
| Không cần     | Express / Fastify / HTTP public | Handoff qua Discord Webhook                              |

### 1.2 Extension (bridge)

| Thành phần             | Vai trò                                |
| ---------------------- | -------------------------------------- |
| MAIN `page-capture.js` | Chỉ quan sát / extract metadata        |
| Isolated content       | UI, validate message, nhận claim code  |
| Service Worker         | **Duy nhất** được POST Discord Webhook |
| Panel                  | Tab Redeem \| Link                     |

### 1.3 Infra

- **Dùng:** Discord Webhook (URL cố định, tạo 1 lần).
- **Không:** localhost public, quick tunnel, Named Tunnel, VPS, PaaS cho claim.

### 1.4 Prototype

Console userscript = research only.

---

## 2. Kiến trúc 3 lớp

```text
LAYER 1 Extension              capture → handoff → SW → Discord Webhook
LAYER 2 Bot (Webhook listener) SECURITY BOUNDARY — validate + encrypt
LAYER 3 DfToolsClient          decrypt → profile → API — không biết nguồn credential
```

### 2.1 Phân quyền Extension

```text
MAIN world
   │ capture only — KHÔNG POST webhook
   ▼ postMessage
Isolated content
   │ UI + validate shape
   ▼ runtime.sendMessage
Service Worker
   │ HTTPS POST Discord Webhook
   ▼
Discord Channel (private)
   │
Bot messageCreate / webhook listener
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
  → SW POST Discord Webhook
  → Bot nhận message → atomic consume + encrypt + persist
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
**Consume phải atomic**.

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

### 3.3 Telemetry research (tách, optional)

```text
credential_capture_events   -- không lưu full credential
├── id
├── discord_user_id?
├── endpoint
├── captured_at
├── credential_fingerprint
└── notes
```

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
├── s
├── u, a
└── endpoint-specific params
```

### 3.5 Endpoint profiles (Layer 3)

```ts
DfToolsClient.request(discordUserId, endpointKey, extra?)
```

### 3.6 openid

- Coi là **identifier**, không phải authentication secret.
- Lưu plaintext để index được chấp nhận.
- **Vẫn không log** nếu không cần.

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

Encrypt chỉ trong bot sau validate claim; decrypt chỉ trong DfToolsClient; never log plaintext.

---

## 5. Discord Webhook (handoff boundary)

### 5.1 Tạo Webhook

1. Tạo channel riêng (private, chỉ admin + bot nhìn thấy), ví dụ `#df-link-claims`.
2. Channel Settings → Integrations → Webhooks → New Webhook.
3. Copy **Webhook URL** (dạng `https://discord.com/api/webhooks/{id}/{token}`).
4. Lưu vào `.env` của bot nếu cần verify (tùy chọn).
5. Extension hardcode hoặc lưu `webhookUrl` (private build).

### 5.2 Payload Extension gửi

```json
{
  "type": "df_claim",
  "secret": "shared-secret-ngắn",
  "code": "A1B2C3D4",
  "openid": "...",
  "token": "...",
  "ts": "...",
  "s": "...",
  "u": "...",
  "a": "...",
  "source_endpoint": "GetManufactureRecommendationList",
  "captured_at": 1722...
}
```

### 5.3 Bot lắng nghe

```js
client.on('messageCreate', async (message) => {
  if (message.channelId !== CLAIM_CHANNEL_ID) return;
  if (!message.webhookId) return; // chỉ nhận từ webhook

  let data;
  try {
    data = JSON.parse(message.content);
  } catch {
    return;
  }

  if (data.type !== 'df_claim') return;
  if (data.secret !== process.env.DF_WEBHOOK_SECRET) return;

  // → validate claim code atomic → encrypt → persist → DM user
});
```

### 5.4 Requirements

```text
claim_code: random | short-lived | one-time | bound Discord user
transport: Discord Webhook (HTTPS cố định)
consume: ATOMIC
at rest: encrypt immediately
response: không có HTTP response → bot DM user kết quả
logs: never full token / s
rate limit: theo Discord + bot-side (số lần tạo claim / user)
```

### 5.5 Atomic consume

```text
BEGIN
  SELECT claim WHERE code=? AND status='pending' AND expires_at>now
  UPDATE claim SET status='consumed'
  INSERT/UPDATE binding (encrypted)
COMMIT
```

### 5.6 Binding ACTIVE vs capture candidate

```text
MVP capture (extension):
  credential CANDIDATE đầu tiên có openid + token

MVP binding ACTIVE:
  chỉ sau khi bot validate claim_code thành công
  + (Phase 1) validation call ít nhất 1 endpoint
```

---

## 6. Discord `/df-link`

| Lệnh     | Việc                             |
| -------- | -------------------------------- |
| `start`  | Claim code + hướng dẫn + mở HQ   |
| `status` | Mask identifier, status, last_ok |
| `unlink` | revoked                          |
| `manual` | Optional tech fallback           |

Hằng ngày: lệnh data **không** mở HQ; hết hạn → bảo re-link.

**Hướng dẫn user (non-tech):**

1. Gõ `/df-link start` → nhận claim code.
2. Mở trang HQ Delta Force (đã login).
3. Mở extension → tab Link → dán claim code → bấm Liên kết.
4. Nhận DM "Linked OK".

---

## 7. Extension — tổng quan

- MAIN: capture **candidate** only (không POST webhook).
- Isolated content: UI tab Link + bridge message.
- SW: **duy nhất** POST Discord Webhook.
- Webhook URL hardcode (private build) hoặc lưu `chrome.storage.local.webhookUrl`.
- Không log token preview production.
- Chi tiết tích hợp → **§14**.

---

## 8. Multi-máy

Discord Webhook URL **cố định toàn cầu**. Không phụ thuộc máy dev hay mạng user.

---

## 9. Phase order (khóa agent)

```text
Phase 1 — Research          ← bắt buộc trước client đầy đủ
Phase 2 — Architecture
Phase 3 — Security
Phase 4 — UX
Phase 5 — Implementation
```

**Song song được:** skeleton webhook listener + claim code generator.
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

1. **Phase 1:** trả lời R1–R5 bằng test có kiểm soát.
2. **Phase 2–3:** AccountBinding, encrypt, claim atomic, webhook listener.
3. **Phase 4:** `/df-link`, panel, DM.
4. **Phase 5:** Extension port + DfToolsClient theo profile đã chứng minh.

---

## 11. Test cases

### Research (R1–R5)

| ID  | Case                                                           | Ghi nhận                  |
| --- | -------------------------------------------------------------- | ------------------------- |
| R1  | Gọi lại API ngoài browser với openid+token                     | reusable?                 |
| R2  | Endpoint khác profile                                          | scope                     |
| R3  | T+10m, 1h, 24h                                                 | expiry                    |
| R4  | Replay nguyên URL/param đã capture                             | request reusable?         |
| R5  | Đổi ts giữ s; đổi param; cùng token request mới                | s/ts static hay generated |

### Claim & crypto

| ID  | Case                            | Expected                                |
| --- | ------------------------------- | --------------------------------------- |
| C01 | Happy path                      | Bot nhận webhook → encrypted DB → DM OK |
| C02 | Invalid / expired / double code | Không tạo binding; atomic               |
| C03 | Sai secret / sai type           | Bỏ qua                                  |
| C04 | Parallel double claim same code | đúng 1 binding                          |
| C05 | AAD mismatch / tamper           | decrypt fail                            |
| C06 | No full credential in logs      | pass                                    |

### Network / extension / product

| ID  | Expected                                      |
| --- | --------------------------------------------- |
| N01 | Webhook URL hoạt động từ mạng ngoài           |
| E02 | MAIN không gọi webhook                        |
| E03 | Link non-tech không F12                       |
| P01 | Sau bind ACTIVE, lệnh bot **không** bắt mở HQ |
| P02 | Hết hạn → re-link rõ ràng                     |

---

## 12. Quyết định chốt

| Chủ đề        | Quyết định                                          |
| ------------- | --------------------------------------------------- |
| Tên           | **DfTools credential** đến hết Phase 1              |
| Extension     | Bridge; MAIN không POST                             |
| Handoff       | **Discord Webhook** (cố định, không tunnel)         |
| Claim         | Atomic one-time TTL bound user                      |
| DB production | AccountBinding                                      |
| Research log  | Table tách, không full secret                       |
| openid        | Identifier, hạn chế log                             |
| `ts`/`s`      | Không commit persistent cho đến R5                  |
| Capture MVP   | **Candidate** openid+token                          |
| ACTIVE        | Sau validation bot-side                             |
| Multi-máy     | Discord Webhook URL cố định                         |
| bcrypt        | Không                                               |
| Agent         | Không Phase 5 client đầy đủ trước R1–R5             |

---

## 13. Checklist

```text
[ ] R1–R5 có ghi chú kết quả
[ ] Final credential model (sau R5) đã cập nhật section 3.4
[ ] DF_CRED_KEY_V1
[ ] Discord Webhook đã tạo + URL lưu an toàn
[ ] Claim atomic + secret (nếu dùng)
[ ] AccountBinding không nhầm research log
[ ] Extension MAIN → SW only
[ ] Không log full credential
[ ] P01: dùng bot không mở HQ liên tục
```

---

## 14. Tích hợp vào Extension (Garena Redeem → DF Toolbox)

### 14.1 Hiện trạng extension redeem (baseline)

```text
garena-redeem-code/
├── manifest.json
├── background/service-worker.js
├── content/
│   ├── content.js
│   ├── page-capture.js
│   └── dashboard.css
├── popup/
└── assets/
```

**Pattern tái sử dụng:** MAIN capture → postMessage → content → SW.

### 14.2 Target structure

```text
df-toolbox/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── shell/
│   │   ├── panel.css
│   │   └── panel-shell.js
│   ├── redeem/
│   │   ├── content.js
│   │   └── page-capture.js
│   └── link/
│       ├── panel.js
│       ├── bridge.js
│       └── page-capture.js
├── popup/
└── assets/
```

### 14.3 manifest.json — micro-steps

1. Đổi `name` → `DF Toolbox`.
2. Thêm `host_permissions`:
   - Giữ redeem hosts
   - Thêm `https://www.playdeltaforce.com/*`
   - Thêm `https://discord.com/*` (để SW POST webhook)
3. `content_scripts`: hai entry (redeem + HQ).
4. `web_accessible_resources`: thêm `link-page-capture.js`.
5. `permissions`: giữ `storage`.

### 14.4 link-page-capture.js (MAIN world)

1. IIFE `'use strict'`.
2. `const SOURCE = 'df-link-capture'`.
3. Helper `isDfToolsUrl(url)` → `url.includes('DfTools')`.
4. Helper `extractCredential(url)`:
   - Lấy `openid`, `token`, optional `ts`, `s`, `u`, `a`, `game_id`, …
   - Nếu thiếu `openid` hoặc `token` → return null
   - Return plain object **candidate**.
5. Hook `XMLHttpRequest.prototype.open/send`.
6. Hook `window.fetch`.
7. Optional: `performance.getEntriesByType('resource')` scan một lần.
8. `postMessage` shape:

```js
window.postMessage(
  {
    source: 'df-link-capture',
    type: 'CREDENTIAL_CANDIDATE',
    credential: { openid, token, ts, s, u, a },
    endpoint: 'GetManufactureRecommendationList',
    capturedAt: Date.now(),
  },
  window.location.origin,
);
```

9. **Cấm trong file này:** `fetch(webhookUrl)`, đọc claim code, `chrome.*`, log full token.

### 14.5 Inject MAIN script từ content

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
  state.candidate = d.credential;
  state.endpoint = d.endpoint;
  renderLinkPanel();
});
```

### B. UI tab Link (tối thiểu)

```text
[ Redeem ] [ Link ]
---
Claim code: [____________]
Trạng thái capture: Chưa có / Đã bắt (openid •••1234)
[ Liên kết Discord ]
Kết quả: …
```

### C. Nút Liên kết → SW

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
}
```

**D. Không** `chrome.storage` full token; optional clear `state.candidate` sau claim OK.

### 14.7 service-worker.js — POST Discord Webhook

```js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'DF_CLAIM') return;

  (async () => {
    try {
      const { webhookUrl } = await chrome.storage.local.get('webhookUrl');
      const url = webhookUrl || 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN';

      const payload = {
        type: 'df_claim',
        secret: 'YOUR_SHARED_SECRET',
        code: msg.code,
        openid: msg.credential.openid,
        token: msg.credential.token,
        ts: msg.credential.ts,
        s: msg.credential.s,
        u: msg.credential.u,
        a: msg.credential.a,
        source_endpoint: msg.source_endpoint,
        captured_at: Date.now(),
      };

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Discord webhook trả 204 No Content khi thành công
      sendResponse({
        ok: r.status === 204 || r.ok,
        error: r.ok ? undefined : 'http_' + r.status,
      });
    } catch (e) {
      sendResponse({ ok: false, error: 'network' });
    }
  })();

  return true;
});
```

**Cấm:** log `msg.credential.token`.

### 14.8 Cấu hình Webhook URL trong extension

| Cách | Khi nào |
| --- | --- |
| Hardcode trong SW (private build) | Khuyến nghị cho private |
| `chrome.storage.local.webhookUrl` | Đổi webhook không rebuild |

User non-tech **không** sửa URL — chỉ dán claim code.

### 14.9 Gộp UI một dashboard hai tab

- Trang redeem: tab Redeem = UI hiện tại; tab Link hiện hướng dẫn "Mở HQ để link".
- Trang HQ: chỉ mount tab Link + inject `link-page-capture.js`.

### 14.10 Thứ tự implement extension

```text
E1. manifest: hosts + web_accessible
E2. link-page-capture.js (MAIN) + inject
E3. link-content.js: message listener + state candidate
E4. SW: DF_CLAIM → POST Discord Webhook
E5. Panel UI claim code + error mapping
E6. (Optional) tab shell gộp redeem
E7. QA: E02 MAIN không fetch webhook; E03 non-tech path
```

### 14.11 Checklist tích hợp extension

```text
[ ] manifest matches HQ + discord.com
[ ] link-page-capture chỉ postMessage, không POST webhook
[ ] content chỉ nhận message đúng source + origin
[ ] SW unique path DF_CLAIM
[ ] webhookUrl hardcode hoặc storage
[ ] Không storage lâu full token
[ ] Không console.log token
[ ] Redeem path không bị regress
[ ] Trên HQ: bắt được candidate sau khi trang gọi DfTools
[ ] Claim sai code → bot không tạo binding; đúng → DM Linked OK
```

### 14.12 Mapping userscript research → extension

| Userscript | Extension |
| --- | --- |
| `@@WEBHOOK_URL@@` | Discord Webhook URL |
| `@@CLAIM_CODE@@` | Input panel |
| `mode: 'no-cors'` | Bỏ — SW fetch bình thường |
| `send()` ngay trong page | `postMessage` → `content` → `SW` |
| `log token preview` | Tắt production |

### 14.13 Điều không làm trong extension

- Không decrypt / không gọi DfTools business API từ extension.
- Không embed Discord bot token.
- Không coi candidate là ACTIVE binding (bot quyết định).
- Không yêu cầu user mở HQ mỗi ngày.

---

## 15. Ưu điểm của luồng Webhook so với Claim API cũ

| Vấn đề cũ                      | Giải pháp Webhook          |
| ------------------------------ | -------------------------- |
| Tunnel URL đổi mỗi lần restart | Webhook URL cố định        |
| Cần public server / domain     | Không cần                  |
| Non-tech phải config URL       | Chỉ dán claim code         |
| Dependency cycle               | Biến mất                   |
| Dev mệt vì restart             | Restart bot thoải mái      |

---

_Master instruction cho agent. Observation ≠ assumption. Cập nhật access-token / công thức `s` / TTL chỉ khi Phase 1 có số liệu._
