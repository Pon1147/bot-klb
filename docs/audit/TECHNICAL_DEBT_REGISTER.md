# TECHNICAL DEBT REGISTER

**Project:** `bot-klb` (Bot Delta)  
**Version:** 1.6.12  
**Audit Baseline Commit:** `9b51bca`

---

## 1. Dead & Unreachable Code

| Item ID     | Location                                      | Symbol / Code Item                 | Status                              | Technical Details                                                                                                                                                               |
| ----------- | --------------------------------------------- | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEBT-01** | `src/services/deltaforce.scraper.ts:L317-370` | `extractToken` function            | **CONFIRMED DEAD CODE**             | Unreferenced anywhere in source code, scripts, or tests. Abandoned legacy token interceptor before Chrome Extension implementation. Contains unhandled rejection risk on timer. |
| **DEBT-02** | `src/database/df.token.db.ts`                 | Legacy `df_tokens` table & methods | **INTENTIONAL COMPATIBILITY LAYER** | Maintained for backward compatibility and migration for older linked accounts. New links write to `df_account_bindings`.                                                        |

---

## 2. Code Quality & Typing Debt

| Item ID     | Location                               | Description                                        | Severity     | Impact                                                                                                                                                                                                            |
| ----------- | -------------------------------------- | -------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEBT-03** | Core handlers & configs (15 instances) | `@typescript-eslint/no-explicit-any` warnings      | **P3 (Low)** | Found in `permissions.ts`, `autopost.handler.ts`, `match.handler.ts`, `pay.command.ts`, `payment-flow.ts`, `event-loader.ts`, `deltaforce.api.ts`, `df-autopost-scheduler.ts`. Does not impact runtime execution. |
| **DEBT-04** | `__tests__` jest configuration         | `ts-jest` deprecation warning on `isolatedModules` | **P3 (Low)** | Suggests setting `isolatedModules: true` in `tsconfig.json` before ts-jest v30.0.0.                                                                                                                               |

---

## 3. Dependency Vulnerabilities (`npm audit`)

| Item ID     | Package                                             | Severity      | Advisory / CVE                                                | Impact & Remediation                                                                                                                       |
| ----------- | --------------------------------------------------- | ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **DEBT-05** | `axios`                                             | High          | GHSA-vh66-26gq-q6x8, GHSA-9fr6-4gfg-395g, GHSA-c29m-xwm3-cm6r | Prototype pollution / ReDoS gadgets. Used in `deltaforce.api.ts` and `vietqr.utils.ts`. Upgrade to safe patch release via `npm audit fix`. |
| **DEBT-06** | `undici`                                            | High          | GHSA-3wwx-pv8p-q78v, GHSA-r53p-7pc4-xj5r                      | Sub-dependency of Discord.js. DoS via unhandled error in WebSocket permessage-deflate. Update discord.js/undici via `npm audit fix`.       |
| **DEBT-07** | `zod` / `puppeteer`                                 | High          | GHSA-mrhx-c7xc-m3w5                                           | Memory exhaustion on oversized collections in Chromium-bidi. Update Puppeteer to latest patch.                                             |
| **DEBT-08** | `deepmerge`, `minimatch`, `glob`, `brace-expansion` | Moderate/High | Various GHSA advisories                                       | Sub-dependencies of Dev tools (`jest`, `eslint`, `archiver`). No runtime production exposure.                                              |
