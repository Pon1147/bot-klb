# BOT-KLB — TARGETED FINDINGS INDEPENDENT VERIFICATION REPORT

**Audit Date:** 2026-11-10  
**Repository:** `discord-bot-klb`  
**Commit / Base:** `6993105` (`fix/pay-create-components-v2-flags`)  
**Auditor:** Senior Software Architect, Security & QA Auditor  
**Operating Mode:** Read-Only Source Inspection (No Code/Dependency/Database Modifications)

---

## Executive Summary of Verification

An independent, evidence-based verification of the 7 findings identified in the latest repository audit was conducted against the repository source code, AST references, database queries, and test fixtures.

| # | Audit Finding | Verdict | Key Technical Conclusion |
| :--- | :--- | :--- | :--- |
| **1** | Unlink does not delete legacy plain tokens | **DISPROVEN** | `revokeBindingAsync()` explicitly calls `deleteDfToken(database, discordUserId)` in both SQLite update branches (lines 339 & 358). Legacy tokens are already wiped on unlink. |
| **2** | `stats-select.handler.ts` skips key version in decryption | **CONFIRMED** | `decryptCredential()` is called without `binding.key_version`, defaulting to `'v1'`. If rotated keys are used, decryption fails and falls back to stale `df_tokens`. |
| **3** | npm audit security advisories (28 advisories) | **PARTIALLY CONFIRMED** | Vulnerabilities exist in `axios@1.19.0` and transitive `undici@6.28.0`. However, `@payos/node` is NOT installed (PayOS is natively implemented via standard `fetch`). `axios` is only used in `deltaforce.api.ts`. |
| **4** | Coverage failure on `df-claim-store.ts` | **CONFIRMED** | `runDbCleanup()` (lines 50–66, 131, 176–177) runs inside a 5-minute background interval. Existing tests never advance fake timers to trigger the interval callback, dropping branch coverage to 54.54% against a 100% threshold. |
| **5** | `extractToken` dead code & timer leak | **CONFIRMED** | Zero references exist across `src/`, `scripts/`, `__tests__/`, and extension files. If `page.goto` fails, its 20s internal timer is never cleared, creating an unhandled promise rejection. |
| **6** | In-memory state breaks under horizontal scale | **PARTIALLY CONFIRMED** | Bot is deployed as a single Node.js container on Railway with no horizontal replicas (standard non-sharded Discord Gateway cannot run multi-replica). The immediate risk is RAM state wipe on container restart/crash, not multi-node split-brain. |
| **7** | `requireDfBinding` redundant query & replacement | **PARTIALLY DISPROVEN** | Replacing `requireDfBinding` with `resolveUserDfToken()` would break unlinking for users with corrupted bindings and alter error feedback. Eager query of `getDfToken` can be fixed via short-circuit evaluation (`!binding && !getDfToken(...)`). |

---

## Detailed Findings Verification

### 1. Legacy Token Cleanup on Unlink

- **Initial Audit Claim:** `/df unlink` calls `revokeBindingAsync` to revoke `df_account_bindings`, but fails to remove records from `df_tokens`, leaving legacy plaintext tokens active and retrievable via `resolveUserDfToken()`.
- **Verdict:** **DISPROVEN**

#### Evidence & Exact Source Locations
- `src/features/delta-force/unlink.handler.ts:24`:
  ```typescript
  const revokeResult = await revokeBindingAsync(database, interaction.user.id);
  ```
- `src/database/df-binding.db.ts:296-360`:
  ```typescript
  export async function revokeBindingAsync(
    database: Database.Database,
    discordUserId: string,
    expectedNonce?: string,
  ): Promise<{ success: boolean; error?: string }> {
    ...
    // 2. Runtime Cache (SQLite)
    let changes = 0;
    ...
    // 1. Khi SQLite conditional UPDATE trả về changes > 0:
    //    - Xóa token legacy
    //    - Trả về success
    if (changes > 0) {
      deleteDfToken(database, discordUserId); // LINE 339
      return { success: true };
    }

    // 2. Khi changes === 0:
    ...
    //    - Nếu bản ghi đã ở trạng thái inactive hoặc không tồn tại (chỉ có legacy token):
    //      xử lý theo hợp đồng idempotent unlink (xóa token legacy nếu có và trả về success)
    deleteDfToken(database, discordUserId); // LINE 358
    return { success: true };
  }
  ```
