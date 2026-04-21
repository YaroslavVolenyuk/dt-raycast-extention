# Remaining Work & Bug Fixes
> Generated: 2026-04-21
> Based on Epic review — covers every gap between EXPANSION_PLAN.md / STORIES.md and the current codebase.

---

## 🐛 Bugs (must fix before Store submission)

---

### BUG-1 · Jira endpoint is plural — all ticket creation will 404

**File:** `src/lib/integrations/jira.ts`, line 37

**Problem:**
```ts
// ❌ Current — wrong, returns 404
const endpoint = `${jiraUrl.replace(/\/$/, "")}/rest/api/3/issues`;

// ✅ Fix
const endpoint = `${jiraUrl.replace(/\/$/, "")}/rest/api/3/issue`;
```

The Jira Cloud REST API uses singular `/issue`, not plural `/issues`. Every call to `createJiraIssue()` will return 404, making the entire Jira integration non-functional.

**AC:**
- [ ] Endpoint corrected to `/rest/api/3/issue`.
- [ ] Manual or integration test creates a ticket successfully.

---

### BUG-2 · Menu Bar uses wrong Problem shape — all fields will be undefined at runtime

**File:** `src/commands/menubar-problems/index.tsx`

**Problem:** The file defines a local `Problem` interface with nested shape `problem.event.name`, but the Grail API (and `types/problem.ts`) returns flat dot-notation fields `"event.name"`, `"event.id"`, etc. At runtime every rendered field will be `undefined`.

```ts
// ❌ Local interface in menubar-problems/index.tsx (WRONG)
interface Problem {
  event: { id: string; name: string; severity: string; start: string; status: string; }
}
// usage: problem.event.name  → undefined at runtime

// ✅ Correct shape from src/lib/types/problem.ts
type Problem = { "event.id": string; "event.name": string; "event.severity": string; ... }
// usage: problem["event.name"]
```

**Fix:**
1. Remove the local `Problem` interface.
2. Import `Problem` from `../../lib/types/problem`.
3. Update all field accesses: `problem.event.name` → `problem["event.name"]`, etc.
4. Also fix the tenant deep-link: `problem.event.id` → `problem["event.id"]`.

**AC:**
- [ ] No local `Problem` interface in `menubar-problems/index.tsx`.
- [ ] All field accesses use bracket notation matching `types/problem.ts`.
- [ ] In mock mode the menu bar renders problem names correctly.

---

### BUG-3 · Menu Bar calls `execute()` twice — second call cancels the first via AbortController

**File:** `src/commands/menubar-problems/index.tsx`, `fetchOpenProblems` function

**Problem:** `fetchOpenProblems` calls `execute()` for the top-5 list, then immediately calls `execute()` again for the count query. Because `useDynatraceQuery.execute()` calls `abortRef.current?.abort()` at the start, the first request is always cancelled. The top-5 list will always be empty.

**Fix:** Combine into a single DQL call — fetch the top-5 open problems and derive the count from the result length. For a precise total count when there are more than 5, run a single `stats count()` query only (no need for the first top-5 query separately). Cleanest approach: one query for top-5 display, count shown as `5+` if result is full.

```ts
const dql = `fetch dt.davis.problems
  | filter event.status == "OPEN"
  | sort event.severity asc, event.start desc
  | limit 6`;   // fetch 6 to detect "more than 5"

const results = await execute(dql, undefined, activeTenant);
const problems = (results ?? []).slice(0, 5);
const count = results && results.length > 5 ? "5+" : String(results?.length ?? 0);
```

**AC:**
- [ ] `execute()` is called at most once per `fetchOpenProblems` invocation.
- [ ] Menu bar renders problem names and correct count.
- [ ] No AbortError in mock mode.

---

### BUG-4 · Menu Bar: deep-link to Manage Tenants uses wrong extension identifier

**File:** `src/commands/menubar-problems/index.tsx`, line ~111

**Problem:**
```ts
// ❌ Current — wrong owner/name
await open("raycast://extensions/dynatrace/tenants");

// ✅ Fix — use actual owner + extension name from package.json
await open("raycast://extensions/one-developer-corporation/dynatrace-connector/dt-tenants");
```

The format is `raycast://extensions/<owner>/<extension-name>/<command-name>`. The current string points to a non-existent extension and silently fails (swallowed by the empty `catch {}`).

**AC:**
- [ ] Clicking "Configure Tenant" in the menu bar opens the Manage Tenants command.

---

### BUG-5 · Traces: "Find Related Logs" is a stub — shows toast instead of navigating

**File:** `src/commands/traces/index.tsx`, lines 180–184

