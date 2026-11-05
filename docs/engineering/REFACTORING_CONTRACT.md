# REFACTORING CONTRACT

## Mandatory Engineering Agreement Between Project Owner & AI Coding Agent

**Project:** bot_klb — Delta Force Discord Bot  
**Document Type:** Mandatory Engineering Contract  
**Authority:** Project Owner  
**Applies To:** All AI Coding Agents, Models, Subagents and Automated Coding Tools  
**Status:** MANDATORY — NON-OPTIONAL

---

# 1. PURPOSE & AUTHORITY

This document establishes a mandatory engineering contract between the Project Owner and any AI Coding Agent working on this repository.

Its purpose is to ensure that every refactoring operation improves the codebase without compromising:

- Existing business logic.
- System reliability and stability.
- Security and data integrity.
- Architectural consistency.
- Performance and resource efficiency.
- Long-term maintainability.
- Testability and operational readiness.

This contract is mandatory.

The AI Coding Agent MUST follow every applicable requirement in this document.

## 1.1 Authority Hierarchy

When making engineering decisions, follow this priority:

1. Explicit instructions from the Project Owner.
2. This Refactoring Contract.
3. Repository-level engineering rules in `AGENTS.md`.
4. Approved architecture and technical specifications.
5. Existing implementation conventions.
6. AI Coding Agent recommendations.

The AI MUST NOT override explicit Project Owner decisions based on its own preferences.

If two mandatory requirements conflict, the AI MUST stop and request clarification instead of silently choosing one.

## 1.2 Core Principle

Refactoring is the improvement of internal implementation while preserving externally observable behavior.

A refactor is NOT successful merely because:

- Code becomes shorter.
- Files become fewer.
- Abstractions become more sophisticated.
- The directory structure looks cleaner.
- Tests pass without sufficient behavioral coverage.

The actual objective is to improve engineering quality without introducing regressions.

---

# 2. NON-NEGOTIABLE RULES

The following rules are mandatory.

### RF-01 — Preserve Existing Behavior

The AI MUST preserve existing business behavior unless the Project Owner explicitly authorizes a behavior change.

This includes:

- Discord commands and interactions.
- Event handling.
- API contracts and response structures.
- Database operations and data integrity.
- Authentication and authorization.
- Scheduled tasks and cron jobs.
- Background workers.
- Matchmaking and voice sessions.
- Webhooks and browser-extension communication.
- AutoPost and game-code scraping.
- Discord Components V2 behavior.

### RF-02 — No Unverified Code Removal

The AI MUST NOT delete code merely because it appears unused.

Before removing any implementation, verify:

- All references and imports.
- Dynamic imports and runtime registrations.
- Event listeners and command registration.
- Dependency injection and factory usage.
- Reflection or dynamically resolved modules.
- Build-time and deployment references.
- Tests and external integration points.

If usage cannot be conclusively determined, preserve the code and report the uncertainty.

### RF-03 — No Unnecessary Abstraction

The AI MUST NOT introduce:

- Unnecessary interfaces.
- Excessive design patterns.
- Over-engineered dependency injection.
- Redundant utility layers.
- Unnecessary wrapper functions.
- Premature generalization.
- Frameworks or dependencies without demonstrated benefits.

Every new abstraction must solve a concrete, documented problem.

### RF-04 — No Test Manipulation

The AI MUST NOT:

- Delete tests simply to achieve a passing test suite.
- Weaken assertions without justification.
- Skip failing tests to hide regressions.
- Mock away the behavior being tested.
- Modify expected results to accommodate an unintended behavior change.
- Claim coverage that has not been measured.

Any necessary test modification must include a technical justification.

### RF-05 — No Silent Error Suppression

The AI MUST NOT introduce error suppression mechanisms that hide failures.

Examples include:

- Empty catch blocks.
- Unjustified `as any`.
- Unnecessary `@ts-ignore`.
- Broad exception swallowing.
- Silent fallback behavior.
- Returning fabricated success responses.

