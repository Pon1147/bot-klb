# CROSS-MODULE RISK REPORT

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`

---

## 1. Cross-Module Data Sharing & Shared Entities

| Shared Entity                       | Modules                    | Read / Write Pattern                | Risk Level | Assessment & Controls                                                                                         |
| ----------------------------------- | -------------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `guild_settings`                    | BM-01, BM-02, BM-04, BM-06 | Write: BM-01<br>Read: BM-02, 04, 06 | **LOW**    | Cleanly mediated through `SettingsService`. Uses in-memory cache synchronized with SQLite updates.            |
| `df_account_bindings` / `df_tokens` | BM-03, BM-04, BM-07        | Write: BM-07<br>Read: BM-03, 04     | **LOW**    | Read-side uses `resolveUserDfToken` which transparently handles encryption decryption and migration fallback. |
| `payments`                          | BM-06, BM-01               | Write: BM-06<br>Read: BM-06, 01     | **LOW**    | Isolated SQLite table with indexed columns (`idx_payments_guild_buyer`, `idx_payments_guild_status`).         |

---

## 2. Concurrency & Race Condition Evaluation

1. **Simultaneous Donation Requests (PayOS Order Codes):**
   - **Risk:** Order code collisions under burst load.
   - **Status:** Mitigated. `generatePayosOrderCode` in `donate.command.ts` uses atomic sequence tracking `(now * 1000 + orderSequence)` across millisecond boundaries.

2. **In-Memory Rate Limiting Under Multi-Instance Scaling:**
   - **Risk:** `TTLStore` and `SimpleRateLimiter` operate in-memory inside the active Node.js process. If deployed across multiple container replicas behind a load balancer, rate limits and cooldowns would not be shared across replicas.
   - **Status:** Acceptable for current single-container deployment (e.g., standard Railway worker). If multi-instance horizontal scaling is introduced, a Redis adapter for `TTLStore` will be required.

3. **Database Write Concurrency (SQLite WAL Mode):**
   - **Risk:** SQLite database locks during concurrent writes.
   - **Status:** Mitigated. `welcome.database.ts` enables `WAL` mode (`journal_mode = WAL`) and sets busy timeout, allowing concurrent readers alongside single writer.

---

## 3. Failure Propagation Boundaries

- **MongoDB Isolation:**
  MongoDB failure does not degrade Discord interactions. The startup synchronization is wrapped in try/catch and falls back to SQLite immediately.
- **Scraper Isolation:**
  Puppeteer failures during daily scraping or auto-post scheduling are isolated within the scheduler loop, logging an error and dispatching Discord embed alerts to the configured admin channel without affecting Discord gateway commands.
- **Payment Webhook Isolation:**
  Malformed or forged webhook payloads sent to `POST /webhook/payment` are rejected at the HTTP layer (400 Invalid signature) without executing database operations or triggering Discord DMs.