**Problem:**
```ts
// ❌ Current
onAction={() => {
  // TODO: Navigate to Search Logs with trace_id filter
  showToast({ style: Toast.Style.Success, title: "Feature coming soon" });
}}
```

Per Epic P3-S1 AC: *"Find related logs transitions to Search Logs with `trace_id` filter"*. This is the core cross-signal navigation that justifies the Traces command.

**Fix:** Push `SearchLogsView` (or the search-logs command index) with `initialParams` containing `extraFilter: \`trace_id == "${span.trace_id}"\``. The search-logs `index.tsx` already accepts `extraFilter` in `buildDqlQuery`.

Because Raycast cannot `Action.Push` across top-level commands, the cleanest approach is to render the search-logs view inline:

```tsx
import SearchLogsView from "../search-logs/index";

<Action
  title="Find Related Logs"
  icon={Icon.Link}
  onAction={() =>
    push(
      <SearchLogsView
        arguments={{ timeframeValue: "30", timeframeUnit: "m", query: "all" }}
        _extraFilter={`trace_id == "${span.trace_id}"`}
      />
    )
  }
/>
```

This requires `search-logs/index.tsx` to accept an optional `_extraFilter` prop and pass it into `buildDqlQuery`.

**AC:**
- [ ] "Find Related Logs" navigates to a log list filtered by the span's `trace_id`.
- [ ] The resulting DQL contains `trace_id == "<id>"`.
- [ ] No "coming soon" toast.

---

### BUG-6 · Menu Bar: `useState<any>` for tenant

**File:** `src/commands/menubar-problems/index.tsx`, line 28

Minor type-safety issue, but `ray lint` may flag `any`.

```ts
// ❌
const [tenant, setTenant] = useState<any>(null);

// ✅
import type { TenantConfig } from "../../lib/auth";
const [tenant, setTenant] = useState<TenantConfig | null>(null);
```

**AC:**
- [ ] `ray lint` passes without `any` warnings.

---

## 🚧 Missing Features (planned in STORIES.md, not yet implemented)

---

### FEAT-1 · Timeframe presets dropdown (P1-S1f)

**Story:** P1-S1f  
**File to modify:** `src/commands/search-logs/index.tsx`

**What's missing:** The Epic specified replacing the raw `timeframeValue`/`timeframeUnit` command arguments with a `List.Dropdown` preset picker (15m / 1h / 4h / 24h / 7d) persisted in LocalStorage. Currently the command only uses CLI arguments and falls back to `storedTimeframe`. There is no in-command UI for switching timeframe without re-invoking the command.

**Tasks:**
1. Add a `List.Dropdown` for timeframe presets. Since `searchBarAccessory` is already taken by service filter or `TenantSwitcher`, put the preset dropdown inside `ActionPanel` as `Action` items with keyboard shortcuts, or use `List.Dropdown` and move `TenantSwitcher` into the action panel.
2. Persist selected preset under key `"dt_timeframe_preset"` in LocalStorage.
3. On mount, restore the saved preset as the initial timeframe.
4. Remove the command arguments `timeframeValue` / `timeframeUnit` from the active query path (they can remain for Raycast Quick Links compatibility but should not override the dropdown on normal invocation).

**AC:**
- [ ] User can switch timeframe from within the command without reinvoking it.
- [ ] Selected preset survives command close/reopen.
- [ ] `15m`, `1h`, `4h`, `24h`, `7d` are all available.

---

### FEAT-2 · TenantSwitcher accessible from Problems and other commands (P0-S6 gap)

**Files to modify:** `src/commands/problems/index.tsx`, `src/commands/deployments/index.tsx`, `src/commands/entities/index.tsx`, `src/commands/dql-runner/index.tsx`

**What's missing:** In the Problems command, `searchBarAccessory` is taken by the OPEN/ALL status dropdown — there's no way to switch tenant from within the command. Same pattern exists in other commands.

**Option A (recommended):** Add `TenantSwitcher` as an `Action` in `ActionPanel` (top-level action "Switch Tenant") with a submenu listing tenants.

**Option B:** Add a dedicated `Action` → `Action.Push` → `<Command>` (Manage Tenants) with a reload callback.

**AC:**
- [ ] From Problems, Deployments and Entities the user can switch the active tenant without leaving the command.

---

### FEAT-3 · Background Alerts command — `no-view` mode (P2 Epic item)

**Story:** Mentioned in EXPANSION_PLAN §2.1 and §4 roadmap (Phase 2), but not in STORIES.md with a full story — treat as P2 nice-to-have.

**What's missing:** A `no-view` command that polls for new OPEN problems every N minutes and fires a system notification.

**Tasks:**
1. Add to `package.json`:
   ```json
   { "name": "dt-alerts", "title": "Background Problem Alerts", "mode": "no-view", "interval": "5m" }
   ```