Errors must be handled explicitly and consistently.

### RF-06 — No Unapproved Scope Expansion

The AI MUST NOT expand the refactoring scope without approval.

If additional problems are discovered:

1. Document the finding.
2. Explain its impact.
3. Identify dependencies and risks.
4. Recommend a solution.
5. Wait for approval when the change exceeds the authorized scope.

### RF-07 — No Destructive Changes Without Verification

Database migrations, schema changes, file deletions, configuration changes, dependency removal and data transformations require impact analysis.

Potentially irreversible operations MUST have a recovery strategy.

### RF-08 — No False Completion Claims

The AI MUST never claim that something has been verified, tested, fixed or completed unless the corresponding operation was actually performed and its result observed.

If a test cannot run, report it as NOT VERIFIED.

---

# 3. REFACTORING QUALITY STANDARDS

Every refactoring operation MUST be evaluated against the following ten engineering dimensions.

## 3.1 Behavior Preservation — 20 Points

Requirements:

- Preserve existing business rules.
- Preserve public interfaces and contracts.
- Preserve database semantics.
- Preserve event and interaction lifecycles.
- Preserve expected error behavior.
- Preserve scheduling and concurrency behavior.

Acceptance criteria:

- No unauthorized behavior changes.
- Existing regression tests pass.
- Relevant integration scenarios are verified.
- Any intentional behavior change is explicitly approved.

## 3.2 Architecture & Modularity — 15 Points

Requirements:

- Every module has a clear responsibility.
- Dependencies follow a consistent direction.
- Avoid circular dependencies.
- Separate business logic from infrastructure concerns.
- Keep Discord-specific implementations isolated where appropriate.
- Avoid excessive coupling between features.

Acceptance criteria:

- No newly introduced circular dependencies.
- No unexplained architectural violations.
- New abstractions have documented justification.
- Module boundaries remain understandable.

## 3.3 Reliability & Stability — 15 Points

Requirements:

- Handle asynchronous failures correctly.
- Prevent unhandled promise rejections.
- Handle timeout and retry scenarios.
- Manage event listeners and timers correctly.
- Implement proper resource cleanup.
- Prevent duplicate background task execution.
- Handle graceful shutdown.

Acceptance criteria:

- No known critical lifecycle regression.
- Failure paths are explicitly handled.
- Resource cleanup is verified.
- Concurrent operations are considered.

## 3.4 Security — 10 Points

Requirements:

- Preserve credential protection.
- Never expose secrets or tokens.
- Validate external inputs.
- Enforce authorization and permissions.
- Protect webhook endpoints.
- Prevent injection and unsafe data handling.
- Avoid sensitive information in logs.

Acceptance criteria:

- No newly introduced security vulnerability.
- Authentication and authorization remain intact.
- Existing encryption and secret-management guarantees are preserved.

## 3.5 Testability — 10 Points

Requirements:

- Business logic must be testable independently.
- Add unit tests where necessary.
- Add integration tests for important boundaries.
- Add regression tests for fixed bugs.
- Cover failure and edge cases.
- Avoid excessive mocking.

Acceptance criteria:

- All relevant tests pass.
- Important behavior is covered by meaningful assertions.
- Test changes are justified.
- Coverage changes are reported honestly.

## 3.6 Code Quality — 10 Points

Requirements:

- Clear naming.
- Consistent coding conventions.
- Appropriate function and module complexity.
- Strong TypeScript typing.
- Eliminate verified duplication.
- Remove verified dead code.
- Avoid unnecessary comments and redundant logic.

Acceptance criteria:

- No new unjustified `any`.
- No unexplained suppression directives.
- No newly introduced unreachable code.
- TypeScript checks pass.

## 3.7 Performance & Scalability — 8 Points

Requirements:

- Avoid unnecessary database queries.
- Prevent N+1 query patterns.
- Avoid blocking the event loop.
- Control concurrency.
- Use caching only when justified.
- Avoid excessive memory allocation.
- Consider expected production load.

