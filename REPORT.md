# Repo Judge Report: bot_klb

> Audit toàn bộ Discord bot repo (TypeScript, discord.js v14, Container V2)
> 97 source files, 34 test files — chi nhánh `test/KhoaLPD/e2e`

---

## Score Summary

| Tieu Chi             | Score      | Danh Gia                                                           |
| -------------------- | ---------- | ------------------------------------------------------------------ |
| Clean Code           | **6/10**   | Nhiều vấn đề DRY, magic numbers, dead code                         |
| Clear Architecture   | **7.5/10** | Separation of concerns tôt, nhung inconsistency giua folders       |
| Tuong Minh (Clarity) | **6/10**   | Naming mixed EN/VI, comment inconsistent, 2 color palettes overlap |
| Scalability          | **7/10**   | DI pattern tôt, nhung duplicate boilerplate se scale thanh van de  |
| Test Coverage        | **9/10**   | 95-100% threshold, nhung con 11 files chua test                    |
| Code Reuse           | **5/10**   | Điểm yếu nhat — booster/ va welcome/ la carbon copy                |

---

## 1. Project Structure Overview

### Directory Layout

```bash
src/
  index.ts                           # Entry point (13 buoc khoi tao)
  config/
    bot.config.ts                    # Env var loading (BOT_TOKEN, CLIENT_ID, GUILD_ID)
    container.variables.ts           # CONTAINER_COLORS, EMBED_COLORS
    default.settings.ts
    intents.ts                       # Discord gateway intents
    logger.variables.ts
    variables.ts
  database/
    df.token.db.ts                   # DeltaForce token CRUD + migration
    guild.settings.db.ts             # Guild settings (deepMerge, JSON corruption recovery)
    welcome.database.ts              # Welcome settings DB
  handlers/
    command.handler.ts               # Recursive command loader + incremental deploy
    event.handler.ts                 # Recursive event loader
  server/
    webhook-server.ts                # Express server (port 3500)
    webhook.routes.ts                # POST /api/df/claim
  services/
    deltaforce.api.ts                # DeltaForce API client (axios)
    deltaforce.scraper.ts            # Puppeteer scraper
    df-claim-store.ts                # In-memory claim code Map (10-min TTL)
    settings.service.ts              # Settings singleton with cache
  scraper/
    df-webhook.ts                    # Userscript for webhook POST
    dfStable.ts                      # Legacy console paste script
    getDailyCodes.ts
  types/
    client-augmentation.d.ts         # Augments Client with .commands, .database
    components-v2.ts                 # Container V2 type definitions
    deltaforce.types.ts
    settings.types.ts
  utils/
    container.utils.ts               # buildContainer, buildError, makeResult, toComponentsV2
    df-operator.utils.ts             # Operator name/icon resolution
    df-rank.utils.ts                 # Rank from score lookup
    logger.ts
    template.utils.ts
  commands/
    .tree                            # File-based command tree config
    booster/
      booster.command.ts             # /test-booster (setchannel, setrole, toggle, status)
      handlers/                      # 4 handlers + test.command.ts
    container/
      container.command.ts           # /container (edit, reset)
      container-builders.ts          # Button/modal builders
      container-edit.handler.ts      # Interactive edit session
      container-reset.handler.ts
      container-routers.ts           # Button customId router
      container-session.ts           # Session management (15-min timeout)
      handlers/                      # action.handler.ts, property.handler.ts
    df/
      code.command.ts                # /df-code (leaderboard lookup)
      link.command.ts                # /df-link (start, paste, status, unlink)
      unlink.command.ts              # /df-unlink
      stats.command.ts               # /df-stats
      daily.command.ts               # /df-daily
      history.command.ts             # /df-history
    welcome/
      setup.command.ts               # /welcome (setchannel, setrole, toggle, status)
      handlers/                      # 4 handlers + test.command.ts
  events/
    guildMemberAdd.event.ts
    guildMemberUpdate.event.ts
    interactionCreate.event.ts
  assets/img/                        # 40+ image files (ranks, operators, maps)

__tests__/                           # 26 unit tests + 8 e2e tests
```