2. Create `src/dt-alerts.tsx` → `src/commands/alerts/index.tsx`.
3. On each invocation: fetch open problems count, compare with last-seen count from LocalStorage. If increased → `showHUD` + system notification via `showToast({ style: Toast.Style.Failure })`.
4. Add a preference `"enableAlerts"` (checkbox, default `false`) — command exits early if disabled.

**AC:**
- [ ] Command entry exists in `package.json` with `mode: "no-view"`.
- [ ] Notification fires when OPEN problem count increases.
- [ ] Preference `enableAlerts: false` suppresses notifications.

---

### FEAT-4 · Menu Bar: "Open Active Problems" menu item missing (P2-S3 AC gap)

**File:** `src/commands/menubar-problems/index.tsx`

**What's missing:** The P2-S3 acceptance criteria explicitly require:
> `MenuBarExtra.Item` «Open Active Problems» → `open("raycast://extensions/...")`

Currently the menu only shows the top-5 problem list and a Refresh item. There's no shortcut to open the full Problems command.

**Fix:**
```tsx
<MenuBarExtra.Item
  title="Open Active Problems"
  icon={Icon.ArrowRight}
  onAction={() =>
    open("raycast://extensions/one-developer-corporation/dynatrace-connector/dt-problems")
  }
/>
```

Add this item below the separator, before "Refresh".

**AC:**
- [ ] "Open Active Problems" item present in the menu.
- [ ] Clicking it opens the Active Problems Raycast command.

---

### FEAT-5 · Metadata: missing screenshots for Entities and Menu Bar (P4-S1 gap)

**Directory:** `metadata/`

**What's missing:** The `metadata/` folder has 6 images (`search-logs.png`, `problems.png`, `deployments.png`, `dql-runner.png`, `log-detail.png`, `tenants.png`) but lacks:
- `entities.png` — Find Entity command
- `menubar-problems.png` — Menu Bar counter screenshot

Raycast Store recommends 6–8 screenshots. With two commands undocumented the Store submission may be rejected or appear incomplete.

**AC:**
- [ ] `metadata/entities.png` added.
- [ ] `metadata/menubar-problems.png` added.
- [ ] `README.md` screenshot section references all 8 images.

---

### FEAT-6 · AI Explain action in Log Detail (P3-S2 — nice-to-have)

**Story:** P3-S2  
**Files:** `src/commands/search-logs/log-detail.tsx`, `src/lib/utils/formatLogContent.ts`

**What's missing:** "Explain This Error" and "Summarize last 10 errors for this service" actions using `@raycast/api` AI.

**Tasks:**
1. In `log-detail.tsx` import `AI` from `@raycast/api`.
2. Add action guarded by `environment.canAccess(AI)`.
3. On action: `showToast({ style: Animated, title: "Analyzing…" })` → `AI.ask(prompt)` → `push(<Detail markdown={explanation} />)`.
4. Second action fetches last 10 ERROR records for the service and summarises them.

**AC:**
- [ ] Actions hidden when `AI` is not available.
- [ ] Explanation renders in a new Detail view.
- [ ] Animated toast shown during inference.

---

## 📋 Priority Order

| Priority | Item | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | BUG-1 — Jira endpoint 404 | 1 line | Jira integration non-functional |
| 🔴 P0 | BUG-2 — Menu Bar wrong field names | ~20 lines | Menu Bar shows blank data |
| 🔴 P0 | BUG-3 — Menu Bar double execute() | ~15 lines | Menu Bar always shows 0 problems |
| 🟠 P1 | BUG-4 — Menu Bar deeplink wrong | 1 line | Configure Tenant CTA broken |
| 🟠 P1 | BUG-5 — Traces Related Logs is stub | ~30 lines | Key cross-signal navigation missing |
| 🟡 P2 | BUG-6 — `any` type in Menu Bar | 2 lines | Lint warning / type safety |
| 🟡 P2 | FEAT-1 — Timeframe presets dropdown | ~50 lines | UX gap from story P1-S1f |
| 🟡 P2 | FEAT-4 — Menu Bar "Open Problems" item | ~8 lines | AC gap from P2-S3 |
| 🟢 P3 | FEAT-2 — TenantSwitcher in all commands | ~20 lines each | UX convenience |
| 🟢 P3 | FEAT-5 — Missing metadata screenshots | screenshots | Store submission completeness |
| ⚪ P4 | FEAT-3 — Background Alerts command | ~60 lines | nice-to-have ambient monitoring |
| ⚪ P4 | FEAT-6 — AI Explain action | ~40 lines | nice-to-have power feature |
