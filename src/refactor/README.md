# DF Stats UI Redesign Documentation

## 1. Mục tiêu

Tài liệu này mô tả kế hoạch redesign command `/df-stats` của Discord bot
KLB.

### Hiện trạng

UI hiện tại sử dụng:

- Discord Embed
- Text fields
- Bullet list
- Select Menu để chuyển category

Ví dụ dữ liệu đang hiển thị:

- Tổng quan
- Kinh tế
- Chiến đấu
- Tiểu đội

UI hiện tại hoạt động tốt về mặt dữ liệu và interaction, nhưng phần
trình bày bị giới hạn bởi Discord Embed và chưa tạo được cảm giác giống
giao diện Delta Force.

### Mục tiêu redesign

Chuyển phần **presentation layer** từ Discord Embed sang một **dashboard
image được render động**, lấy cảm hứng từ visual language của UI Delta
Force.

Mục tiêu kiến trúc:

```text
DF API / Existing Data
        ↓
Normalize dữ liệu
        ↓
DFStatsViewModel
        ↓
DFStatsRenderer
        ↓
PNG/WebP Buffer
        ↓
Discord Attachment
        +
Discord Select Menu / Buttons
```

Nguyên tắc:

> Image chịu trách nhiệm Presentation.\
> Discord Components chịu trách nhiệm Interaction.

---

## 2. Reference UI

Thiết kế tham khảo gồm hai nguồn visual chính:

1.  UI Delta Force chính thức.
2.  Một implementation Discord `/df-stats` sử dụng dashboard image.

Các đặc điểm cần kế thừa:

- Dark tactical interface.
- Military / industrial atmosphere.
- Operator artwork là visual focus.
- Layout nhiều panel.
- Typography đậm, dễ đọc.
- Border mảnh và HUD-style decorations.
- Background tối, blur nhẹ.
- Rank và operator là các focal point.
- Data được trình bày theo hierarchy rõ ràng.

Không nên copy nguyên xi screenshot hoặc hard-code một ảnh cố định. Mục
tiêu là xây dựng một renderer có thể render dữ liệu động.

---

## 3. UX Flow

## Hiện tại

```text
/dF-stats
    ↓
Fetch data
    ↓
Discord Embed
    ↓
Select Menu
    ↓
User chọn category
    ↓
Update Embed
```

## Sau redesign

```text
/df-stats
    ↓
Fetch data
    ↓
Normalize dữ liệu
    ↓
Render Dashboard Image
    ↓
Discord Attachment
    +
Select Menu
    ↓
User chọn category
    ↓
Render View mới
    ↓
interaction.update()
```

### Điểm quan trọng

Không thay đổi UX interaction hiện tại nếu không cần thiết.

Select Menu hiện tại là một interaction pattern phù hợp vì dữ liệu được
chia thành nhiều nhóm.

---

## 4. Các Dashboard Views

Dữ liệu hiện tại nên được chia thành 4 views.

## 4.1 Overview

Mục tiêu: hiển thị profile tổng quan.

Dữ liệu chính:

- Player name
- Level
- Overall points
- Join date
- Play duration
- Total matches

Layout đề xuất:

```text
┌──────────────────────────────────────────────────────────────┐
│ DELTA FORCE                                PLAYER PROFILE    │
│                                                              │
│ OPERATIONS                                                    │
│                                                              │
│ Basic Info                OPERATOR ARTWORK       Current Rank│
│                                                              │
│ Level                     [ CHARACTER ]          [ BADGE ]   │
│ Total Matches                                  Rank Name      │
│ Play Duration                                  Rank Points    │
│ Overall Points                                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4.2 Economy

Dữ liệu hiện tại:

- Tổng reward
- Extract value
- Profit/Loss
- Mandel Brick

Layout đề xuất:

```text
┌──────────────────────────────────────────────────────────────┐
│ OPERATIONS / ECONOMY                                         │
│                                                              │
│ Total Reward                  Extract Value                  │
│                                                              │
│ Profit / Loss                 Mandel Brick                   │
│                                                              │
│                  OPERATOR ARTWORK                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4.3 Combat

Dữ liệu hiện tại:

- Kill
- Hit rate
- Headshot
- KD

Layout đề xuất:

```text
┌──────────────────────────────────────────────────────────────┐
│ OPERATIONS / COMBAT                                          │
│                                                              │
│ Kills                         Hit Rate                       │
│                                                              │
│ Headshot Rate                 K/D                            │
│                                                              │
│                  OPERATOR ARTWORK                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4.4 Squad

Dữ liệu hiện tại:

- Revive
- Rescue
- Retreat rate
- Team Extract

Layout đề xuất:

```text
┌──────────────────────────────────────────────────────────────┐
│ OPERATIONS / SQUAD                                           │
│                                                              │
│ Revive                        Rescue                         │
│                                                              │
│ Retreat Rate                  Team Extract                   │
│                                                              │
│                  OPERATOR ARTWORK                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Recommended Technical Approach

## Recommendation: Sharp + SVG

Ưu tiên sử dụng:

```text
Sharp
  +
SVG UI Template
  +
PNG/WebP Assets
```

### Vì sao không nên dùng Discord Embed cho presentation chính?

Discord Embed không hỗ trợ:

- Absolute positioning.
- Layering tùy ý.
- Background artwork.
- Character artwork overlap.
- HUD border.
- Custom panel geometry.
- Full visual control.

### Vì sao Sharp + SVG?

Sharp phù hợp để:

- Resize ảnh.
- Composite nhiều layers.
- Export PNG/WebP.
- Xử lý buffer.
- Render hiệu quả trên bot server.

SVG phù hợp để:

- Panel.
- Border.
- Text.
- Gradient.
- Blur.
- Decorative HUD lines.
- Dynamic layout.

Pipeline:

```text
Background
    +
Operator Artwork
    +
Dark Overlay
    +
SVG UI Panels
    +
Rank Icon
    +
Avatar
    +
Badges
    ↓
Sharp Composite
    ↓
PNG Buffer
```

---

## 6. Renderer Architecture

Không nên đặt toàn bộ logic vẽ vào một file lớn.

## Cấu trúc đề xuất

```text
src/
├── commands/
│   └── df-stats.command.ts
│
├── services/
│   └── delta-force/
│       └── df-stats.service.ts
│
├── renderers/
│   └── df-stats/
│       ├── df-stats.renderer.ts
│       │
│       ├── views/
│       │   ├── overview.view.ts
│       │   ├── economy.view.ts
│       │   ├── combat.view.ts
│       │   └── squad.view.ts
│       │
│       ├── components/
│       │   ├── header.ts
│       │   ├── basic-info-panel.ts
│       │   ├── stat-grid.ts
│       │   ├── rank-panel.ts
│       │   ├── operator-panel.ts
│       │   └── badges-panel.ts
│       │
│       ├── utils/
│       │   ├── image-loader.ts
│       │   ├── number-format.ts
│       │   └── text-fit.ts
│       │
│       └── types/
│           └── df-stats.types.ts
│
└── assets/
    └── delta-force/
        ├── backgrounds/
        ├── operators/
        ├── ranks/
        ├── badges/
        └── fonts/
```

---

## 7. Data Layer

Không đưa raw API response trực tiếp vào renderer.

Nên có một bước normalize.

```text
Raw API Response
        ↓
DFStatsService
        ↓
DFStatsViewModel
        ↓
Renderer
```

## Type đề xuất

```ts
export type DFStatsView = 'overview' | 'economy' | 'combat' | 'squad';

export interface DFStatsViewModel {
  player: {
    name: string;
    level: number;
    avatarUrl?: string;
    joinDate?: string;
    playDuration?: string;
  };

  overview: {
    totalPoints?: number;
    totalMatches?: number;
  };

  economy: {
    totalReward?: number;
    extractValue?: number;
    profitLoss?: number;
    mandelBrick?: number;
  };

  combat: {
    kills?: number;
    hitRate?: number;
    headshotRate?: number;
    kd?: number;
  };

  squad: {
    revive?: number;
    rescue?: number;
    retreatRate?: number;
    teamExtract?: number;
  };

  rank?: {
    name: string;
    points?: number;
    assetKey?: string;
  };

  operator?: {
    id?: string;
    name?: string;
    assetKey?: string;
  };

  badges?: string[];
}
```

Renderer chỉ nhận data đã normalize:

```ts
const image = await dfStatsRenderer.render({
  view: 'overview',
  data: viewModel,
});
```