### Key Dependencies

| Package          | Version  | Purpose           |
| ---------------- | -------- | ----------------- |
| `discord.js`     | ^14.26.4 | Discord framework |
| `better-sqlite3` | ^11.10.0 | Database          |
| `axios`          | ^1.17.0  | HTTP client       |
| `express`        | ^5.2.1   | Webhook server    |
| `puppeteer`      | ^25.1.0  | Browser scraping  |

### TypeScript Config

| Setting              | Value               |
| -------------------- | ------------------- |
| `strict`             | **true**            |
| `target`             | ES2022              |
| `module`             | node16 (native ESM) |
| `noUnusedLocals`     | true                |
| `noUnusedParameters` | true                |
| `noImplicitReturns`  | true                |

---

## 2. CLEAN CODE — 6/10

### Van De Nghiem Trong

| #   | Van De                                                                                          | Location                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Welcome handlers thieu `await` tren `settingsService.update()` — data co the khong save         | `welcome/handlers/set-channel.handler.ts:15`, `set-role.handler.ts:15`, `toggle.handler.ts:15` |
| 2   | `deferReply({ ephemeral: false })` roi editReply ephemeral — message hien thi cong khai briefly | `df/code.command.ts:89`                                                                        |
| 3   | `DF_RED = 0x0ff695` khong phai mau do — ten bien mislead                                        | `df/history.command.ts:17`                                                                     |
| 4   | Dead barrel files (chi co comment, khong export)                                                | `booster/index.ts`, `welcome/index.ts`, `df/index.ts`                                          |
| 5   | Hardcoded `0x5865F2` vs `0x5865f2` — inconsistent casing                                        | `df/stats.command.ts:129` vs `df/daily.command.ts:34`                                          |
| 6   | `coverage-gaps.test.ts` — `jest.mock()` trong `beforeEach()` la ineffective                     | `__tests__/coverage-gaps.test.ts:16-23`                                                        |

### `any` Usage (8 places)

| Location                       | Issue                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `container-routers.ts:221`     | `draft: any` — nen dung `ContainerEditSession`                                       |
| `container-builders.ts:40`     | `settings: any` — nen dung `ContainerSettings`                                       |
| `container-edit.handler.ts:40` | `settings: any` — nen dung `ContainerSettings`                                       |
| `container/command.ts:42,54`   | `any` cho option builder callback (discord.js type limitation)                       |
| `df/stats.command.ts:63,123`   | `Record<string, unknown>` cho component tree (chap nhan — Container V2 chua co type) |

---

## 3. CLEAR ARCHITECTURE — 7.5/10

### Diem Tot

- Entry point `src/index.ts` râ rang voi 13 buoc khoi tao
- DI pattern: `database` injected vao `execute(interaction, database)`
- Service layer tach biet (api, scraper, settings, claim-store)
- Event-driven voi handler recursive load
- Session cleanup + claim code cleanup background tasks

### Van De

| #   | Van De                                                                                                                    | Impact                       | Location                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| 1   | **Bilingual inconsistency** — booster/welcome dung EN user-facing text, df/container dung VI                              | UX inconsistent              | All folders                                            |
| 2   | `setup.command.ts` vs `booster.command.ts` — file naming inconsistent                                                     |                              | `welcome/setup.command.ts`                             |
| 3   | Error handling inconsistent — booster catch-all khong check `interaction.replied`; container co check                     | Potential double-reply error | `booster.command.ts:110` vs `container.command.ts:133` |
| 4   | Wildcard CORS tren webhook endpoint — security risk trong production                                                      | Security                     | `webhook-server.ts`                                    |
| 5   | df commands build raw Container V2 objects thay vi dung `container.utils.ts` utilities — bypass text-trim, URL validation | Missed safeguards            | `df/stats.command.ts:63-134`                           |