- `__tests__/database/df-binding.db.test.ts:390-396`:
  ```typescript
  saveDfToken(db, 'user-legacy-only', 'openid-legacy', 'tok-only');
  const result = await revokeBindingAsync(db, 'user-legacy-only');
  expect(result.success).toBe(true);
  expect(getDfToken(db, 'user-legacy-only')).toBeUndefined();
  ```

#### Execution Path
`Interaction (/df unlink)` $\rightarrow$ `unlink.handler.ts:execute()` $\rightarrow$ `revokeBindingAsync(database, userId)` $\rightarrow$ (Optional Mongo Revocation) $\rightarrow$ SQLite `df_account_bindings` set to `'revoked'` $\rightarrow$ **`deleteDfToken(database, discordUserId)`** (Lines 339 or 358).

#### Actual Impact
Legacy tokens are strictly and idempotently deleted whenever an account is unlinked. The previous audit looked only at `unlink.handler.ts` and assumed that because `deleteDfToken` was not imported in that single file, it was never called. Inspection of `revokeBindingAsync` disproves this claim.

#### Missing Evidence
None. Source code and automated test assertions explicitly confirm deletion.

#### Recommended Action
No code modification required. Close Finding 1 as Disproven.

---

### 2. Encryption Key Rotation in `stats-select.handler.ts`

- **Initial Audit Claim:** `stats-select.handler.ts` duplicates token resolution logic instead of reusing `resolveUserDfToken()`, and fails to pass `binding.key_version` into `decryptCredential()`.
- **Verdict:** **CONFIRMED**

#### Evidence & Exact Source Locations
- `src/features/delta-force/stats-select.handler.ts:93-119`:
  ```typescript
  try {
    const binding = getActiveBinding(database, targetUserId);
    if (binding) {
      const decrypted = decryptCredential(
        binding.cred_nonce,
        binding.cred_ciphertext,
        binding.cred_tag,
        binding.discord_user_id,
        binding.openid,
        // MISSING 6th argument: binding.key_version!
      );
      const cred = JSON.parse(decrypted);
      token = { ... };
    } else {
      token = getDfToken(database, targetUserId) ?? null;
    }
  } catch {
    token = getDfToken(database, targetUserId) ?? null; // Line 118: Falls back to plaintext token on decrypt failure
  }
  ```
- `src/services/df-crypto.ts:100-107`:
  ```typescript
  export function decryptCredential(
    nonce: string,
    ciphertext: string,
    tag: string,
    discordUserId: string,
    openid: string,
    keyVersion = 'v1', // Defaults to 'v1'
  ): string
  ```
- `src/utils/df-command.runner.ts:91-99`:
  ```typescript
  // Canonical implementation passes binding.key_version:
  const decrypted = decryptCredential(
    binding.cred_nonce,
    binding.cred_ciphertext,
    binding.cred_tag,
    binding.discord_user_id,
    binding.openid,
    binding.key_version, // Correctly supplied
  );
  ```
- `src/utils/df-token.utils.ts:21-34`:
  ```typescript
  // Canonical utility also correctly passes binding.key_version:
  export function resolveUserDfToken(database: Database.Database, userId: string): DfApiToken | null {
    try {
      const binding = getActiveBinding(database, userId);
      if (binding) {
        const decrypted = decryptCredential(
          binding.cred_nonce,
          binding.cred_ciphertext,
          binding.cred_tag,
          binding.discord_user_id,
          binding.openid,
          binding.key_version,
        );
  ```

