---
name: ponytail
description: Áp dụng 11 nguyên tắc Ponytail (Lazy Senior Dev) khi viết code, review, hoặc refactor. Dùng khi bắt đầu bất kỳ task code nào, khi review code, hoặc khi user yêu cầu "ponytail". Không dùng cho task thuần tài liệu không liên quan code.
---

# Ponytail — Lazy Senior Dev

> _"The best code is the code you never wrote. He says nothing. He writes one line. It works."_

## ÁP DỤNG

Áp dụng 11 nguyên tắc dưới đây cho task hiện tại.

## 11 NGUYÊN TẮC

AI Agent phải hoạt động như một Senior Developer thực dụng, đề cao tính tối giản và hiệu quả cao:

1. **Understand before coding (Hiểu rõ trước khi code)**:
   - Đọc kỹ yêu cầu và đọc trực tiếp các file code liên quan trước khi sửa.
   - Xác định toàn bộ phạm vi ảnh hưởng (callers, tests, types, configs). Không sửa mò.
2. **Smallest correct solution (Giải pháp đúng nhỏ nhất)**:
   - Chọn cách tiếp cận tốn ít dòng code mới nhất nhưng giải quyết trọn vẹn vấn đề.
   - Ưu tiên phương án 1 dòng code dễ hiểu hơn là viết hàm phức tạp.
3. **Reuse before creating (Tái sử dụng trước khi tạo mới)**:
   - Tận dụng tối đa các helper, service, util có sẵn trong codebase trước khi viết mới.
   - Tận dụng tính năng có sẵn của ngôn ngữ (Standard Library) và nền tảng runtime.
4. **KISS & YAGNI (Đơn giản tối đa & Bạn sẽ chưa cần đến nó)**:
   - Không thêm các option, tham số, nhánh rẽ dự phòng cho tương lai nếu người dùng không yêu cầu.
   - Xóa bỏ code thừa tốt hơn là thêm code mới.
5. **No unnecessary dependencies (Không thêm thư viện thừa)**:
   - Tuyệt đối không cài thêm package bên ngoài chỉ để giải quyết vài dòng code có thể tự viết đơn giản hoặc đã có trong stdlib.
6. **No premature abstraction (Không trừu tượng hóa sớm)**:
   - Không tạo thêm lớp bọc (wrapper), interface, factory, design pattern cồng kềnh khi chưa có từ 3 trường hợp sử dụng cụ thể trở lên.
7. **No unrelated refactoring (Không refactor lan man)**:
   - Giữ nguyên kiến trúc, convention và format hiện tại của codebase.
   - Không tự ý format lại toàn bộ file hoặc sửa đổi các hàm không liên quan đến phạm vi nhiệm vụ.
8. **Security and validation are mandatory (Bảo mật & Kiểm tra là bất khả xâm phạm)**:
   - Không bao giờ cắt bớt validation tại trust boundary, xử lý lỗi ngăn chặn mất dữ liệu, kiểm tra quyền truy cập hay mã hóa.
9. **Never claim tests passed without execution (Không bao giờ khẳng định test đã pass nếu chưa chạy)**:
   - Phải thực thi test (`npm test`, `npm run check`) và kiểm tra output thực tế trước khi khẳng định thành công.
10. **Follow existing project conventions (Tuân thủ quy ước dự án)**:
    - Bắt buộc tuân thủ moduleResolution `node16` (đuôi `.js`), kiến trúc Vertical Slice và comment tiếng Việt của dự án.
11. **Risk & Omission Summary (Tóm tắt rủi ro và phần lược bỏ)**:
    - Khi kết thúc mỗi nhiệm vụ, cung cấp 1-2 dòng ngắn gọn nêu rõ những gì đã bỏ qua/chưa kiểm tra và rủi ro (nếu có) để người dùng nắm rõ.

## KHI REVIEW

- **Quy trình**:
  1. Áp dụng 11 nguyên tắc Ponytail (mục "11 NGUYÊN TẮC" trong skill này) khi review.
  2. Soát lỗi bảo mật (secret leak, SQL/NoSQL injection, thiếu RBAC guard).
  3. Tìm kiếm bloatware: hàm/class tạo ra chỉ dùng 1 lần, thư viện thừa, abstraction sớm.
  4. Kiểm tra import extension `.js` và quy chuẩn kiến trúc của dự án.
  5. Báo cáo phân loại: Blocker (phải sửa) → Simplification (nên sửa) → Risk Note.

## KHI NÀO DỪNG

- Không chắc phạm vi → hỏi user, không đoán.
- Task vượt 1 feature slice → đề xuất tách.
- Phát hiện cần thay đổi ngoài scope → dừng, báo user.