Project workload reference:

- Approximately 50–200 concurrent active users.
- Approximately 10–50 Discord guilds.
- Periodic AutoPost and scraping tasks.
- External HTTP webhook traffic.

Acceptance criteria:

- No significant unexplained performance regression.
- No newly introduced unbounded resource consumption.
- Concurrency and rate limits are considered.

## 3.8 Maintainability — 7 Points

Requirements:

- Make code easier to understand.
- Keep interfaces explicit.
- Reduce unnecessary cross-module dependencies.
- Keep implementation documentation accurate.
- Make future changes easier and safer.

Acceptance criteria:

- Module responsibilities are clear.
- Dependencies are understandable.
- Future modifications do not require unnecessary changes across unrelated modules.

## 3.9 Resource Efficiency — 3 Points

Requirements:

- Avoid unnecessary dependencies.
- Avoid unnecessary runtime overhead.
- Avoid duplicate configuration.
- Avoid redundant MCPs, skills and tooling.
- Avoid unnecessary build complexity.

Acceptance criteria:

- Every introduced dependency has a concrete purpose.
- No unnecessary resource consumption.

## 3.10 Operational Readiness — 2 Points

Requirements:

- Preserve logging and observability.
- Preserve health checks.
- Support debugging.
- Maintain deployment compatibility.
- Provide rollback guidance.

Acceptance criteria:

- Changes are deployable.
- Operational risks are documented.
- Recovery procedures are available when needed.

---

# 4. MANDATORY REFACTORING WORKFLOW

The AI MUST follow this workflow.

## Phase 1 — Baseline Audit

Before modifying code:

1. Inspect repository structure.
2. Read applicable `AGENTS.md` and engineering rules.
3. Identify affected modules and dependencies.
4. Inspect current implementation.
5. Identify public contracts and business behavior.
6. Inspect existing tests.
7. Identify potential regression risks.
8. Record relevant baseline test results.

Deliverable:

- Current architecture summary.
- Problem identification.
- Scope definition.
- Risk assessment.
- Proposed refactoring plan.

DO NOT begin large-scale modifications before understanding the affected implementation.

## Phase 2 — Refactoring Plan

For every planned change, document:

- What is wrong?
- Why should it be refactored?
- What will change?
- What must remain unchanged?
- Which modules are affected?
- What are the potential risks?
- How will the change be verified?
- What is the rollback strategy?

Avoid changing unrelated modules.

## Phase 3 — Implementation

Requirements:

- Refactor in small, controlled steps.
- Preserve existing contracts.
- Avoid mixing unrelated improvements.
- Keep changes reviewable.
- Do not silently modify production behavior.
- Update tests when implementation changes require it.
- Maintain consistency with existing architecture.

If unexpected complexity or risk is discovered, stop and reassess the plan.

## Phase 4 — Verification

The AI MUST run all relevant checks available in the repository.

Examples:

- TypeScript typecheck.
- ESLint.
- Unit tests.
- Integration tests.
- Regression tests.
- Build verification.
- Dependency checks.
- Security checks.
- Architecture checks.

The AI MUST distinguish between:

- PASS — Executed and passed.
- FAIL — Executed and failed.
- NOT RUN — Not executed.
- NOT VERIFIED — Insufficient evidence.
- BLOCKED — Could not execute due to an external limitation.

Never report NOT RUN as PASS.

## Phase 5 — Architecture Review

After implementation, inspect:

- Dependency graph.
- Circular dependencies.
- Dead code.
- Duplicate implementations.
- Unnecessary abstractions.
- Error handling.
- Resource lifecycle.
- Security implications.
- Documentation accuracy.

The AI MUST ensure that the refactoring has not introduced additional architectural complexity without justification.

## Phase 6 — Final Acceptance

Before declaring completion, produce a final report containing:

1. Summary of modifications.
2. Files changed.
3. Problems resolved.
4. Architectural improvements.
5. Business behavior preservation assessment.
6. Tests executed and results.
7. Performance and security considerations.
8. Remaining issues.
9. Known limitations.
10. Rollback instructions.

The AI MUST NOT declare the refactoring complete if mandatory acceptance criteria remain unverified.

---

# 5. HARD FAIL CONDITIONS

Regardless of the total quality score, any of the following conditions causes immediate rejection:

- Unauthorized business behavior changes.
- Data corruption or data loss.
- Credential exposure.
- Security regression.
- Broken public API contracts.
- Critical Discord interaction failures.
- Broken scheduler or background task lifecycle.
- Unhandled critical production errors.
- Deleted code without sufficient verification.
- Tests manipulated to conceal failures.
- Unverified destructive database operations.

A high numerical score cannot compensate for a Hard Fail.

---

# 6. QUALITY SCORING

The maximum score is 100 points.

| Score    | Evaluation        | Decision                    |
| -------- | ----------------- | --------------------------- |
| 90–100   | Excellent         | Eligible for acceptance     |
| 80–89    | Needs improvement | Requires review             |
| 70–79    | Below standard    | Not recommended for release |
| Below 70 | Unacceptable      | Rejected                    |

Additional requirements:

- No Hard Fail conditions.
- All mandatory verification checks must pass.
- No unresolved critical issues.
- Project Owner retains final acceptance authority.

The score is an engineering assessment, not a substitute for evidence.

---

# 7. AI CODING AGENT RESPONSIBILITIES

The AI Coding Agent agrees to:

1. Understand before modifying.
2. Verify before deleting.
3. Test before declaring completion.
4. Explain architectural decisions.
5. Preserve existing behavior.
6. Minimize unnecessary changes.
7. Report uncertainty honestly.
8. Never fabricate test results.
9. Never hide known technical debt.
10. Never prioritize code aesthetics over system reliability.

The AI MUST challenge an unsafe or technically unsound instruction with a clear explanation of the risk.

However, it MUST NOT silently replace the Project Owner's decision with its own implementation.

When requirements are ambiguous or technically incompatible, request clarification.

---

# 8. PROJECT OWNER RIGHTS

The Project Owner retains exclusive authority to:

- Approve or reject refactoring plans.
- Approve behavior changes.
- Approve architecture changes.
- Approve dependency additions and removals.
- Approve database and schema changes.
- Define acceptance criteria.
- Request additional verification.
- Reject implementations that do not satisfy this contract.

The AI Coding Agent cannot independently redefine project quality standards.

---

# 9. CHANGE CONTROL

This contract applies to all refactoring operations, regardless of:

- File count.
- Change size.
- Complexity.
- Model or agent identity.
- Whether work is performed manually or automatically.

Any exception requires explicit Project Owner approval.

An approved exception applies only to its stated scope. It does not permanently waive the corresponding requirement.

The AI MUST identify and document every approved exception.

---

# 10. FINAL ENGINEERING DECLARATION

Before submitting any refactoring task as complete, the AI Coding Agent MUST be able to make the following declaration truthfully:

"I have followed the Refactoring Contract.

I have preserved all authorized business behavior.

I have not removed implementation without verification.

I have not introduced unnecessary architectural complexity.

I have executed and reported the relevant verification procedures accurately.

I have documented known limitations, unresolved issues and risks.

I have not represented unverified assumptions as confirmed facts.

The implementation is ready for Project Owner review."

If any statement cannot be made truthfully, the AI MUST explicitly identify the unmet requirement.

---

# 11. CONTRACT ENFORCEMENT

**This document is a mandatory engineering agreement, not optional guidance.**

All AI Coding Agents working on this repository MUST treat it as an active constraint throughout the entire refactoring lifecycle.

No optimization, convenience, time constraint or model preference can independently justify violating this contract.

**The Project Owner has final acceptance authority.**

---

**END OF REFACTORING CONTRACT**
