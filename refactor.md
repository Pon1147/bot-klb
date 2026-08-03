# REFACTOR PLAN — KL BOT

## Tổng quan

Project: Discord Bot (TypeScript + discord.js v14 + better-sqlite3)
Mục tiêu: Chuẩn hóa codebase trước khi phát triển feature mới
Tổng effort còn lại: ~6.5 giờ

---

## ✅ Phase 0: ESLint 9 + Prettier Configuration (ĐÃ HOÀN THÀNH)

**Risk:** Low | **Impact:** High | **Thời lượng:** ~30p

### Files đã tạo

- `eslint.config.mjs` — Flat config với TypeScript parser, recommended rules
- `.prettierrc` — semi, singleQuote, trailingComma, printWidth 100

### Files đã sửa

- `package.json` — Xóa `--ext .ts` deprecated, update lint-staged pattern
- `src/handlers/command.handler.ts` — eslint-disable cho require()
- `src/handlers/event.handler.ts` — eslint-disable cho require()
- `src/database/guild.settings.db.ts` — Xóa unused eslint-disable directives
- `tsconfig.json` — Thêm typeAcquisition.enable: false

### Verify

- `npm run check`: 0 errors
- `npm run lint`: 0 errors, 22 warnings (any types)
- `npm run format:check`: All pass

---

## ✅ Phase 1: Extract Magic Values to Constants (ĐÃ HOÀN THÀNH)

**Risk:** Low | **Impact:** Medium | **Thời lượng:** ~2h

### Files đã tạo

- `src/config/deltaforce.config.ts` — 12 constants (API URLs, params, timeouts, seasons)
- `src/config/app.constants.ts` — 25 constants (port, messages, limits, timeouts, avatars, mock data)

### Files đã sửa (20+ files)

| File                         | Changes                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `deltaforce.api.ts`          | BASE, HEADERS, params, timeouts → constants             |
| `deltaforce.scraper.ts`      | HQ URL typo fix (laugue→language), timeouts → constants |
| `link.command.ts`            | URL, regex, messages → constants                        |
| `history.command.ts`         | `20` → `MAX_HISTORY_PAGE`                               |
| `container-builders.ts`      | `4000`, MockUser, avatar URL → constants                |
| `container-routers.ts`       | Session expired message → constant                      |
| `container-session.ts`       | Timeouts → constants                                    |
| `team-find.interaction.ts`   | Session message, avatar size → constants                |
| `df-rank.utils.ts`           | SOL threshold → constant                                |
| `df-voice.utils.ts`          | Voice full message → constant                           |
| `container.utils.ts`         | Text length, avatar size → constants                    |
| `interactionCreate.event.ts` | Voice full message → constant                           |
| `webhook-server.ts`          | Port → constant                                         |
| `webhook.routes.ts`          | Claim message → constant                                |
| `webhook-tunnel.ts`          | Bin name, download URL → constants                      |
| `df-claim-store.ts`          | TTL, cleanup interval, attempts → constants             |
| `team-find-session.ts`       | Session timeout → constant                              |
| `df-codes-scheduler.ts`      | Cleanup interval → constant                             |
| `index.ts`                   | Port, cleanup interval → constants                      |
| `command.handler.ts`         | `any` → proper union type                               |
| `event.handler.ts`           | `any[]` → `unknown[]`                                   |

### Verify

- `npm run check`: 0 errors
- `npm run lint`: 0 errors, 19 warnings (any types)
- `npm run format:check`: All pass

---

## ✅ Phase 2: Replace console.log/error → createLogger (ĐÃ HOÀN THÀNH)

**Risk:** Low | **Impact:** Medium | **Thời lượng:** ~3h

### Files đã sửa (16 files)

| File                                                | Logger Tag          |
| --------------------------------------------------- | ------------------- |
| `src/utils/section-config.handlers.ts`              | `SectionConfig`     |
| `src/commands/df/link.command.ts`                   | `DfLink`            |
| `src/commands/df/daily.command.ts`                  | `DfDaily`           |
| `src/commands/container/container-edit.handler.ts`  | `ContainerEdit`     |
| `src/commands/container/handlers/action.handler.ts` | `ContainerAction`   |
| `src/commands/container/container.command.ts`       | `Container`         |
| `src/commands/container/container-routers.ts`       | `ContainerRouters`  |
| `src/commands/container/container-session.ts`       | `ContainerSession`  |
| `src/server/webhook.routes.ts`                      | `Webhook`           |
| `src/server/webhook-server.ts`                      | `WebhookServer`     |
| `src/events/interactionCreate.event.ts`             | `InteractionCreate` |
| `src/events/guildMemberUpdate.event.ts`             | `GuildMemberUpdate` |
| `src/events/guildMemberAdd.event.ts`                | `GuildMemberAdd`    |
| `src/services/webhook-tunnel.ts`                    | `WebhookTunnel`     |
| `src/services/deltaforce.api.ts`                    | `DfApi`             |
| `src/commands/df/team-find.interaction.ts`          | `TeamFind`          |