#### Execution Path
User selects season in `/df stats` select menu $\rightarrow$ `stats-select.handler.ts` receives interaction $\rightarrow$ calls `decryptCredential` with default `keyVersion='v1'` $\rightarrow$ If binding was encrypted with rotated key (e.g. `'v2'`), `getKey('v1')` is used $\rightarrow$ GCM tag mismatch throws `Unsupported state or unable to authenticate data` $\rightarrow$ Catch block swallows error $\rightarrow$ Falls back to `getDfToken(database, targetUserId)` $\rightarrow$ Returns stale legacy token or null.

#### Actual Impact
- Breakage during key rotation: Whenever credentials are migrated to `v2` keys, stats dropdown menus fail for all migrated users.
- Stale data exposure: If a legacy token exists from before the binding, the user will unexpectedly query data using the old token instead of being prompted to re-authenticate.
- Code duplication: 30 lines of duplicated decryption and fallback logic exist in `stats-select.handler.ts`.

#### Missing Evidence
None. Code paths and argument mismatches are verified.

#### Recommended Fix
Replace lines 92–120 in `src/features/delta-force/stats-select.handler.ts` with:
```typescript
const apiToken = resolveUserDfToken(database, targetUserId);
if (!apiToken) {
  await sendReply(interaction, {
    content: 'Chưa liên kết tài khoản. Dùng `/df link start`.',
    flags: 64,
  });
  return { handled: true };
}
```
And remove line 143 (`const apiToken = buildDfApiToken(token);`).

#### Regression Tests Required
1. Unit test in `__tests__/df/df-stats.command.test.ts` verifying that `stats-select.handler.ts` successfully decrypts bindings with `key_version = 'v2'`.
2. Unit test verifying that when `resolveUserDfToken` returns null, the prompt "Chưa liên kết tài khoản" is returned with ephemeral flags.

---

### 3. Dependency Vulnerabilities (npm audit)

- **Initial Audit Claim:** 28 advisories exist. Older `axios` (v1.7.9) is pulled by `@payos/node` causing ReDoS/SSRF, and `undici` is vulnerable.
- **Verdict:** **PARTIALLY CONFIRMED**

#### Evidence & Exact Source Locations
- `package.json:44`: `"axios": "^1.17.0"` (Installed: `1.19.0`).
- `node_modules/axios/package.json`: version `1.19.0`.
- Audit scan: `npm audit --json` returns 28 total advisories (1 critical, 10 high, 10 moderate, 7 low).
- **PayOS Dependency Verification:**
  - `npm ls @payos/node` returns `(empty)`. `@payos/node` is **NOT installed**.
  - `src/services/payos.service.ts:148` natively uses Node.js global `fetch`:
    ```typescript
    const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', { ... });
    ```
- **Reachable Axios Path:**
  - `src/services/deltaforce.api.ts:1` directly imports `axios`:
    ```typescript
    import axios, { AxiosInstance } from 'axios';
    ```
  - `deltaforce.api.ts` makes outbound requests to `https://df.garena.vn/api/` using client credentials.
  - Advisory: GHSA-vh66-26gq-q6x8, GHSA-9fr6-4gfg-395g (Prototype pollution in default instance / fetch adapter). Patched in `1.20.0` / `1.21.0`.
- **Undici Path:**
  - `npm ls undici`:
    ```text
    `-- discord.js@14.27.0
      +-- @discordjs/rest@2.6.3
      | `-- undici@6.28.0 deduped
      `-- undici@6.28.0
    ```
  - Advisories: GHSA-rfgv-xxqx-mfg5, GHSA-xjj6-f33q-929c, GHSA-2m5v-pch6-74hx. Patched in `6.29.1+` / `6.30.0`.

#### Actual Impact
- **Axios:** Low practical exploitability in `bot-klb`. All URLs called by `deltaforce.api.ts` are hardcoded Garena API endpoints (`https://df.garena.vn/...`). User input is passed as sanitized query params (OpenID/tokens), not arbitrary URLs, preventing SSRF.
- **Undici:** Moderate exploitability. Handles all Discord REST API traffic and WebSocket connection via `discord.js`.

