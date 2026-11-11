# Danh Mục Lệnh Chuẩn — Bot Delta (Ground Truth Command Catalog)

> **Tài liệu tự động sinh (Auto-generated)** — Phiên bản Bot: **v1.11.0**
> *Mọi AI Assistant và lập trình viên bắt buộc tuân theo tài liệu này. Không tự suy diễn cú pháp hay tham số.*

## 1. Thống Kê Tổng Quan

- **Tổng số lệnh thực thi**: `57` subcommands.
- **Nhóm lệnh**: `/df`, `/team`, `/pay`, `/donate`, `/config`.

## 2. Bảng Tra Cứu Lệnh Chi Tiết

| Canonical Path | Mô tả (VI) | Description (EN) | Quyền (RBAC Policy) | Tham số (Options) |
| :--- | :--- | :--- | :--- | :--- |
| `/config roles set` | Thiết lập vai trò quản trị phân quyền RBAC (Admin, Mod, Member). | Configure RBAC permissions for administrative and member roles. | `MANAGE_RBAC` | `role_type*`, `role*` |
| `/config roles view` | Xem cấu hình phân quyền vai trò hiện tại của máy chủ. | View current role-based access control (RBAC) configuration. | `MANAGE_RBAC` | *Không có* |
| `/config welcome setchannel` | Chọn kênh gửi tin nhắn chào mừng thành viên mới. | Select the channel for automated new member welcome messages. | `MANAGE_CONFIG` | `channel*` |
| `/config welcome setrole` | Chọn role tự động cấp cho thành viên mới khi vào máy chủ. | Set the automatic role assigned to new members upon joining. | `MANAGE_CONFIG` | `role*` |
| `/config welcome toggle` | Bật hoặc tắt hệ thống chào mừng thành viên mới. | Enable or disable the automated member welcome system. | `MANAGE_CONFIG` | `enabled*` |
| `/config welcome status` | Xem trạng thái cấu hình hệ thống chào mừng hiện tại. | View current member welcome system configuration and status. | `MANAGE_CONFIG` | *Không có* |
| `/config welcome test` | Gửi tin nhắn chào mừng thử nghiệm để kiểm tra giao diện. | Send a test welcome message to preview layout and formatting. | `MANAGE_CONFIG` | *Không có* |
| `/config leave setchannel` | Chọn kênh gửi thông báo khi thành viên rời máy chủ. | Select the channel for member departure and farewell notices. | `MANAGE_CONFIG` | `channel*` |
| `/config leave toggle` | Bật hoặc tắt hệ thống thông báo thành viên rời máy chủ. | Enable or disable member departure notifications. | `MANAGE_CONFIG` | `enabled*` |
| `/config leave status` | Xem trạng thái cấu hình thông báo thành viên rời máy chủ. | View current member departure notification configuration. | `MANAGE_CONFIG` | *Không có* |
| `/config leave test` | Gửi tin nhắn thông báo rời máy chủ thử nghiệm để xem trước. | Send a test farewell message to preview layout and formatting. | `MANAGE_CONFIG` | *Không có* |
| `/config booster setchannel` | Chọn kênh gửi tin nhắn cảm ơn khi có thành viên Boost máy chủ. | Select the channel for server booster appreciation messages. | `MANAGE_CONFIG` | `channel*` |
| `/config booster setrole` | Chọn role dành riêng cho Server Booster. | Set the designated reward role for server boosters. | `MANAGE_CONFIG` | `role*` |
| `/config booster toggle` | Bật hoặc tắt hệ thống thông báo cảm ơn Server Booster. | Enable or disable the server booster appreciation system. | `MANAGE_CONFIG` | `enabled*` |
| `/config booster status` | Xem trạng thái cấu hình cảm ơn Server Booster hiện tại. | View current server booster configuration status. | `MANAGE_CONFIG` | *Không có* |
| `/config booster test` | Gửi tin nhắn cảm ơn Booster thử nghiệm để xem trước giao diện. | Send a test booster appreciation message to preview layout. | `MANAGE_CONFIG` | *Không có* |
| `/config container edit` | Chỉnh sửa giao diện tin nhắn Container V2 của máy chủ tương tác. | Interactively edit Discord Components V2 message containers. | `MANAGE_CONFIG` | `type*` |
| `/config container reset` | Đặt lại giao diện tin nhắn Container V2 về mẫu mặc định. | Reset Discord Components V2 container layout to default templates. | `MANAGE_CONFIG` | `type*` |
| `/config bot guilds` | Xem danh sách các máy chủ mà bot đang tham gia (Bot Owner). | View list of all Discord servers the bot has joined (Bot Owner). | `MANAGE_RBAC` | *Không có* |
| `/config bot setannouncechannel` | Thiết lập kênh nhận thông báo cập nhật tính năng mới từ bot. | Set the designated channel to receive bot update announcements. | `MANAGE_RBAC` | `channel*` |
| `/config bot announce` | Phát sóng thông báo cập nhật tới toàn bộ máy chủ (Bot Owner). | Broadcast feature update announcements to all servers (Bot Owner). | `MANAGE_RBAC` | `title`, `message`, `preview` |
| `/config qr-server toggle` | Bật hoặc tắt tính năng QR thanh toán trả phí cho máy chủ (Bot Owner). | Enable or disable premium VietQR payment licensing for a server. | `MANAGE_RBAC` | `enabled*`, `server_id` |
| `/config qr-server status` | Kiểm tra trạng thái cấp phép tính năng QR của máy chủ (Bot Owner). | Check premium VietQR payment licensing status for a server. | `MANAGE_RBAC` | `server_id` |
| `/config vietqr set` | Cấu hình thông tin tài khoản ngân hàng nhận tiền chuyển khoản VietQR. | Configure the receiving bank account for automated VietQR payments. | `MANAGE_RBAC` | `bank*`, `account_no*`, `account_name*`, `prefix` |
| `/config vietqr workflow` | Cấu hình quy trình duyệt đơn, role nhân viên và đánh giá feedback. | Configure payment approval workflow, staff role & feedback ratings. | `MANAGE_CONFIG` | `staff_role`, `feedback_channel`, `enable_rating`, `thanks_message` |
| `/config vietqr status` | Xem thông tin tài khoản nhận tiền VietQR hiện tại của máy chủ. | View current receiving bank account details and payment status. | `MANAGE_CONFIG` | *Không có* |
| `/config vietqr preview` | Tạo mã QR thanh toán thử nghiệm để quét kiểm tra số tài khoản. | Generate a sample VietQR code to preview and test bank scanning. | `MANAGE_CONFIG` | `amount` |
| `/config vietqr reset` | Gỡ bỏ và xóa toàn bộ thông tin tài khoản ngân hàng VietQR của máy chủ. | Remove and reset all VietQR banking account configuration. | `MANAGE_RBAC` | *Không có* |
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
| `/df gift-code` | Nhận 280 mã giftcode tân thủ và công cụ tự động nhận quà trên Garena. | Get 280 starter giftcodes and tools to auto-redeem rewards on Garena. | `DF_ACCESS` | *Không có* |
| `/df code show` | Bảng mật mã két sắt 6 bản đồ hôm nay (tự động cập nhật mỗi sáng). | Today’s safe vault combination codes for all 6 maps (auto-updated daily). | `DF_ACCESS` | `page` |
| `/df code status` | Kiểm tra trạng thái cập nhật mật mã két sắt hôm nay. | Check the status of today’s safe vault codes synchronization. | `DF_ACCESS` | *Không có* |
| `/df code setchannel` | Cài đặt kênh tự động gửi mật mã két sắt 6 bản đồ mỗi ngày. | Set the channel to auto-receive daily 6-map safe vault codes. | `MANAGE_DF_CODE` | `channel*` |
| `/df code settime` | Cài đặt giờ tự động gửi mật mã két sắt hằng ngày (mặc định 08:00). | Set daily scheduled time to post safe vault codes (default 08:00). | `MANAGE_DF_CODE` | `time*` |
| `/df code setadminchannel` | Cài đặt kênh nhận thông báo lỗi lịch trình gửi mã két sắt. | Set the administrative channel for safe codes scheduler error logs. | `MANAGE_DF_CODE` | `channel*` |
| `/df link start` | Khởi tạo phiên liên kết tài khoản Delta Force HQ và nhận tiện ích DF Toolbox. | Initiate a Delta Force HQ account linking session and download DF Toolbox. | `DF_ACCESS` | *Không có* |
| `/df link status` | Kiểm tra trạng thái liên kết tài khoản Delta Force HQ hiện tại. | Check the current linking status of your Delta Force HQ account. | `DF_ACCESS` | *Không có* |
| `/df autopost set` | Cài đặt lịch tự động đăng cẩm nang bản đồ hoặc build súng meta. | Schedule auto-posting for map tactical guides or meta weapon builds. | `MANAGE_RBAC` | `type*`, `interval_hours*`, `broadcast_now` |
| `/df autopost toggle` | Bật hoặc tắt hệ thống tự động đăng cẩm nang định kỳ. | Toggle automated tactical guide and weapon build broadcasting. | `MANAGE_RBAC` | `type*`, `enabled*` |
| `/df autopost status` | Xem trạng thái các kênh tự động đăng bài của bot. | View auto-posting schedules and channel broadcast status. | `MANAGE_RBAC` | *Không có* |
| `/df autopost run` | Kích hoạt gửi ngay cẩm nang bản đồ hoặc súng mà không cần chờ lịch. | Immediately trigger a tactical guide or weapon build broadcast. | `MANAGE_RBAC` | `type*` |
| `/pay create` | Tạo mã QR thanh toán VietQR chuyển khoản ngân hàng tự động. | Create an automated VietQR bank transfer payment invoice. | `PAY_ACCESS` | `amount*`, `customer`, `memo` |
| `/pay history` | Xem lịch sử các giao dịch thanh toán VietQR của bạn trong máy chủ. | View your VietQR transaction payment history in this server. | `PAY_ACCESS` | `target` |
| `/pay top` | Xem bảng xếp hạng top thành viên ủng hộ / chi tiêu nhiều nhất trong máy chủ. | View top spending and supporter leaderboards in this server. | `PAY_ACCESS` | *Không có* |
| `/donate` | Tạo link thanh toán PayOS ủng hộ nhà phát triển duy trì bot. | Generate a PayOS payment link to support bot server operating costs. | `PAY_ACCESS` | `amount*`, `message` |
| `/team find` | Đăng tin tuyển hoặc tìm squad leo rank theo map, chế độ & điều phối voice chat tự động. | Post or find squad recruitment for rank climb by map, mode & automated voice dispatch. | `TEAM_ACCESS` | *Không có* |

---
*Ghi chú: Ký hiệu `*` sau tên tham số biểu thị tham số bắt buộc (required).*
