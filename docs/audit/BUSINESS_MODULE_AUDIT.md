# BUSINESS MODULE AUDIT

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`

---

## 1. BM-01: Core Administration & RBAC

- **Correctness:** Verified. Policies resolve hierarchically: `GUILD_OWNER` → `ADMINISTRATOR` → `BOT_ADMIN` → `MODERATOR` → `MEMBER` → `EVERYONE`.
- **Security:** Verified. Direct Bot Owner bypass is strictly constrained to `botConfig.botOwnerId` (Snowflake ID comparison). Unmapped command paths default to hard rejection (`access denied`).
- **Reliability:** Preloads guild settings in memory cache (`Map<string, GuildSettings>`) with SQLite disk persistence.
- **Findings:** None blocking.

---

## 2. BM-02: Server Experience & Engagement (Welcome, Booster, Container)

- **Correctness:** Supports both modern Components V2 containers (`MessageFlags.IsComponentsV2`) and legacy embeds.
- **Discord Reliability:** Container sessions time out cleanly after 10 minutes; expired sessions are pruned by `startSessionCleanup()`.
- **Findings:** None blocking.

---

## 3. BM-03: Delta Force Profiles & Game Data

- **Correctness:** Match and stats calculations cleanly parse Garena/Tencent payload structures.
- **Security:** Account tokens are encrypted at-rest using AES-256-GCM (`df-crypto.ts`). Plaintext tokens are never stored in log files or returned over HTTP.
- **Legacy Compatibility:** Dual token retrieval in `resolveUserDfToken`: reads active encrypted binding from `df_account_bindings` first; falls back to legacy SQLite table `df_tokens` if not yet migrated.
- **Reliability:** Garena API rate limiting handled gracefully with friendly cooldown error embeds.
- **Findings:** None blocking.

---

## 4. BM-04: Delta Force Codes, Scraping & Automation

- **Correctness:** Map daily codes scraped from HQ portal using Puppeteer. If scraping fails (Cloudflare challenge / network timeout), falls back to static seed codes in `DEFAULT_CODES`.
- **Performance & Resources:** Headless Chromium is spawned per scrape, but calls are protected by a 30-minute memory cache (`HQ_CODES_CACHE_TTL = 1800s`) and in-flight promise deduplication (`inFlightFetchPromise`), preventing duplicate browser instances during concurrent requests.
- **Dead Code Finding:**
  - Function `extractToken` in `src/services/deltaforce.scraper.ts:L317-370` is never called anywhere in the codebase. Contains an unhandled promise rejection edge case if `page.goto` times out before the token timer fires.
  - Classification: Confirmed Dead Code. Recommended deletion.

---

## 5. BM-05: Team Management & Matchmaking

- **Correctness:** Matchmaking flow stores live lobbies in memory via `TTLStore` (15-min session TTL).
- **Discord Reliability:** All join/leave/done actions update the original lobby message in-place without generating spam messages.
- **Findings:** In-memory store is single-process; will not share active party state across multi-container load-balanced instances without Redis.

---

## 6. BM-06: Payment, Donation & VietQR Economy

- **Correctness:**
  - VietQR workflow strictly prevents blank QR codes by enforcing bank account configuration validation before invoice generation.
  - PayOS order code generation (`generatePayosOrderCode`) combines millisecond timestamp with a sequential counter (000-999) to guarantee uniqueness under concurrency.
- **Security:**
  - PayOS webhooks verified with HMAC SHA-256 (`crypto.timingSafeEqual`) to eliminate timing attack vectors.
  - P2P VietQR transactions require confirmation by designated seller or staff with `PAY_ACCESS`.
- **Performance:** In-memory rate limiting via `TTLStore` prevents spamming invoice generation.
- **Findings:** None blocking.

---

## 7. BM-07: Browser Extension & Auth Gateway

- **Security:**
  - HTTP Server (`http-server.ts`) enforces payload size limits (`MAX_PAYLOAD_SIZE = 64KB`) against memory DoS.
  - Sliding window IP rate limiter (`SimpleRateLimiter`, 10 req/min/IP) protects `POST /api/v1/auth/claim` against brute-force attacks.
  - CORS strictly limits allowed origins to `chrome-extension://`, `moz-extension://`, and official Delta Force domains.
- **Findings:** None blocking.

---

## 8. BM-08: Infrastructure, Storage & Operations

- **Correctness:** Complete coverage of Discord Gateway events. Unhandled promise rejections and interaction timeouts (10062) caught cleanly without terminating the Node.js process.
- **Testing:** 92 test suites passing (1162 tests, 100% pass rate).
- **Static Analysis:** 0 TypeScript compile errors; 15 `@typescript-eslint/no-explicit-any` warnings.
- **Findings:**
  - Dependency audit flagged vulnerabilities in `axios`, `undici`, `puppeteer`/`zod` (runtime) and `jest`/`deepmerge`, `archiver`/`minimatch` (dev dependencies).