### Quy tắc thay thế

- `console.log` → `logger.info()` (string concatenation)
- `console.error` → `logger.error()`
- `console.warn` → `logger.warn()`
- Multi-line → single-line
- Extra: `daily.command.ts` (phát hiện thêm khi verify)

### Acceptance

- Chỉ còn `console.*` trong `logger.ts`, `deltaforce.scraper.ts`, `scraper/df-webhook.ts` (scraper excluded)
- `npm run check`: 0 errors
- `npm run lint`: 0 errors, 19 warnings (any types → Phase 3)

## ⏳ Phase 3: Eliminate `any` Types

| File                                                | Logger Tag          |
| --------------------------------------------------- | ------------------- |
| `src/utils/section-config.handlers.ts`              | `SectionConfig`     |
| `src/commands/df/link.command.ts`                   | `DfLink`            |
| `src/commands/container/container-edit.handler.ts`  | `ContainerEdit`     |
| `src/commands/container/handlers/action.handler.ts` | `ContainerAction`   |
| `src/commands/container/container.command.ts`       | `Container`         |
| `src/commands/container/container-routers.ts`       | `ContainerRouters`  |
| `src/commands/container/container-session.ts`       | `ContainerSession`  |
| `src/server/webhook.routes.ts`                      | `Webhook`           |
| `src/server/webhook-server.ts`                      | `WebhookServer`     |
| `src/events/interactionCreate.event.ts`             | `InteractionCreate` |
| `src/events/guildMemberUpdate.event.ts`             | `GuildMemberUpdate` |
| `src/events/guildMemberAdd.event.ts`                | `GuildMemberAdd`    |
| `src/services/webhook-tunnel.ts`                    | `WebhookTunnel`     |
| `src/services/deltaforce.api.ts`                    | `DfApi`             |
| `src/commands/df/team-find.interaction.ts`          | `TeamFind`        |

---

## ✅ Phase 3: Eliminate `any` Types (ĐÃ HOÀN THÀNH)

**Risk:** Medium | **Impact:** High | **Thời lượng:** ~4h

### Files đã sửa (10 files)

| File | Changes |
|------|---------|
| `src/types/client-augmentation.d.ts` | `any` × 3 → proper collection types |
| `src/events/guildMemberUpdate.event.ts` | `guild: any` → `Guild` |
| `src/services/settings.service.ts` | Removed `[x: string]: any` index signature |
| `src/commands/container/container-routers.ts` | `draft: any` → `ContainerSettings` |
| `src/commands/container/container-edit.handler.ts` | `settings: any` → `ContainerSettings` |
| `src/server/webhook.routes.ts` | `error: any` → `error: unknown` × 2 |
| `src/commands/df/team-find.interaction.ts` | 5× `as any` → eslint-disable + comment |
| `src/decorators/requireRole.ts` | `this: any` → `ChatInputCommandInteraction` |
| `src/events/interactionCreate.event.ts` | `as any` → eslint-disable + comment |
| `src/commands/admin/set-role.command.ts` | `permData as any` → `as unknown as PermissionsConfig` |
| `src/services/deltaforce.scraper.ts` | Removed `as any` (puppeteer context) |

### Quy tắc

- Catch clauses: `error: any` → `error: unknown` + `instanceof Error`
- Types: `any` → proper type hoặc `Record<string, unknown>`
- External libs (discord.js, puppeteer): eslint-disable + comment lý do
- Removed unused index signature `[x: string]: any`

### Acceptance

- `npm run check`: 0 errors
- `npm run lint`: 0 errors, 0 warnings

### Chi tiết từng file

| File                         | Line             | Current              | Fix                                              |
| ---------------------------- | ---------------- | -------------------- | ------------------------------------------------ |
| `client-augmentation.d.ts`   | 6                | `any` × 3            | Proper collection type                           |
| `command.handler.ts`         | 136              | `commandData: any`   | `SlashCommandBuilder \| Record<string, unknown>` |
| `event.handler.ts`           | 11               | `any[]`              | `unknown[]`                                      |
| `guildMemberUpdate.event.ts` | 80               | `guild: any`         | `Guild` (import from discord.js)                 |
| `settings.service.ts`        | 38               | `[x: string]: any`   | Typed record interface                           |
| `container-routers.ts`       | 221              | `draft: any`         | `ContainerSettings`                              |
| `container-edit.handler.ts`  | 40               | `settings: any`      | `ContainerSettings`                              |
| `webhook.routes.ts`          | 97, 116          | `catch (error: any)` | `catch (error: unknown)`                         |
| `link.command.ts`            | 135              | `catch (error: any)` | `catch (error: unknown)`                         |
| `deltaforce.scraper.ts`      | 69               | `any` × 2            | Puppeteer evaluate context                       |
| `team-find.interaction.ts`   | 46,51,80,108,158 | `as any`             | discord.js type mismatch                         |
| `decorators/requireRole.ts`  | 34               | `this: any`          | `ChatInputCommandInteraction`                    |

