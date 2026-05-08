# CLAUDE.md — Dynatrace Raycast Extension

Raycast extension that connects to Dynatrace Grail via OAuth 2.0 and DQL. Lets developers search logs, monitor problems, inspect deployments, run custom DQL queries, and manage multi-tenant configs from the Raycast launcher.

## Commands

```bash
npm run dev          # Start development server (hot reload in Raycast)
npm run build        # Production build
npm run lint         # ESLint check
npm run fix-lint     # ESLint auto-fix
npm test -- --runInBand                              # Full test suite
npm test -- --runInBand src/__tests__/<name>.test.ts # Single test file
npx tsc --noEmit                                     # Type check only
npm run publish      # Publish to Raycast Store
```

## Rules — load the relevant file before starting work

@.claude/rules/raycast.md — editing commands, UI, menu bar, package.json, assets, preferences  
@.claude/rules/dynatraceapi.md — OAuth, tenants, Grail, DQL, mock mode, integrations  
@.claude/rules/testing.md — tests, schemas, API clients, data contracts  
@.claude/rules/security.md — auth, secrets, logging, exports, storage, telemetry  
@.claude/rules/multiagent.md — planning parallel work, subagent roles, handoff  
@.claude/rules/publishing.md — publishing to Raycast Store, release checklist  
