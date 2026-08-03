# Phase 1 — Research Report: DfTools Credential Lifecycle

> **Ngày:** 2026-08-03
> **Version:** r2 (khớp `df-link-architecture-guide.md` r2)
> **Trạng thái:** Analysis-based (chưa có live testing)
> **Nguyên tắc:** Observation ≠ Assumption. Cập nhật thuật ngữ sau Phase 1.

---

## 1. Observation (đã thấy trên wire/codebase)

### 1.1 DfTools Request Parameters

Các param quan sát được từ DfTools API requests:

| Param | Type | Observed Value | Source |
|-------|------|----------------|--------|
| `openid` | string (hex) | Fixed per account | URL query param |
| `token` | string (hex, 40-64 chars) | Fixed per session | URL query param |
| `ts` | string (numeric) | Changes per request | URL query param |
| `s` | string (hex) | Captured from URL | URL query param |
| `u` | string (UUID) | `randomUUID()` per request | URL query param |
| `a` | string | `10005` | URL query param (static) |
| `game_id` | string | `30150` | Config |
| `channel` | string | `10` | Config |
| `account_type` | string | `1` | Config |
| `lang_type` | string | `vi` | Config |

### 1.2 Endpoints Observed

| Endpoint | Method | Observed Params | Used By |
|----------|--------|-----------------|---------|
| `/GetMyData` | POST | openid, token, ts, s, u + body `{ seasonno: [...] }` | `/df-stats` |
| `/GetMatchList` | POST | openid, token, ts, s, u + body `{ seasonno: [10009] }` | `/df-history` |
| `/GetDahongCollection` | POST | openid, token, ts, s, u + body `{}` | `/df-stats` |
| `/GetDailyReport` | POST | openid, token, ts, s, u + body `{}` | `/df-daily` |
| `/GetPrivateRoomKey` | POST | u, a, ts, s (không thấy token trong URL mẫu) | Research |

### 1.3 Current Implementation

```
Browser (HQ session)
    ↓ capture (userscript hook fetch/XHR + localStorage scan)
POST /api/df/claim (webhook, no-cors)
    ↓
saveDfToken() → df_tokens table (PLAINTEXT)
    ↓
DfTools API client → buildInstance() → axios with ALL params
    ↓
Discord response
```

**Điểm cần lưu ý:**
- Credential đang lưu **plaintext** → cần Phase 3 (AES-256-GCM)
- Userscript dùng `mode: 'no-cors'` → architecture guide nói đây là **research only**
- Claim code lưu **in-memory** (TTLStore) → cần Phase 2 (DB-backed)
- `ts`, `s`, `u` được capture và lưu nhưng **vai trò chưa rõ**

---

## 2. Research Questions (R1–R5) — Chưa trả lời

| ID | Câu hỏi | Status | Impact |
|----|---------|--------|--------|
| **R1** | Credential có **reuse ngoài browser** không? | ❓ Chưa test | Bot server-side có sống được không |
| **R2** | Dùng được **endpoint khác** endpoint đã capture không? | ❓ Chưa test | Scope của bot |
| **R3** | **Expire** sau bao lâu? (T+10m / 1h / 24h) | ❓ Chưa test | Tần suất re-link |
| **R4** | Request nào **replay nguyên vẹn** (cùng URL/param) được? | ❓ Chưa test | Request reusable vs credential reusable |
| **R5** | `ts`/`s`/`u`/`a` là **static credential** hay **request-generated**? | ❓ Chưa test | Có lưu DB / có phải sign lại mỗi call |

### Hypotheses (chưa xác nhận — đánh dấu assumption)

| # | Hypothesis | Loại | Cơ sở |
|---|------------|------|-------|
| H1 | Credential reusable ngoài browser | Assumption | Bot đang gọi thành công không cần mở HQ |
| H2 | Credential có expire (hours → days) | Assumption | Guide nhắc đến re-link |
| H3 | Không có refresh mechanism | Assumption | Guide: "HQ chỉ lúc link/re-link" |
| H4 | `s` có thể là `f(token, ts, params)` → request-generated | Assumption | Guide phân biệt `s` vs `ts` |
| H5 | Mỗi endpoint cần bộ param khác nhau | Observation | Log thấy `GetPrivateRoomKey` khác param |

---

## 3. Phân tách Persistent vs Request Context (dự kiến, sau R5)

> **Cảnh báo:** Schema dưới đây là **dự kiến** sau Phase 1 xác nhận. Chưa commit production model.

### 3.1 Persistent Credential (ứng viên)

```
Những gì CÓ THỂ lưu dài hạn (sau R5 xác nhận):
├── openid       (identifier, không phải auth secret)
└── token        (nếu chứng minh được reusable dài hạn)
    (+ field nào chứng minh reusable)
```

### 3.2 Request Context (per call, có thể generate lại)

```
Những gì CÓ THỂ sinh lại mỗi request:
├── ts           (timestamp — sinh khi cần)
├── s            (nếu s = f(token, ts, params) → regenerate, không lưu)
├── u            (UUID — mỗi request mới)
├── a            (static = 10005)
└── endpoint-specific params
```

**Nếu H4 đúng** (`s = f(token, ts, params)`): `s` **không** lưu trong DB như secret lâu dài. Client regenerate từ token + ts + params.

---

## 4. Telemetry Research (Optional, tách biệt)

```sql
CREATE TABLE credential_capture_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT,
  endpoint TEXT,              -- tên endpoint quan sát
  captured_at DATETIME,
  credential_fingerprint TEXT, -- hash ngắn / len — không phải secret
  notes TEXT
);
```

**AccountBinding ≠ research log.** Tách biệt rõ ràng.

---

## 5. Next Steps

1. **Phase 1 complete khi:** R1–R5 có ghi chú kết quả từ live testing
2. **Sau Phase 1:** Khóa final credential model, request signing strategy, TTL policy
3. **Phase 2–3:** Architecture + Security (dựa trên kết quả Phase 1)
4. **Phase 4–5:** UX + Implementation

---

_Generated from codebase analysis on 2026-08-03. Observation ≠ assumption. Live testing required for R1–R5._
