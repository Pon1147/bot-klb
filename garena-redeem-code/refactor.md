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
  - [ ] Enum states: PENDING, SUCCESS, FAILED, TIMEOUT, CANCELLED

- [x] AuthEngine dùng chung correlation mechanism
  - [x] REFRESH_REQUEST → requestId
  - [x] REFRESH_RESPONSE → requestId match
  - [x] Correlate request/response pairs

- [x] Update `auth-investigator.js` interceptor
  - [x] Gán requestId vào XHR/fetch intercept
  - [x] Truyền requestId qua postMessage

---

## P1: Separate Engines

- [ ] Tách `RedeemEngine` khỏi `content.js`
  - [ ] Tạo file `content/redeem-engine.js`
  - [ ] Queue management, retry logic, state
  - [ ] `content.js` chỉ còn injection + message bridge

- [ ] Tách `AuthEngine` thành module độc lập
  - [ ] State machine: UNKNOWN → ACTIVE → EXPIRING_SOON → EXPIRED → CONFIRMED_EXPIRED
  - [ ] Refresh flow: REFRESHING → ACTIVE / EXPIRED
  - [ ] Session management với sessionId

- [ ] `content.js` refactor thành thin bridge
  - [ ] Inject scripts (page-capture, auth-investigator, auth-state-engine)
  - [ ] Listen postMessage → dispatch to engines
  - [ ] Target: <200 lines

---

## P1: Service Worker Notification Orchestrator

- [ ] AuthEngine → chrome.runtime.sendMessage(AUTH_EXPIRED)
  - [ ] Không gửi Discord từ content.js
  - [ ] Event format: `{ type, sessionId, reason, timestamp }`

- [ ] Service Worker làm notification orchestrator
  - [ ] Nhận AUTH_EXPIRED từ content scripts
  - [ ] Deduplication per session+type (5 phút)
  - [ ] Rate limiting
  - [ ] Gửi Discord webhook embed

- [ ] AUTH_RESTORED notification
  - [ ] Emit khi session được restore (new token)
  - [ ] Chỉ gửi sau khi có AUTH_EXPIRED trước đó

- [ ] AUTH_REFRESH_FAILED notification
  - [ ] Emit khi refresh request nhưng không có new token

---

## P1: Auth State Engine UI

- [ ] Popup Auth State Engine tab
  - [ ] Auth state banner (ACTIVE/EXPIRING_SOON/EXPIRED/CONFIRMED_EXPIRED)
  - [ ] Session ID display
  - [ ] Token remaining countdown
  - [ ] Notifications list (read/unread)

- [ ] Sub-tabs trong Auth State Engine
  - [ ] Overview: session, token, refresh status
  - [ ] Timeline: auth events timeline
  - [ ] Refresh: refresh flow checklist + correlation pairs
  - [ ] Network: filtered network events
  - [ ] Storage: storage write events

- [ ] Event Inspector Modal
  - [ ] Click timeline event → show details
  - [ ] Show auth fields, hashes, correlation
  - [ ] Click outside or × to close

- [ ] Clear buttons
  - [ ] Clear events
  - [ ] Clear notifications

---

## P2: Runtime Event Bus

- [ ] Tạo in-memory event bus
  - [ ] Capture → Event Bus → Engines
  - [ ] Engines publish events, UI subscribe

- [ ] chrome.storage.local chỉ làm persistence
  - [ ] Save state khi có change
  - [ ] Load state khi init
  - [ ] Không dùng onChanged làm event bus

- [ ] Popup subscribe qua chrome.runtime.sendMessage
  - [ ] Periodic poll (5s) cho auth state
  - [ ] Message-based cho events

---

## Security & Reliability

- [ ] Không gửi raw tokens qua Discord
  - [ ] Chỉ gửi state + sessionId (short hash)
  - [ ] No access_token, refresh_token, cookie, OpenID

- [ ] Token fingerprint thay vì raw token
  - [ ] SHA-256 hash của access_token
  - [ ] Hash cho identity mapping (garena_sns_openid vs dfTools openid)

- [ ] Handle extension context invalidated
  - [ ] Guard chrome.runtime?.id trước khi gửi message
  - [ ] Graceful degradation khi tab reload

- [ ] Prevent race conditions
  - [ ] Register waiter BEFORE trigger request
  - [ ] Single source of truth cho state

---

## Testing

- [ ] Browser test snippet cho Auth State Engine
  - [ ] 12 test cases: state transitions, rate limiting, session management
  - [ ] Test refresh flow (success/failed)
  - [ ] Test terminal state guard

- [ ] Test NetworkEvent correlation
  - [ ] requestId matching
  - [ ] Multiple concurrent requests

---

## Migration Notes

- [ ] Giữ backward compatibility với event format cũ
  - [ ] Normalize cả raw và normalized events
  - [ ] Support old popup.js logic trong过渡期

- [ ] Không rewrite toàn bộ
  - [ ] Từng layer, từng commit
  - [ ] Mỗi commit phải chạy được

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
