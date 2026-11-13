---
name: tdd-workflow
description: Quy trình TDD (Red → Green → Refactor) cho repo này. Dùng khi viết feature mới, sửa bug, hoặc refactor code có logic nghiệp vụ. Không dùng cho thay đổi tầm thường (typo, label, config) — chỉ cần `npm run check`.
---

# TDD Workflow

## Khi nào dùng

- Feature mới có logic nghiệp vụ (handler, service, db query)
- Sửa bug cần tái hiện trước khi fix
- Refactor code có test coverage

**Không dùng cho:** đổi label, sửa comment, cập nhật config, đổi type định nghĩa → chỉ chạy `npm run check`.

## Quy trình 3 pha

### 1. RED — Viết test fail trước

- Viết test mô tả **hành vi mong đợi** (không phải implementation).
- Chạy `npm test -- <tên-file-test>` → **bắt buộc phải fail đúng lý do** (thiếu implementation, sai logic).
- Nếu test pass ngay → test sai, viết lại.
- Nếu fail do syntax error hoặc thiếu dependency → fix setup trước, không tính là RED.

### 2. GREEN — Viết code tối thiểu để pass

- Viết **ít code nhất** để test pass.
- Không refactor trong pha này.
- Chạy lại test → **bắt buộc pass**.

### 3. REFACTOR — Dọn code khi test xanh

- Tách hàm, đổi tên, xóa code thừa.
- Chạy test sau **mỗi** bước refactor → phải pass.
- Chạy `npm run check` xác minh type safety.

## Script (chỉ dùng lệnh có trong package.json)

| Mục đích             | Lệnh                     |
| -------------------- | ------------------------ |
| Chạy test cụ thể     | `npm test -- <tên-file>` |
| Chạy toàn bộ test    | `npm test`               |
| Chạy test + coverage | `npm run test:coverage`  |
| Type check           | `npm run check`          |
| Watch mode           | `npm run test:watch`     |

> Ngưỡng coverage: xem `jest.config.cjs` (section `coverageThreshold`). Không ghi số ở đây.

## Cấu trúc test (theo pattern repo)

```typescript
// Mock discord.js — bắt buộc cho mọi test liên quan interaction
jest.mock('discord.js', () => ({
  MessageFlags: { IsComponentsV2: 65536, Ephemeral: 64 },
  ComponentType: { Container: 17, TextDisplay: 10, Button: 2 },
}));

// Mock database module
jest.mock('../../src/database/df.token.db.js', () => ({
  getDfToken: jest.fn(),
}));

// Import sau khi mock — dùng đuôi .js (node16)
import { requireDfToken } from '../../src/utils/df-guards.js';

describe('df-guards — requireDfToken', () => {
  it('nên trả về true và reply error khi không có token', async () => {
    // Arrange — mock interaction object
    (getDfToken as jest.Mock).mockReturnValue(undefined);
    const interaction: any = {
      user: { id: 'user-123' },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    // Act
    const result = await requireDfToken(interaction, mockDb);

    // Assert
    expect(result).toBe(true);
    expect(interaction.reply).toHaveBeenCalled();
  });
});
```

### Pattern SQLite in-memory

```typescript
import Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => {
  db = new Database(':memory:');
  initializeTable(db);
});
afterEach(() => {
  db.close();
});
```

### Pattern mock MongoDB

```typescript
jest.mock('../../src/database/mongo/index.js', () => ({
  isMongoConnected: jest.fn(() => false),
  upsertAccountBindingToMongo: jest.fn().mockResolvedValue(true),
}));
```

## Checklist

- [ ] Test viết **trước** code production
- [ ] RED: test fail đúng lý do (chạy thật, không đoán)
- [ ] GREEN: code tối thiểu, test pass
- [ ] REFACTOR: test vẫn xanh sau mỗi bước
- [ ] `npm run check` pass
- [ ] Import có đuôi `.js`
- [ ] Comment tiếng Việt
- [ ] Mock theo pattern repo (discord.js, better-sqlite3 `:memory:`, mongo module)
