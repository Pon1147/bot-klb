# Container Module Audit Workflow

Reusable workflow cho việc audit, review, và fix issues trong `src/commands/container/`.

## Trigger

Chạy khi:

- Có PR/commit thay đổi code trong `src/commands/container/`
- Trước khi ship feature mới liên quan đến container editor
- Định kỳ (tuần/lý) để đảm bảo code quality

## Steps

### 1. Read All Container Files

Read toàn bộ 8 files trong `src/commands/container/`:

- `container.command.ts` — Entry point, slash command definition
- `container-edit.handler.ts` — Session initialization
- `container-routers.ts` — Button/modal interaction routing
- `container-property.handlers.ts` — Lines, color, separator, media handlers
- `container-action.handlers.ts` — Save, reset, cancel handlers
- `container-builders.ts` — UI component factories (buttons, modals, preview)
- `container-session.ts` — Session state management + cleanup
- `container-reset.handler.ts` — One-shot reset handler

### 2. Read Related Files

Read files mà container module phụ thuộc:

- `src/utils/container.utils.ts` — Core container builders
- `src/services/settings.service.ts` — Settings persistence
- `src/types/settings.types.ts` — Type definitions
- `src/config/container.variables.ts` — Color palette + defaults
- `src/events/interactionCreate.event.ts` — How interactions are routed to container
- `__tests__/*container*` — Test coverage

### 3. Check Dimensions

For each dimension, grep and read relevant code:

**Correctness:**

- Grep for `interaction.reply` and `interaction.update` — verify no double reply
- Grep for `deferUpdate` — verify not called after reply
- Check modal handler: error paths return early, success path calls deferUpdate
- Check session timeout: `createdAt` vs last interaction

**Consistency:**

- Grep for function names across files — find duplicates
- Grep for `as any` — count and assess necessity
- Check naming conventions: `handle*` for handlers, `build*` for builders

**Integration:**

- Trace: `interactionCreate.event.ts` → container router → handler → builder
- Verify SettingsService.get() → SettingsService.update() flow matches
- Check type definitions match actual usage
- Verify test coverage for critical paths

### 4. Run Tests

```bash
npm test -- --testPathPattern=container --coverage --collectCoverageFrom=src/commands/container/**
```

Verify:

- All tests pass
- Coverage meets threshold (100% lines/branches, 95% functions/statements)
- No new warnings

### 5. Report

Output findings ranked by severity:

- **High**: Bug that causes production failure
- **Medium**: Code smell, maintainability risk
- **Low**: Nice-to-have improvement

Each finding includes:

- Title, severity, file:line
- What's wrong, why it matters
- Fix suggestion
