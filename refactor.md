# Refactor: Loại bỏ logic dư thừa trong commands

## Context
Audit phát hiện 18 finding với ~200+ dòng code trùng lặp. Goal: giảm boilerplate, tăng DRY, không thay đổi hành vi runtime.

---

## Phase 1: Extract `sendReply` helper (Priority 1 — ảnh hưởng 16+ files)

**File tạo mới:** `src/utils/reply.utils.ts`

```typescript
export async function sendReply(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions | MessageCreateOptions,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply(payload);
  }
}
```

**Files cần sửa (thay thế if/else replied/deferred bằng sendReply):**
- `src/utils/df-guards.ts` — lines 10-16, 31-41, 55-65 (3 chỗ)
- `src/utils/section-config.handlers.ts` — lines 59-73, 94-108, 129-142, 162-180 (4 chỗ)
- `src/utils/df-command.runner.ts` — lines 87-94
- `src/commands/df/link.command.ts` — lines 131-134, 151-154, 160-163
- `src/commands/df/unlink.command.ts` — lines 23-27, 38-41
- `src/commands/df/team-find.interaction.ts` — lines 33-38, 75-80, 113-118, 152-157
- `src/commands/container/container-routers.ts` — lines 55-59, 145-149, 165-169, 177-182, 189-197, 200-208, 218-222
- `src/commands/df/history.command.ts` — lines 96-102
- `src/commands/df/code.command.ts` — lines 113-132
- `src/commands/container/container-edit.handler.ts` — lines 24-38
- `src/commands/container/container.command.ts` — lines 137-151
- `src/commands/df/team-find.command.ts` — lines 29-34
- `src/commands/admin/set-role.command.ts` — lines 97-122

---

## Phase 2: Extract `requireAdministrator` guard (Priority 2 — 4 files)

**Thêm vào:** `src/utils/df-guards.ts`

```typescript
export async function requireAdministrator(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) return true;
  const member = interaction.member as GuildMember;
  if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
    await sendReply(interaction, { content: 'Bạn cần quyền Administrator...', flags: MessageFlags.Ephemeral });
    return true;
  }
  return false;
}
```

**Files cần sửa:**
- `src/commands/df/code.command.ts` — lines 92-108 (thay thế guild guard + admin guard)
- `src/commands/admin/set-role.command.ts` — lines 65-80
- `src/commands/container/container.command.ts` — lines 95-111
- `src/utils/section-config.handlers.ts` — lines 214-220

---

## Phase 3: Consolidate container builders (Priority 3)

**File:** `src/utils/container.utils.ts` — lines 245-273

Thay 3 hàm `buildSuccessContainer`, `buildErrorContainer`, `buildInfoContainer` bằng 1 hàm tham số hóa:

```typescript
function buildStatusContainer(
  message: string,
  icon: string,
  color: number,
): BuildContainerResult {
  const text = { type: ComponentType.TextDisplay, content: `**${icon}**\n${message}` };
  const sep = { type: ComponentType.Separator, accentColor: color };
  return makeResult([{ type: ComponentType.Container, components: [text, sep] }], 65536);
}
```

---

## Phase 4: Extract session helpers trong team-find (Priority 4)

**File:** `src/utils/team-find.utils.ts` (mới) hoặc thêm vào `src/commands/df/team-find.interaction.ts`

```typescript
async function checkOwnership(interaction: StringSelectMenuInteraction, userId: string): Promise<boolean> {
  if (userId !== interaction.user.id) {
    await sendReply(interaction, { content: 'Đây không phải session của bạn.', flags: MessageFlags.Ephemeral });
    return true; // blocked
  }
  return false;
}

async function checkSession(interaction: StringSelectMenuInteraction, userId: string): Promise<Session | null> {
  const session = getSession(userId);
  if (!session) {
    await sendReply(interaction, { content: SESSION_EXPIRED_MESSAGE, flags: MessageFlags.Ephemeral });
    return null;
  }
  return session;
}
```

**Files cần sửa:**
- `src/commands/df/team-find.interaction.ts` — 4 chỗ check ownership, 3 chỗ check session

---

## Phase 5: Extract openid masking helper (Priority 5)

**File:** `src/utils/string.utils.ts` (mới)

```typescript
export function maskString(str: string, prefixLen: number = 4, suffixLen: number = 4): string {
  return str.length > prefixLen + suffixLen
    ? `${str.slice(0, prefixLen)}****${str.slice(-suffixLen)}`
    : '****';
}
```

**Files cần sửa:**
- `src/commands/df/link.command.ts` — lines 118-121, 141-144

---

## Phase 6: Simplify stats.command.ts (Priority 6-7)

**File:** `src/commands/df/stats.command.ts`

- Lines 40-41: Bỏ `?.` thừa → `rankInfo.name ?? 'Chưa rõ'`
- Lines 64-89: Tạo helper `buildStatBlock(data, formatter)` thay 3 ternary giống nhau

---

## Phase 7: Cleanup redundant handlers (Priority 8-10)

**File:** `src/commands/df/daily.command.ts`
- Lines 55-58: Xóa `.catch()` local → để runner handle error

**File:** `src/commands/df/link.command.ts`
- Line 193: Đổi raw SQL → `deleteDfToken(database, interaction.user.id)`

**File:** `src/commands/admin/set-role.command.ts`
- Lines 29-43: Generic builder `buildRoleSubcommand(name, description)`

---

## Verification sau mỗi phase
```bash
npm run check   # type check
npm run test    # 571 tests pass
```

## Ước tính impact
- **Phase 1**: -80 dòng duplicated
- **Phase 2**: -30 dòng duplicated
- **Phase 3**: -20 dòng, 3 hàm → 1
- **Phase 4**: -40 dòng duplicated
- **Phase 5-10**: -30 dòng tổng

**Tổng**: ~200 dòng giảm, 0 thay đổi hành vi runtime.
