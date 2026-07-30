# SOURCE OF TRUTH — GARENA REDEEM CODE EXTENSION

Bạn đang xây dựng một Chromium Extension (Manifest V3) dùng để tự động redeem code trên:

<https://redeem.df.garena.sg/vi/cdkgarena.html>

Mục tiêu là xây dựng extension có 2 UI chính:

1. POPUP — dùng để cấu hình danh sách redeem code.
2. DASHBOARD — được inject trực tiếp vào website redeem và điều khiển quá trình redeem realtime.

==================================================

## 1. # KIẾN TRÚC TỔNG THỂ

Architecture:

POPUP
│
│ chrome.storage.local
▼
CENTRAL STATE
│
├──────────────► DASHBOARD
│
└──────────────► REDEEM CONTROLLER
│
▼
GARENA WEBSITE
│
▼
RAW RESPONSE
│
▼
RESPONSE PARSER
│
▼
NORMALIZED RESULT
│
▼
CENTRAL STATE
│
▼
DASHBOARD REALTIME

Nguyên tắc:

- chrome.storage.local là SOURCE OF TRUTH.
- Popup không giữ state chính.
- Dashboard không giữ state chính.
- Redeem controller không tự giữ stats riêng.
- Mọi thay đổi state quan trọng phải được ghi vào central storage.
- Dashboard phải phản ứng realtime thông qua storage/message event.
- Không reload website để update UI.
- Không tạo nhiều state độc lập giữa popup/dashboard/script.

==================================================

## 2. POPUP

Popup có:

- Textarea nhập codes.
- Button "Lưu codes".
- Button "Reset default".

Popup lần đầu cài extension:

DEFAULT_CODES được load vào chrome.storage.local.

Ví dụ:

const DEFAULT_CODES = [
"DFSL9304",
"DFSL6257",
"GARENADFNY2501C158",
...
];

Lần đầu:

DEFAULT_CODES
↓
chrome.storage.local
↓
codes

Không được load DEFAULT_CODES lại mỗi lần mở popup.

DEFAULT_CODES chỉ được sử dụng:

1. Khi extension được install lần đầu.
2. Khi user click Reset default.

Reset default:

Reset chỉ đưa DEFAULT_CODES vào textarea.

Không tự commit storage nếu chưa click Save.

Save:

textarea
↓
trim
↓
split newline
↓
remove empty
↓
remove duplicate
↓
validate
↓
save storage

Khi user Save một danh sách codes mới:

- Tạo session mới.
- currentIndex = 0.
- reset stats.
- reset logs.
- reset code statuses.
- status = READY.

Không được giữ stats/session cũ khi user Save một danh sách code mới.

==================================================

## 3. CENTRAL STATE

Thiết kế state tập trung.

Concept:

{
sessionId,
codes,
currentIndex,
currentCode,
status,
stats,
logs
}

Status của extension:

NO_CODES
READY
RUNNING
PAUSED
COMPLETED

Ý nghĩa:

NO_CODES:
Không có code được lưu.

READY:
Có code và sẵn sàng chạy.

RUNNING:
Đang redeem.

PAUSED:
User đã bấm Dừng.

COMPLETED:
Đã xử lý hết queue.

Không tự động chuyển RUNNING thành tiếp tục redeem sau khi browser/tab reload.

Nếu extension/browser restart trong lúc RUNNING:
RUNNING → PAUSED.

==================================================

## 4. CODE STATE

Mỗi redeem code phải có lifecycle rõ ràng.

Các trạng thái logic:

PENDING
PROCESSING
SUCCESS
FAILED

Reason chi tiết nằm riêng:

REDEEMED
USED
EXPIRED
INVALID
LIMIT_REACHED
PRESENT_ERROR
VERIFY
TEMP_ERROR
UNKNOWN
NO_RESPONSE

Không dùng USED/EXPIRED/INVALID trực tiếp thay cho SUCCESS/FAILED ở tầng result.

Ví dụ:

{
redeemCode: "DFSL9304",
result: "FAILED",
reason: "USED"
}

Success:

{
redeemCode: "DFSL9304",
result: "SUCCESS",
reason: "REDEEMED"
}