### Quy tắc

- Catch clauses: `error: any` → `error: unknown`, dùng `instanceof Error` để extract message
- Types: `any` → proper type hoặc `Record<string, unknown>`
- External libs (puppeteer, discord.js): giữ `any` nếu không thể fix, thêm eslint-disable comment với lý do

### Acceptance

- `npm run check`: pass
- `@typescript-eslint/no-explicit-any`: 0 errors
- Không còn `as any` assertions trong bot code (scraper files excluded)

---

## ✅ Phase 4: Centralize Custom IDs (ĐÃ HOÀN THÀNH)

**Risk:** Medium | **Impact:** Low | **Thời lượng:** ~1h

### Files đã tạo

- `src/commands/container/container-ids.ts` — 15 constants + `ContainerModalPrefix`
- `src/commands/df/team-find-ids.ts` — 5 constants

### Files đã sửa (4 files)

| File | Changes |
|------|---------|
| `container-routers.ts` | 14× raw string → ContainerIds imports |
| `container-builders.ts` | 16× raw string → ContainerIds imports |
| `interactionCreate.event.ts` | 4× `startsWith` → TeamFindIds/ContainerModalPrefix |
| `team-find.interaction.ts` | 4× `startsWith`/`.replace` → TeamFindIds imports |

### Acceptance

- `npm run check`: 0 errors
- `npm run lint`: 0 errors, 0 warnings

---

## ⏳ Phase 5: Fix Known Bugs

**Risk:** Low | **Impact:** High | **Thời lượng:** ~30p

### 5a. Voice channel cleanup bug

**File:** `src/events/guildMemberUpdate.event.ts:59`

**Vấn đề:**

```ts
const changed = oldChannelId && (!newChannelId || oldChannelId !== newChannelId);
```

Điều kiện này có thể trigger sai khi user join voice channel đầu tiên (oldChannelId = null).

**Cần fix:**

- Thêm guard `oldChannelId !== null` để chỉ cleanup khi user thực sự rời voice channel
- Hoặc đổi logic: chỉ cleanup khi `oldChannelId !== null && (!newChannelId || oldChannelId !== newChannelId)`

### 5b. Team-find Done silent failure

**File:** `src/commands/df/team-find.interaction.ts:122`

**Vấn đề:**

```ts
if (!session || !session.map || !session.mode) {
  return true; // Silent fail — user không biết gì
}
```

**Cần fix:**

- Show error message: "Bạn cần chọn map và mode trước khi hoàn thành."
- Hoặc xóa session và báo user dùng lại `/team-find`

### Acceptance

- Voice cleanup chỉ trigger khi user rời voice channel (không phải join)
- Done button show error message khi thiếu map/mode

---

## ⏳ Phase 6: Decorator Typing

**Risk:** Low | **Impact:** Low | **Thời lượng:** ~15p

### File: `src/decorators/requireRole.ts:34`

**Current:**

```ts
function requireRole(roleId: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) { ... };
  descriptor.value = async function (this: any, ...args: unknown[]) { ... };
}
```

**Fix:**

```ts
import type { ChatInputCommandInteraction } from 'discord.js';

descriptor.value = async function (this: ChatInputCommandInteraction, ...args: unknown[]) { ... };
```

### Acceptance

- `npm run check`: pass
- `this` được type chính xác là `ChatInputCommandInteraction`

---

## Summary

| Phase | Category                   | Risk   | Impact         | Est. Time | Status  |
| ----- | -------------------------- | ------ | -------------- | --------- | ------- |
| 0     | ESLint/Prettier config     | Low    | High (blocker) | 30p       | ✅ DONE |
| 1     | Magic values extraction    | Low    | Medium         | 2h        | ✅ DONE |
| 2     | Console → Logger migration | Low    | Medium         | 3h        | ✅ DONE |
| 3     | Eliminate `any` types      | Medium | High           | 4h        | ✅ DONE |
| 4     | Centralize custom IDs      | Medium | Low            | 1h        | ✅ DONE |
| 5     | Bug fixes                  | Low    | High           | 30p       | ⏳ TODO |
| 6     | Decorator typing           | Low    | Low            | 15p       | ⏳ TODO |

**Total remaining effort: ~1 giờ**

**Execution order:** Phase 4 → Phase 5 → Phase 6
