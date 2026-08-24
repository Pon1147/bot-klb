Đúng. Tôi nghĩ đây là **bước tiếp theo hợp lý nhất**: chuyển Auth Investigator từ một công cụ "quan sát" thành **Auth State Engine**, rồi Discord chỉ nhận **event đã được xác minh**.

Tôi sẽ thiết kế lại flow theo hướng này:

## 1. Flow tổng thể

```text
┌──────────────────────┐
│ User mở trang Garena │
│ / Delta Force        │
└──────────┬───────────┘
           ↓
     Capture Auth
           ↓
┌──────────────────────┐
│ SESSION ACTIVE       │
│ Token fingerprint    │
│ expiresAt            │
│ identity mapping     │
└──────────┬───────────┘
           ↓
       User sử dụng
           ↓
      API request
           ↓
    ┌──────┴──────┐
    │             │
    ▼             ▼
  SUCCESS      EXPIRED
    │             │
    │             ▼
    │       Có refresh flow?
    │             │
    │        ┌────┴────┐
    │        │         │
    │       YES        NO
    │        │         │
    │        ▼         ▼
    │    REFRESH    SESSION_EXPIRED
    │        │         │
    │        ▼         ▼
    │    SUCCESS    Discord alert
    │                  │
    │                  ▼
    │          "Vui lòng F5..."
    │
    ▼
 SESSION ACTIVE
```

Nhưng tôi **không muốn chỉ dựa vào `expiresAt`**.

---

# 2. Quan trọng: phân biệt `EXPIRING` và `EXPIRED`

Auth engine nên có state machine:

```text
ACTIVE
  │
  ├── remaining > warningThreshold
  │
  ▼
EXPIRING_SOON
  │
  ├── remaining <= 0
  │
  ▼
EXPIRED
  │
  ├── request thực tế thất bại
  │
  ▼
CONFIRMED_EXPIRED
```

Ví dụ:

```text
ACTIVE
14d 22h remaining

        ↓

EXPIRING_SOON
10m remaining

        ↓

EXPIRED
0s

        ↓

CONFIRMED_EXPIRED
API request → token expired
```

### Vì sao cần `CONFIRMED_EXPIRED`?

Vì:

```text
expiresAt <= Date.now()
```

chỉ là **dự đoán theo client clock**.

Còn nếu server trả:

```text
401
TOKEN_EXPIRED
INVALID_TOKEN
SESSION_EXPIRED
```

thì đó mới là evidence mạnh.

---

# 3. Nếu token hết hạn nhưng user vẫn sử dụng

Đây chính là case bạn hỏi.

Ví dụ:

```text
Token expires:
10:00:00

User click "Get Data":
10:03:12
```

Interceptor bắt:

```text
REQUEST
   ↓
RESPONSE 401
   ↓
error = TOKEN_EXPIRED
```

Auth Engine chuyển:

```text
ACTIVE
   ↓
EXPIRED
   ↓
CONFIRMED_EXPIRED
```

Sau đó emit một event duy nhất:

```js
{
  type: 'AUTH_EXPIRED',
  reason: 'TOKEN_EXPIRED',
  timestamp: ...,
  sessionId: ...
}
```

**Không gửi access_token / refresh_token lên Discord.**

---

# 4. Discord notification

Bot nhận event:

```text
AUTH_EXPIRED
```

và gửi:

> 🔴 **Delta Force Authentication Expired**
>
> Token/session của bạn đã hết hạn và request vừa được xác nhận thất bại.
>
> **Vui lòng quay lại trang đăng nhập Garena/Delta Force và nhấn F5 để tạo session mới.**
>
> Trạng thái: `EXPIRED`
>
> Thời điểm: `10:03:12`

Tôi sẽ không ghi:

```text
Token: eyJ...
Refresh Token: ...
OpenID: ...
```

Discord chỉ nhận **state + diagnostic metadata tối thiểu**.

---

# 5. Nhưng đừng gửi Discord notification mỗi request

Đây là một pain point rất dễ phát sinh.

Token expired → user tiếp tục click 20 lần.

Nếu logic đơn giản:

```js
if (expired) sendDiscord();
```

thì Discord sẽ nhận:

```text
10:03 Token expired
10:03 Token expired
10:03 Token expired
10:04 Token expired
...
```

Rất khó chịu.

Phải có **notification deduplication**.

Ví dụ:

```js
session.expiredNotified = true;
```

Sau khi gửi:

```text
AUTH_EXPIRED
     ↓
Discord notification
     ↓
notified = true
```

Các request sau:

```text
TOKEN_EXPIRED
TOKEN_EXPIRED
TOKEN_EXPIRED
```

→ **không gửi lại**.

---

# 6. Khi user F5 và lấy token mới

Đây là phần rất quan trọng.

User:

```text
F5
 ↓
Garena login/session
 ↓
new access_token
 ↓
new fingerprint
 ↓
new expiresAt
```

Auth Engine phát hiện:

```text
old fingerprint ≠ new fingerprint
```

và:

```text
new expiresAt > Date.now()
```

→ chuyển:

```text
EXPIRED
   ↓
AUTHENTICATING
   ↓
ACTIVE
```

đồng thời reset:

```js
expiredNotified = false;
```

