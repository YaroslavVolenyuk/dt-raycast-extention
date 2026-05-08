# Raycast Rules

Use this when editing Raycast commands, UI components, menu bar commands, `package.json` command entries, assets, or preferences.

## Project Layout

```
src/dt-*.tsx                          # Thin re-exports — one per command in package.json
src/commands/<feature>/index.tsx      # Main view or no-view command implementation
src/commands/<feature>/*-detail.tsx   # Detail views pushed via useNavigation
src/components/                       # Shared UI: EmptyTenantState, TenantSwitcher, JiraIssueForm
src/lib/                              # Auth, tenants, query hook, utils, types
src/lib/utils/                        # Pure functions: buildDqlQuery, parseTimeframe, exportData
src/lib/types/                        # Zod schemas + TypeScript types
src/lib/api/mock.ts                   # Mock datasets for all entity types
src/__mocks__/@raycast/api.ts         # Jest mock for Raycast API
assets/dynatrace-icon.png             # Extension icon (512×512 PNG)
metadata/                             # Store screenshots
package.json                          # Raycast manifest, preferences, command registration, scripts
```

### Active commands

| Command file | Mode | Description |
|---|---|---|
| `dt` | view | Hub — navigates to all other commands |
| `dt-search-logs` | view | Search Grail logs with DQL filters |
| `dt-problems` | view | Active Davis AI problems |
| `dt-deployments` | view | Recent deployment events |
| `dt-entities` | view | Search services, hosts, process groups |
| `dt-dql-runner` | view | Execute custom DQL query |
| `dt-saved-queries` | view | Manage and run saved DQL queries |
| `dt-tenants` | view | Add, edit, switch tenants |
| `dt-traces` | view | Search distributed traces |
| `dt-menubar-problems` | menu-bar | Problem count in menu bar, polls every 5m |
| `dt-alerts` | no-view | Background notifications for new OPEN problems, polls every 5m |
| `dt-test-connection` | view | Test tenant connection |

## Adding a New Command — full checklist

1. Create `src/commands/<name>/index.tsx` with `export default function Command()`
2. Create `src/dt-<name>.tsx` as a thin re-export:
   ```tsx
   export { default } from "./commands/<name>";
   ```
3. Add entry to `package.json` under `"commands"`:
   ```json
   { "name": "dt-<name>", "title": "...", "subtitle": "Dynatrace", "mode": "view", "icon": "dynatrace-icon.png" }
   ```
4. Use `useDynatraceQuery<YourType>()` — never raw `fetch` inside components
5. Handle no-tenant state: check `tenantChecked && !tenant`, return `<EmptyTenantState />`
6. Add mock data in `src/lib/api/mock.ts` so it works in mock mode
7. Add query sniffer in `query.ts` mock branch: `query.includes("your.table")`
8. Wire into hub command `src/commands/dt/index.tsx` via `useNavigation().push`
9. Add unit tests for any new utility functions in `src/__tests__/`

## UI Patterns

- Prefer Raycast primitives: `List`, `Detail`, `Form`, `ActionPanel`, `Action`, `MenuBarExtra`
- Always show `isLoading`, empty states with `List.EmptyView`, and retry actions
- Group actions with `ActionPanel.Section` when there are several categories
- Use `Keyboard.Shortcut.Common.*` where available
- Destructive/delete actions need confirmation or an explicit safe path
- Menu bar commands must avoid noisy toasts during normal background refresh

## Data Flow

- All Dynatrace data goes through `useDynatraceQuery<T>()` — do not duplicate request logic in components
- Load tenant and persisted state in a single `useEffect` with `Promise.all` on mount
- Debounce search inputs 300ms before triggering a query
- Use `useMemo` for expensive list transforms; `useCallback` for stable callbacks in hook deps
- Avoid unstable objects or functions in hook dependency arrays when they trigger network calls

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Command entry files | `dt-kebab-case.tsx` | `dt-search-logs.tsx` |
| Command directories | `kebab-case/` | `search-logs/` |
| Component files | `PascalCase.tsx` | `LogDetailView.tsx` |
| Utility files | `camelCase.ts` | `buildDqlQuery.ts` |
| Test files | `<unit>.test.ts` | `buildDqlQuery.test.ts` |

## Manifest Rules

- Command names in `package.json` must exactly match `src/dt-<name>.tsx` filenames
- Password-like preferences must use Raycast `password` type field
- Icons live in `assets/` — do not put them at project root

## Known Gotchas

- Do not present static mock arrays as real production integrations
- Do not push placeholder React nodes (e.g. `<span>Problems</span>`) as navigation targets
- Raycast lint enforces action title casing and manifest consistency — run `npm run lint` before committing
- Build and lint require Node 22+; check with `node --version`
- `useEffect + fetch` for Dynatrace data is wrong — always use `useDynatraceQuery`
