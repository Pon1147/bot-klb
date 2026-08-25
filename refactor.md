# DF Toolbox — Refactor Checklist

> Audit bugs và roadmap fix cho bot Discord + extension
> Current score: ~7.5/10 → Target: 9/10+

---

## P0: Critical Bugs

### 1. `/df-link start` — không invalidate old claim sessions trong DB

**Vấn đề:** Khi user gọi `/df-link start` lần 2, code xóa old entry khỏi in-memory TTLStore nhưng old code trong `df_claim_sessions` (DB) vẫn valid cho đến khi expire → user có thể dùng code cũ để link.

**File cần fix:** `src/services/df-claim-store.ts`, `src/commands/df/link.command.ts`

**Fix:**
- Gọi `invalidateUserClaims(database, discordUserId)` trước khi sinh code mới
- Hoặc xóa old code khỏi TTLStore + DB atomicly

---

### 2. `/df-link manual` — lưu vào legacy DB thay vì encrypted binding

**Vấn đề:** `handleManual` lưu trực tiếp vào `df_tokens` (plaintext) thay vì `df_account_bindings` (encrypted). `runDfCommand` ưu tiên binding mới → manual link chỉ hoạt động khi binding không tồn tại.

**File cần fix:** `src/commands/df/link.command.ts`

**Fix:**
- Dùng `upsertAccountBinding()` thay vì `saveDfToken()`
- Encrypt credential trước khi lưu
- Update message hướng dẫn user dùng `/df-link start` thay vì manual

---

### 3. `runDfCommand` — decrypt fallback silent

**Vấn đề:** Khi decrypt binding thất bại (crypto key missing, corrupt data), code tự động fallback sang legacy token mà không báo lỗi → user không biết binding bị corrupt.

**File cần fix:** `src/utils/df-command.runner.ts`

**Fix:**
- Log error chi tiết khi decrypt fail
- Trả về error container thay vì silent fallback
- Hoặc tự động migrate legacy → binding khi detect legacy token

---

## P1: Medium Bugs

### 4. `/df-unlink` + `/df-link unlink` — trùng lặp chức năng

**Vấn đề:** 2 commands khác nhau làm cùng 1 việc (revoke binding + delete token), gây nhầm lẫn cho user.

**File cần fix:** `src/commands/df/link.command.ts`, `src/commands/df/unlink.command.ts`

**Fix:**
- Chọn 1 làm canonical (khuyên dùng `/df-unlink` riêng)
- Subcommand `/df-link unlink` → redirect sang `/df-unlink` hoặc deprecate

---

### 5. `/df-daily` — API response type không rõ ràng

**Vấn đề:** Code dùng `battleReport?.battlefield_battle ?? battleReport?.beacon_battle` nhưng type `DailyReport` có thể không có `beacon_battle`.

**File cần fix:** `src/commands/df/daily.command.ts`, `src/types/deltaforce.types.ts`

**Fix:**
- Kiểm tra type definition của `DailyReport`
- Thêm type guard cho `beacon_battle`
- Hoặc đổi fallback field phù hợp

---

### 6. `/df-stats` select — rate limit 2s cố định

**Vấn đề:** `dfStatsSelect.handler.ts:64` có `setTimeout(resolve, 2000)` cứng → trải nghiệm chậm khi user chọn season nhiều lần.

**File cần fix:** `src/events/dfStatsSelect.handler.ts`

**Fix:**
- Giảm xuống 500ms hoặc bỏ hoàn toàn (API không rate-limit)
- Hoặc dùng per-user rate limit (1 request/3s)

---

### 7. `/df-link unlink` (subcommand) — không revoke legacy token

**Vấn đề:** `handleUnlink` trong `link.command.ts` chỉ gọi `revokeBinding()` nhưng không xóa `df_tokens` entry → `/df-link status` sau unlink vẫn hiện legacy token.

**File cần fix:** `src/commands/df/link.command.ts`

**Fix:**
- Thêm `database.prepare('DELETE FROM df_tokens WHERE discord_id = ?').run(interaction.user.id)` sau revokeBinding

---

## P2: Minor Bugs

### 8. `/df-history` — count text sai

**Vấn đề:** Hiển thị `matchData.list.length` nhưng mảng render là `matches` (đã slice theo limit) → số liệu không khớp.

**File cần fix:** `src/commands/df/daily.command.ts` (dòng 125)

**Fix:**
- Đổi thành `${matches.length} / ${Math.min(matchData.list.length, MAX_HISTORY_PAGE)} trận`

---

### 9. `/df-code show` — lỗi chính tả

**Vấn đề:** `"Loi khi lay du lieu"` thay vì `"Lỗi khi lấy dữ liệu"`.

**File cần fix:** `src/commands/df/code.command.ts` (dòng 112)

**Fix:**
- Đổi thành `buildErrorContainer(\`Lỗi khi lấy dữ liệu: \${(error as Error).message}\`)`

---

### 10. `expireBinding` — không xóa legacy token

**Vấn đề:** `expireBinding()` chỉ update status binding thành `expired` nhưng `df_tokens` entry vẫn tồn tại.

**File cần fix:** `src/database/df-binding.db.ts`

**Fix:**
- Thêm `database.prepare('DELETE FROM df_tokens WHERE discord_id = ?').run(discordUserId)` sau update status

---

## Migration Notes

- Giữ backward compatibility với legacy `df_tokens` table
- Không xóa table `df_tokens` — vẫn dùng cho manual link fallback
- Crypto key `DF_CRED_KEY_V1` phải được config trước khi dùng encrypted binding

---

## Architecture Target

```
df_tokens (legacy, plaintext)
    ↓ fallback
df_account_bindings (encrypted, AES-256-GCM)
    ↓ canonical
runDfCommand → decryptCredential → API calls
```

---

## Commit Strategy

Mỗi bug → 1 commit riêng:

1. `fix(df-link): invalidate old claim sessions trong DB khi start mới`
2. `fix(df-link): lưu manual link vào encrypted binding thay vì legacy`
3. `fix(df-command): báo lỗi thay vì silent fallback khi decrypt thất bại`
4. `chore(df): deprecate /df-link unlink, giữ /df-unlink`
5. `fix(df-daily): kiểm tra type beacon_battle trước khi access`
6. `perf(df-stats): giảm rate limit season select từ 2s xuống 500ms`
7. `fix(df-link): revoke legacy token khi unlink`
8. `fix(df-history): sửa count text cho matches.length`
9. `fix(df-code): sửa lỗi chính tả "Loi" → "Lỗi"`
10. `fix(df-binding): xóa legacy token khi expire binding`
