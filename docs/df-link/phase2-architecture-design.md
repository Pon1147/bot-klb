# Phase 2 — Architecture Design

> **Ngày:** 2026-08-03
> **Version:** r2 (khớp `df-link-architecture-guide.md` r2)
> **Trạng thái:** Design draft — awaiting review
> **Dựa trên:** guide r2 + phase1-research-report.md + current codebase
> **Nguyên tắc:** Observation ≠ Assumption. `s`/`ts` không commit persistent đến R5.

---

## Overview: 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Extension (DF Toolbox)                                   │
│  HQ session → MAIN capture → Content validate → SW → POST claim    │
│  Không: lưu credential dài hạn, không business logic Discord       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS POST /api/df/claim
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — Claim API (SECURITY BOUNDARY)                            │
│  validate code → ATOMIC consume → encrypt (AES-GCM) → persist      │
│  Không: gọi DfTools business API                                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ encrypted AccountBinding
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — DfTools Client                                           │
│  load binding → decrypt → request per endpoint profile → data      │
│  Không: biết credential đến từ extension hay manual                │
└─────────────────────────────────────────────────────────────────────┘
```

**Lưu ý quan trọng:** `DfToolsClient` **không phụ thuộc extension**. Có thể test Layer 3 độc lập:

```
Fixture credential → DB/in-memory binding → DfToolsClient → API
```

---

## 1. Layer 1 — Extension Architecture

### 1.1 Directory Structure

```
extensions/df-toolbox/
├── manifest.json                    # MV3 manifest
├── background/
│   └── sw.js                        # Service Worker — POST claim ONLY
├── content/
│   ├── page-capture.js              # MAIN world — capture only
│   └── panel.css                    # UI styles
├── panels/
│   ├── link.html                    # Link tab UI
│   └── redeem.html                  # Redeem tab UI (reuses existing)
└── modules/
    ├── link/
    │   ├── bridge.js                # Content script (isolated) — validate + handoff
    │   └── panel.js                 # Panel logic — show code, handle submit
    └── redeem/
        └── panel.js                 # Existing redeem logic (import)
```

### 1.2 Security Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│ MAIN world (page-capture.js)                                 │
│  ✓ Hook fetch/XHR/performance                                │
│  ✓ Extract query params from DfTools URLs                    │
│  ✗ NO HTTP calls to external services                        │
│  ✗ NO access to claim code or Discord user ID                │
│  ↓ postMessage({ type: 'DF_CREDENTIALS', params })           │
├──────────────────────────────────────────────────────────────┤
│ Isolated content script (bridge.js)                          │
│  ✓ Validate message shape & origin                           │
│  ✓ Show UI panel with claim code                             │
│  ✓ Receive claim code from user                              │
│  ✗ NO direct credential access beyond validation             │
│  ↓ chrome.runtime.sendMessage({ type, code, params })        │
├──────────────────────────────────────────────────────────────┤
│ Service Worker (sw.js)                                       │
│  ✓ HTTPS POST to Claim API (TLS)                             │
│  ✓ Receive { ok: true } response                             │
│  ✗ NO credential persistence                                 │
│  ✗ NO access to Discord bot internals                        │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Message Protocol

```typescript
// MAIN → Content (postMessage)
interface CredentialMessage {
  type: 'DF_CREDENTIALS';
  source: string; // 'fetch' | 'xhr' | 'performance'
  params: {
    openid: string;
    token: string;
    ts?: string;
    s?: string;
    u?: string;
  };
}

// Content → SW (chrome.runtime.sendMessage)
interface ClaimRequest {
  type: 'DF_CLAIM_REQUEST';
  code: string; // User-entered claim code
  params: {
    openid: string;
    token: string;
    ts?: string;
    s?: string;
    u?: string;
  };
  source: string;
}

// SW → Claim API (fetch, HTTPS)
interface ClaimRequestBody {
  code: string;
  openid: string;
  token: string;
  ts?: string;
  s?: string;
  u?: string;
}