---

## 4. TUONG MINH (CLARITY) — 6/10

| Van De                                                                                             | Location                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------- |
| Khong co CLAUDE.md — khong co project-level doc                                                    | Root directory                  |
| 2 color palettes (`CONTAINER_COLORS` vs `EMBED_COLORS`) — overlap semantic keys nhung khac gia tri | `config/container.variables.ts` |
| `CONTAINER_COLORS.SUCCESS` (0x57f287) khac `EMBED_COLORS.SUCCESS` (0x00FF00)                       |                                 |
| `ASSETS_PATH = './src/assets/img/map/'` — dung source path, co the break trong production          | `df/code.command.ts:21`         |
| Comment mixed: Vietnamese trong df/container, English trong booster/welcome                        | Multiple files                  |

---

## 5. SCALABILITY — 7/10

### Van De Se Bite Khi Scale

| #   | Van De                                                                                                                                                            | Location                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **Booster va Welcome la carbon copy** — 8 handler files + 2 command files duplicate near-identical logic. Moi feature moi nhu the nay × N = maintenance nightmare | `booster/handlers/*` vs `welcome/handlers/*`                                              |
| 2   | `apiToken` object build 3 lan giong het nha — nen co utility function                                                                                             | `df/stats.command.ts:38-44`, `df/daily.command.ts:66-72`, `df/history.command.ts:111-117` |
| 3   | `guard clause` (guild check, token check, ephemeral reply) — copy-paste o ~10 command files                                                                       | All command files                                                                         |
| 4   | Raw component building trong df/ bypass utilities — neu Container V2 API thay doi, phai fix o nhieu noi                                                           | `df/*.command.ts`                                                                         |
| 5   | `test.command.ts` duplication — channel-send-fallback logic identical trong booster va welcome                                                                    | `booster/test.command.ts:58-80` vs `welcome/test.command.ts:78-100`                       |

**Khuyen nghi:** Generic `handleSystemConfig(systemName, propertyKey)` co the loai bo 8+ handler files cua booster/welcome.

---

## 6. TEST COVERAGE — 9/10

### Diem Manh

- Thresholds that ke: **100% lines, 100% branches, 95% statements/functions**
- 34 test files, AAA pattern consistent
- E2E tests voi real SQLite, real Express (supertest)
- Mock chat luong cao: fake timers cho TTL, `:memory:` DB, virtual axios mock
- Vietnamese `describe`/`it` naming: `phai gui message khi...`, `nen tra ve error khi...`

### Test File Count

| Category                                | Count                                              |
| --------------------------------------- | -------------------------------------------------- |
| Unit tests (`__tests__/*.test.ts`)      | 26                                                 |
| E2E tests (`__tests__/e2e/*.test.ts`)   | 8                                                  |
| Total test files                        | **34**                                             |
| Source files (`.ts`, excluding `.d.ts`) | **~97**                                            |
| Effective test-to-source ratio          | **~1.1** (nhiều test files cover multiple modules) |

### Coverage Gaps (11 files chua test)

| File                                                          | Importance                                            |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `container-routers.ts`                                        | **HIGH** — button router cho interactive edit flow    |
| `handlers/action.handler.ts`                                  | **HIGH** — save/cancel/preview actions                |
| `handlers/property.handler.ts`                                | **HIGH** — edit container properties                  |
| `welcome/setup.command.ts` + 4 handlers                       | **MEDIUM** — duplicate cua booster nhung chua co test |
| `event.handler.ts`, `command.handler.ts`                      | **MEDIUM** — infrastructure modules                   |
| `interactionCreate.event.ts`                                  | **MEDIUM** — routes button/modal interactions         |
| `df-operator.utils.ts`                                        | **LOW** — simple name/icon resolution                 |
| `config/variables.ts`, `config/index.ts`, `config/intents.ts` | **LOW** — config barrel exports                       |

