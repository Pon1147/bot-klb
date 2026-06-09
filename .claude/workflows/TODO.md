---
name: df-link-redesign
description: Redesign /df-link flow — replace DevTools copy-paste with webhook relay
metadata:
  type: project
---

# Redesign `/df-link` — Remove DevTools Dependency

## Problem

Current flow has 7 steps, each a drop-off point:

```text
/df-link get-script → bot DMs JS file → user opens HQ page → login → F12 DevTools → paste script → interact → copy JSON → back to Discord → /df-link paste
```

**Pain points (from user feedback):**

- Users don't know how to use DevTools (F12, Console tab)
- Too many manual steps (7+ interactions)
- Entire flow can/should be replaced
- **User can run a webhook server** — this is the enabler

## Solution: Webhook Relay (Primary)

Replace copy-paste with direct POST. The bot exposes an HTTP endpoint that receives credentials from the browser, links them to a Discord user by claim code, and confirms on Discord via DM.

**New flow (3 steps):**

```text
1. /df-link start   → bot sends 6-char claim code via DM
2. User opens HQ page (logged in) → injects 1-line userscript (or bookmarklet)
3. Userscript POSTs token to webhook → bot validates → saves → DMs success
```

Zero copy-paste, zero DevTools console, zero JSON parsing for the user.

---

## Task Breakdown

### Phase 1: Webhook Server (`src/server/`)

- [ ] 1.1 Add `express` dependency (lightweight HTTP server, no framework bloat)
  - **Why**: Bot needs an HTTP endpoint to receive webhook POST from browser
  - **File**: `package.json` + new `src/server/webhook-server.ts`
  - **Details**: Port from env `WEBHOOK_PORT` (default 3500), single route `POST /api/df/claim`

- [ ] 1.2 Design webhook endpoint contract
  - **File**: `src/server/webhook.routes.ts`
  - **Endpoint**: `POST /api/df/claim`
  - **Request body**: `{ code: string, openid: string, token: string }`
  - **Response 200**: `{ status: "linked", nickname: string }`
  - **Response 400**: `{ status: "error", message: string }` (bad code, missing fields)
  - **Response 409**: `{ status: "error", message: string }` (code already used)
  - **Security**: Rate limit 5 req/ip/min, no auth needed (codes are single-use, short-lived)
  - **From skills**: API design (status codes, error format), security-review (rate limiting, no secrets in URL)

- [ ] 1.3 In-memory claim code store
  - **File**: `src/services/df-claim-store.ts`
  - **Structure**: `Map<string, { discordId: string, expiresAt: number }>`
  - **Functions**: `generateCode(discordId: string): string`, `consumeCode(code: string): DiscordId | null`, `cleanupExpired(): void`
  - **Details**: 6-char alphanumeric code, 10-minute TTL, periodic cleanup (every 5 min)
  - **Note**: In-memory is fine — codes are short-lived, no need for DB persistence

- [ ] 1.4 Wire webhook server to bot lifecycle
  - **File**: `src/index.ts`
  - **Details**: Start server on bot ready, graceful shutdown on bot stop
  - **Env**: `ENABLE_WEBHOOK=true/false` to toggle (default true)

### Phase 2: Userscript (`src/scraper/`)

- [ ] 2.1 Rewrite userscript for webhook POST (replace clipboard copy)
  - **File**: `src/scraper/df-webhook.ts` (new, replaces dfStable.ts)
  - **Changes**:
    - Remove: clipboard copy, manual JSON formatting
    - Add: `fetch()` POST to webhook URL with claim code
    - Keep: fetch/XHR intercept for GetMyData token extraction
    - New: Configurable webhook URL + code (passed via URL params or prompt)
  - **Delivery**: Inline script tag injection via bookmarklet OR simplified console paste
  - **Target**: <50 lines (current dfStable.ts is 121 lines with comments/types)

- [ ] 2.2 Create bookmarklet as alternative to console paste
  - **File**: Generated at build time, included in DM message
  - **Concept**: Single URL user drags to bookmarks bar, one click injects script
  - **Challenge**: Bookmarklet size limit (~2KB); minify userscript aggressively
  - **Fallback**: If too large, keep as console paste but with a 1-liner instead of full file

### Phase 3: Discord Command (`src/commands/df/`)

- [ ] 3.1 Add `start` subcommand to `/df-link`
  - **File**: `src/commands/df/df-link.command.ts`
  - **Behavior**:
    1. Generate 6-char claim code via `generateCode(userId)`
    2. Send DM with:
       - Claim code (large, bold, easy to read)
       - Step 1: Open HQ page (with link)
       - Step 2: Bookmarklet instruction (drag to bookmarks, click) OR 1-liner console paste
       - Step 3: Wait for confirmation DM
    3. Show ephemeral: "Code đã gửi qua DM — mã `ABC123` (hết hạn sau 10 phút)"
  - **Security**: Only allow from guild, DM must be openable