==================================================

## 5. DASHBOARD

Dashboard được inject vào:

<https://redeem.df.garena.sg/vi/cdkgarena.html>

UI gồm:

- Status indicator.
- Tổng.
- Thành công.
- Thất bại.
- Còn lại.
- Progress.
- Button Bắt đầu.
- Button Dừng.
- Nhật ký.

Status UI:

NO_CODES:
"Chưa sẵn sàng"
→ yêu cầu user mở popup và Save codes.

READY:
"Sẵn sàng"
→ dot xanh.

RUNNING:
"Đang chạy"

PAUSED:
"Đã tạm dừng"

COMPLETED:
"Hoàn tất"

Nếu chưa Save codes thì button Bắt đầu phải disabled.

==================================================

## 6. STATS

Stats:

TOTAL
SUCCESS
FAILED
REMAINING

TOTAL:
Tổng số code trong session.

SUCCESS:
Số code có result = SUCCESS.

FAILED:
Số code có result = FAILED.

REMAINING:
Số code chưa hoàn tất xử lý.

Không để remaining trở thành nguồn dữ liệu độc lập dễ sai lệch.

Có thể tính:

remaining = total - success - failed

hoặc dựa trên số code chưa terminal.

Ví dụ:

100 total
23 success
17 failed
60 remaining

FAILED có thể bao gồm:

USED
EXPIRED
INVALID
LIMIT_REACHED
PRESENT_ERROR
VERIFY
TEMP_ERROR
UNKNOWN

Stats chỉ hiển thị SUCCESS/FAILED.

Log hiển thị reason chi tiết.

==================================================

## 7. START / STOP / RESUME

Button Bắt đầu:

Nếu NO_CODES:
→ không chạy.

Nếu READY:
→ bắt đầu từ code đầu tiên.

Nếu PAUSED:
→ resume từ code đang pending/processing theo queue state.

Nếu COMPLETED:
→ không chạy lại session đã hoàn tất.

Button Dừng:

Không RESET queue.

Không reset currentIndex.

Không reset stats.

Không xóa logs.

Không bắt đầu lại từ code đầu tiên.

Khi Dừng:

RUNNING → PAUSED

Đặc biệt:

Nếu code hiện tại đã gửi request nhưng response chưa về:

code status = PROCESSING

Không được tự động coi là FAILED.

Khi resume phải xử lý chính xác code PROCESSING/PENDING theo policy đã thiết kế, tránh bỏ sót hoặc double-count.

==================================================

## 8. REDEEM CONTROLLER

Tạo riêng RedeemController.

Không để dashboard tự xử lý toàn bộ redeem logic.

Controller chịu trách nhiệm:

start()
pause()
resume()
processNext()
processCode()
handleResponse()

Flow:

START
↓
get next pending code
↓
set PROCESSING
↓
input code vào website
↓
click redeem
↓
capture network response
↓
parse response
↓
normalize result
↓
update code state
↓
update stats
↓
append log
↓
persist state
↓
dashboard realtime update
↓
process next code

==================================================

## 9. NETWORK RESPONSE

Website trả response dạng:

{
code: 400072,
code_type: 2,
msg: "current uid exchanged cdkey",
data: null,
seq: "5dec522b-57d1-4c32-9da0-c6d2125bceae"
}

Đây là response thực tế và phải được xử lý bằng RESPONSE CODE.

QUAN TRỌNG:

Không xây parser chủ yếu dựa vào regex của msg.

Không chuyển:

400072
→ "error_hint_400072"
→ regex
→ status

Thay vào đó:

raw response
→ response.code
→ RESPONSE_CODE_MAP
→ normalized result

==================================================

## 10. RESPONSE CODE MAP

Tạo một map tập trung:

const RESPONSE_CODE_MAP = {
0: {
result: "SUCCESS",
reason: "REDEEMED",
label: "Thành công"
},

    400072: {
        result: "FAILED",
        reason: "USED",
        label: "Đã sử dụng"
    },

    ...

};

Các response code khác phải được bổ sung dựa trên response thực tế.

Không tự suy đoán code mới.

==================================================

## 11. RESPONSE PARSER

