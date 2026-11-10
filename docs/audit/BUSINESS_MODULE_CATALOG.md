# BUSINESS MODULE CATALOG

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`

---

## Catalog Overview

From rigorous source code inspection, exactly **8 Business Modules (BM)** have been identified.

| Module ID | Module Name                          | Primary Responsibility                                                            | Status                  |
| --------- | ------------------------------------ | --------------------------------------------------------------------------------- | ----------------------- |
| **BM-01** | Core Administration & RBAC           | Server settings, RBAC role assignment, feature flags, VietQR config               | CONFIRMED / IMPLEMENTED |
| **BM-02** | Server Experience & Engagement       | Member welcome, farewell, server booster appreciation, Components V2 editor       | CONFIRMED / IMPLEMENTED |
| **BM-03** | Delta Force Profiles & Game Data     | Player statistics, match details, vault items, weapon builds, market prices, link | CONFIRMED / IMPLEMENTED |
| **BM-04** | DF Codes, Scraping & Automation      | HQ web scraping, daily redeem codes broadcast, automated map/gun publishing       | CONFIRMED / IMPLEMENTED |
| **BM-05** | Team Management & Matchmaking        | Voice-aware party matchmaking, map/mode/rank selection, automated TTL sessions    | CONFIRMED / IMPLEMENTED |
| **BM-06** | Payment, Donation & VietQR Economy   | Peer-to-peer VietQR invoice generation, PayOS donations, feedback ratings         | CONFIRMED / IMPLEMENTED |
| **BM-07** | Browser Extension & Auth Gateway     | Companion Chrome Extension, REST claim server, sliding window IP rate limiting    | CONFIRMED / IMPLEMENTED |
| **BM-08** | Infrastructure, Storage & Operations | Discord gateway lifecycle, SQLite/MongoDB hybrid persistence, TTL store, logging  | CONFIRMED / IMPLEMENTED |

---

## Detailed Module Specifications

### BM-01: Core Administration & RBAC

- **Scope:** Server-wide administration, role permissions, Bot Owner commands.
- **Commands:** `/config`
  - Subcommands: `roles set`, `roles view`, `bot guilds`, `bot setannouncechannel`, `bot announce`, `qr-server toggle`, `qr-server status`, `vietqr set`, `vietqr workflow`, `vietqr status`, `vietqr preview`.
- **Services:** `SettingsService`, `settings.service.ts`
- **Repositories:** `guild.settings.db.ts` (SQLite), `guild-settings.repo.ts` (MongoDB)
- **Permissions:** `MANAGE_RBAC`, `MANAGE_CONFIG`
- **Test Suites:** `__tests__/admin/config.command.test.ts`, `__tests__/admin/permissions.test.ts`, `__tests__/admin/policy.test.ts`
- **Status:** Fully Implemented.

### BM-02: Server Experience & Community Engagement

- **Scope:** Automated greetings, departures, booster rewards, and interactive message styling.
- **Commands:** Managed under `/config welcome *`, `/config leave *`, `/config booster *`, `/config container *`
- **Events:** `guildMemberAdd.event.ts`, `guildMemberRemove.event.ts`, `guildMemberUpdate.event.ts`
- **Interactions:** Custom container editor buttons (`ContainerIds.PREFIX`), modals (`ContainerModalPrefix`).
- **Repositories:** `welcome.database.ts`, `guild.settings.db.ts`
- **Test Suites:** `__tests__/container/*`, `__tests__/booster/*`, `__tests__/database/welcome.database.test.ts`
- **Status:** Fully Implemented.

### BM-03: Delta Force Profiles & Game Data

- **Scope:** Live Garena/Tencent Delta Force game data, player telemetry, account binding, and market crafting.
- **Commands:** `/df`
  - Subcommands: `stats`, `daily`, `history`, `workshop`, `vault`, `match`, `market`, `build`, `map`, `link start`, `link status`, `unlink`
- **Interactions:** Autocomplete (`match_id`, `item`), Select Menus (`MATCH_SELECT_PREFIX`, stats select), Button (`df_link_show_webhook`).
- **Services:** `deltaforce.api.ts`, `df-metadata.service.ts`, `df-crypto.ts`, `weapon-loadouts.service.ts`
- **Repositories:** `df-binding.db.ts`, `df.token.db.ts`, `df-loadouts.db.ts`, `df-telemetry.db.ts`
- **Permissions:** `DF_ACCESS`
- **Test Suites:** `__tests__/df/*`, `__tests__/services/deltaforce.api.test.ts`
- **Status:** Fully Implemented.

### BM-04: Delta Force Codes, Scraping & Automation

- **Scope:** Web scraping map passwords, automated daily broadcasting, multi-guild AutoPost scheduler.
- **Commands:** `/df code *`, `/df autopost *`, `/df help`
- **Background Schedulers:** `df-codes-scheduler.ts` (node-cron), `df-autopost-scheduler.ts` (node-cron)
- **Scraper:** `deltaforce.scraper.ts` (Puppeteer headless Chromium with 30m TTL cache and in-flight deduplication)
- **Repositories:** `df-autopost.db.ts` (SQLite), `autopost.repo.ts` (MongoDB)
- **Permissions:** `DF_ACCESS`, `MANAGE_DF_CODE`, `MANAGE_RBAC`
- **Test Suites:** `__tests__/df/df-codes-scheduler.test.ts`, `__tests__/df/df-autopost-scheduler.test.ts`, `__tests__/df/deltaforce.scraper.test.ts`
- **Status:** Fully Implemented.

### BM-05: Team Management & Matchmaking

- **Scope:** Real-time party coordination, map/mode filter, interactive voice-state integration.
- **Commands:** `/team find`
- **Interactions:** Buttons (`TeamFindIds.JOIN`, `LEAVE`, `DONE`, `CANCEL`), Select Menu (`TeamFindIds.RANK`).
- **Services:** `team-find-session.ts`, `team-find-message-store.ts`, `df-voice.utils.ts`
- **Storage:** In-memory `TTLStore` (session cleanup every 60s, TTL 15 mins).
- **Permissions:** `TEAM_ACCESS`
- **Test Suites:** `__tests__/team-find/*`
- **Status:** Fully Implemented.

### BM-06: Payment, Donation & VietQR Economy

- **Scope:** Peer-to-peer invoice generation with VietQR imagery, PayOS automated donation webhook, buyer leaderboards, star ratings.
- **Commands:** `/pay create`, `/pay history`, `/pay top`, `/donate`
- **Interactions:** Buttons (`pay:confirm:*`, `pay:cancel:*`, `feedback:rate:*`), Modals (`pay:modal:*`, `feedback:modal:*`).
- **Services:** `payment.service.ts`, `payment-flow.ts`, `payos.service.ts`, `vietqr.utils.ts`
- **HTTP Webhook:** `POST /webhook/payment` (HMAC SHA-256 signature verification).
- **Repositories:** `payment.db.ts` (`payments`, `payment_feedback`, `donations`)
- **Permissions:** `PAY_ACCESS`
- **Test Suites:** `__tests__/payment/*`, `__tests__/services/payos.service.test.ts`
- **Status:** Fully Implemented.

### BM-07: Browser Extension & Auth Gateway

- **Scope:** Chrome/Edge browser extension (`garena-redeem-code/`) capturing Garena authentication tokens, communicating with Bot HTTP API.
- **HTTP API:** `POST /api/v1/auth/claim`, `GET /health` in `http-server.ts`.
- **Security:** In-memory sliding window IP rate limiter (10 req/min/IP), origin validation.
- **Repositories:** `df-claim.db.ts` (SQLite), `df-claim.repo.ts` (MongoDB)
- **Test Suites:** `__tests__/extensions/*`, `__tests__/infrastructure/http-server.test.ts`
- **Status:** Fully Implemented.

### BM-08: Infrastructure, Storage & Operations

- **Scope:** Dynamic command/event loaders, interaction router with timeout protection, dual SQLite/MongoDB abstraction, logging.
- **Modules:** `src/infrastructure/*`, `src/database/mongo/*`, `src/utils/logger.ts`, `src/utils/ttl-store.ts`.
- **Test Suites:** `__tests__/infrastructure/*`, `__tests__/database/mongo.test.ts`, `__tests__/utils/*`
- **Status:** Fully Implemented.
