# DF Link — Hướng dẫn kiến trúc & triển khai

> **Mục đích tài liệu:** mô tả đầy đủ công nghệ, logic, luồng, triển khai từng bước nhỏ, và test case cho hệ thống **link tài khoản Delta Force HQ → Discord bot** (private bot, không thương mại).  
> **Phiên bản kiến trúc:** chốt theo thảo luận 2026-08.  
> **Đối tượng:** developer triển khai bot + extension.

---

## 0. Mục tiêu & ràng buộc

### 0.1 Mục tiêu sản phẩm

| Mục tiêu           | Mô tả                                                      |
| ------------------ | ---------------------------------------------------------- |
| Non-tech UX        | User **không** mở F12 / paste console                      |
| Multi-máy          | User mạng khác dev vẫn link được                           |
| Credential an toàn | Token HQ **không** lưu plaintext; **không** log full token |
| Tách lớp           | Capture ≠ Claim ≠ API client                               |
| Private use        | Server/guild riêng; không thiết kế marketplace             |

### 0.2 Không phải mục tiêu

- OAuth chính thức từ Garena/Tencent cho third-party bot (không có).
- Biến Discord Incoming Webhook thành nơi nhận token production.
- Dùng bcrypt để “mã hóa” token còn cần gọi API lại.
- Giả định token HQ là access token vĩnh viễn trước khi có test lifecycle.

### 0.3 Nguyên tắc cốt lõi

1. Credential chỉ xuất hiện trong **browser session HQ** → phải có **client-side capture**.
2. Discord chỉ **nhận diện user** (claim code), không phải nơi auth HQ.
3. **HTTPS endpoint cố định** là điều kiện multi-máy; encryption không thay thế endpoint.
4. Mỗi DfTools endpoint có thể dùng **bộ param khác nhau** (đã chứng minh bằng log).

---

## 1. Công nghệ

### 1.1 Bot (server)

| Thành phần    | Gợi ý                                           | Ghi chú                                            |
| ------------- | ----------------------------------------------- | -------------------------------------------------- |
| Runtime       | Node.js 20+                                     | Khớp Discord.js bot hiện tại                       |
| Bot framework | discord.js v14                                  | Slash `/df-link`                                   |
| HTTP          | Express / Fastify / `http` gắn cùng process bot | Route `POST /api/df/claim`                         |
| DB            | better-sqlite3 (hiện có) hoặc Postgres          | Private bot: SQLite đủ                             |
| Crypto        | `node:crypto` AES-256-GCM                       | Built-in, không thêm dep bắt buộc                  |
| Config        | `.env`                                          | `DF_CRED_KEY_V1`, `CLAIM_TTL_SEC`, public base URL |

### 1.2 Extension (client bridge)

| Thành phần | Gợi ý                                                        | Ghi chú                                            |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Manifest   | MV3                                                          | Content script + service worker                    |
| UI         | Floating panel (tab **Redeem \| Link**)                      | Pattern giống extension redeem sẵn có              |
| Capture    | Script inject **MAIN world**                                 | Hook `fetch` / `XHR` + optional `performance` scan |
| Network    | Background `fetch` → Claim API                               | Tránh CORS/`no-cors` từ page context               |
| Host match | `https://www.playdeltaforce.com/*` (và subdomain HQ thực tế) | Chỉ quyền tối thiểu                                |

### 1.3 Infra bắt buộc (multi-máy)

| Option                       | Khi nào dùng                                               |
| ---------------------------- | ---------------------------------------------------------- |
| Cloudflare **Named Tunnel**  | Bot chạy máy nhà, cần URL HTTPS cố định                    |
| VPS / Railway / Render / Fly | Bot 24/7, production hơn                                   |
| **Không** dùng               | `localhost`, `trycloudflare` quick tunnel (URL đổi / chết) |

### 1.4 Không dùng cho production token path

- Discord Incoming Webhook làm ingestion credential.
- `mode: 'no-cors'` POST từ page (không đọc response, opaque).
- Console userscript là **prototype research only**.

---

## 2. Kiến trúc 3 lớp