interface ClaimResponseBody {
  ok: boolean;
  error?: string;
}
```

**Ghi chú:** `source_endpoint` là research telemetry, **không** nằm trong production binding. Nếu cần capture, ghi riêng vào `credential_capture_events` table.

### 1.4 Capture Logic (page-capture.js)

```typescript
// Hook fetch
const originalFetch = window.fetch;
window.fetch = async function (url, ...args) {
  const urlStr = url.toString?.() ?? String(url);
  if (urlStr.includes('/DfTools/')) {
    const params = extractDfToolsParams(urlStr);
    if (isValidCredential(params)) {
      window.postMessage(
        {
          type: 'DF_CREDENTIALS',
          source: 'fetch',
          params: {
            openid: params.openid,
            token: params.token,
            ts: params.ts,
            s: params.s,
            u: params.u,
          },
        },
        '*',
      );
    }
  }
  return originalFetch.apply(this, [url, ...args]);
};

// Hook XHR (similar pattern)
// Scan performance entries (fallback)
```

### 1.5 Manifest V3

```json
{
  "manifest_version": 3,
  "name": "DF Toolbox",
  "version": "0.1.0",
  "description": "Delta Force HQ credential bridge",
  "permissions": [],
  "host_permissions": [
    "https://www.playdeltaforce.com/*",
    "https://sg-act.playerinfinite.com/*"
  ],
  "background": {
    "service_worker": "background/sw.js"
  },
  "content_scripts": [
    {
      "matches": ["*://www.playdeltaforce.com/*"],
      "js": ["content/page-capture.js"],
      "world": "MAIN"
    },
    {
      "matches": ["*://www.playdeltaforce.com/*"],
      "js": ["modules/link/bridge.js"],
      "world": "ISOLATED"
    }
  ],
  "action": {
    "default_popup": "panels/link.html",
    "default_title": "DF Toolbox — Link"
  }
}
```

---

## 2. Layer 2 — Claim API Architecture

### 2.1 Endpoint

```http
POST {PUBLIC_BASE_URL}/api/df/claim
Content-Type: application/json
Max body: 4KB

{
  "code": "AB12CD34",
  "openid": "...",
  "token": "...",
  "ts": "...",
  "s": "...",
  "u": "..."
}
```

**Requirements bắt buộc:**
- `Content-Type: application/json` validation
- Max body size limit (4KB) → 413 nếu vượt
- Timeout: 10s
- TLS only (HTTPS)

### 2.2 Handler Flow (ATOMIC)

```
1. Parse + validate body:
   - Content-Type = application/json
   - Body size ≤ 4KB
   - Presence: code, openid, token
   → Reject 400 nếu thiếu

2. ATOMIC consume + persist (transaction):
   BEGIN
     SELECT claim WHERE code=? AND status='pending' AND expires_at > now
       -- lock / immediate transaction
     UPDATE claim SET status='consumed', consumed_at=now
       -- reject nếu row affected = 0 (đã consumed bởi request khác)
     Encrypt credential blob (AES-256-GCM)
     INSERT/UPDATE AccountBinding (status='active')
   COMMIT

3. Notify Discord → DM user "Linked successfully"

4. Return { ok: true }
```

**Parallel safety:** Hai POST song song cùng code → chỉ một thành công (atomic).

### 2.3 Rate Limiting

| Scope | Limit | Method |
|-------|-------|--------|
| Per IP | 5 req/min | Token bucket in-memory |
| Per code (fail) | 3 attempts | Track in claim session |
| Per `/df-link start` | 1 pending | Invalidate old code on new start |

### 2.4 Response Codes

| HTTP | Body | When |
|------|------|------|
| 200 | `{ "ok": true }` | Success |
| 400 | `{ "ok": false, "error": "invalid_body" }` | Missing fields / bad Content-Type |
| 401 | `{ "ok": false, "error": "invalid_code" }` | Code not found / expired / consumed |
| 413 | `{ "ok": false, "error": "body_too_large" }` | Body > 4KB |
| 429 | `{ "ok": false, "error": "rate_limited" }` | Too many attempts |
| 500 | `{ "ok": false, "error": "server_error" }` | Unexpected failure |

### 2.5 Binding ACTIVE vs Capture Candidate

```
MVP capture (extension):
  credential CANDIDATE đầu tiên có openid + token
  (chưa gọi là "credential hợp lệ production")