### Issues

| #   | Issue                                                                                                                        | Location                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | `link.command.ts` va `history.command.ts` bi exclude khoi coverage trong `jest.config.cjs` nhung vẫn co test — contradiction | `jest.config.cjs:31-32` |
| 2   | `booster.test.ts` (lines 189-364) va `e2e/events.e2e.test.ts` (lines 266-341) test cung 1 event — duplicate CI time          |                         |
| 3   | DF command tests mock `container.utils.js` tra ve trivial objects — khong verify actual container output                     | `df-*.command.test.ts`  |

---

## 7. CODE REUSE — 5/10

**Day la diem yeu nhat cua repo.**

### Duplication Matrix

| Duplication                                   | Files Affected                     | Fix                                 |
| --------------------------------------------- | ---------------------------------- | ----------------------------------- |
| Booster ↔ Welcome handlers (carbon copy)      | 8 handler files + 2 commands       | Generic handler function            |
| `apiToken` construction                       | 3 df command files                 | `buildApiToken(token)` utility      |
| Guard clauses (guild, token, ephemeral reply) | ~10 command files                  | Middleware/decorator                |
| Container component assembly                  | 4 df command files                 | Dung `container.utils.ts` utilities |
| `DeepPartial<T>` type                         | 2 copies                           | Single export tu types/             |
| Directory scan function                       | 2 copies (command + event handler) | Single utility                      |
| Daily codes scraping logic                    | 2 scraper files                    | Consolidate                         |

### Booster vs Welcome — Chi Tiet

| Handler                  | Booster                                                | Welcome                                                | Difference                   |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------- |
| `set-channel.handler.ts` | `src/commands/booster/handlers/set-channel.handler.ts` | `src/commands/welcome/handlers/set-channel.handler.ts` | Property path + message text |
| `set-role.handler.ts`    | `src/commands/booster/handlers/set-role.handler.ts`    | `src/commands/welcome/handlers/set-role.handler.ts`    | Property path + message text |
| `toggle.handler.ts`      | `src/commands/booster/handlers/toggle.handler.ts`      | `src/commands/welcome/handlers/toggle.handler.ts`      | Property path + message text |
| `status.handler.ts`      | `src/commands/booster/handlers/status.handler.ts`      | `src/commands/welcome/handlers/status.handler.ts`      | Property path + message text |

**Booster co `await` tren `settingsService.update()`, welcome khong** — bug hidden trong duplicate code.

---

## 8. Top 10 Actions (Prioritized)

| Priority | Action                                                         | Impact                              | Effort    |
| -------- | -------------------------------------------------------------- | ----------------------------------- | --------- |
| **P0**   | Fix: `await` welcome handlers (3 files)                        | Bug fix — data co the khong save    | 5 min     |
| **P0**   | Fix: `deferReply` ephemeral o code.command.ts:89               | Bug fix — message cong khai briefly | 1 min     |
| **P1**   | DRY: Extract generic handler cho booster + welcome (10+ files) | Maintenance                         | 2-3 hours |
| **P1**   | DRY: `buildApiToken()` utility cho df commands                 | Maintainance                        | 15 min    |
| **P2**   | Test: Container edit interactive handlers (3 files)            | Safety net                          | 1-2 hours |
| **P2**   | Test: Welcome command suite (5 files)                          | Safety net                          | 30 min    |
| **P2**   | Remove dead barrel index.ts files                              | Clean code                          | 2 min     |
| **P3**   | Fix: Rename `DF_RED` → ten dung                                | Clarity                             | 1 min     |
| **P3**   | Consolidate 2 color palettes thanh 1                           | Clarity                             | 30 min    |
| **P3**   | Write CLAUDE.md voi project overview                           | Onboarding                          | 30 min    |

---

## 9. Command Architecture Detail

### Two Structural Patterns

**Pattern A — Router + Handler files** (booster/, welcome/, container/)