```text
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — Extension (DF Toolbox)                           │
│  Trách nhiệm: HQ session → capture credential → POST claim  │
│  Không: lưu token dài hạn, không business logic Discord     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS POST /api/df/claim
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — Claim API (security boundary)                    │
│  Trách nhiệm: validate code → map Discord user → encrypt    │
│               → persist AccountBinding → notify bot/DM      │
│  Không: gọi DfTools business API                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ encrypted store
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — DfTools Client                                   │
│  Trách nhiệm: load binding → decrypt → request theo profile │
│  Không: biết credential lấy từ extension hay manual         │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Sơ đồ end-to-end (happy path)

```text
User                Discord Bot           Extension              Claim API            DB
 │                      │                     │                      │                 │
 │  /df-link            │                     │                      │                 │
 │─────────────────────>│                     │                      │                 │
 │                      │ create claim_code   │                      │                 │
 │                      │ (TTL, one-time)     │                      │                 │
 │  code + "Mở HQ"      │                     │                      │                 │
 │<─────────────────────│                     │                      │                 │
 │                      │                     │                      │                 │
 │  mở HQ (đã login)    │                     │                      │                 │
 │──────────────────────────────────────────>│                      │                 │
 │                      │                     │ panel: dán code      │                 │
 │                      │                     │ hook DfTools         │                 │
 │                      │                     │ openid+token+…       │                 │
 │                      │                     │ POST claim           │                 │
 │                      │                     │─────────────────────>│                 │
 │                      │                     │                      │ validate code   │
 │                      │                     │                      │ encrypt token   │
 │                      │                     │                      │───────────────>│
 │                      │                     │                      │ store binding   │
 │                      │  event / internal   │                      │                 │
 │                      │<────────────────────│──────────────────────│                 │
 │  DM "Linked OK"      │                     │                      │                 │
 │<─────────────────────│                     │                      │                 │
```

---

## 3. Mô hình dữ liệu

### 3.1 Claim session (ephemeral)

Lưu memory `Map` hoặc Redis/SQLite bảng tạm — **TTL ngắn** (ví dụ 10–15 phút).

| Field             | Kiểu       | Mô tả                                          |
| ----------------- | ---------- | ---------------------------------------------- |
| `code`            | string     | Random, đủ entropy (ví dụ 8–12 ký tự alphabet) |
| `discord_user_id` | snowflake  | User gọi `/df-link`                            |
| `guild_id`        | snowflake? | Optional                                       |
| `created_at`      | number     | Unix ms                                        |
| `expires_at`      | number     | `created_at + TTL`                             |
| `consumed_at`     | number?    | null until used                                |
| `status`          | enum       | `pending` \| `consumed` \| `expired`           |

**Luật:**

- Một code chỉ consume **một lần**.
- Hết `expires_at` → reject.
- Optional: một user chỉ có 1 code `pending` (tạo mới → invalidate code cũ).

### 3.2 AccountBinding (persistent)

**Không** thiết kế chỉ `user_id + token + openid`.

```text
df_account_bindings
├── id                    INTEGER PK
├── discord_user_id       TEXT NOT NULL
├── provider              TEXT NOT NULL DEFAULT 'garena'
├── platform              TEXT NOT NULL DEFAULT 'df_hq'
├── openid                TEXT NOT NULL          -- identifier, plaintext OK
├── cred_nonce            BLOB NOT NULL          -- 12 bytes
├── cred_ciphertext       BLOB NOT NULL
├── cred_tag              BLOB NOT NULL          -- 16 bytes GCM tag
├── key_version           INTEGER NOT NULL DEFAULT 1
├── status                TEXT NOT NULL DEFAULT 'active'
│                           -- active | expired | revoked
├── source_endpoint       TEXT                   -- endpoint bắt được lúc capture
├── captured_at           TEXT / INTEGER
├── last_ok_at            TEXT / INTEGER NULL
├── last_error            TEXT NULL
├── created_at            TEXT / INTEGER
├── updated_at            TEXT / INTEGER
└── UNIQUE(discord_user_id, provider, platform)  -- hoặc cho multi-account sau
```

### 3.3 Payload credential (plaintext trước encrypt)

JSON một blob (khuyến nghị):

```json
{
  "token": "df554b9977ffede320577abb1092abb958306ba3",
  "u": "e215f791-bc6c-4374-bd95-7a13b3148938",
  "a": "10005",
  "ts": "1785732778",
  "s": "72231ef8fae98d223ff9382140ae350f",
  "game_id": "30150",
  "channel": "10",
  "account_type": "1",
  "lang_type": "vi"
}
```

Chỉ field nào **thật sự bắt được** mới ghi; thiếu thì omit.

### 3.4 Endpoint profile (DfToolsClient)

Không hardcode “mọi call = openid + token”.

```text
profiles:
  GetManufactureRecommendationList:
    auth: openid_token
    extra: [game_id, channel, account_type, lang_type]
    signing: ts_s_optional   # TBD sau research

  GetPrivateRoomKey:
    auth: session_u_a
    signing: ts_s

  GetMyData:   # ví dụ — chỉnh theo API bot thật dùng
    auth: openid_token
    ...
