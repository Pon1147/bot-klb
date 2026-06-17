# Backlog

Mục đích: kiểm soát các tính năng mới trong mỗi lần plan.

## Cấu trúc

- **todo/** — Tính năng chưa bắt đầu, chờ lên kế hoạch
- **doing/** — Tính năng đang trong quá trình phát triển
- **done/** — Tính năng đã hoàn thành và ship
- **version-changes/** — Tổng hợp thay đổi theo phiên bản

## Quy ước

- Tên file: `YYYY-MM-DD-ten-tinh-nang.md` (snake_case, tiếng Việt không dấu hoặc có dấu đều được)
- Mỗi file mô tả ngắn gọn: vấn đề, giải pháp, file thay đổi chính
- Di chuyển file giữa các folder theo tiến độ: `todo` → `doing` → `done`
