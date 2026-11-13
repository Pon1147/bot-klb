---
name: judge
description: Đánh giá yêu cầu, task file, hoặc TODO list có đủ ngữ cảnh (Sufficient Context) để bắt đầu implement hay chưa. Dùng khi user yêu cầu judge/validate/evaluate task clarity, hoặc khi yêu cầu mơ hồ trước khi implement. Không dùng khi yêu cầu đã rõ ràng và user chỉ cần thực thi.
---

# Judge — Sufficient Context Validator

Đánh giá yêu cầu trước khi implement. Mục tiêu: phát hiện mơ hồ, sinh câu hỏi làm rõ, đưa verdict.

## Khi nào dùng

- User yêu cầu: "Judge task này", "Yêu cầu này đã rõ chưa?", "Validate requirements"
- Yêu cầu có dấu hiệu mơ hồ (từ chung chung, thiếu scope, thiếu constraints)
- Trước khi implement task phức tạp chạm nhiều module

## 6 tiêu chí SC

| Tiêu chí          | Kiểm tra gì                                    | Ví dụ thất bại                              |
| ----------------- | ---------------------------------------------- | ------------------------------------------- |
| **Terms**         | Mọi thuật ngữ kỹ thuật/nghiệp vụ đã định nghĩa | "Make it faster" — nhanh bao nhiêu?         |
| **Scope**         | Làm gì VÀ không làm gì                         | "Tính tổng đơn hàng" — gồm VAT, ship không? |
| **Conditions**    | Khi nào trigger, input/output gì               | "Gửi email" — khi nào? cho ai? dữ liệu gì?  |
| **Constraints**   | Hiệu năng, bảo mật, giới hạn                   | "Tối ưu" — target response time?            |
| **Consistency**   | Không mâu thuẫn nội tại                        | "Nhanh và đầy đủ" không có trade-off        |
| **Actionability** | Đủ chi tiết để bắt đầu code                    | "Build authentication" — loại nào?          |

## Quy trình

1. Đọc toàn bộ yêu cầu (task file, prompt, TODO list).
2. Đối chiếu từng tiêu chí SC.
3. Ghi nhận mơ hồ với vị trí cụ thể (dòng, đoạn).
4. Sinh tối đa 5 câu hỏi làm rõ, ưu tiên theo impact (HIGH > MEDIUM > LOW).
5. Đưa verdict.

## Verdict

| Verdict                 | Ý nghĩa                               | Hành động                     |
| ----------------------- | ------------------------------------- | ----------------------------- |
| **PASS**                | Đủ 6 tiêu chí, bắt đầu implement được | Tiến hành implement           |
| **NEEDS_CLARIFICATION** | 1-2 mơ hồ mức LOW/MEDIUM, không block | Hỏi nhanh, rồi tiếp tục       |
| **FAIL**                | Có mơ hồ HIGH block implement         | Dừng, hỏi user trước khi code |

## Output format

```
## Judge: <PASS | NEEDS_CLARIFICATION | FAIL>

### Mơ hồ phát hiện

| # | Loại | Vị trí | Vấn đề | Impact |
|---|------|--------|--------|--------|
| 1 | Scope | Dòng 5 | "Thêm payment" — cổng nào? | HIGH |

### Câu hỏi làm rõ

1. **HIGH**: Hỗ trợ cổng thanh toán nào? (VietQR, PayOS, khác?)
2. **MEDIUM**: Target response time cho payment flow?

### Kết luận

<1-2 dòng: có thể implement chưa, cần gì thêm>
```

## Checklist

- [ ] Đọc toàn bộ yêu cầu
- [ ] Kiểm tra đủ 6 tiêu chí SC
- [ ] Ghi nhận mơ hồ với vị trí cụ thể
- [ ] Tối đa 5 câu hỏi, ưu tiên HIGH
- [ ] Verdict đúng bảng (PASS / NEEDS_CLARIFICATION / FAIL)
- [ ] Kết luận có hành động tiếp theo rõ ràng
