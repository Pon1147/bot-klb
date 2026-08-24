# Auth State Engine — Implementation Checklist

> Architecture refactor theo P0 → P1 → P2 roadmap
> Current score: 7.3/10 → Target: 9/10+

---

## P0: NetworkEvent Normalization + RequestId Correlation

- [x] Chuẩn hóa `NetworkEvent` shape trong `page-capture.js`
  - [x] Thêm `requestId` (UUID) cho mỗi request
  - [x] Format: `{ id, requestId, type, timestamp, method, url, status, body }`
  - [x] postMessage qua content.js với format mới

- [x] RedeemController dùng `requestId` correlation
  - [x] Register waiter BEFORE click button
  - [x] Match response bằng requestId thay vì URL/timestamp/code
  - [x] Enum states: PENDING, SUCCESS, FAILED, TIMEOUT, CANCELLED

- [x] AuthEngine dùng chung correlation mechanism
  - [x] REFRESH_REQUEST → requestId
  - [x] REFRESH_RESPONSE → requestId match
  - [x] Correlate request/response pairs

- [x] Update `auth-investigator.js` interceptor
  - [x] Gán requestId vào XHR/fetch intercept
  - [x] Truyền requestId qua postMessage

---

## P1: Separate Engines

- [x] Tách `RedeemEngine` khỏi `content.js`
  - [x] Tạo file `content/redeem-engine.js`
  - [x] Queue management, retry logic, state
  - [x] `content.js` chỉ còn injection + message bridge

- [x] Tách `AuthEngine` thành module độc lập
  - [x] State machine: UNKNOWN → ACTIVE → EXPIRING_SOON → EXPIRED → CONFIRMED_EXPIRED
  - [x] Refresh flow: REFRESHING → ACTIVE / EXPIRED
  - [x] Session management với sessionId

- [x] `content.js` refactor thành thin bridge
  - [x] Inject scripts (page-capture, auth-investigator, auth-state-engine)
  - [x] Listen postMessage → dispatch to engines
  - [x] Target: <200 lines (134 lines)

---

## P1: Service Worker Notification Orchestrator

- [x] AuthEngine → chrome.runtime.sendMessage(AUTH_EXPIRED)
  - [x] Không gửi Discord từ content.js
  - [x] Event format: `{ type, sessionId, reason, timestamp }`

- [x] Service Worker làm notification orchestrator
  - [x] Nhận AUTH_EXPIRED từ content scripts
  - [x] Deduplication per session+type (5 phút)
  - [x] Rate limiting
  - [x] Gửi Discord webhook embed

- [x] AUTH_RESTORED notification
  - [x] Emit khi session được restore (new token)
  - [x] Chỉ gửi sau khi có AUTH_EXPIRED trước đó

- [x] AUTH_REFRESH_FAILED notification
  - [x] Emit khi refresh request nhưng không có new token

---

## P1: Auth State Engine UI

- [x] Popup Auth State Engine tab
  - [x] Auth state banner (ACTIVE/EXPIRING_SOON/EXPIRED/CONFIRMED_EXPIRED)
  - [x] Session ID display
  - [x] Token remaining countdown
  - [x] Notifications list (read/unread)

- [x] Sub-tabs trong Auth State Engine
  - [x] Overview: session, token, refresh status
  - [x] Timeline: auth events timeline
  - [x] Refresh: refresh flow checklist + correlation pairs
  - [x] Network: filtered network events
  - [x] Storage: storage write events

- [x] Event Inspector Modal
  - [x] Click timeline event → show details
  - [x] Show auth fields, hashes, correlation
  - [x] Click outside or × to close

- [x] Clear buttons
  - [x] Clear events
  - [x] Clear notifications

---

## P2: Runtime Event Bus

- [x] Tạo in-memory event bus
  - [x] Capture → Event Bus → Engines
  - [x] Engines publish events, UI subscribe

- [x] chrome.storage.local chỉ làm persistence
  - [x] Save state khi có change
  - [x] Load state khi init
  - [x] Không dùng onChanged làm event bus

- [x] Popup subscribe qua chrome.runtime.sendMessage
  - [x] Periodic poll (5s) cho auth state
  - [x] Message-based cho events

---

## Security & Reliability

- [x] Không gửi raw tokens qua Discord
  - [x] Chỉ gửi state + sessionId (short hash)
  - [x] No access_token, refresh_token, cookie, OpenID

- [x] Token fingerprint thay vì raw token
  - [x] SHA-256 hash của access_token
  - [x] Hash cho identity mapping (garena_sns_openid vs dfTools openid)

- [x] Handle extension context invalidated
  - [x] Guard chrome.runtime?.id trước khi gửi message
  - [x] Graceful degradation khi tab reload

- [x] Prevent race conditions
  - [x] Register waiter BEFORE trigger request
  - [x] Single source of truth cho state

---

## Testing

- [x] Browser test snippet cho Auth State Engine
  - [x] 12 test cases: state transitions, rate limiting, session management
  - [x] Test refresh flow (success/failed)
  - [x] Test terminal state guard

- [x] Test NetworkEvent correlation
  - [x] requestId matching
  - [x] Multiple concurrent requests

---

## Migration Notes

- [x] Giữ backward compatibility với event format cũ
  - [x] Normalize cả raw và normalized events
  - [x] Support old popup.js logic

- [x] Không rewrite toàn bộ
  - [x] Từng layer, từng commit
  - [x] Mỗi commit phải chạy được

---

## Architecture Target

```bash
                 PAGE
                  │
                  ▼
          ┌───────────────┐
          │ Capture Layer │ (page-capture.js)
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ Event Bus     │ (in-memory)
          └───────┬───────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
┌───────────────┐    ┌────────────────┐
│ Redeem Engine │    │ Auth Engine    │
└───────┬───────┘    └───────┬────────┘
        │                     │
        └──────────┬──────────┘
                   ▼
           ┌──────────────┐
           │ State Store  │ (chrome.storage.local)
           └──────┬───────┘
                  │
          ┌───────┴────────┐
          ▼                ▼
      Dashboard         Popup

Auth Event
     │
     ▼
chrome.runtime.sendMessage()
     │
     ▼
Service Worker
     │
     ▼
Discord Notification
```

---

## Commit Strategy

Mỗi feature → 1 commit riêng:

1. `feat(extension): chuẩn hóa NetworkEvent + requestId correlation`
2. `fix(redeem): dùng requestId thay vì timestamp correlation`
3. `refactor(content): tách RedeemEngine thành module`
4. `feat(auth): thêm Auth State Engine state machine`
5. `fix(service-worker): notification orchestrator`
6. `refactor(popup): Auth State Engine UI`
7. `test(extension): browser test snippet`
8. `perf(storage): chrome.storage.local chỉ làm persistence`
