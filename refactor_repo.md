# Refactoring Plan — bot_klb

Assessment bởi Technical Leader. Sắp theo priority, có file reference cụ thể.

---

## Phase 0: Cleanup Artifacts (P0 — 5 phút)

- [ ] **0.1** Thêm `.gitignore` — loại `dist/`, `data/*.db*`, `*.env`, `codes-output.txt`, `script.js`
- [ ] **0.2** Xóa `REPORT.md`, `plan.md`, `judge.md`, `diagrams.md` (files không cần trong production)
- [ ] **0.3** Xóa `backlog/` directory (task tracking trong git files — không automation)

---

## Phase 1: Eliminate `as any` (P0 — ~30 phút)

### 1.1 `src/commands/container/container.command.ts`

**Vấn đề:** `buildEditTypeOptionCallback` và `buildResetTypeOptionCallback` dùng `opt: any` (line 42-51, 55-65)

```typescript
// Hiện tại
export function buildEditTypeOptionCallback(opt: any): any { ... }
export function buildResetTypeOptionCallback(opt: any): any { ... }
```

**Fix:** Dùng typed builder từ discord.js

```typescript
import { SlashCommandStringOption } from 'discord.js';

export function buildEditTypeOptionCallback(opt: SlashCommandStringOption): SlashCommandStringOption {
  return opt.setName('type').setDescription('...').setRequired(true).addChoices(...);
}
```

### 1.2 `src/commands/df/team-find.interaction.ts`

**Vấn đề:** 3 chỗ `as any`

| Line | Code                                         | Fix                                                           |
| ---- | -------------------------------------------- | ------------------------------------------------------------- |
| 129  | `(interaction.member as any).voice?.channel` | Dùng `interaction.member instanceof GuildMember` guard        |
| 141  | `session.map as any`                         | Type `session.map` → `MapKey \| null` trong session interface |
| 154  | `}) as any`                                  | Type return → `Message` từ discord.js                         |

### 1.3 `src/commands/df/team-find.menu.ts`

**Vấn đề:** 2 chỗ `MAP_MODES as any` (line 74-75)

**Fix:** Định nghĩa `MAP_MODES` với proper type `Record<MapKey, Difficulty[]>`

### 1.4 `src/commands/df/team-find.command.ts`

**Vấn đề:** `interaction.reply({...}) as any` (line 49)

**Fix:** Type return → `Message` từ discord.js

### 1.5 `src/events/interactionCreate.event.ts`

**Vấn đề:** 3 chỗ `as any`

| Line | Code                                | Fix                                                    |
| ---- | ----------------------------------- | ------------------------------------------------------ |
| 46   | `(interaction.member as any).voice` | Dùng `interaction.member instanceof GuildMember`       |
| 108  | `(client as any).commands`          | Dùng client augmentation từ `client-augmentation.d.ts` |
| 122  | `(client as any).database`          | Dùng client augmentation từ `client-augmentation.d.ts` |

### 1.6 `src/database/guild.settings.db.ts`

**Vấn đề:** 6 chỗ `as unknown as Record<string, unknown>` / `as unknown as GuildSettings`

**Fix:** Tạo helper `deepMerge<T>(a: unknown, b: unknown): T` thay vì cast từng chỗ

### 1.7 `src/utils/container.utils.ts`

**Vấn đề:** `toComponentsV2` dùng `as unknown as ComponentsPayload` (line 61)

**Fix:** Unavoidable cast (discord.js v14 không export Container V2 types). Giữ nguyên nhưng thêm JSDoc comment giải thích **why**

### 1.8 `src/services/deltaforce.scraper.ts`

**Vấn đề:** `(globalThis as any).document` (line 68)

**Fix:** Giữ nguyên + thêm comment `// scraper cần browser DOM API`

### 1.9 `src/scraper/df-webhook.ts`

**Vấn đề:** 7 chỗ `as any` — toàn bộ là browser hook manipulation

**Fix:** Giữ nguyên + thêm comment `// browser DevTools script — unavoidable casts`

---

## Phase 2: Normalize Command Signatures (P1 — 10 phút)

**Vấn đề:** 6 command files dùng `_database: unknown` thay vì `Database.Database`

| File                       | Line | Hiện tại             | Fix                           |
| -------------------------- | ---- | -------------------- | ----------------------------- |
| `container.command.ts`     | 85   | `_database: unknown` | `database: Database.Database` |
| `code.command.ts`          | 78   | `_database: unknown` | `database: Database.Database` |
| `welcome/setup.command.ts` | 18   | `_database: unknown` | `database: Database.Database` |
| `booster/command.ts`       | 18   | `_database: unknown` | `database: Database.Database` |
| `booster/test.command.ts`  | 26   | `_database: unknown` | `database: Database.Database` |
| `welcome/test.command.ts`  | 41   | `_database: unknown` | `database: Database.Database` |