```bash
command.ts                    # Defines data with subcommands, switch dispatch
  └── handlers/               # One file per subcommand
        set-channel.handler.ts
        set-role.handler.ts
        toggle.handler.ts
        status.handler.ts
```

**Pattern B — Monolithic commands** (df/)

```bash
link.command.ts               # Self-contained data + execute
stats.command.ts              # Self-contained data + execute
daily.command.ts              # Self-contained data + execute
```

### Consistency Table

| Aspect                                     | booster/ | welcome/     | df/        | container/        |
| ------------------------------------------ | -------- | ------------ | ---------- | ----------------- |
| `data` uses `setDefaultMemberPermissions`  | No       | No           | N/A        | **Yes** (line 76) |
| Guild-check messages                       | English  | English      | Vietnamese | Vietnamese        |
| Error messages                             | English  | English      | Vietnamese | Vietnamese        |
| `await` on `settingsService.update`        | **Yes**  | **No** (bug) | N/A        | Yes               |
| Error handler checks `interaction.replied` | No       | No           | Yes        | Yes               |

---

## 10. Entry Point Boot Sequence

`src/index.ts` — 13 buoc trong `main()`:

```bash
1.  Initialize SQLite DB           → welcome.database.ts
2.  Initialize guild_settings      → guild.settings.db.ts
3.  Initialize df_tokens table     → df.token.db.ts
4.  Initialize SettingsService     → settings.service.ts (singleton)
5.  Create Discord Client          → intents from BOT_INTENTS
6.  Load commands (recursive)      → command.handler.ts
7.  Load events (recursive)        → event.handler.ts
8.  Start session cleanup          → container-session.ts
9.  Start claim code cleanup       → df-claim-store.ts
10. Attach DB to client            → client.database
11. Start webhook server           → webhook-server.ts (port 3500)
12. Deploy commands (incremental)  → only updates changed
13. Login to Discord               → client.login(token)
```

---

## Appendix: File Counts

| Location     | TypeScript (.ts) | Declaration (.d.ts) | Non-TS (images, config) | Total   |
| ------------ | ---------------- | ------------------- | ----------------------- | ------- |
| `src/`       | 63               | 1                   | 61                      | 125     |
| `__tests__/` | 34               | 0                   | 3                       | 37      |
| **Total**    | **97**           | **1**               | **64**                  | **162** |

---

## 11. Dead / Garbage / Stale Files Audit

> 47 items found — 9 source files confirmed dead, 35 unused assets, 3 broken/stale config references

### CONFIRMED DEAD — Safe to Delete (Source Files)

