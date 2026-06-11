# Dynatrace Raycast Extension

This file gives Claude Code stable project context. Keep it short; put detailed rules in `.claude/instructions/`.

## What
This is a TypeScript/React Raycast extension for Dynatrace observability. It provides commands for logs, DQL, Davis AI, problems, SLOs, workflows, settings, tenants, traces, metrics, synthetics, maintenance windows, status dashboards, and menu bar monitors. Raycast command entries live in `package.json`, thin entrypoints live in `src/dt-*.tsx`, implementations live in `src/commands/<feature>/`, and shared code lives in `src/lib/`, `src/hooks/`, `src/components/`, and `src/lib/utils/`.

## Why
Keep command UI code focused on Raycast interaction while domain behavior stays in shared API, type, hook, and utility modules. Dynatrace responses vary by API family, so runtime validation and explicit response mapping are preferred over optimistic casts. Security matters: this extension handles OAuth, Jira, and tenant secrets.

## How
- Use Node 22 or newer. The Raycast CLI can fail on older Node versions.
- Build: `npm run build`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Tests: `npm test -- --runInBand`
- Focused tests: `npm test -- --runInBand src/__tests__/<name>.test.ts`
- Use `rg` for search and inspect existing patterns before editing.
- Prefer Zod schemas for external API data and fixtures.
- Keep code comments rare and useful; prefer clear names and types.

## Architecture Instructions
- Read `.claude/instructions/raycast.md` before changing command UI, actions, menubar commands, or package manifest entries.
- Read `.claude/instructions/dynatraceapi.md` before changing OAuth, REST, Grail, Davis, tenants, SLOs, workflows, or endpoint contracts.
- Read `.claude/instructions/testing.md` before changing tests, mocks, schemas, or quality gates.
- Read `.claude/instructions/security.md` before touching auth, preferences, Jira, logging, telemetry, or export code.
- Read `.claude/instructions/multiagent.md` before planning parallel Claude agents or delegating work.
- Read `.claude/instructions/publishing.md` before release, version, metadata, README, changelog, CI, or Raycast Store work.

## Boundaries
- Always preserve unrelated local changes. This repo may have dirty worktrees.
- Ask before adding dependencies, changing auth flows, changing persisted storage keys, or broad refactors.
- Never log access tokens, client secrets, Jira API tokens, Basic auth headers, raw Authorization headers, `.env` contents, or full sensitive request bodies.
- Never leave mock-only implementations presented as production-ready behavior.
- Never skip verification silently; report commands run and failures seen.

## Current Quality Priorities
- Keep `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint`, and `npm run build` green.
- Remove debug `console.log` from production paths or gate it behind safe dev logging.
- Replace endpoint probing with documented, typed clients and fixtures.
- Convert mock-only features to real Dynatrace integrations with graceful empty/error states.
