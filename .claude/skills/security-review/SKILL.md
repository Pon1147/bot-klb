---
name: security-review
description: Review bảo mật cho repo này. Dùng khi thêm auth, xử lý user input, secrets, API endpoint, payment, hoặc lưu trữ dữ liệu nhạy cảm. Không dùng cho thay đổi UI thuần không chạm trust boundary.
---

# Security Review

## Khi nào dùng

- Thêm/sửa auth, RBAC, permission check
- Xử lý user input (interaction options, HTTP body, webhook payload)
- Làm việc với secrets, token, credential
- Thêm API endpoint hoặc HTTP handler
- Payment, crypto, dữ liệu nhạy cảm
- Integrations bên ngoài (axios, puppeteer, fetch)

## Checklist theo trust boundary

### 1. Secrets & Environment

```typescript
// ĐÚNG — đọc từ env, validate ngay khi boot
import { botConfig } from '../../config/bot.config.js';
// bot.config.ts: dotenv.config() + requireEnvVariable('BOT_TOKEN')

// SAI — hardcode
const token = '<DISCORD_TOKEN>';
```

- [ ] Mọi secret qua `process.env` / `botConfig`, không hardcode
- [ ] `.env` trong `.gitignore`
- [ ] Token game mã hóa AES-256-GCM qua `df-crypto.ts` trước khi lưu DB
- [ ] Không log secret: dùng `maskString()` từ `src/utils/string.utils.ts`

### 2. RBAC & Permission

```typescript
// ĐÚNG — kiểm tra quyền trước khi execute
import { loadPermissions, COMMAND_PATH_POLICIES } from '../../config/permissions.js';

// SAI — bỏ qua permission check
```

- [ ] Mọi command mới khai báo trong `COMMAND_PATH_POLICIES` (`src/config/permissions.ts`)
- [ ] Admin command kiểm tra role qua `loadPermissions()`
- [ ] Interaction router (`interaction-router.ts`) từ chối unmapped command path
- [ ] Test CI `__tests__/infrastructure/command-policy-mapping.test.ts` quét tự động

### 3. User Input Validation

```typescript
// ĐÚNG — Discord.js validate type tại API level
const type = interaction.options.getString('type', true); // required
const limit = interaction.options.getInteger('limit') || MAX_HISTORY_LIMIT; // optional + default
const channel = interaction.options.getChannel('channel', true); // validated object

// SAI — nhận raw string không validate
const input = interaction.options.getString('input'); // không check format
```

- [ ] Dùng `getString/getInteger/getBoolean/getChannel/getRole` — Discord.js đã validate type
- [ ] String input: validate format trước khi dùng (regex, whitelist, length)
- [ ] Integer: clamp range (`Math.min(Math.max(val, min), max)`)
- [ ] Không trust `interaction.user.id` cho logic nghiệp vụ quan trọng (anti-spoof)

### 4. Database (SQL Injection)

```typescript
// ĐÚNG — parameterized query (better-sqlite3)
const stmt = db.prepare('SELECT * FROM df_tokens WHERE guild_id = ? AND user_id = ?');
const row = stmt.get(guildId, userId);

// SAI — string concatenation
const row = db.prepare(`SELECT * FROM df_tokens WHERE guild_id = '${guildId}'`).get();
```

- [ ] Mọi query dùng `?` placeholder, không string interpolation
- [ ] MongoDB: không dùng `$where` với user input, dùng operator-based query
- [ ] Validate input trước khi đưa vào query (type, length, format)

### 5. External Requests (SSRF / Open Redirect)

```typescript
// ĐÚNG — validate URL trước khi fetch
const url = new URL(userInput);
if (!['https:'].includes(url.protocol)) throw new Error('Protocol not allowed');

// SAI — pass user input thẳng vào axios/puppeteer
await axios.get(userProvidedUrl);
```

- [ ] User-provided URL: validate protocol (https only), domain whitelist nếu cần
- [ ] Axios: set timeout (`API_TIMEOUT_MS`), không follow redirect vô hạn
- [ ] Puppeteer: không navigate đến user-provided URL không validate
- [ ] HTTP server: `MAX_PAYLOAD_SIZE = 64KB`, `SimpleRateLimiter` cho endpoint nhạy cảm

### 6. Logging

```typescript
// ĐÚNG — mask sensitive data
import { createLogger } from '../../utils/logger.js';
import { maskString } from '../../utils/string.utils.js';
const logger = createLogger('DfApi');
logger.info('Token: %s', maskString(token)); // "abc...xyz"

// SAI — log raw token
logger.info('Token: %s', token);
```

- [ ] Không log token, password, credential, PII
- [ ] Dùng `maskString()` cho mọi value nhạy cảm
- [ ] Error message gửi user: generic, không lộ stack trace

### 7. Dependencies

- [ ] `npm audit` trước khi commit
- [ ] Không thêm dependency mới không cần thiết
- [ ] Lock file (`package-lock.json`) commit vào repo

## Checklist tổng

- [ ] Secrets qua env, không hardcode
- [ ] RBAC policy khai báo cho mọi command mới
- [ ] User input validated tại trust boundary
- [ ] SQL parameterized, không string concat
- [ ] External URL validated trước khi request
- [ ] Log không chứa sensitive data
- [ ] `npm audit` sạch
- [ ] Test cho edge case bảo mật (tampered input, missing permission, oversized payload)