| File                            | Reason                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/commands/df/index.ts`      | Barrel file — chỉ có comment, 0 exports, 0 importers                                       |
| `src/commands/booster/index.ts` | Barrel file — chỉ có comment, 0 exports, 0 importers                                       |
| `src/commands/welcome/index.ts` | Barrel file — chỉ có comment, 0 exports, 0 importers                                       |
| `src/scraper/dfStable.ts`       | Legacy userscript (clipboard copy) — superseded bằng `df-webhook.ts`, 0 imports            |
| `src/scraper/getDailyCodes.ts`  | Puppeteer scraper — 0 imports, chức năng được thay bằng `deltaforce.scraper.ts`            |
| `src/types/components-v2.ts`    | Type definitions — 0 imports, codebase dùng `Record<string, unknown>` thay vì các type này |
| `src/scripts/tree.mts`          | Standalone browser userscript — không import bởi bot code, chỉ compile riêng               |
| `src/scripts/tree.js`           | Duplicate — compiled output của `tree.mts`, không cần commit                               |

### UNUSED ASSETS — Safe to Delete (35 files)

**Operator images (16) — `df-operator.utils.ts` dùng remote URLs, không dùng local files:**

| File                           | File                          |
| ------------------------------ | ----------------------------- |
| `src/assets/img/d-wolf.webp`   | `src/assets/img/gizmo.webp`   |
| `src/assets/img/hackclaw.webp` | `src/assets/img/luna.webp`    |
| `src/assets/img/morse.webp`    | `src/assets/img/nox.webp`     |
| `src/assets/img/raptor.webp`   | `src/assets/img/saseed.webp`  |
| `src/assets/img/shepherd.webp` | `src/assets/img/sineva.webp`  |
| `src/assets/img/stinger.webp`  | `src/assets/img/tempest.webp` |
| `src/assets/img/toxic.webp`    | `src/assets/img/uluru.webp`   |
| `src/assets/img/vlinder.webp`  | `src/assets/img/vyron.webp`   |

**Sticker images (10):**

`sticker-1.jpg`, `sticker-1.png`, `sticker-2.jpg`, `sticker-2.png`, `sticker-3.jpg`, `sticker-3.png`, `sticker-4.jpg`, `sticker-4.png`, `sticker-5.jpg`, `sticker-5.png`

**Misc (5):**

| File                                               | Reason                                                        |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `src/assets/img/HoA.webp`                          | Code dùng Discord emoji ID `<a:HoA:...>`, không dùng file này |
| `src/assets/img/box.png`                           | 0 references                                                  |
| `src/assets/img/icon9-De6T9unB.png`                | Code dùng Discord emoji ID `<:icon9De6T9unB:...>`             |
| `src/assets/img/kill.png`                          | Code dùng Discord emoji ID `<:kill:...>`                      |
| `src/assets/img/collections_9ca7...png`            | 0 references                                                  |
| `src/assets/img/M_y_ch__c_a_Pon_N_____channels.md` | Markdown file trong folder img — stale                        |

**NOTE:** Map images trong `src/assets/img/map/` (5 files) — **ACTIVE**, được dùng bởi `df/code.command.ts` line 21-28 (`MAP_DISPLAY`). Không delete.

### BROKEN / STALE CONFIG

| File                    | Issue                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tsconfig.tree.json`    | Reference non-existent `tree.ts` — `npm run build:tree` và `watch:tree` sẽ fail                               |
| `package.json`          | `"deploy-commands"` script reference non-existent `src/deploy-commands.ts` (logic đã move vào `src/index.ts`) |
| `package.json`          | `build:tree` và `watch:tree` scripts reference broken tsconfig                                                |
| `jest.config.cjs:31-32` | Exclude `link.command.ts` và `history.command.ts` khỏi coverage nhưng vẫn có test files — contradiction       |
| `jest.config.cjs`       | Exclude non-existent `src/deploy-commands.ts` — stale                                                         |

### ORPHANED EXPORT

| Location                               | Issue                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| `src/config/logger.variables.ts:62-68` | Export `BORDER` (box-drawing chars) — 0 file import hoặc use |

### OLD / Stale (Long Unupdated)

| File                           | Age Indicator                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/scraper/dfStable.ts`      | Legacy approach (clipboard copy) — replaced by webhook flow, code style khác hẳn current codebase           |
| `src/scraper/getDailyCodes.ts` | Old Puppeteer scraper — replaced by `deltaforce.scraper.ts`, không có test                                  |
| `src/types/components-v2.ts`   | Type definitions written nhưng không bao giờ được dùng — codebase đi hướng khác (`Record<string, unknown>`) |
| `src/scripts/tree.*`           | Standalone tool, không liên quan đến bot, có vẻ là experiment cũ                                            |

### Summary

| Category            | Count        | Action                                                            |
| ------------------- | ------------ | ----------------------------------------------------------------- |
| Dead source files   | 9            | **Delete**                                                        |
| Unused assets       | 35           | **Delete**                                                        |
| Broken/stale config | 3            | **Fix** (`package.json`, `jest.config.cjs`, `tsconfig.tree.json`) |
| Orphaned export     | 1            | **Remove** `BORDER` từ `logger.variables.ts`                      |
| **Total**           | **48 items** | ~30% repo bloat                                                   |