#### Missing Evidence
Verification of whether overriding `undici` to `6.29.1` or `axios` to `1.21.0` causes breaking changes with `discord.js@14.27.0`.

#### Recommended Fix
Do not run `npm audit fix --force` (which attempts to downgrade `jest` to `25.1.0` and destroys ESM support).  
Instead, apply controlled npm overrides in `package.json`:
```json
"overrides": {
  "axios": "^1.21.0"
}
```
And test compilation with `npm run check` and `npm test`. For `undici`, await upstream release from `@discordjs/rest` or verify that `undici@6.29.1` passes all 92 test suites before committing.

#### Regression Tests Required
Run all 92 test suites with overrides applied to confirm zero regressions in Discord REST calls and Garena API client calls.

---

### 4. Coverage Failure on `df-claim-store.ts`

- **Initial Audit Claim:** Branch coverage is 54.54% and function coverage is 66.66% against 100% thresholds in `jest.config.cjs` because `runDbCleanup()` background interval and error branches are not tested.
- **Verdict:** **CONFIRMED**

#### Evidence & Exact Source Locations
- `jest.config.cjs:48-53`:
  ```javascript
  'src/services/df-claim-store.ts': {
    branches: 100,
    functions: 100,
    lines: 96,
    statements: 96,
  },
  ```
- Coverage Report (`npx jest --coverage --collectCoverageFrom="src/services/df-claim-store.ts" __tests__/df/df-claim-store.test.ts`):
  ```text
  -------------------|---------|----------|---------|---------|-------------------
  File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
  -------------------|---------|----------|---------|---------|-------------------
   df-claim-store.ts |    81.7 |    54.54 |   66.66 |   83.33 | 50-66,131,176-177 
  -------------------|---------|----------|---------|---------|-------------------
  ```
- Uncovered lines in `src/services/df-claim-store.ts`:
  - **Lines 50–66 (`runDbCleanup` function):**
    ```typescript
    async function runDbCleanup(): Promise<number> {
      if (!claimDb || ('open' in claimDb && !claimDb.open)) return 0;
      if (cleanupInProgress) return cleanupInProgress;

      cleanupInProgress = (async () => {
        try {
          if (claimDb && (!('open' in claimDb) || claimDb.open)) {
            return cleanupExpiredClaimSessions(claimDb, 7);
          }
          return 0;
        } catch {
          return 0;
        } finally {
          cleanupInProgress = null;
        }
      })();

      return cleanupInProgress;
    }
    ```
  - **Line 131 (`startCleanup` interval callback):**
    ```typescript
    dbCleanupInterval = setInterval(() => {
      void runDbCleanup(); // LINE 131: Never invoked in tests
    }, CLAIM_CODE_CLEANUP_INTERVAL_MS);
    ```
  - **Lines 176–177 (`stopCleanup` in-flight wait error branch):**
    ```typescript
    if (cleanupInProgress) {
      try {
        await cleanupInProgress;
      } catch {
        // Bỏ qua trong quá trình shutdown // LINES 176-177
      }
    }
    ```
- Inspection of `__tests__/df/df-claim-store.test.ts`:
  - `startCleanup()` is tested, but `jest.advanceTimersByTime(CLAIM_CODE_CLEANUP_INTERVAL_MS)` is NEVER called while the interval is active.
  - The interval callback (Line 131) is therefore never triggered.
  - `cleanupInProgress` remains `null`, leaving lines 50–66 and 176–177 completely unvisited.

#### Execution Path
`startCleanup()` registers an interval with 5-minute delay (`CLAIM_CODE_CLEANUP_INTERVAL_MS = 300_000ms`). In unit tests, Jest executes synchronously without advancing virtual time past 300,000ms. The callback is never dispatched.

#### Actual Impact
`npm run test:coverage` crashes with exit code 1. CI pipelines fail on coverage threshold violation despite 100% test pass rate (1,162/1,162 tests passing).

#### Missing Evidence
None. The exact uncovered lines match `runDbCleanup()` and the interval trigger.

