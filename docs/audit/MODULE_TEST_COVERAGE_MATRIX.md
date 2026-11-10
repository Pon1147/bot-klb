# MODULE TEST COVERAGE MATRIX

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`  
**Execution Results:** 92 Test Suites Passed (1,162 Tests Passed, 0 Failed, Duration: ~46s)

---

## 1. Module Test Distribution

| Module ID | Business Module        | Total Test Suites | Primary Test Files                                                                                                 | Pass Rate | Coverage Assessment                                                                      |
| --------- | ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| **BM-01** | Core Admin & RBAC      | 4                 | `__tests__/admin/*`, `__tests__/config/*`                                                                          | 100%      | High (Role assignment, permissions, policy resolver, QR server flags)                    |
| **BM-02** | Server Experience      | 8                 | `__tests__/container/*`, `__tests__/booster/*`, `welcome.database.test.ts`                                         | 100%      | High (Builders, edit handlers, reset, session cleanup, header templates)                 |
| **BM-03** | DF Profiles & Data     | 18                | `__tests__/df/*`, `__tests__/services/deltaforce.api.test.ts`                                                      | 100%      | High (Stats, match autocomplete, vault, market, workshop, link/unlink, crypto)           |
| **BM-04** | DF Codes & Automation  | 6                 | `__tests__/df/df-code*`, `df-autopost*`, `deltaforce.scraper.test.ts`                                              | 100%      | High (Scraper retry, in-flight deduplication, cron schedulers, channel matcher)          |
| **BM-05** | Team Matchmaking       | 5                 | `__tests__/team-find/*`                                                                                            | 100%      | High (Session lifecycle, embed rendering, button/select handlers, voice utils)           |
| **BM-06** | Payment & VietQR       | 5                 | `__tests__/payment/*`, `payos.service.test.ts`, `vietqr.utils.test.ts`                                             | 100%      | High (VietQR image generation, PayOS signature, payment flow, order code collisions)     |
| **BM-07** | Extension & Auth       | 5                 | `__tests__/extensions/*`, `__tests__/infrastructure/http-server*`                                                  | 100%      | High (Extension architecture, classifier, claim rate limiting, CORS headers)             |
| **BM-08** | Infrastructure & Utils | 41                | `__tests__/infrastructure/*`, `__tests__/database/*`, `__tests__/events/*`, `__tests__/utils/*`, `__tests__/e2e/*` | 100%      | High (Command/event loader, interaction router, MongoDB repositories, TTL store, logger) |

---

## 2. Testing Quality & Gap Analysis

- **Happy Paths:** Fully verified across all 8 modules.
- **Error & Edge Paths:**
  - Interaction timeout handling (Discord 10062) verified in `__tests__/infrastructure/interaction-router.test.ts`.
  - Concurrency orderCode collisions verified in `__tests__/payment/donate.command.test.ts`.
  - VietQR workflow security & buyer identity verified in `__tests__/payment/vietqr-remediation.test.ts`.
- **Identified Coverage Gaps (Non-blocking):**
  - Live Chromium browser launch during scraper is mocked in Jest (`setPuppeteerLoaderForTest`); actual headless execution depends on system-installed Chromium binary (`npx puppeteer browsers install chrome`).
  - True multi-container Redis cluster testing is not covered (in-memory `TTLStore` is used).
