# Multi-Agent Rules

Use this when planning Claude subagents, parallel work, or role-based workflows.

## Default

Use one strong general agent with the relevant rules loaded for normal implementation, debugging, documentation, and sequential refactors. Multi-agent is useful only when tasks are truly independent and can run in parallel without touching the same files.

## Good Uses for Parallel Agents

- Independent feature slices with disjoint file ownership (e.g. new command + new utility)
- Parallel codebase exploration with separate questions
- Security review while implementation continues elsewhere
- Test and fixture work in separate files from production implementation
- Comparing two approaches before committing to one

## Avoid

- Delegating work that blocks the very next step
- Giving two agents ownership of the same file
- Multi-agent for tightly coupled refactors (e.g. changing `useDynatraceQuery` signature)
- Large vague tasks like "fix architecture" without bounded, measurable outputs

## Natural Parallelism Boundaries

Split work along these seams — agents can work independently:

| Boundary | What agent can own |
|---|---|
| New command | `src/commands/<name>/`, `src/dt-<name>.tsx`, `package.json` entry, mock data |
| New utility | `src/lib/utils/<name>.ts`, `src/__tests__/<name>.test.ts` |
| New type/schema | `src/lib/types/<name>.ts` (no side effects) |
| UI improvement | Single command directory only |
| Test addition | `src/__tests__/` files only |

**Never parallelize work on:**
- `src/lib/query.ts`
- `src/lib/auth.ts`
- `package.json`
- `src/__mocks__/@raycast/api.ts`

## Agent Roles

| Role | Responsibility |
|---|---|
| **Architect** | Reads current code, proposes bounded design, identifies risks and file ownership |
| **API Researcher** | Verifies Dynatrace/Raycast contracts, produces endpoint/schema notes, uses MCP if available |
| **Implementer** | Edits a clearly owned file set, follows rules files, reports changed paths |
| **Test Engineer** | Adds or updates focused tests and fixtures for assigned modules |
| **Security Reviewer** | Checks auth, storage, export paths, secret redaction — read-only unless explicitly asked to patch |
| **Integrator** | Resolves returned changes, runs quality gate, writes final summary |

## Handoff Format

Each agent must return:

```
- Objective handled:
- Files read:
- Files changed:
- Tests or checks run:
- Remaining risks or blockers:
```

Do not mark a task complete without running at least the focused tests and `npx tsc --noEmit`.

## File Ownership — assign before starting parallel work

Declare explicit write scopes before launching agents. Example for adding SLO command:

```
API worker:  src/lib/types/slo.ts, src/__tests__/slo.test.ts
UI worker:   src/commands/slo/, src/dt-slo.tsx, package.json (commands array only)
Security:    read-only review of API worker output
```

Agents must not edit files outside their assigned scope without declaring it first.

## Stop Conditions

Stop and re-plan (do not continue) if:

- An agent discovers a wrong API assumption that affects other agents' work
- Two tasks turn out to need the same files
- Tests fail for reasons outside the assigned scope
- A change requires new dependencies, storage key migrations, auth changes, or destructive git operations
- An agent hits a "Current Fragile Area" listed in `dynatraceapi.md` — escalate before proceeding