#### Recommended Fix
Do NOT lower coverage thresholds in `jest.config.cjs`.  
Add 2 targeted test cases in `__tests__/df/df-claim-store.test.ts`:
1. Use `jest.useFakeTimers()` to call `startCleanup(mockDb)` and execute `jest.advanceTimersByTime(300_000)` to trigger line 131 and lines 50–66.
2. Test `stopCleanup()` while an asynchronous cleanup operation is in flight (`cleanupInProgress`), covering lines 176–177.

#### Regression Tests Required
Execute `npx jest --coverage --collectCoverageFrom="src/services/df-claim-store.ts" __tests__/df/df-claim-store.test.ts` to confirm 100% statements, branches, functions, and lines are covered.

---

### 5. `extractToken` Dead Code & Timeout Leak

- **Initial Audit Claim:** `extractToken` in `src/services/deltaforce.scraper.ts:317-371` is completely unreferenced and leaks timer handles if `page.goto` fails.
- **Verdict:** **CONFIRMED**

#### Evidence & Exact Source Locations
- `src/services/deltaforce.scraper.ts:317-371`:
  ```typescript
  export async function extractToken(
    hqUrl: string,
    timeoutMs = 20000,
  ): Promise<{ openid: string; token: string } | null> {
    const puppeteer = await loadPuppeteer();
    let browser: PuppeteerBrowser | null = null;
    try {
      ...
      const tokenPromise = new Promise<{ openid: string; token: string }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Timeout: không tìm thấy token trong 20s')),
          timeoutMs,
        );
        ...
        page.on('request', (req: { url: () => string; continue: () => void }) => {
          if (url.includes('GetMyData')) {
            clearTimeout(timer); // Timer only cleared when request matches
            ...
          }
          req.continue();
        });
      });

      await page.goto(hqUrl, { waitUntil: 'networkidle2', timeout: HQ_PAGE_TIMEOUT }); // LINE 357: If this throws...
      const token = await tokenPromise;
      return token;
    } finally {
      if (browser) await browser.close(); // Browser closes, but timer is still running!
    }
  }
  ```
- Grep across the entire codebase (`git grep "extractToken"`):
  - `src/services/deltaforce.scraper.ts:317`: function definition.
  - Zero imports or callers in `src/`.
  - Zero references in `scripts/`.
  - Zero references in `__tests__/`.
  - Zero references in `garena-redeem-code/`.
  - Not exported in `package.json`.

#### Execution Path
If `extractToken()` is invoked and `page.goto` fails (e.g. timeout or DNS failure), execution jumps directly to `finally`, closes the browser, and rejects. However, `timer = setTimeout(..., 20000)` was registered on the Node.js event loop and is never cleared. After 20 seconds, the timer fires `reject(...)` on a promise that is no longer being listened to, emitting an `UnhandledPromiseRejection`.

#### Actual Impact
- Dead code bloat: 55 lines of dead browser automation code.
- Unnecessary Puppeteer dependency weight for token extraction (tokens are now delivered exclusively by the Chrome extension via `/api/v1/auth/claim`).

#### Missing Evidence
None.

#### Recommended Fix
Safely delete `extractToken()` (lines 317–371) from `src/services/deltaforce.scraper.ts`.

#### Regression Tests Required
Run `npm run check` and `npm test` to verify no compilation or runtime errors.

---

### 6. In-Memory State & Deployment Topology

- **Initial Audit Claim:** In-memory stores (`SimpleRateLimiter`, `TTLStore`, `df-claim-store`) cause desynchronization and rate-limit bypass when running across multiple processes.
- **Verdict:** **PARTIALLY CONFIRMED**

#### Evidence & Exact Source Locations
- `src/index.ts:10`:
  ```typescript
  * Delegates lifecycle orchestration to app/bootstrap và xử lý graceful shutdown trên Railway.
  ```
- `src/utils/rate-limiter.ts:10`: In-memory `Map<string, RateLimitEntry>`
- `src/utils/ttl-store.ts:8`: In-memory `Map<string, TTLEntry<T>>`
- `src/services/df-claim-store.ts:18`: In-memory `TTLStore<ClaimCodeEntry>`
- `src/features/team-find/team-find.service.ts:32`: In-memory `Map<string, TeamFindSession>`

