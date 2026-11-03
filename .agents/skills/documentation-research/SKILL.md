---
name: documentation-research
description: >-
  Use this skill when researching library APIs, framework features, specifications, or debugging unclear external errors. Leverages Context7 and official docs instead of hallucinating.
---

# Documentation Research

Eliminates API hallucination by querying up-to-date documentation and official sources.

## Research Priority Order

1. **Context7 Documentation MCP**:
   - For modern libraries, frameworks, and APIs, leverage Context7 MCP to fetch live, version-accurate documentation and snippets.
   - Use targeted queries: package name, specific method or module, and target version.

2. **Official Source Code & Types**:
   - Inspect local `node_modules` `.d.ts` declaration files or GitHub repositories.
   - The type definitions provide the single source of truth for method signatures, options, and return types.

3. **Official Search & Release Notes**:
   - Search official documentation and changelogs for breaking changes or deprecations.

## Rules
- Never guess an API signature or assume a method exists based on similar libraries.
- Verify whether the method is asynchronous (`Promise`) or synchronous.
- Keep research queries concise to conserve context tokens.