- [ ] 3.2 Update command to send userscript content inline (not as file)
  - **File**: `src/commands/df/df-link.command.ts`
  - **Change**: Instead of sending `df-hq-script.js` attachment, embed the bookmarklet URL or 1-liner in the DM message
  - **Reason**: Users currently download file → open → copy → paste. New flow: read code → open page → paste 1-liner or click bookmarklet

- [ ] 3.3 Keep `paste` subcommand as fallback (deprecate, don't remove)
  - **Reason**: Some users may still prefer manual paste; don't break existing workflow
  - **Change**: Add note in description: "(fallback — dùng `/df-link start` để nhanh hơn)"

- [ ] 3.4 Remove `get-script` subcommand (replaced by `start`)
  - **File**: `src/commands/df/df-link.command.ts`
  - **Timing**: After `start` is fully working
  - **Note**: Update deployed commands via `npm run deploy-commands`

### Phase 4: Testing

- [ ] 4.1 Unit tests for claim code store
  - **File**: `__tests__/df-claim-store.test.ts`
  - **Cover**: generate/consume cycle, code collision, expiry, cleanup

- [ ] 4.2 Unit tests for webhook route handler
  - **File**: `__tests__/webhook.routes.test.ts`
  - **Cover**: Valid claim, invalid code, expired code, missing fields, rate limit

- [ ] 4.3 Update `df-link.command.test.ts` for new `start` subcommand
  - **Cover**: Code generation, DM send, ephemeral reply, error cases (no DM access)

- [ ] 4.4 Integration test: full webhook flow
  - **File**: `__tests__/df-link-webhook.integration.test.ts`
  - **Flow**: Start server → `/df-link start` → POST to webhook → verify DB → verify DM
  - **Mock**: Discord client, API client (getMyData)

### Phase 5: Cleanup

- [ ] 5.1 Deprecate `dfStable.ts` → rename to `dfStable.ts.bak` or remove
  - **Condition**: Only after Phase 4 tests pass

- [ ] 5.2 Update `src/scraper/getDailyCodes.ts` if it references old script
  - **Check**: Any imports of dfStable? If so, update to new module

- [ ] 5.3 Deploy updated commands to Discord
  - **Command**: `npm run deploy-commands`
  - **Verify**: `/df-link start` appears in Discord command list

---

## Alternative Approaches (Not Implementing Now)

### Approach B: Browser Extension

- One-time install, one-click capture, no DevTools
- **Pros**: Best UX for non-technical users, no console needed
- **Cons**: Requires Chrome Web Store or manual CRX install (higher barrier than script)
- **When**: Consider if webhook relay still has adoption issues

### Approach C: Cookie-Based Auth

- User exports cookies → bot uses cookies to call HQ page directly
- **Pros**: No token extraction needed
- **Cons**: SameSite cookie policy blocks cross-origin cookie send; requires DevTools Application tab (worse than Console)
- **Verdict**: Rejected — cookie restriction makes this impractical

### Approach D: Server-Side Puppeteer (No User Script)

- Bot runs Puppeteer, user shares session via screen share or remote browser
- **Pros**: No client-side code
- **Cons**: Requires shared browser session, complex auth handoff, slow
- **Verdict**: Rejected — too complex for the problem

---

## Design Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| HTTP framework | Express | Lightest Node HTTP framework; bot already has axios, minimal add |
| Code length | 6 chars | Balance: unique enough for low volume, easy to read/type |
| Code TTL | 10 minutes | Enough time to complete flow, limits stale code accumulation |
| Storage | In-memory Map | Codes are ephemeral; no need for DB, survives restart = fine to lose |
| Auth | Code-based (no JWT) | Single-use, short-lived codes are sufficient; no bot-to-browser auth needed |
| Rate limit | 5 req/ip/min | Prevents abuse; enough for legitimate retry |
| Webhook URL | User-provided in DM | Bot tells user the URL; no reverse proxy or domain needed for dev |

## Ngrok / Public URL Consideration

For local development, the webhook server needs a public URL for the HQ page to POST to. Options:

- **ngrok**: `ngrok http 3500` → gives public URL for DM message
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3500`
- **Production**: Bot server already has public IP → webhook runs on same host

The userscript/bookmarklet will be configured with the webhook URL at generation time (when `/df-link start` is called).