#### Deployment Topology Analysis
1. **Actual Topology:** Single-container Node.js process deployed on Railway.
2. **Discord Gateway Constraints:** Standard Discord bots connect over a single WebSocket Gateway. Running multiple replicas of the bot with the same token without Discord Sharding causes session collision (`Error 4004: Authentication failed` or rapid gateway disconnects).
3. **Current Multi-Process Risk:** **Non-existent in current deployment**. There is only one process running. Rate limits and claim codes cannot be bypassed by routing to another process because no other process exists.
4. **Current Actual Risk (Process Restarts):** When Railway restarts the container (deployments, healthcheck failures, or crashes), in-memory state is wiped.
   - For claim codes: Mitigated by SQLite `df_claim_sessions` table.
   - For team-finding sessions: Any active search lobbies are lost on restart.
   - For rate limits: Cooldowns reset to zero on restart.

#### Missing Evidence
There is no Docker Swarm, Kubernetes cluster, or PM2 cluster configured in this repository.

#### Recommended Action
Add a `shortcut:` architectural comment in `src/utils/rate-limiter.ts` and `src/utils/ttl-store.ts` documenting that the in-memory store is designed for the current single-process Railway deployment, and that horizontal scaling will require Redis or MongoDB TTL integration.

---

### 7. `requireDfBinding` Guard & Semantic Comparison

- **Initial Audit Claim:** `requireDfBinding` runs two sequential queries (`getActiveBinding` and `getDfToken`) on every command and should be replaced by `resolveUserDfToken()`.
- **Verdict:** **PARTIALLY DISPROVEN**

#### Evidence & Exact Source Locations
- `src/utils/df-guards.ts:48-63`:
  ```typescript
  export async function requireDfBinding(
    interaction: ChatInputCommandInteraction,
    database: Database.Database,
  ): Promise<boolean> {
    const binding = getActiveBinding(database, interaction.user.id);
    const legacyToken = getDfToken(database, interaction.user.id); // LINE 53: Eager query

    if (!binding && !legacyToken) {
      const err = buildErrorContainer(
        'Bạn chưa liên kết tài khoản. Dùng `/df link start` để bắt đầu.',
      );
      await sendReply(interaction, { components: err.toJSON() });
      return true;
    }
    return false;
  }
  ```
- `src/utils/df-token.utils.ts:21-44`:
  ```typescript
  export function resolveUserDfToken(database: Database.Database, userId: string): DfApiToken | null {
    try {
      const binding = getActiveBinding(database, userId);
      if (binding) {
        // Tries to DECRYPT the credential with AES-256-GCM
        const decrypted = decryptCredential(...);
        ...
      }
    } catch {
      // Swallows error, falls back to legacy
    }
    ...
  }
  ```
- `src/features/delta-force/unlink.handler.ts:15-16`:
  ```typescript
  // Kiểm tra user đã link chưa (binding active hoặc legacy token)
  if (await requireDfBinding(interaction, database)) return;
  ```

#### Semantic Comparison: `requireDfBinding` vs `resolveUserDfToken`
1. **Purpose:** `requireDfBinding` is an authorization/existence guard. It verifies whether an account binding row exists in the database. It does NOT decrypt payload ciphertext.
2. **Failure Handling (Corrupted Binding):**
   - If a user has a binding with corrupted ciphertext:
     - Under `requireDfBinding`: The guard returns `false` (meaning the check passes, user has a binding).
     - Then `/df unlink` proceeds to `revokeBindingAsync` and successfully revokes the corrupt binding.
     - Under `resolveUserDfToken`: `decryptCredential` throws. If no legacy token exists, `resolveUserDfToken` returns `null`.
     - If `requireDfBinding` used `resolveUserDfToken`, the guard would block the user with:  
       `"Bạn chưa liên kết tài khoản. Dùng /df link start để bắt đầu."`
     - **The user would be trapped forever and unable to unlink their corrupted binding!**
