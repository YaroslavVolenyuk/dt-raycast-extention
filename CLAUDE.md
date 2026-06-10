# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (hot reload in Raycast)
npm run build      # Production build
npm run lint       # ESLint check
npm run fix-lint   # ESLint auto-fix
npm test           # Run all Jest tests
npm test -- --testPathPattern=buildDqlQuery  # Run a single test file
```

## Architecture

This is a **Raycast extension** for Dynatrace observability. It connects to Dynatrace Grail (next-gen storage) via OAuth 2.0 client credentials and DQL (Dynatrace Query Language).

### Entry points

Each `src/dt-*.tsx` file is a thin re-export that maps to a Raycast command declared in `package.json`. The actual implementation lives under `src/commands/<name>/`. The `dt` command (`src/commands/dt/index.tsx`) is a hub that navigates inline to all other commands via `useNavigation().push`.

### Data flow

1. **Auth** — `src/lib/auth.ts` obtains OAuth tokens from `ssoEndpoint` using `client_credentials` grant. Tokens are cached in Raycast `Cache` with a 30-second proactive refresh. The OAuth client needs Grail scopes (`storage:logs:read`, `storage:problems:read`, `storage:events:read`, `entity:read`); scopes are configured per-tenant.
2. **Tenant config** — `src/lib/tenants.ts` persists `TenantConfig` objects in Raycast `LocalStorage` (`tenants:v1` key). `getActiveTenant()` returns the active one; falls back to first tenant if none selected.
3. **Query** — `src/lib/query.ts` exports `useDynatraceQuery<T>()`, the single React hook used by every command. It hits `POST /platform/storage/query/v1/query:execute`. Response shape is validated with Zod (`grailResponseSchema` in `src/lib/types/grail.ts`).
4. **DQL building** — `src/lib/utils/buildDqlQuery.ts` constructs DQL strings. User input is escaped via `escapeDqlString()` before interpolation. The `extraFilter` field is intentionally unescaped (power-user raw DQL).

### Mock / dev mode

Enable **"Use Mock Data"** in Raycast extension preferences (`useMockData`). `isMockMode()` in `src/lib/devMode.ts` reads this flag. `useDynatraceQuery` returns data from `src/lib/api/mock.ts` without any HTTP calls. Query content sniffing (e.g. `query.includes("dt.davis.problems")`) selects the right mock dataset.

### Background commands

- `dt-menubar-problems` — menu-bar command, polls every 5 minutes, shows open problem count.
- `dt-alerts` — no-view command, polls every 5 minutes, sends macOS notifications for new OPEN problems.

### Raycast AI

`src/commands/search-logs/log-detail.tsx` uses Raycast AI (`AI.ask`) to explain log errors. Gate any AI feature behind `environment.canAccess(AI)` — not all Raycast plans expose it.

### Jira integration

`src/lib/integrations/jira.ts` provides `createJiraIssue()`. Jira credentials (URL, email, API token, project key) are stored as Raycast extension preferences (not in LocalStorage).

### Type structure

- `src/lib/types/grail.ts` — canonical Zod schemas for Grail API responses and log records
- `src/lib/types/{problem,deployment,entity,span,log,savedQuery}.ts` — domain types

### Tests

Tests live in `src/__tests__/` and use Jest + `ts-jest`. Raycast API is mocked in `src/__mocks__/@raycast/api.ts`. Run a single test file with `npm test -- --testPathPattern=<name>`.

CI (`.github/workflows/ci.yml`) runs `ray lint`, `ray build`, and `npm test` on every PR and on push to `main`. Keep all three green.

## Project map

Pure cartography — what lives where, not a quality judgment.

### File responsibilities

**Entry shims** (`src/dt-*.tsx`) — one-line `export { default }` re-exports mapping each `package.json` command to its impl under `src/commands/`. Only exception: `src/commands/dt/index.tsx` is the hub (eagerly imports every other command, navigates via `push`).

**Commands** (`src/commands/<name>/`):
- `index.tsx` — the command's list/form view.
- `*-detail.tsx` — pushed detail views (`problems`, `deployments`, `search-logs`, `traces`).
- `*-form.tsx` — create/edit forms (`saved-queries`, `tenants`).
- `query-results.tsx` (dql-runner), `filter-accessory.tsx` (traces) — local helpers.

**Lib** (`src/lib/`):
- `auth.ts` — OAuth token fetch + cache + `validateTenantCredentials`.
- `query.ts` — `useDynatraceQuery<T>()`, the shared Grail query hook.
- `tenants.ts` — tenant CRUD + active-tenant selection.
- `savedQueries.ts` — saved-query CRUD.
- `devMode.ts` — mock-mode flag, dev logging, fake network delay.
- `mockTenant.ts` — synthesizes a fake tenant for mock mode.
- `api/mock.ts` — all canned datasets (`MOCK_LOGS`, `MOCK_PROBLEMS`, …).
- `api/grail.ts` — re-export shim of Grail types (no logic).
- `integrations/jira.ts` — Jira REST client.
- `utils/*` — pure helpers (see Business logic).
- `types/*` — Zod schemas + domain types.

**Components** (`src/components/`) — cross-command UI: `EmptyTenantState`, `TenantSwitcher`, `JiraIssueForm`, `JiraIssueResult`.

### State storage

- **OAuth tokens** → Raycast `Cache`, namespace `dt-oauth` (`auth.ts`). Only consumer of `Cache`.
- **Tenants** → `LocalStorage` keys `tenants:v1` + `tenants:active` (`tenants.ts`).
- **Saved queries** → `LocalStorage` key `saved-queries:v1` (`savedQueries.ts`).
- **Alerts last-seen count** → `LocalStorage` (`commands/alerts/index.tsx`).
- **Jira config** → Raycast extension preferences, not LocalStorage (`package.json` prefs, read in `jira.ts`).
- **Transient UI** → React `useState`/`useCachedPromise` in each command.

### API calls (`fetch`)

- `auth.ts` — SSO token endpoint (`ssoEndpoint`).
- `query.ts` — Grail `POST …/query/v1/query:execute` (primary data path for all views).
- `commands/alerts/index.tsx` — direct Grail fetch (bypasses the hook; see exceptions).
- `integrations/jira.ts` — Atlassian Jira REST (create issue, list issue types, validate token, browse URL — 5 fetch sites).

No HTTP client lib — uses global `fetch` (Node ≥22).

### Business logic

- **DQL construction** → `utils/buildDqlQuery.ts` (+ `escapeDqlString`).
- **Timeframe parsing** → `utils/parseTimeframe.ts`.
- **Log formatting / error extraction** → `utils/formatLogContent.ts`.
- **Export** → `utils/exportData.ts` (`toJson`, `toCsv`, filename helpers).
- **Jira URL parsing / scoped-vs-unscoped detection** → `utils/jiraUrlValidator.ts`.
- **Response validation** → Zod schemas in `types/*`, enforced in `query.ts`, `tenants.ts`, `savedQueries.ts`.

### Patterns and exceptions

Dominant pattern: view command → `useDynatraceQuery<T>()` → Zod-validated Grail records → `List`/`Detail`. Exceptions:
- `commands/alerts/index.tsx` (`no-view`) — calls `fetch` + `getAccessToken` directly; can't use a React hook.
- `commands/test-connection/index.tsx` — uses `validateTenantCredentials`, not the query hook.
- `commands/saved-queries/index.tsx` — `useCachedPromise` over LocalStorage, no Grail call.
- `commands/menubar-problems/index.tsx` — uses both `useDynatraceQuery` and `useCachedPromise`.
- `buildDqlQuery.ts` is used **only** by `search-logs`. `problems`/`deployments`/`entities`/`traces` build DQL inline in their `index.tsx`; `dql-runner` takes raw user DQL.

### Non-standard / heavier spots

- `commands/dt/index.tsx` — eager-imports all commands (rest of tree is lazy via shims).
- `query.ts` — large `DEFAULT_PAYLOAD` mirroring a Postman example; content-sniffs the query string to pick mock datasets in mock mode.
- `utils/buildDqlQuery.ts` — `extraFilter` is intentionally **unescaped** raw DQL (power-user injection point).
- `integrations/jira.ts` — largest non-UI file; branches on scoped vs unscoped Atlassian token URLs.
- `commands/search-logs/log-detail.tsx` — only Raycast AI consumer (`AI.ask`, gated by `environment.canAccess(AI)`).

### External dependencies (and where used)

- `@raycast/api` — everywhere (UI primitives, `Cache`, `LocalStorage`, `AI`, preferences).
- `@raycast/utils` — `useCachedPromise`, only in `saved-queries` + `menubar-problems`.
- `zod` — validation in all `types/*` + `query.ts`, `tenants.ts`, `savedQueries.ts`.
- `react` — hooks across commands/components.
- Global `fetch` — `auth.ts`, `query.ts`, `alerts`, `jira.ts`.