Sau đó Discord có thể gửi **một message recovery**:

> 🟢 **Authentication Restored**
>
> Session mới đã được phát hiện.
>
> Token: `ACTIVE`
>
> Expires: `...`

Hoặc nếu bạn muốn giảm spam, chỉ gửi message này khi trước đó đã có `AUTH_EXPIRED`.

---

# 7. Tôi đề xuất dùng `sessionId`

Đây là thay đổi architecture tôi rất muốn thêm.

Mỗi lần nhận diện token mới:

```js
sessionId = randomUUID();
```

Ví dụ:

```text
Session A
──────────────
fingerprint: abc...
expires: 10:00
status: ACTIVE
```

hết hạn:

```text
Session A
status: EXPIRED
```

User F5:

```text
Session B
──────────────
fingerprint: xyz...
expires: 10:00 tomorrow
status: ACTIVE
```

Như vậy hệ thống không nhầm:

```text
old token
```

với:

```text
new token
```

và Discord event có thể chứa:

```text
sessionId: short-id
```

chỉ để correlation, **không phải credential**.

---

# 8. Logic nên thiết kế thành Auth State Machine

Tôi sẽ không để `popup.js`, `content.js`, `background.js` mỗi nơi tự quyết định token expired.

Tạo một lớp trung tâm:

```text
AuthStateEngine
```

Ví dụ:

```js
const AUTH_STATES = {
  UNKNOWN: 'UNKNOWN',
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  REFRESHING: 'REFRESHING',
  AUTHENTICATING: 'AUTHENTICATING',
};
```

Và event:

```js
AUTH_EVENTS = {
  TOKEN_DETECTED,
  TOKEN_REFRESH_REQUEST,
  TOKEN_REFRESH_SUCCESS,
  TOKEN_REFRESH_FAILED,
  API_TOKEN_EXPIRED,
  NEW_SESSION_DETECTED,
};
```

Flow:

```text
TOKEN_DETECTED
      ↓
ACTIVE
      ↓
expiresAt reached
      ↓
EXPIRED
      ↓
API request
      ↓
401 TOKEN_EXPIRED
      ↓
CONFIRMED_EXPIRED
      ↓
Discord notification
```

Nếu refresh thành công:

```text
EXPIRED
  ↓
REFRESHING
  ↓
TOKEN_RENEWED
  ↓
ACTIVE
```

Nếu refresh không tồn tại/thất bại:

```text
REFRESHING
    ↓
FAILED
    ↓
EXPIRED
    ↓
Discord
```

---

# 9. Tôi còn đề xuất một cải tiến: "F5 Required" không nên là kết luận duy nhất

Message Discord:

> Token của bạn đã hết hạn. Vui lòng F5 để lấy token mới.

chỉ nên xuất hiện khi:

```text
Token expired
+
Không có refresh thành công
+
Request thực tế xác nhận expired
```

Còn nếu:

```text
Token expired
+
refresh request detected
+
new token detected
+
fingerprint changed
+
expiry updated
```

thì **không báo user F5**.

Thay vào đó:

```text
🟡 Authentication refreshed automatically
```

hoặc thậm chí không thông báo Discord nếu bạn muốn bot im lặng.

---

# 10. Discord nên nhận 3 loại notification

Tôi sẽ giới hạn thành:

### 🔴 `AUTH_EXPIRED`

```text
Authentication Expired

Session: #a81f
Reason: TOKEN_EXPIRED
Detected: 10:03:12

Action required:
Please return to the authentication page
and press F5 to obtain a new session.
```

### 🟢 `AUTH_RESTORED`

Chỉ gửi nếu trước đó đã `AUTH_EXPIRED`:

```text
Authentication Restored

New session detected.
Status: ACTIVE
Expires: 2026-08-27 10:05
```

### 🟡 `AUTH_REFRESH_FAILED`

```text
Authentication Refresh Failed

Refresh request was detected,
but no valid new token was confirmed.

Action required:
Refresh the authentication page.
```

---

# 11. Kiến trúc cuối tôi khuyên dùng

```text
                 PAGE
                  │
        ┌─────────▼──────────┐
        │ Auth Investigator  │
        │ Capture Layer      │
        └─────────┬──────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Evidence Engine     │
        │                     │
        │ Identity            │
        │ Token fingerprint   │
        │ Expiry              │
        │ Refresh correlation │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Auth State Engine   │
        │                     │
        │ ACTIVE              │
        │ EXPIRING_SOON       │
        │ REFRESHING          │
        │ EXPIRED             │
        │ AUTHENTICATING      │
        └─────────┬───────────┘
                  │
          ┌───────┴────────┐
          ▼                ▼
       Popup            Discord
          │                │
          ▼                ▼
       UI status       Notification
```

**Đây là thay đổi logic tôi khuyên làm tiếp theo.**

Không cần tiếp tục nhồi thêm feature vào `Auth Investigator`. Phần capture/evidence hiện đã khá đầy đủ; bước tiếp theo là **đưa evidence thành một state machine có lifecycle rõ ràng**.

Và quan trọng: Discord chỉ nên nhận **notification/event trạng thái**, không nhận hay lưu raw `access_token`, `refresh_token`, cookie hoặc OpenID.