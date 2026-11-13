---
name: ui-ux-design
description: Thiết kế và xây dựng giao diện Discord (Container V2, Embed, Button, Modal, Select Menu) hoặc web view. Dùng khi tạo/sửa UI component, layout, hoặc interaction. Không dùng khi chỉ sửa logic nghiệp vụ không liên quan hiển thị.
---

# UI/UX Design — Discord Bot

## Nguyên tắc

1. **Nội dung trước, rối sau**: Thông tin chính ở trên, chi tiết phụ dùng progressive disclosure (modal, select, expand).
2. **Component native**: Dùng Container V2, ActionRow, Button, StringSelect, TextDisplay, MediaGallery, Separator, Section, Thumbnail. Không tự tạo layout bằng text thuần khi có component phù hợp.
3. **Nhãn rõ ràng**: Button label ngắn, có color cue (Primary/Success/Danger/Secondary). Error state phải có hướng dẫn bước tiếp theo.
4. **Nhất quán**: Tuân thủ palette màu trong `src/config/container.variables.ts` (`COLORS`). Không hardcode hex.

## Giới hạn Discord (xác minh từ code repo)

| Giới hạn                                  | Giá trị         | Nguồn                                                              |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------ |
| Tổng text mọi TextDisplay trong 1 message | **4,000 ký tự** | `MAX_CONTAINER_TEXT_LENGTH` trong `src/config/app.constants.ts`    |
| Buttons per ActionRow                     | **5**           | Comment trong `src/features/team-find/team-find.menu.ts`           |
| Session timeout (container edit)          | **15 phút**     | `CONTAINER_SESSION_TIMEOUT_MS` trong `src/config/app.constants.ts` |
| Session timeout (team-find)               | **10 phút**     | `TEAM_FIND_SESSION_TIMEOUT_MS` trong `src/config/app.constants.ts` |
| Claim code TTL                            | **10 phút**     | `CLAIM_CODE_TTL_MS` trong `src/config/app.constants.ts`            |
| Avatar size (embed)                       | **256px**       | `EMBED_AVATAR_SIZE` trong `src/config/app.constants.ts`            |
| Avatar size (default)                     | **128px**       | `DEFAULT_AVATAR_SIZE` trong `src/config/app.constants.ts`          |

> Số chưa xác minh từ code repo: số lượng ActionRow tối đa per message, giới hạn options per StringSelect, giới hạn attachments per message. Tra cứu tại discord.js docs hoặc Discord Developer Portal khi cần.

## Palette màu (từ `container.variables.ts`)

| Key               | Hex       | Dùng cho           |
| ----------------- | --------- | ------------------ |
| `WELCOME`         | `#5865f2` | Welcome, info      |
| `SUCCESS`         | `#57f287` | Thành công         |
| `WARNING`         | `#fee75c` | Cảnh báo           |
| `ERROR` / `LEAVE` | `#ed4245` | Lỗi, leave         |
| `BOOSTER`         | `#fb663a` | Booster            |
| `DF`              | `#0ff695` | Delta Force accent |

## Reply flags (bắt buộc)

```typescript
// ĐÚNG
await interaction.reply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, ... });

// SAI — không dùng ephemeral: true
await interaction.reply({ ephemeral: true, ... });
```

## Checklist

- [ ] Dùng component native, không text thuần khi có component phù hợp
- [ ] Tổng text < 4,000 ký tự (kiểm tra bằng `MAX_CONTAINER_TEXT_LENGTH`)
- [ ] Buttons chia thành rows tối đa 5
- [ ] Màu từ `COLORS` trong `container.variables.ts`, không hardcode
- [ ] Reply dùng `flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2`
- [ ] Error state có hướng dẫn bước tiếp theo
- [ ] Session có timeout phù hợp (10-15 phút)
