# REFACTOR PLAN — KL BOT (Architectural Refactor)

## Tổng quan

Project: Discord Bot (TypeScript + discord.js v14 + better-sqlite3)
Mục tiêu: Giải quyết 4 điểm yếu kiến trúc trước khi phát triển feature mới
Tổng effort còn lại: ~7.5 giờ

## Tiền đề

Đã hoàn thành 6 phases refactor đầu (Phase 0-6): ESLint config, magic values, console→logger, eliminate any types, centralize custom IDs, bug fixes, decorator typing.

Đánh giá 9 điểm yếu claimed → **8/9 đúng**, 1 điểm (permission check trùng) thực chất là design có chủ đích với 2 lớp permission độc lập.

---

## ⏳ Phase 7: Extract Join-Voice + Fix Hardcoded Prefix

**Risk:** Low | **Impact:** Medium | **Thời lượng:** ~1h

### Điểm yếu

- `interactionCreate.event.ts` = 236 dòng, đóng vai trò "god router" cho tất cả interactions
- Join-voice logic (~60 dòng) nằm inline trong event handler
- 1 hardcoded prefix string: `'container_'` (dòng 35)

### Files tạo mới

- `src/commands/df/team-find.handlers.ts` — `handleTeamFindButton()` + `handleJoinVoice()`

### Files sửa

| File                                      | Changes                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/events/interactionCreate.event.ts`   | Delegate Map/Mode/Done → `handleTeamFindButton()`, xóa inline join-voice (236 → ~170 dòng) |
| `src/commands/container/container-ids.ts` | Thêm `PREFIX: 'container_'` constant                                                       |
| `src/events/interactionCreate.event.ts`   | `'container_'` → `ContainerIds.PREFIX`                                                     |

### Verification

- `npm run check`: 0 errors
- `npm run test`: all pass
- Manual: click join button trong team-find flow → bot join voice

---

## ⏳ Phase 8: Shared DF Command Runner

**Risk:** Medium | **Impact:** High | **Thời lượng:** ~2.5h

### Điểm yếu

- `stats.command.ts`, `daily.command.ts`, `history.command.ts` lặp ~30 dòng boilerplate mỗi file
- Pattern: requireGuild → getDfToken + error reply → deferReply → API → touchDfToken → editReply → catch + buildErrorContainer
- `requireDfToken` guard tồn tại trong `df-guards.ts` nhưng KHÔNG file nào dùng

### Files tạo mới

- `src/utils/df-command.runner.ts` — `runDfCommand(ctx, fn)` function

```typescript
// Runner xử lý boilerplate, command chỉ cần:
await runDfCommand({ userId: interaction.user.id, database, interaction }, async (apiToken) => {
  const data = await getSeasonData(apiToken, LATEST_SEASON);
  return { components: buildStatsContainer(data), flags: MessageFlags.IsComponentsV2 };
});
```

### Files sửa

| File                                 | Changes                                          |
| ------------------------------------ | ------------------------------------------------ |
| `src/commands/df/stats.command.ts`   | Remove ~50 dòng boilerplate, giữ domain logic    |
| `src/commands/df/daily.command.ts`   | Remove ~40 dòng (có unique `.catch()` pattern)   |
| `src/commands/df/history.command.ts` | Remove ~50 dòng boilerplate, giữ match rendering |

### Verification

- `npm run check`: 0 errors
- `npm run test`: df-stats, df-daily, df-history tests pass
- Manual: `/df-stats`, `/df-daily`, `/df-history` → same output như trước

---

## ⏳ Phase 9: Shared TTL Store Abstraction

**Risk:** Medium | **Impact:** Medium | **Thời lượng:** ~2.5h

### Điểm yếu

- 4 session stores độc lập, tất cả share pattern: `Map<string, T>` + TTL + cleanup + start/stop
- Không có shared abstraction — copy-paste thủ công

| Store       | File                         | TTL               | Key            |
| ----------- | ---------------------------- | ----------------- | -------------- |
| Container   | `container-session.ts`       | lastInteractionAt | userId         |
| Team-find   | `team-find-session.ts`       | lastInteractionAt | userId         |
| DF Claim    | `df-claim-store.ts`          | expiresAt         | code           |
| Message ref | `team-find-message-store.ts` | None              | guildId:userId |

### Files tạo mới

- `src/utils/ttl-store.ts` — `TTLStore<K, V>` generic class

```typescript
export class TTLStore<K extends string, V extends { expiresAt: number }> {
  set(key: K, value: V): void;
  get(key: K): V | undefined; // auto-expire check
  delete(key: K): void;
  cleanupExpired(): number;
  startCleanup(intervalMs: number): void;
  stopCleanup(): void;
  clear(): void;
  size: number;
}
```

### Files sửa

| File                                          | Changes                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `src/services/df-claim-store.ts`              | Dùng TTLStore cho Map + cleanup                            |
| `src/services/team-find-session.ts`           | Dùng TTLStore, wrap `lastInteractionAt` → `expiresAt`      |
| `src/commands/container/container-session.ts` | Dùng TTLStore, giữ `touchSession`/`isSessionValid`         |
| `src/services/team-find-message-store.ts`     | **Giữ nguyên** — không TTL, quá nhỏ (40 dòng, 4 functions) |

### Verification

- `npm run check`: 0 errors
- `npm run test`: df-claim-store.test.ts, container session tests pass
- Manual: `/team-find` session works, `/container edit` session works

---

## ⏳ Phase 10: Fix /df-code + Unify Error Handling

**Risk:** Low | **Impact:** Medium | **Thời lượng:** ~1.5h

### Điểm yếu

- `/df-code` có dead code path (dòng 121) — Discord không send interaction cho unregistered subcommands
- Error handling trộn lẫn 2 pattern: `buildErrorContainer()` vs plain `content` strings
- `team-find.interaction.ts` dùng plain text cho session ownership checks nhưng container cho logic errors

### Files tạo mới

- `src/utils/reply.utils.ts` — `replyWithContainer()` + `replyWithError()` helpers

```typescript
export async function replyWithContainer(
  interaction,
  result: BuildContainerResult,
  isEdit: boolean,
): Promise<void>;
export async function replyWithError(interaction, message: string, isEdit: boolean): Promise<void>;
```

### Files sửa

| File                                       | Changes                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/commands/df/code.command.ts`          | Remove dead default path, thêm guard throw                                    |
| `src/commands/df/team-find.interaction.ts` | 7 chỗ plain text → `buildErrorContainer` (dòng 34, 43, 76, 85, 114, 123, 153) |

### Verification

- `npm run check`: 0 errors
- `npm run test`: df-code.test.ts pass
- Manual: `/df-code status`, `/df-code setchannel #channel` work
- Manual: /team-find error messages dùng containers

---

## Tổng kết

| Phase     | Category                        | New Files | Modified Files | Est. Time |
| --------- | ------------------------------- | --------- | -------------- | --------- |
| 7         | Extract join-voice + fix prefix | 1         | 3              | 1h        |
| 8         | DF command runner               | 1         | 4              | 2.5h      |
| 9         | TTL store abstraction           | 1         | 3              | 2.5h      |
| 10        | Error unification               | 1         | 3              | 1.5h      |
| **Total** |                                 | **4**     | **13**         | **~7.5h** |