MVP binding ACTIVE:
  chỉ sau khi server-side validation thành công
  với ÍT NHẤT một endpoint đã xác định trong Phase 1
```

Không đánh dấu "hợp lệ mãi" chỉ vì parse được query string.

---

## 3. Database Schema

### 3.1 `df_claim_sessions` (ephemeral, replaces in-memory TTLStore)

```sql
CREATE TABLE df_claim_sessions (
  code TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'consumed', 'expired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME,
  fail_count INTEGER DEFAULT 0
);

CREATE INDEX idx_claim_expires ON df_claim_sessions(expires_at);
```

**Luật:**
- Random code + short-lived (10–15 phút) + one-time + bound to Discord user
- Consume phải atomic (transaction)
- Optional: user chỉ 1 code `pending` (mới invalidate cũ)

### 3.2 `df_account_bindings` (production persistent)

```sql
CREATE TABLE df_account_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'garena',
  platform TEXT NOT NULL DEFAULT 'df_hq',
  openid TEXT NOT NULL,              -- identifier (plaintext OK nhưng hạn chế log)
  cred_nonce TEXT NOT NULL,          -- 12 bytes hex (IV cho AES-GCM)
  cred_ciphertext TEXT NOT NULL,     -- AES-256-GCM encrypted
  cred_tag TEXT NOT NULL,            -- 16 bytes auth tag (hex)
  key_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'expired', 'revoked')),
  captured_at DATETIME,
  last_ok_at DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_binding_user ON df_account_bindings(discord_user_id);
CREATE INDEX idx_binding_status ON df_account_bindings(status);
```

**Quyết định từ guide r2:**
- **Không** bắt buộc `source_endpoint` trong production binding
- `openid` = identifier, lưu plaintext được nhưng vẫn hạn chế log
- `cred_nonce` + `cred_ciphertext` + `cred_tag` = AES-256-GCM output

### 3.3 `credential_capture_events` (telemetry research, optional)

```sql
CREATE TABLE credential_capture_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT,
  endpoint TEXT,              -- tên endpoint quan sát được
  captured_at DATETIME,
  credential_fingerprint TEXT, -- hash ngắn / length — không phải secret
  notes TEXT
);
```

**AccountBinding ≠ research log.** Tách biệt rõ ràng. Table này chỉ phục vụ Phase 1 research.

### 3.4 Migration: df_tokens → df_account_bindings

```sql
-- Backfill từ plaintext tokens hiện có
INSERT OR IGNORE INTO df_account_bindings
  (discord_user_id, openid, cred_nonce, cred_ciphertext, cred_tag,
   key_version, status, captured_at)
SELECT
  discord_id,
  openid,
  lower(hex(randomblob(12))),  -- random nonce
  token,                        -- plaintext → cần re-encrypt trên next use
  '',                           -- empty tag → set khi re-encrypt
  'v1',
  'active',
  linked_at
FROM df_tokens;
```

**Strategy:**
1. Tạo `df_claim_sessions` + `df_account_bindings` (mới, không ảnh hưởng)
2. Backfill từ `df_tokens`
3. Cập nhật code dùng `df_account_bindings`
4. Sau 2 tuần verification → drop hoặc deprecate `df_tokens`

---

## 4. Crypto Module (AES-256-GCM)

### 4.1 Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Algorithm | `aes-256-gcm` | — |
| Key size | 32 bytes | `DF_CRED_KEY_V1` env var (Base64) |
| Nonce size | 12 bytes | `crypto.randomBytes(12)` |
| Tag size | 16 bytes | Auto from GCM |
| AAD | `garena|df_hq|{discord_user_id}|{openid}` | Computed |

### 4.2 Interface

```typescript
interface CryptoHelpers {
  encrypt(
    plaintext: string,
    discordUserId: string,
    openid: string,
  ): { nonce: string; ciphertext: string; tag: string }