```

Client API bề mặt:

```ts
DfToolsClient.request(discordUserId, endpointKey, extraParams?)
// load binding → decrypt → build query theo profile → fetch → update last_ok_at
```

---

## 4. Mã hóa (AES-256-GCM)

### 4.1 Tại sao không bcrypt

| Thuật toán      | Tính chất             | Dùng khi                                |
| --------------- | --------------------- | --------------------------------------- |
| bcrypt / argon2 | One-way hash          | Password chỉ **verify**                 |
| AES-256-GCM     | Reversible + auth tag | Server **cần plaintext lại** để gọi API |

Token HQ → bot phải gửi lại DfTools → **bắt buộc reversible encryption**.

### 4.2 Tham số

| Tham số    | Giá trị                                                |
| ---------- | ------------------------------------------------------ |
| Algorithm  | `aes-256-gcm`                                          |
| Key        | 32 bytes, Base64 trong env `DF_CRED_KEY_V1`            |
| Nonce / IV | 12 bytes, `crypto.randomBytes(12)` **mỗi lần encrypt** |
| Auth tag   | 16 bytes                                               |
| AAD        | `garena\|df_hq\|{discord_user_id}\|{openid}`           |

### 4.3 Micro-steps encrypt

1. Validate claim thành công, có `openid` + `token`.
2. `plaintext = JSON.stringify(credentialObject)`.
3. `aad = \`garena|df_hq|${discordUserId}|${openid}\``.
4. `nonce = randomBytes(12)`.
5. `createCipheriv('aes-256-gcm', key, nonce)`.
6. `setAAD(Buffer.from(aad, 'utf8'))`.
7. `ciphertext = update + final`.
8. `tag = getAuthTag()`.
9. Ghi DB: `nonce`, `ciphertext`, `tag`, `key_version`, `openid`, …
10. **Xóa** biến plaintext khỏi scope; không `console.log(token)`.

### 4.4 Micro-steps decrypt

1. Load row `status = active` theo `discord_user_id`.
2. Lấy key theo `key_version`.
3. Rebuild **đúng** AAD như lúc encrypt.
4. `createDecipheriv` → `setAAD` → `setAuthTag` → `update + final`.
5. `JSON.parse` → dùng cho **một** request.
6. Không ghi plaintext ra log / Discord.

### 4.5 Sinh key (một lần trên máy deploy)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`.env`:

```env
DF_CRED_KEY_V1=<base64 32-byte key>
CLAIM_TTL_SEC=900
PUBLIC_BASE_URL=https://your-fixed-hostname.example
```

### 4.6 Key rotation (sau này)

1. Thêm `DF_CRED_KEY_V2`.
2. Encrypt binding mới bằng `key_version = 2`.
3. Decrypt đọc theo `key_version` trên row.
4. Optional job: re-encrypt toàn bộ V1 → V2, rồi retire V1.

---

## 5. Claim API