---

## 8. Asset Strategy

## 8.1 Backgrounds

```text
assets/delta-force/backgrounds/
├── operations.webp
├── warfare.webp
├── combat.webp
└── economy.webp
```

Background cần tối để text dễ đọc.

Có thể dùng:

```text
Original Background
      +
Dark Overlay
      +
Blur / Vignette
```

## 8.2 Operator Assets

```text
assets/delta-force/operators/
├── stinger.png
├── ...
```

Ưu tiên PNG/WebP có transparency.

Nếu operator artwork không có transparency, renderer sẽ khó tạo cảm giác
layering như UI game.

## 8.3 Rank Assets

```text
assets/delta-force/ranks/
├── bronze/
├── silver/
├── gold/
└── ...
```

Mapping:

```ts
const RANK_ASSETS: Record<string, string> = {
  silver_1: 'silver-1.png',
  silver_2: 'silver-2.png',
  silver_3: 'silver-3.png',
};
```

---

## 9. Layout System

Không nên hard-code text và panel trực tiếp trong renderer chính.

Tạo constants:

```ts
export const CANVAS = {
  width: 1536,
  height: 864,
};
```

Ví dụ layout:

```ts
export const LAYOUT = {
  leftPanel: {
    x: 100,
    y: 100,
    width: 440,
    height: 710,
  },

  center: {
    x: 540,
    y: 0,
    width: 460,
    height: 864,
  },

  rightPanel: {
    x: 995,
    y: 100,
    width: 440,
    height: 490,
  },
};
```

Các giá trị thực tế cần được tinh chỉnh sau khi prototype.

---

## 10. Render Layers

Thứ tự layer rất quan trọng.

```text
Layer 1
Background

Layer 2
Dark Overlay

Layer 3
Atmospheric Effects

Layer 4
Operator Artwork

Layer 5
UI Panels

Layer 6
Text

Layer 7
Rank / Avatar / Badges

Layer 8
Foreground Shadows / Decorations
```

Operator không nên luôn nằm dưới toàn bộ panel.

Một số artwork có thể:

```text
Background
    ↓
Character torso
    ↓
Panel
    ↓
Character foreground element
```

Điều này tạo cảm giác chiều sâu.

---

## 11. Discord Integration

## Initial Reply

```ts
const buffer = await dfStatsRenderer.render({
  view: 'overview',
  data,
});

await interaction.reply({
  files: [
    new AttachmentBuilder(buffer, {
      name: 'df-stats.png',
    }),
  ],
  components: [createDFStatsSelectMenu('overview')],
});
```

## Select Menu Interaction

```ts
const view = interaction.values[0] as DFStatsView;

const buffer = await dfStatsRenderer.render({
  view,
  data,
});

await interaction.update({
  files: [
    new AttachmentBuilder(buffer, {
      name: 'df-stats.png',
    }),
  ],
  components: [createDFStatsSelectMenu(view)],
});
```

### Lưu ý

Khi update attachment, cần kiểm tra behavior của Discord.js version hiện
tại để tránh attachment cũ bị giữ lại ngoài ý muốn.

---

## 12. Caching Strategy

Render image cho mỗi interaction có thể tốn CPU.

Nên cache:

## Static assets

Load khi application startup:

- Background.
- Rank icons.
- Operator images.
- Fonts.

## Dynamic output

Có thể cache theo:

```text
playerId
+
view
+
statsUpdatedAt
```

Ví dụ:

```text
df-stats:{playerId}:{view}:{dataVersion}
```

Nếu stats không thay đổi:

```text
Return cached image
```

Nếu user bấm Refresh:

```text
Fetch API
    ↓
Invalidate cache
    ↓
Render lại
```

---

## 13. Error Handling

Renderer không nên fail toàn bộ nếu một asset thiếu.

Ví dụ:

```text
Operator image missing
    ↓
Fallback background

Rank icon missing
    ↓
Text-only rank

Badge missing
    ↓
Hide badge slot
```

Không nên để:

```text
Missing rank image
    ↓
Entire /df-stats command crashes
```

---

## 14. Responsive Text Rules

Image là fixed-size nhưng dữ liệu có độ dài khác nhau.

Ví dụ:

```text
1Stops
```

và:

```text
VeryLongPlayerNameExample123
```

Cần có helper:

```ts
fitText({
  text,
  maxWidth,
  fontSize,
  minFontSize,
});
```

Các lựa chọn:

1. Giảm font size.
2. Truncate bằng ellipsis.
3. Wrap tối đa 2 dòng.

Khuyến nghị:

- Username: ellipsis hoặc giảm font nhẹ.
- Stat label: wrap tối đa 2 dòng.
- Stat value: ưu tiên single line.

---

## 15. Implementation Phases

## Phase 1 --- Inspect Current Implementation

Kiểm tra:

- `/df-stats` command.
- Service lấy data.
- Embed builder hiện tại.
- Select Menu handler.
- Custom ID pattern.
- Interaction update flow.

Mục tiêu:

> Không phá logic hiện tại.

---

## Phase 2 --- Build ViewModel

Tách:

```text
API Response
```

khỏi:

```text
UI Renderer Input
```

Output:

```ts
DFStatsViewModel;
```

---

## Phase 3 --- Asset Preparation

Chuẩn bị:

- Backgrounds.
- Operators.
- Rank icons.
- Badges.
- Fonts.

---

## Phase 4 --- Renderer Prototype

Render trước một view:

```text
overview
```

Kiểm tra:

- Readability.
- Text overflow.
- Image size.
- Discord attachment quality.
- Render time.

---

## Phase 5 --- Remaining Views

Implement:

```text
economy
combat
squad
```

---

## Phase 6 --- Integrate Components

Giữ Select Menu.

```text
Tổng quan
Kinh tế
Chiến đấu
Tiểu đội
```

Select:

```text
User action
    ↓
interaction.update()
    ↓
Replace dashboard image
```

---

## Phase 7 --- Performance and Cache

Kiểm tra:

- Render latency.
- Memory.
- Concurrent users.
- Asset loading.
- Cache invalidation.

---

## 16. Non-Goals

Trong phase đầu không cần:

- Animation.
- Video rendering.
- Real-time live dashboard.
- Rebuild toàn bộ command logic.
- Thay Select Menu bằng một interaction system phức tạp.
- Pixel-perfect clone 100% UI chính thức.

Mục tiêu là:

> Một dashboard image động, có chất lượng cao, nhận diện rõ visual
> language Delta Force và hoạt động ổn định trong Discord.

---

## 17. Final Architecture

```text
┌───────────────────────────┐
│ Discord /df-stats Command │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ DF Stats Service          │
│ Fetch / Transform Data    │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ DFStatsViewModel          │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ DFStatsRenderer           │
│                           │
│ Sharp + SVG + Assets      │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ PNG/WebP Buffer           │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Discord Attachment        │
│ + Select Menu             │
└───────────────────────────┘
```

---

## 18. Definition of Done

Việc redesign `/df-stats` được xem là hoàn thành khi:

- [ ] Command `/df-stats` vẫn lấy đúng dữ liệu hiện tại.
- [ ] Không còn phụ thuộc vào Embed cho presentation chính.
- [ ] Có dashboard image động.
- [ ] Có ít nhất 4 views: Overview, Economy, Combat, Squad.
- [ ] Select Menu chuyển view thành công.
- [ ] Interaction dùng `interaction.update()`.
- [ ] Text không overflow nghiêm trọng.
- [ ] Asset thiếu có fallback.
- [ ] Render không làm bot crash.
- [ ] Có cache phù hợp.
- [ ] Visual hierarchy giống phong cách tactical dashboard của Delta
      Force.
- [ ] Không phá các command hoặc interaction hiện tại.

---

## 19. Recommended Next Step

Trước khi code renderer, cần inspect chính xác implementation
`/df-stats` hiện tại trong repository.

Mục tiêu inspect:

1.  File command chính.
2.  Service/API data source.
3.  Embed builder hiện tại.
4.  Select Menu builder.
5.  Interaction handler.
6.  Types đang sử dụng.

Sau khi inspect, mapping hiện tại sẽ được chuyển thành:

```text
Current Data Field
        ↓
DFStatsViewModel Field
        ↓
Dashboard View
```

Việc này giúp implementation thực tế bám đúng codebase hiện tại thay vì
tạo một renderer độc lập nhưng không tương thích.
