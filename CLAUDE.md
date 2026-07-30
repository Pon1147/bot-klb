# KL BOT - Discord Bot

Discord bot built with TypeScript and discord.js v14, using Container V2 components and SQLite for persistence. Guild-scoped commands deployed via incremental diff detection.

## Architecture

**Entry point:** `src/index.ts` orchestrates a 13-step boot sequence: initialize 3 database tables, create the Discord client, load commands/events, start background timers (session cleanup, claim cleanup), launch the webhook server, deploy commands, and login.

**Database:** Single SQLite file via `better-sqlite3` with 3 tables: `guild_settings`, `df_tokens`, `welcome`. Database handle is attached to `client.database`.

**SettingsService:** Singleton (registered via `setSettingsService`). Manages guild settings with an in-memory cache. `update()` is synchronous. Access via the singleton after bootstrap.

**Command loading:** `loadCommands()` recursively scans `src/commands/`, loading any module exporting `data` (SlashCommandBuilder) and `execute(interaction, ...args)`. Non-command files (handlers, builders, utils) are silently skipped.

**Command patterns:**

- **Generic pattern** (booster/, welcome/): each command file uses `section-config.handlers.ts` for shared subcommand logic (setchannel, setrole, toggle, status). Differentiated only by config (section key, display name, emoji, color).
- **Monolithic pattern** (df/): self-contained command files, each handling one slash command with all logic inline.

**Container editor:** Interactive session-based editor with 15-minute TTL. Routes button/modal interactions through property and action handlers. Session cleanup runs on an interval to prevent memory leaks.

**Services:** `deltaforce.api.ts` (axios client), `deltaforce.scraper.ts` (puppeteer-based web scraper), `df-claim-store.ts` (in-memory Map with 10-minute TTL for claim codes).

## File Structure

```bash
src/
  index.ts                  - Entry point, 13-step boot
  config/                   - Bot config, intents, defaults, colors
  database/                 - SQLite schema init (welcome, guild_settings, df_tokens)
  commands/
    booster/                - Generic section-config pattern (shared handler)
    welcome/                - Generic section-config pattern (shared handler)
    df/                     - Monolithic: daily, history, stats, link, unlink, code
    container/              - Interactive container editor with session management
  events/                   - guildMemberAdd, guildMemberUpdate, interactionCreate
  handlers/                 - Command loading, event loading
  services/                 - SettingsService, DeltaForce API, scraper, claim store
  server/                   - Express webhook server for external integrations
  types/                    - TS declarations, client augmentation
  utils/                    - Container utils, DF guards, rank/token utils, section-config, logger
  scraper/                  - Webhook script (excluded from tests)
__tests__/                  - Jest test suite
```

## Build / Run

```bash
npm run dev          - tsx watch (development)
npm run build        - tsc to dist/
npm run start        - node dist/index.js
npm run check        - tsc --noEmit (type check only)
```

Environment: Node >=22.12.0. Required env vars loaded in `src/config/bot.config.ts`: `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`, optionally `WEBHOOK_PORT` (default 3500).

## Testing

```bash
npm run test             - Jest with ts-jest, ESM
npm run test:coverage    - With coverage report
npm run test:e2e         - E2E suite (separate config in __tests__/e2e/)
```

- Coverage thresholds: 85% branches, 95% functions, 93% lines/statements globally.
- Excluded from coverage: `src/index.ts`, `src/config/bot.config.ts`, scraper files.
- Per-file threshold overrides for files with discord.js builder code and Express fallback paths.

## Key Conventions

- **Container V2 components** use `Record<string, unknown>` for component data. Convert with `toComponentsV2()` from `container.utils.ts`.
- **Reply flags:** Use `flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2`. NEVER use `ephemeral: true` in `reply()`.
- **Settings updates** are synchronous; no await needed for `settingsService.update()`.
- **Bilingual codebase:** English for booster/welcome modules, Vietnamese for df/container modules and core infrastructure.
- **Strict TypeScript:** ES2022 target, node16 modules, `noUnusedLocals`/`noUnusedParameters` enabled.
- **Unified palette:** Colors defined in `src/config/variables.ts`; do not hardcode hex values.
- **Container defaults:** Defined in `src/config/container.variables.ts`.
- **Logger:** Use `createLogger(tag)` from `src/utils/logger.ts`. Configurable via `src/config/logger.variables.ts`.

## Development Workflow

1. Add commands in `src/commands/<domain>/`. Ensure `data` and `execute` are exported.
2. For subcommands with shared logic (channel/role/toggle/status), use `section-config.handlers.ts` generic handlers.
3. Run `npm run test` before committing; coverage must meet thresholds.
4. Run `npm run check` to verify types.
5. Commands are auto-discovered; no manual registration needed.
6. Deployment is incremental: `deployCommands()` compares local fingerprint with Discord and only reports changes.
