# Danh Mục Lệnh Chuẩn — Bot Delta (Ground Truth Command Catalog)

> **Tài liệu tự động sinh (Auto-generated)** — Phiên bản Bot: **v1.8.1**
> *Mọi AI Assistant và lập trình viên bắt buộc tuân theo tài liệu này. Không tự suy diễn cú pháp hay tham số.*

## 1. Thống Kê Tổng Quan

- **Tổng số lệnh thực thi**: `55` subcommands.
- **Nhóm lệnh**: `/df`, `/team`, `/pay`, `/donate`, `/config`.

## 2. Bảng Tra Cứu Lệnh Chi Tiết

| Canonical Path | Mô tả (VI) | Description (EN) | Quyền (RBAC Policy) | Tham số (Options) |
| :--- | :--- | :--- | :--- | :--- |
| `/config roles set` | Thiết lập role cho một phân quyền bot. | *(Admin / Internal)* | `MANAGE_RBAC` | `role_type*`, `role*` |
| `/config roles view` | Xem danh sách role RBAC hiện tại của máy chủ. | *(Admin / Internal)* | `MANAGE_RBAC` | *Không có* |
| `/config welcome setchannel` | Chọn kênh gửi tin nhắn chào mừng. | *(Admin / Internal)* | `MANAGE_CONFIG` | `channel*` |
| `/config welcome setrole` | Chọn role tự động cấp khi vào server. | *(Admin / Internal)* | `MANAGE_CONFIG` | `role*` |
| `/config welcome toggle` | Bật hoặc tắt hệ thống chào mừng. | *(Admin / Internal)* | `MANAGE_CONFIG` | `enabled*` |
| `/config welcome status` | Xem trạng thái cấu hình chào mừng hiện tại. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config welcome test` | Gửi tin nhắn chào mừng thử nghiệm để kiểm tra hiển thị. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config leave setchannel` | Chọn kênh gửi tin nhắn tạm biệt. | *(Admin / Internal)* | `MANAGE_CONFIG` | `channel*` |
| `/config leave toggle` | Bật hoặc tắt hệ thống tạm biệt. | *(Admin / Internal)* | `MANAGE_CONFIG` | `enabled*` |
| `/config leave status` | Xem trạng thái cấu hình tạm biệt hiện tại. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config leave test` | Gửi tin nhắn tạm biệt thử nghiệm để kiểm tra hiển thị. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config booster setchannel` | Chọn kênh gửi tin nhắn cảm ơn Booster. | *(Admin / Internal)* | `MANAGE_CONFIG` | `channel*` |
| `/config booster setrole` | Chọn role dành riêng cho Booster. | *(Admin / Internal)* | `MANAGE_CONFIG` | `role*` |
| `/config booster toggle` | Bật hoặc tắt hệ thống thông báo Booster. | *(Admin / Internal)* | `MANAGE_CONFIG` | `enabled*` |
| `/config booster status` | Xem trạng thái cấu hình Booster hiện tại. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config booster test` | Gửi tin nhắn cảm ơn Booster thử nghiệm để kiểm tra hiển thị. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config container edit` | Chỉnh sửa container settings (Interactive UI). | *(Admin / Internal)* | `MANAGE_CONFIG` | `type*` |
| `/config container reset` | Reset container settings về mặc định. | *(Admin / Internal)* | `MANAGE_CONFIG` | `type*` |
| `/config bot guilds` | Xem danh sách các máy chủ (guilds) bot đang tham gia. | *(Admin / Internal)* | `MANAGE_RBAC` | *Không có* |
| `/config bot setannouncechannel` | Cấu hình kênh nhận thông báo cập nhật bot cho máy chủ này. | *(Admin / Internal)* | `MANAGE_RBAC` | `channel*` |
| `/config bot announce` | Phát thông báo cập nhật tới toàn bộ máy chủ (chỉ dành cho Bot Owner). | *(Admin / Internal)* | `MANAGE_RBAC` | `title`, `message`, `preview` |
| `/config qr-server toggle` | Bật hoặc tắt tính năng QR tự động cho máy chủ. | *(Admin / Internal)* | `MANAGE_RBAC` | `enabled*`, `server_id` |
| `/config qr-server status` | Xem trạng thái tính năng QR của máy chủ. | *(Admin / Internal)* | `MANAGE_RBAC` | `server_id` |
| `/config vietqr set` | Cài đặt thông tin tài khoản ngân hàng nhận tiền. | *(Admin / Internal)* | `MANAGE_RBAC` | `bank*`, `account_no*`, `account_name*`, `prefix` |
| `/config vietqr workflow` | Cấu hình quy trình duyệt bill, nhận feedback 5 sao và lời cảm ơn. | *(Admin / Internal)* | `MANAGE_CONFIG` | `staff_role`, `feedback_channel`, `enable_rating`, `thanks_message` |
| `/config vietqr status` | Xem thông tin tài khoản nhận tiền hiện tại của máy chủ. | *(Admin / Internal)* | `MANAGE_CONFIG` | *Không có* |
| `/config vietqr preview` | Xem trước và quét thử mã QR thanh toán mẫu của máy chủ. | *(Admin / Internal)* | `MANAGE_CONFIG` | `amount` |
| `/df stats` | Xuất thẻ căn cước chiến binh (K/D, tỉ lệ rút quân, cấp bậc, số trận) & menu đổi mùa giải. | Display combat identity card (K/D, extraction rate, rank tier, matches) & season selector. | `DF_ACCESS` | *Không có* |
| `/df daily` | Báo cáo tổng hợp hiệu suất tác chiến trong ngày hôm nay. | Comprehensive summary report of your combat performance today. | `DF_ACCESS` | *Không có* |
| `/df history` | Xem lịch sử 1–20 trận gần nhất (operator, map, kết quả rút quân). | View recent match history for the last 1–20 deployments (operator, map, extraction result). | `DF_ACCESS` | `limit` |
| `/df vault` | Sảnh Triển Lãm Đồ Đỏ — Kho báu vật phẩm quý hiếm đã rút quân an toàn & tổng định giá. | Red Item Trophy Hall — Showcase of rare treasures extracted & appraisal valuation. | `DF_ACCESS` | *Không có* |
| `/df match` | Soi chi tiết kết quả 1 trận cụ thể (kèm gợi ý tự động 5 trận gần nhất). | Inspect detailed results of a specific match (with auto-suggested recent 5 matches). | `DF_ACCESS` | `match_id` |
| `/df workshop` | Xem khuyến nghị sản xuất tối ưu tại Xưởng Căn Cứ Ngầm. | View optimal crafting recommendations at the Underground Base Workshop. | `DF_ACCESS` | *Không có* |
| `/df market` | Tra cứu giá nguyên liệu thị trường & biên lợi nhuận chế tác bàn xưởng từ HQ API. | Check market commodity prices & workbench crafting profit margins from the HQ API. | `DF_ACCESS` | `item` |
| `/df unlink` | Hủy liên kết tài khoản Delta Force HQ khỏi tài khoản Discord của bạn. | Unlink your Delta Force HQ account from your Discord identity. | `DF_ACCESS` | *Không có* |
| `/df help` | Hiển thị cẩm nang hướng dẫn sử dụng Bot Delta toàn tập. | Display the comprehensive user guide and help manual for Bot Delta. | `DF_ACCESS` | *Không có* |
| `/df map` | Cẩm nang bản đồ, soi két sắt, lối rút quân & liên kết mô phỏng 3D tại deltaforcetools.gg. | Map tactical guides, safe locations, evacuation routes & 3D simulation links at deltaforcetools.gg. | `DF_ACCESS` | *Không có* |
| `/df build` | Thư viện build súng meta Garena, lọc theo chế độ/loại súng & copy mã 1-chạm. | Garena meta weapon build library with mode/class filtering and 1-tap code copy. | `DF_ACCESS` | `weapon`, `mode` |
| `/df gun` | Tra cứu nhanh build súng meta theo tên súng và chế độ chơi. | Quick search for meta weapon loadouts by gun name and game mode. | `DF_ACCESS` | `weapon`, `mode` |
| `/df code show` | Bảng mật mã két sắt 6 bản đồ hôm nay (tự động cập nhật mỗi sáng). | Today’s safe vault combination codes for all 6 maps (auto-updated daily). | `DF_ACCESS` | `page` |
| `/df code status` | Kiểm tra trạng thái cập nhật mật mã két sắt hôm nay. | Check the status of today’s safe vault codes synchronization. | `DF_ACCESS` | *Không có* |
| `/df code setchannel` | Đặt channel tự động gửi codes mỗi ngày. | *(Admin / Internal)* | `MANAGE_DF_CODE` | `channel*` |
| `/df code settime` | Đặt giờ tự động gửi codes mỗi ngày. | *(Admin / Internal)* | `MANAGE_DF_CODE` | `time*` |
| `/df code setadminchannel` | Đặt channel nhận thông báo lỗi scheduler. | *(Admin / Internal)* | `MANAGE_DF_CODE` | `channel*` |
| `/df link start` | Khởi tạo phiên liên kết tài khoản Delta Force HQ và nhận tiện ích DF Toolbox. | Initiate a Delta Force HQ account linking session and download DF Toolbox. | `DF_ACCESS` | *Không có* |
| `/df link status` | Kiểm tra trạng thái liên kết tài khoản Delta Force HQ hiện tại. | Check the current linking status of your Delta Force HQ account. | `DF_ACCESS` | *Không có* |
| `/df autopost set` | Thiết lập chu kỳ lặp lại cho loại nội dung. | *(Admin / Internal)* | `MANAGE_RBAC` | `type*`, `interval_hours*`, `broadcast_now` |
| `/df autopost toggle` | Bật hoặc tắt phát tự động cho loại nội dung. | *(Admin / Internal)* | `MANAGE_RBAC` | `type*`, `enabled*` |
| `/df autopost status` | Xem trạng thái cấu hình Auto-Post toàn hệ thống. | *(Admin / Internal)* | `MANAGE_RBAC` | *Không có* |
| `/df autopost run` | Bắn thử nghiệm ngay lập tức 1 đợt tới toàn bộ các máy chủ. | *(Admin / Internal)* | `MANAGE_RBAC` | `type*` |
| `/pay create` | Tạo mã QR thanh toán VietQR chuyển khoản ngân hàng tự động. | Create an automated VietQR bank transfer payment invoice. | `PAY_ACCESS` | `amount*`, `customer`, `memo` |
| `/pay history` | Xem lịch sử các giao dịch thanh toán VietQR của bạn trong máy chủ. | View your VietQR transaction payment history in this server. | `PAY_ACCESS` | `target` |
| `/pay top` | Xem bảng xếp hạng top thành viên ủng hộ / chi tiêu nhiều nhất trong máy chủ. | View top spending and supporter leaderboards in this server. | `PAY_ACCESS` | *Không có* |
| `/donate` | Tạo link thanh toán PayOS ủng hộ nhà phát triển duy trì bot. | Generate a PayOS payment link to support bot server operating costs. | `PAY_ACCESS` | `amount*`, `message` |
| `/team find` | Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động. | Post or find squad recruitment for rank climb by map, mode & automated voice dispatch. | `TEAM_ACCESS` | *Không có* |

---
*Ghi chú: Ký hiệu `*` sau tên tham số biểu thị tham số bắt buộc (required).*