Tạo function duy nhất:

parseRedeemResponse(response)

Input:

raw API response.

Output:

{
result: "SUCCESS" | "FAILED",
reason: "...",
responseCode: 400072,
message: "current uid exchanged cdkey",
seq: "...",
raw: response
}

Ví dụ response:

{
code: 400072,
code_type: 2,
msg: "current uid exchanged cdkey",
data: null,
seq: "5dec522b-57d1-4c32-9da0-c6d2125bceae"
}

Phải normalize thành:

{
result: "FAILED",
reason: "USED",
responseCode: 400072,
message: "current uid exchanged cdkey",
seq: "5dec522b-57d1-4c32-9da0-c6d2125bceae",
raw: response
}

response.code là source of truth.

response.msg chỉ dùng:

- hiển thị message.
- debug.
- fallback nếu response code không tồn tại/không map được.

Nếu response code không biết:

{
result: "FAILED",
reason: "UNKNOWN",
responseCode: 123456,
message: "...",
seq: "..."
}

KHÔNG được tự động đoán UNKNOWN thành USED/EXPIRED/etc.

==================================================

## 12. RESPONSE CODE VS REDEEM CODE

Không được dùng cùng tên "code" cho hai khái niệm.

Redeem code:

redeemCode:
"DFSL9304"

API response code:

responseCode:
400072

Luôn giữ hai tên riêng.

==================================================

## 3. LOG SYSTEM

Mỗi log phải là structured object.

Ví dụ:

{
id: "...",
redeemCode: "DFSL9304",
result: "FAILED",
reason: "USED",
responseCode: 400072,
responseMessage: "current uid exchanged cdkey",
responseSeq: "5dec522b-57d1-4c32-9da0-c6d2125bceae",
timestamp: 1753850000000
}

Dashboard có thể render:

🟢 DFSL9304
Đã nhận thành công

🟡 DFSL6257
Đã sử dụng

🔴 PWC260419S65
Hết hạn

Log phải hiển thị rõ:

- code nào success.
- code nào failed.
- code nào used.
- code nào expired.
- code nào invalid.
- code nào unknown.
- code nào chưa nhận được response.

==================================================

## 14. REALTIME UPDATE

Không reload page.

Flow:

Redeem response
↓
parseRedeemResponse()
↓
update state
↓
chrome.storage.local
↓
storage change event
↓
Dashboard render lại
↓
stats/log/status update realtime

Ví dụ:

Trước:

100 total
0 success
0 failed
100 remaining

Response:

code = 400072

↓

success = 0
failed = 1
remaining = 99

Dashboard phải cập nhật ngay.

==================================================

## 15. POPUP ↔ DASHBOARD

Popup và Dashboard phải đọc cùng central state.

Popup:

- Save codes.
- Reset default.
- đọc trạng thái hiện tại nếu cần.

Dashboard:

- đọc codes.
- đọc stats.
- đọc status.
- đọc logs.
- điều khiển start/stop.

Không tạo một bản codes riêng trong popup và một bản codes riêng trong dashboard.

==================================================

## 16. SAVE NEW CODES

Nếu đang có session:

100 codes
30 success
10 failed

User mở popup và Save danh sách mới.

Phải:

- tạo sessionId mới.
- replace codes.
- currentIndex = 0.
- reset stats.
- reset logs.
- reset processing state.
- status = READY.

Không được giữ:

success = 30
failed = 10

của session cũ.

==================================================

## 17. PAGE RELOAD / BROWSER RESTART

Nếu user F5 website:

Dashboard phải restore state từ chrome.storage.local.

Ví dụ:

100 total
37 processed
63 remaining

F5:

vẫn phải:

100 total
37 processed
63 remaining

Nếu browser đóng trong lúc RUNNING:

không tự động redeem tiếp.

Khi mở lại:

status = PAUSED

User phải click Bắt đầu để tiếp tục.

==================================================

## 18. FILE STRUCTURE

Đề xuất:

garena-redeem-extension/
│
├── manifest.json
│
├── assets/
│ ├── icon16.png
│ ├── icon32.png
│ ├── icon48.png
│ └── icon128.png
│
├── popup/
│ ├── popup.html
│ ├── popup.css
│ └── popup.js
│
├── content/
│ ├── content.js
│ ├── dashboard.js
│ ├── dashboard.css
│ └── redeem-controller.js
│
├── background/
│ └── service-worker.js
│
├── core/
│ ├── storage.js
│ ├── state.js
│ ├── constants.js
│ ├── parser.js
│ └── utils.js
│
└── README.md

Responsibilities:

service-worker.js
→ extension lifecycle / initialization.

popup.js
→ input / save / reset.

storage.js
→ toàn bộ storage access.

state.js
→ state model / state transition.

parser.js
→ raw response → normalized result.

dashboard.js
→ render UI / buttons / realtime state.

redeem-controller.js
→ redeem queue / start / pause / resume.

==================================================

## 19. KHÔNG ĐƯỢC LÀM

Không:

1. Dùng msg regex làm parser chính.

2. Biến response code thành string kiểu:
   "error_hint_400072"
   rồi regex ngược lại.

3. Để popup giữ source of truth.

4. Để dashboard giữ source of truth.

5. Reset queue khi bấm Dừng.

6. Reset stats khi bấm Dừng.

7. Reload website để update stats.

8. Tự động coi response unknown là FAILED theo một reason cụ thể.

9. Tự động đoán response code mới.

10. Dùng "code" cho cả redeem code và response code.

11. Để Save codes mới giữ lại session cũ.

12. Double-count một code khi retry.

==================================================

## 20. EDGE CASES PHẢI TEST

Test ít nhất:

1. Extension install lần đầu.

2. DEFAULT_CODES được load.

3. Popup mở lại không overwrite user codes.

4. Reset default.

5. Save codes.

6. Save empty codes.

7. Duplicate codes.

8. Dashboard trước khi Save.

9. Dashboard sau khi Save.

10. Start.

11. Stop giữa batch.

12. Resume.

13. Stop khi request đang pending.

14. Response SUCCESS.

15. Response USED — 400072.

16. Response EXPIRED.

17. Response INVALID.

18. Response LIMIT_REACHED.

19. Response UNKNOWN.

20. Không có response.

21. Network timeout.

22. Retry không double-count.

23. Refresh website.

24. Browser restart.

25. Save codes mới sau session cũ.

26. Hết toàn bộ codes.

27. Dashboard realtime update.

28. Logs realtime update.

==================================================

## 21. IMPLEMENTATION ORDER

Không code toàn bộ cùng lúc.

Phase 1:
Extension skeleton + Manifest V3.

Phase 2:
Popup + DEFAULT_CODES + Save + Reset.

Phase 3:
chrome.storage.local + central state.

Phase 4:
Dashboard injection + UI.

Phase 5:
Dashboard đọc/render state.

Phase 6:
RedeemController + queue.

Phase 7:
Network response capture.

Phase 8:
Response parser + RESPONSE_CODE_MAP.

Phase 9:
Realtime stats/log update.

Phase 10:
Pause/resume.

Phase 11:
Persistence/recovery.

Phase 12:
Edge-case testing.

==================================================

## 22. CORE PRINCIPLE

Toàn bộ extension phải tuân thủ flow:

USER CONFIG
↓
CENTRAL STORAGE
↓
REDEEM QUEUE
↓
NETWORK REQUEST
↓
RAW RESPONSE
↓
RESPONSE CODE
↓
NORMALIZED RESULT
↓
STATE UPDATE
↓
STATS + LOG
↓
REALTIME DASHBOARD

Đặc biệt:

RESPONSE CODE là source of truth để phân loại kết quả redeem.

Ví dụ:

400072
→ FAILED
→ USED
→ "Đã sử dụng"

Không dùng msg regex làm nguồn phân loại chính.

Mọi implementation phải ưu tiên:

- predictable state
- single source of truth
- no duplicated state
- realtime synchronization
- pause/resume chính xác
- không double-count
- response-code driven classification
- dễ mở rộng response code map
- dễ debug bằng raw response

Hãy implement theo đúng architecture này và không tự ý thay đổi data flow hoặc business logic nếu chưa có lý do kỹ thuật rõ ràng.