  decrypt(
    nonce: string,
    ciphertext: string,
    tag: string,
    discordUserId: string,
    openid: string,
  ): string

  verifyKey(): boolean
}
```

### 4.3 Encrypt

```typescript
function encrypt(plaintext, discordUserId, openid): { nonce, ciphertext, tag } {
  const key = Buffer.from(process.env.DF_CRED_KEY_V1, 'base64');
  const nonce = crypto.randomBytes(12);
  const aad = Buffer.from(`garena|df_hq|${discordUserId}|${openid}`);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);

  const ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    nonce: nonce.toString('hex'),
    ciphertext,
    tag,
  };
}
```

### 4.4 Decrypt

```typescript
function decrypt(nonce, ciphertext, tag, discordUserId, openid): string {
  const key = Buffer.from(process.env.DF_CRED_KEY_V1, 'base64');
  const nonceBuf = Buffer.from(nonce, 'hex');
  const tagBuf = Buffer.from(tag, 'hex');
  const aad = Buffer.from(`garena|df_hq|${discordUserId}|${openid}`);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonceBuf);
  decipher.setAAD(aad);
  decipher.setAuthTag(tagBuf);

  const decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  return decrypted + decipher.final('utf8');
}
```

---

## 5. Layer 3 — DfTools Client Architecture

### 5.1 Current Problem

Current `deltaforce.api.ts` sends ALL params (`openid`, `token`, `ts`, `s`, `u`) to EVERY endpoint uniformly. Guide says different endpoints may need different parameter combinations.

### 5.2 Endpoint Profiles

```typescript
interface DfEndpointProfile {
  path: string;
  requiredParams: string[];
  optionalParams?: string[];
  bodyTemplate?: Record<string, unknown>;
}

const ENDPOINT_PROFILES: Record<string, DfEndpointProfile> = {
  MY_DATA: {
    path: '/GetMyData',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: { seasonno: SEASONS_MY_DATA },
  },
  MATCH_LIST: {
    path: '/GetMatchList',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: { seasonno: [SEASON_LATEST] },
  },
  COLLECTION: {
    path: '/GetDahongCollection',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: {},
  },
  DAILY_REPORT: {
    path: '/GetDailyReport',
    requiredParams: ['openid', 'token', 'ts'],
    optionalParams: ['s', 'u'],
    bodyTemplate: {},
  },
  // Future (research only until R5):
  // PRIVATE_ROOM_KEY: {
  //   path: '/GetPrivateRoomKey',
  //   requiredParams: ['u', 'a', 'ts', 's'],  // No token!
  //   bodyTemplate: {},
  // },
};
```

### 5.3 DfToolsClient Interface

```typescript
class DfToolsClient {
  constructor(private binding: AccountBindingRow) {}

  // Load and decrypt credential
  private async getCredential(): Promise<DfCredential>

  // Request using endpoint profile
  async request<T>(
    endpointKey: keyof typeof ENDPOINT_PROFILES,
    extraParams?: Record<string, string>,
  ): Promise<DfApiResponse<T>>

  // Convenience methods
  async getMyData(seasonNos?: number[]): Promise<DfApiResponse<DfPlayerInfo>>
  async getMatchList(offset?: number, limit?: number): Promise<DfApiResponse<DfMatchListResponse>>
  async getCollection(): Promise<DfApiResponse<DfCollectionResponse>>
  async getDailyReport(): Promise<DfApiResponse<DfDailyReportResponse>>