**Lý do:** `unknown` không ngăn gọi method sai, `Database.Database` cho IDE autocomplete + compile-time check.

---

## Phase 3: Remove Test Commands from Production (P1 — 5 phút)

**Vấn đề:** `/test-booster` và `/test-welcome` vẫn được auto-discover bởi command loader

**Fix (chọn 1 trong 2):**

- Option A: Xóa 2 file `booster/test.command.ts` và `welcome/test.command.ts`
- Option B: Rename thành `.disabled.ts` (command loader chỉ load file có export `data`)

---

## Phase 4: Extract Remaining Hardcoded Values (P1 — 15 phút)

### 4.1 `ASSETS_PATH` trong `code.command.ts`

```typescript
// Hiện tại — line 26
const ASSETS_PATH = './src/assets/img/map/';

// Fix: move vào team-find.config.ts
export const ASSETS_PATH = './src/assets/img/map/';
```

### 4.2 `MAX_MATCHES` trong `history.command.ts`

```typescript
// Hiện tại — line 36
const MAX_MATCHES = 10;

// Fix: move vào team-find.config.ts
export const MAX_HISTORY_LIMIT = 10;
```

---

## Phase 5: Unify Container V2 Pattern (P1 — 20 phút)

**Status:** Đã xong ở Phase 1-3 của refactor trước.

**Còn lại:** Đảm bảo tất cả command mới dùng `makeResult()` pattern (raw objects), không dùng `new ContainerBuilder()`.

---

## Phase 6: Reply Flag Consistency (P1 — 10 phút)

**Status:** Đã xong ở Phase 1-3 của refactor trước.

**Check:** Đảm bảo tất cả ephemeral replies có `flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral`

---

## Phase 7: Security & Robustness (P2 — 20 phút)

### 7.1 Env Validation at Startup

**File:** `src/config/bot.config.ts`

```typescript
// Thêm validation
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN environment variable');
```

### 7.2 Cloudflared Tunnel Cleanup

**File:** `src/services/webhook-tunnel.ts`

**Vấn đề:** Không có graceful shutdown → zombie cloudflared processes

**Fix:** Register `process.on('SIGTERM', stopTunnel)` và `process.on('SIGINT', stopTunnel)`

### 7.3 Df-Link Script Security

**File:** `src/commands/df/link.command.ts`

**Vấn đề:** Script được read từ `dist/scraper/df-webhook.js` — nếu build process bị compromise, script có thể inject malicious code

**Fix:** Thêm integrity check (hash) hoặc inline script trong source thay vì `readFileSync`

---

## Phase 8: Performance (P2 — 15 phút)

### 8.1 Pagination cho `df-history`

**File:** `src/commands/df/history.command.ts`

**Vấn đề:** `getMatchList(apiToken)` fetch toàn bộ API → chậm nếu user có 100+ trận

**Fix:** Thêm cursor-based pagination vào `getMatchList()` hoặc thêm option `?limit=10&offset=0`

### 8.2 Claim Store Persistence

**File:** `src/services/df-claim-store.ts`

**Vấn đề:** In-memory Map → mất hết claim codes khi bot restart

**Fix:** Persist claim codes vào SQLite table `claim_codes`

---

## Phase 9: Comment Language Unification (P3 — 15 phút)

**Vấn đề:** Bilingual comments — booster/welcome dùng English, df/container dùng Vietnamese

| File                         | Language   |
| ---------------------------- | ---------- |
| `booster/command.ts`         | English    |
| `welcome/setup.command.ts`   | English    |
| `section-config.handlers.ts` | English    |
| `df-daily.command.ts`        | Vietnamese |
| `team-find.command.ts`       | Vietnamese |

**Fix:** Đổi tất cả booster/welcome comments sang Vietnamese (ngôn ngữ chính của project)

---

## Timeline Estimate

| Phase                         | Effort          | Priority |
| ----------------------------- | --------------- | -------- |
| 0: Cleanup Artifacts          | 5 min           | P0       |
| 1: Eliminate `as any`         | 30 min          | P0       |
| 2: Normalize Signatures       | 10 min          | P1       |
| 3: Remove Test Commands       | 5 min           | P1       |
| 4: Extract Hardcoded Values   | 15 min          | P1       |
| 5: Unify Container V2 Pattern | 0 min (đã xong) | —        |
| 6: Reply Flag Consistency     | 0 min (đã xong) | —        |
| 7: Security & Robustness      | 20 min          | P2       |
| 8: Performance                | 15 min          | P2       |
| 9: Comment Language           | 15 min          | P3       |

### **Total: ~2h 15min**