### 5.1 Endpoint

```http
POST {PUBLIC_BASE_URL}/api/df/claim
Content-Type: application/json
```

**Request body:**

```json
{
  "code": "AB12CD34",
  "openid": "7882496458699115941",
  "token": "df554b9977ffede320577abb1092abb958306ba3",
  "ts": "1785732778",
  "s": "72231ef8fae98d223ff9382140ae350f",
  "u": "e215f791-bc6c-4374-bd95-7a13b3148938",
  "a": "10005",
  "game_id": "30150",
  "channel": "10",
  "account_type": "1",
  "lang_type": "vi",
  "source_endpoint": "GetManufactureRecommendationList"
}
```

**Response (không echo credential):**

| HTTP | Body                                         | Ý nghĩa                            |
| ---- | -------------------------------------------- | ---------------------------------- |
| 200  | `{ "ok": true }`                             | Đã bind                            |
| 400  | `{ "ok": false, "error": "invalid_body" }`   | Thiếu field                        |
| 401  | `{ "ok": false, "error": "invalid_code" }`   | Sai / hết hạn / đã dùng            |
| 409  | `{ "ok": false, "error": "already_linked" }` | Policy: không overwrite (tuỳ chọn) |
| 500  | `{ "ok": false, "error": "server_error" }`   | Lỗi nội bộ                         |

### 5.2 Micro-steps handler

1. Parse JSON; reject nếu thiếu `code`, `openid`, `token`.
2. Normalize: trim code, token length sanity (ví dụ 20–128 hex/char).
3. Lookup claim session by code.
4. Nếu không có / `expires_at < now` / `status !== pending` → `401 invalid_code`.
5. Mark claim `consumed` **trước hoặc trong transaction** với insert binding (tránh double consume).
6. Build credential JSON từ body.
7. Encrypt với AAD có `discord_user_id` từ claim session.
8. Upsert `df_account_bindings` (`status = active`).
9. Trigger bot: DM user `Linked OK` (và optional ephemeral follow-up).
10. Return `{ ok: true }`.
11. **Không** log `token`, `s` full; có thể log `openid` suffix + `source_endpoint`.

### 5.3 CORS

- Extension background POST: thường **không** dính CORS page.
- Nếu test từ page context: server cần  
  `Access-Control-Allow-Origin` (whitelist origin HQ hoặc `*` chỉ khi private + risk chấp nhận được)
  - `POST`, `Content-Type`.
- **Cấm** dựa vào `mode: 'no-cors'` cho production.

### 5.4 Rate limit (nên có)

- Theo IP: ví dụ 30 req/phút.
- Theo code: 5 attempt fail rồi lock code.
- Theo `discord_user_id`: không spam create claim.

---

## 6. Discord command `/df-link`

### 6.1 Subcommands gợi ý

| Subcommand          | Hành vi                                        |
| ------------------- | ---------------------------------------------- |
| `start` / default   | Tạo claim code, hướng dẫn + link mở HQ         |
| `status`            | Đã link? `openid` mask, `last_ok_at`, `status` |
| `unlink`            | `status = revoked`, xóa ciphertext (hoặc soft) |
| `manual` (optional) | Tech user dán openid+token + code (fallback)   |

### 6.2 Micro-steps `/df-link start`

1. Check user chưa bị rate-limit.
2. Invalidate claim `pending` cũ của user (nếu có).
3. Generate `code`.
4. Lưu claim session TTL.
5. Reply ephemeral (hoặc DM):
   - Code (monospace)
   - Nút link: `https://www.playdeltaforce.com/...` (URL HQ thật)
   - Hướng dẫn ngắn: cài extension → tab Link → dán code → Link
6. **Không** nhúng webhook localhost trong message production.

### 6.3 Sau claim thành công

- Bot nhận signal (cùng process: gọi hàm `notifyLinked(userId)`; hoặc queue).
- DM: “Đã liên kết tài khoản DF HQ.”
- Optional: thử 1 soft `GetMyData` / endpoint nhẹ → cập nhật `last_ok_at` hoặc `last_error`.

---

