---
name: message-commit
description: Phân tích git diff đã staged và sinh commit message tiếng Việt đúng convention. Dùng khi user yêu cầu tạo commit message. Không dùng khi user yêu cầu viết code, sửa bug, hoặc tạo tài liệu.
---

# Git Commit Message

Nhiệm vụ duy nhất: **phân tích git diff và sinh commit message đúng convention**. Không viết code, không sửa code, không tạo tài liệu.

## Nguyên tắc

1. Phân tích `git diff --staged` (hoặc `git diff` nếu chưa staged) trước khi viết.
2. Commit message phải phản ánh chính xác thay đổi thực tế trong diff.
3. Subject và description bắt buộc tiếng Việt.
4. Nhiều thay đổi không liên quan → yêu cầu user tách commit, không sinh message.
5. Không suy diễn thay đổi không tồn tại trong diff.

## Format

```
<type>[scope]: <subject>

- description_1
- description_2
```

## Type

| Type     | Ý nghĩa          |
| -------- | ---------------- |
| feat     | Chức năng mới    |
| fix      | Sửa lỗi          |
| docs     | Tài liệu         |
| style    | Format code      |
| refactor | Tái cấu trúc     |
| perf     | Tối ưu hiệu năng |
| test     | Thêm/sửa test    |
| build    | Build system     |
| ci       | CI/CD            |
| chore    | Bảo trì          |

## Scope

Lấy từ tên feature trong `src/features/<name>/`:

| Đường dẫn                   | Scope       |
| --------------------------- | ----------- |
| `src/features/welcome/`     | `welcome`   |
| `src/features/booster/`     | `booster`   |
| `src/features/container/`   | `container` |
| `src/features/delta-force/` | `df`        |
| `src/features/admin/`       | `admin`     |
| `src/features/payment/`     | `payment`   |
| `src/features/team-find/`   | `team-find` |
| Nhiều module                | Bỏ scope    |

## Subject

- Tiếng Việt, viết thường, không dấu ".", không emoji, không tiếng Anh.
- Tối đa ~60 ký tự, mô tả thay đổi quan trọng nhất.

## Description

- Cách subject một dòng trống, mỗi dòng bắt đầu `- `.
- Tiếng Việt, mô tả thay đổi thực tế, không lặp subject.
- Không ghi chung chung như "cập nhật code" hay "sửa lỗi".

## Workflow

1. Đọc `git diff --staged` (hoặc `git diff` + `git status`).
2. Xác định: mục đích, module, type, có nhiều thay đổi độc lập không.
3. Nhiều thay đổi độc lập → dừng, yêu cầu tách commit.
4. Sinh message chỉ dựa trên diff.
5. Kiểm tra: format, type, scope, tiếng Việt, đúng diff.

## Ví dụ

Diff: `src/features/delta-force/daily.handler.ts`, `src/features/delta-force/daily.command.ts`

```
feat(df): thêm lệnh nhận thưởng hàng ngày

- thêm subcommand /df daily claim
- kiểm tra cooldown 24h trước khi cấp thưởng
- cập nhật trạng thái claim trong database
```

Diff: `src/features/container/container.utils.ts`

```
fix(container): sửa lỗi render section khi thiếu thumbnail

- kiểm tra null trước khi gán thumbnail
- fallback về layout không có ảnh
```

## Output

Chỉ trả về commit message. Không markdown, không giải thích, không nhận xét.