  // Health check — xác nhận binding ACTIVE
  async verifyCredential(): Promise<boolean>
}
```

### 5.4 Request Construction

```typescript
async request<T>(endpointKey, extraParams?): Promise<DfApiResponse<T>> {
  const profile = ENDPOINT_PROFILES[endpointKey];
  const cred = await this.getCredential();

  const params = new URLSearchParams();
  params.set('game_id', GAME_ID);
  params.set('channel', DF_CHANNEL);
  params.set('account_type', ACCOUNT_TYPE);
  params.set('a', ACCOUNT_A_PARAM);
  params.set('lang_type', LANG_TYPE);

  // Add required params from credential
  for (const p of profile.requiredParams) {
    if (cred[p] !== undefined) params.set(p, cred[p]);
  }
  // Add optional params
  for (const p of profile.optionalParams ?? []) {
    if (cred[p] !== undefined) params.set(p, cred[p]);
  }
  // u = unique per request
  params.set('u', crypto.randomUUID());

  const body = { ...profile.bodyTemplate, ...extraParams };
  const response = await this.axios.post(profile.path, body, { params });
  return response.data;
}
```

### 5.5 Test DfToolsClient Độc Lập

```
Fixture credential → DB/in-memory binding → DfToolsClient → API
```

Không cần extension để test Layer 3. Dùng fixture credential trong DB hoặc in-memory binding object.

---

## 6. File Structure (Changes)

```
src/
├── services/
│   ├── df-claim.api.ts              # NEW: Claim API handler (atomic)
│   ├── df-crypto.ts                 # NEW: AES-256-GCM helpers
│   └── deltaforce.api.ts            # MODIFIED: DfToolsClient class
├── database/
│   ├── df-claim.db.ts               # NEW: Claim sessions table
│   ├── df-binding.db.ts             # NEW: Account bindings table
│   └── df-telemetry.db.ts           # NEW: Capture events (research)
├── server/
│   ├── webhook.routes.ts            # MODIFIED: POST /api/df/claim
│   └── webhook-server.ts            # MODIFIED: Add max body + rate limit
├── commands/
│   └── df/
│       ├── link.command.ts          # MODIFIED: Update to new flow
│       └── unlink.command.ts        # MODIFIED: Update to binding model
├── utils/
│   └── df-binding.utils.ts          # NEW: Binding CRUD helpers
└── types/
    └── deltaforce.types.ts          # MODIFIED: Add AccountBindingRow, DfCredential

extensions/df-toolbox/               # NEW: Chrome extension
├── manifest.json
├── background/sw.js
├── content/page-capture.js
├── panels/link.html
└── modules/link/
    ├── bridge.js
    └── panel.js
```

---

## 7. Integration Points

### 7.1 Boot Sequence Changes

```typescript
// src/index.ts
initializeClaimSessionsTable(database);       // NEW
initializeAccountBindingsTable(database);      // NEW
initializeCaptureEventsTable(database);        // NEW (optional)

if (!verifyDfCryptoKey()) {
  console.error('DF_CRED_KEY_V1 not configured or invalid length');
  process.exit(1);
}
```

### 7.2 Existing Code Impact

| File | Change | Description |
|------|--------|-------------|
| `df-token.db.ts` | DEPRECATE | Keep for migration, new code uses `df-binding.db.ts` |
| `df-claim-store.ts` | MODIFIED | Replace in-memory TTLStore with DB-backed sessions |
| `webhook.routes.ts` | REWRITE | New Claim API handler with encryption + atomic consume |
| `link.command.ts` | REWRITE | New extension-based flow |
| `unlink.command.ts` | MODIFIED | Update to binding model |
| `deltaforce.api.ts` | REWRITE | DfToolsClient with endpoint profiles |
| `df-guards.ts` | MODIFIED | `requireDfToken()` → `requireDfBinding()` |
| `df-command.runner.ts` | MODIFIED | Use DfToolsClient instead of raw axios |

---

## 8. Open Questions

| # | Question | Impact | Recommendation |
|---|----------|--------|----------------|
| Q1 | Drop `df_tokens` ngay hay giữ 2 tuần? | Migration risk | Giữ 2 tuần, sau drop |
| Q2 | TTL claim session? | Security vs UX | 10–15 phút (như hiện tại) |
| Q3 | Multiple bindings per user? | DB complexity | Single binding (UNIQUE constraint) |
| Q4 | Xử lý plaintext token cũ khi migrate? | Data loss | Migrate as-is, re-encrypt trên next use |
| Q5 | Extension build process? | Dev workflow | Không build step — plain JS files |
| Q6 | Phân phối extension? | User onboarding | .crx download + sideloading |

---

_Design draft r2 — awaiting review before Phase 3 Security implementation._