## 7. Extension — Link tab

### 7.1 Cấu trúc thư mục gợi ý

```text
df-toolbox/
├── manifest.json
├── background/
│   └── service-worker.js      # POST claim API
├── content/
│   ├── bootstrap.js           # inject panel + page-capture
│   ├── page-capture.js        # MAIN world hooks (web_accessible)
│   └── panel.css
├── modules/
│   ├── redeem/                # giữ logic redeem cũ
│   └── link/
│       ├── panel.js           # UI claim code + trạng thái
│       └── capture-bridge.js  # postMessage ↔ background
└── popup/                     # optional
```

### 7.2 Manifest (ý chính)

- `manifest_version: 3`
- `content_scripts` matches HQ host
- `background.service_worker`
- `host_permissions`: HQ + `PUBLIC_BASE_URL` origin
- `web_accessible_resources`: `page-capture.js`

### 7.3 Capture logic (port từ userscript research)

**Giữ:**

- Hook `window.fetch` khi URL chứa `DfTools`
- Hook `XMLHttpRequest.open/send`
- Optional: `performance.getEntriesByType('resource')` scan URL đã load
- Extract query: `openid`, `token`, `ts`, `s`, `u`, …

**Bỏ / đổi:**

- `WEBHOOK_URL` / `CODE` hardcode trong script
- `mode: 'no-cors'`
- `console.log` token preview trên bản ship
- “Gửi token dài nhất mọi endpoint” như mục tiêu vô hạn — MVP: **first valid openid+token** hoặc whitelist endpoint bot cần

### 7.4 Micro-steps UI Link tab

1. User mở HQ (đúng host match) → panel hiện.
2. Ô nhập **Claim code**.
3. Nút **Link** / tự động khi đã có credential trong memory session.
4. Content script nhận credential từ MAIN world qua `postMessage` (origin check).
5. Gửi message tới service worker: `{ type: 'DF_CLAIM', code, credential }`.
6. Service worker `fetch(PUBLIC_BASE_URL + '/api/df/claim', { method:'POST', headers:{'Content-Type':'application/json'}, body })`.
7. UI: `Đang gửi…` → `Thành công — kiểm tra DM Discord` / `Mã không hợp lệ` / `Lỗi mạng`.
8. Không lưu token vào `chrome.storage` lâu dài (hoặc chỉ cache vài phút optional).

### 7.5 Cài đặt cho non-tech (private)

| Cách                               | Phù hợp        |
| ---------------------------------- | -------------- |
| Chrome Web Store (nếu public được) | Tốt nhất       |
| Load unpacked + doc 5 bước có ảnh  | Private server |
| File `.crx` ký nội bộ              | Team nhỏ       |

Hướng dẫn user **chỉ**: Cài extension → Discord lấy code → Mở HQ → Dán code → Link.

---

## 8. Public URL (giải multi-máy)

### 8.1 Vấn đề

```text
User máy B  ──X──>  http://127.0.0.1:PORT  (máy A / dev)
```

Encryption **không** sửa được. Phải có:

```text
User máy B  ────>  https://fixed-host/.../api/df/claim  ────>  Bot process
```

### 8.2 Micro-steps Cloudflare Named Tunnel (ví dụ)

1. Cài `cloudflared` trên máy chạy bot.
2. `cloudflared tunnel login`.
3. Tạo named tunnel, map `https://df-bot.yourdomain.com` → `http://127.0.0.1:BOT_PORT`.
4. Chạy tunnel daemon (service systemd / docker).
5. Set `PUBLIC_BASE_URL=https://df-bot.yourdomain.com`.
6. Extension + bot dùng **cùng** base URL.
7. Test từ điện thoại 4G: `curl -X POST https://df-bot.../api/df/claim -d '{}'` → phải về 400 chứ không timeout.

### 8.3 Checklist “đã hết lỗi khác mạng”

- [ ] URL không chứa `localhost` / `127.0.0.1`
- [ ] HTTPS (trang HQ HTTPS → tránh mixed content nếu gọi từ page; background extension vẫn nên HTTPS)
- [ ] URL **không đổi** mỗi lần restart (named tunnel / VPS)
- [ ] Bot process + tunnel cùng uptime policy

