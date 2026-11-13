# KL BOT - Discord Bot

Discord bot built with TypeScript and discord.js v14, using Container V2 components and SQLite for persistence. Guild-scoped commands deployed via incremental diff detection.

## Architecture

Xem `AGENTS.md` §1 (Vertical Slice Architecture) và §2 (Anti-Hallucination Boundaries) cho chi tiết.

## Minimalism / Anti-Overengineering

Xem `AGENTS.md` §4 (Lazy Senior Dev — 11 nguyên tắc) cho chi tiết.

## File Structure

Xem `AGENTS.md` §1 cho cây thư mục đầy đủ. Điểm chính:

```
src/
  app/                      - Bootstrap & startup sequence
  infrastructure/           - Discord infra: command loader, event loader, interaction router
  features/                 - Vertical slices: welcome, booster, container, delta-force, admin, payment, team-find
  database/                 - SQLite + MongoDB connection
  services/                 - Shared background services
  utils/                    - Pure utilities & logging
  types/                    - TS declarations
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

- Coverage thresholds: xem `jest.config.cjs` (section `coverageThreshold`) — nguồn sự thật duy nhất.
- Excluded from coverage: `src/index.ts`, `src/config/bot.config.ts`, scraper files.
- Per-file threshold overrides cho files có discord.js builder code và Express fallback paths.

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

1. Add commands in `src/features/<domain>/`. Ensure `data` and `execute` are exported.
2. For subcommands with shared logic (channel/role/toggle/status), use `section-config.handlers.ts` generic handlers.
3. Run `npm run test` before committing; coverage must meet thresholds.
4. Run `npm run check` to verify types.
5. Commands are auto-discovered; no manual registration needed.
6. Deployment is incremental: `deployCommands()` compares local fingerprint with Discord and only reports changes.

## Skills Reference

Detailed conventions are in `.claude/skills/<name>/SKILL.md`. Read the relevant skill when working on that topic:

| Skill                    | When to Read                                             |
| ------------------------ | -------------------------------------------------------- |
| `tdd-workflow`           | Writing new features or fixing bugs (MANDATORY)          |
| `security-review`        | Secrets, input validation, authentication, payment       |
| `ui-ux-design`           | Discord embeds, buttons, modals, Container V2 components |
| `documentation-research` | Researching library APIs, framework features             |
| `judge`                  | Evaluating if task requirements are clear enough         |
| `message-commit`         | Generating commit messages for staged changes            |

## Quick Reference

| Rule     | Do                         | Don't                    |
| -------- | -------------------------- | ------------------------ |
| Secrets  | `process.env.VAR`          | Hardcoded keys           |
| State    | `{ ...state, key: value }` | `state.key = value`      |
| SQL      | Parameterized queries      | String concatenation     |
| Tokens   | httpOnly cookies           | localStorage             |
| Comments | Vietnamese                 | English                  |
| Tests    | Write first                | Write after              |
| Errors   | Generic to user            | Stack traces             |
| Async    | `Promise.all()`            | Sequential when parallel |