3. **Database Performance:**
   - Both `df_account_bindings` and `df_tokens` have unique indexes on `discord_user_id` / `discord_id`.
   - In SQLite with WAL mode, querying indexed primary keys takes less than 0.05ms.
   - However, line 53 eagerly queries `getDfToken` even when `binding` is already truthy.

#### Actual Impact
Replacing `requireDfBinding` with `resolveUserDfToken` is dangerous because it tightly couples credential decryption to authorization checking, breaking self-healing workflows (such as unlinking corrupted bindings).

#### Recommended Fix
Do NOT replace `requireDfBinding` with `resolveUserDfToken()`.  
Instead, optimize the query with lazy short-circuit evaluation:
```typescript
const binding = getActiveBinding(database, interaction.user.id);
const hasAccount = binding || getDfToken(database, interaction.user.id);

if (!hasAccount) {
  const err = buildErrorContainer(
    'Bạn chưa liên kết tài khoản. Dùng `/df link start` để bắt đầu.',
  );
  await sendReply(interaction, { components: err.toJSON() });
  return true;
}
return false;
```
This avoids querying `getDfToken` when `binding` is present while preserving 100% of the authorization and unlinking semantics.

#### Regression Tests Required
Unit tests in `__tests__/df/df-guards.test.ts` and `__tests__/df/df-unlink.command.test.ts` verifying that users with both active, legacy-only, and corrupted bindings can pass the guard.

---

## Prioritized Remediation Plan

Based on strictly verified evidence, the following remediation roadmap is established:

```mermaid
flowchart TD
    P1[Phase 1: Critical Bug & Coverage] --> P2[Phase 2: Dead Code & Dependency Hygiene]
    P2 --> P3[Phase 3: Performance & Documentation]

    subgraph P1[Phase 1 - P1 High Priority]
        T1["Fix stats-select.handler.ts (Task 2)<br/>Pass key_version / use resolveUserDfToken"]
        T2["Fix df-claim-store test coverage (Task 4)<br/>Add fake timer tests for runDbCleanup"]
    end

    subgraph P2[Phase 2 - P2 Medium Priority]
        T3["Delete extractToken dead code (Task 5)<br/>Remove unused 55 lines in deltaforce.scraper.ts"]
        T4["Review and override vulnerable dependencies (Task 3)<br/>Update axios to 1.21.0 via package.json override"]
    end

    subgraph P3[Phase 3 - P3 Low Priority]
        T5["Short-circuit getDfToken in requireDfBinding (Task 7)<br/>Lazy-load legacy check"]
        T6["Document single-process topology limit (Task 6)<br/>Add shortcut: comment in TTLStore/RateLimiter"]
    end
```

### Remediation Matrix

| Priority | Task | File Target | Remediation Action | Regression Risk |
| :---: | :--- | :--- | :--- | :---: |
| **P1** | Key Rotation Decrypt Fix | `src/features/delta-force/stats-select.handler.ts` | Replace custom decrypt block with `resolveUserDfToken()`. | Zero. Tested by `df-stats.command.test.ts`. |
| **P1** | Coverage Threshold Fix | `__tests__/df/df-claim-store.test.ts` | Add 2 test cases advancing Jest timers to execute `runDbCleanup()`. | Zero. Increases coverage from 81.7% to 100%. |
| **P2** | Delete `extractToken` | `src/services/deltaforce.scraper.ts` | Remove dead function and its unused interfaces (-55 lines). | Zero. 0 references across repo. |
| **P2** | Patch Axios Advisory | `package.json` | Add `"overrides": { "axios": "^1.21.0" }`. | Low. Must verify Garena API calls with `npm test`. |
| **P3** | Short-circuit Guard Query | `src/utils/df-guards.ts` | Change to `binding \|\| getDfToken(...)` lazy evaluation. | Zero. Preserves exact semantics. |
| **P3** | Architecture Notes | `src/utils/rate-limiter.ts` | Document single-process Railway topology dependency. | None (comment only). |