---

## 9. Thứ tự triển khai (micro roadmap)

### Phase 0 — Research (đã có một phần)

- [x] Userscript bắt được `openid` + `token` từ DfTools
- [ ] Reuse token ngoài browser trên **đúng** endpoint bot cần
- [ ] Ghi nhận scope / lỗi hết hạn
- [ ] Quan sát `ts`/`s` trên ≥3 request (không block Phase 1)

### Phase 1 — Claim path server (bắt buộc trước extension)

1. Thêm bảng `df_account_bindings` + migration.
2. Env `DF_CRED_KEY_V1`, helper `encryptCredential` / `decryptCredential`.
3. Claim store (Map + TTL cleanup interval).
4. `POST /api/df/claim` + CORS/rate limit tối thiểu.
5. `/df-link start` tạo code + hướng dẫn tạm (kể cả manual POST bằng curl).
6. Publish **PUBLIC_BASE_URL** (tunnel/VPS).
7. Test curl từ mạng khác.

### Phase 2 — Extension Link MVP

1. Skeleton MV3 + panel tab Link.
2. Port hook MAIN world (không log token).
3. Background POST claim.
4. UX trạng thái thành công/thất bại.
5. Nội bộ: 2–3 user non-tech thử theo doc 5 bước.

### Phase 3 — DfToolsClient

1. `getBinding(discordUserId)` + decrypt.
2. Profile endpoint tối thiểu (1–2 API thật dùng).
3. Slash command đọc data (profile/daily/…).
4. Xử lý `status = expired` khi API reject → bảo user `/df-link` lại.

### Phase 4 — Hardening

1. Tắt mọi log credential.
2. Unlink / status.
3. Key version field sẵn sàng rotate.
4. Gộp Redeem \| Link polish UI.
5. Gỡ / đánh dấu deprecated console userscript trong `/df-link`.

---

## 10. Test cases

### 10.1 Claim & crypto

| ID  | Case              | Steps                                | Expected                                      |
| --- | ----------------- | ------------------------------------ | --------------------------------------------- |
| C01 | Happy path        | Tạo code → POST đủ field → DB        | 200, row active, ciphertext ≠ plaintext token |
| C02 | Sai code          | POST code random                     | 401 `invalid_code`, không ghi DB              |
| C03 | Hết hạn           | Tạo code, chờ TTL, POST              | 401                                           |
| C04 | Double consume    | POST 2 lần cùng code                 | Lần 1: 200; lần 2: 401                        |
| C05 | Thiếu token       | POST không `token`                   | 400                                           |
| C06 | Decrypt + AAD     | Encrypt rồi decrypt đúng AAD         | Plaintext khớp                                |
| C07 | Sai AAD           | Đổi discord_id trong AAD khi decrypt | Throw / fail                                  |
| C08 | Tamper ciphertext | Đổi 1 byte ciphertext                | Decrypt fail                                  |
| C09 | Không log token   | Chạy C01, grep log                   | Không có full token                           |

### 10.2 Multi-máy / network

| ID  | Case                    | Steps                                            | Expected                             |
| --- | ----------------------- | ------------------------------------------------ | ------------------------------------ |
| N01 | Localhost từ máy khác   | POST `http://127.0.0.1:...` từ host khác         | **Fail** (đây là bug cũ — phải fail) |
| N02 | Public URL từ 4G        | POST `PUBLIC_BASE_URL/api/df/claim` body invalid | 400 nhanh, không timeout             |
| N03 | Extension trên máy user | User nhà, bot + tunnel online                    | Link OK, nhận DM                     |

### 10.3 Extension capture

| ID  | Case                    | Steps                | Expected                             |
| --- | ----------------------- | -------------------- | ------------------------------------ |
| E01 | HQ đã login, có DfTools | Mở trang trigger API | Bắt được openid+token                |
| E02 | Chưa login HQ           | Mở HQ                | UI: chưa có credential / hướng login |
| E03 | Code đúng + đã capture  | Bấm Link             | 200, DM                              |
| E04 | Code sai                | Bấm Link             | UI invalid_code                      |
| E05 | Không còn console       | User không mở F12    | Vẫn link được                        |

### 10.4 DfToolsClient (sau Phase 3)

| ID  | Case                  | Steps                         | Expected                                 |
| --- | --------------------- | ----------------------------- | ---------------------------------------- |
| D01 | Reuse credential      | Decrypt + gọi endpoint đã bắt | 2xx hoặc JSON hợp lệ                     |
| D02 | Endpoint khác profile | Gọi endpoint chỉ cần u/a/ts/s | Không nhét token bừa                     |
| D03 | Token hết hạn         | Sau thời điểm fail            | `status=expired`, user được báo link lại |
| D04 | User chưa link        | Command data                  | Message “chưa liên kết”                  |

### 10.5 Security regression

| ID  | Case                                         | Expected                                                |
| --- | -------------------------------------------- | ------------------------------------------------------- |
| S01 | Response claim không chứa token              | Body chỉ `ok` / `error`                                 |
| S02 | Discord message không chứa token             | DM chỉ status                                           |
| S03 | DB file không chứa substring token plaintext | `strings`/`grep` token sample → không hit plaintext cột |

---

## 11. Prototype userscript — phạm vi

Script console (hook fetch/XHR/perf) **chỉ** để:

- Chứng minh capture được param từ HQ.
- Hỗ trợ Phase 0 research.

**Không** ship cho end user. Khi port extension:

| Userscript          | Extension                      |
| ------------------- | ------------------------------ |
| `@@WEBHOOK_URL@@`   | Config `PUBLIC_BASE_URL`       |
| `@@CLAIM_CODE@@`    | Input panel                    |
| `mode: 'no-cors'`   | Background `fetch` bình thường |
| `log token preview` | Tắt                            |
| Gửi ngay token đầu  | MVP OK; sau filter endpoint    |

---

## 12. Quyết định đã chốt (quick reference)

| Chủ đề          | Quyết định                                          |
| --------------- | --------------------------------------------------- |
| UX non-tech     | Chrome extension panel trên HQ                      |
| Multi-máy       | HTTPS **cố định** (Named Tunnel / VPS)              |
| Discord webhook | Không dùng ingestion token                          |
| Mã hóa          | AES-256-GCM, key env, AAD bind user+openid          |
| bcrypt          | Không cho token API                                 |
| DB              | `AccountBinding` abstraction, không chỉ 3 cột phẳng |
| Client API      | Endpoint profiles, không `call(token)` một tham số  |
| `s` / expiry    | Research song song; không block Claim + encrypt     |
| Redeem + Link   | Một extension, hai tab, module tách                 |

---

## 13. Định nghĩa “xong MVP Link”

User non-tech, **máy và mạng khác** máy dev:

1. Cài extension (theo doc).
2. Trong Discord: `/df-link` → nhận code.
3. Mở HQ đã login.
4. Tab Link → dán code → Link.
5. Nhận DM thành công.
6. (Optional) một lệnh bot đọc được 1 field từ API HQ.

Không đạt (5) vì timeout/localhost → **chưa** xong phần infra.  
Không đạt vì phải F12 → **chưa** xong phần extension.

---

## 14. Phụ lục — checklist deploy một lần

```text
[ ] DF_CRED_KEY_V1 trong env (32-byte base64)
[ ] PUBLIC_BASE_URL https cố định
[ ] Tunnel/VPS trỏ đúng port bot
[ ] POST /api/df/claim reachable từ mạng ngoài
[ ] Bảng df_account_bindings migrated
[ ] /df-link start tạo code TTL
[ ] Extension host_permissions khớp HQ + claim origin
[ ] Không log token trên bot & extension production
[ ] Test N02 + E03 + C01 pass
```

---

_Tài liệu này là đặc tả triển khai nội bộ. Cập nhật khi đã khóa lifecycle token / công thức `s` / danh sách endpoint profile production._
