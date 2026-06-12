# Dynatrace Connector for Raycast — Professional Rewrite Plan

**Date:** 2026-06-12 · **Goal:** evolve the extension from a working prototype into a project that meets dynatrace-oss engineering standards and could live under github.com/dynatrace-oss.
**Reference:** [dynatrace-oss/dtctl](https://github.com/dynatrace-oss/dtctl) (Go CLI, 140★, generated from [dynatrace-oss/template-project](https://github.com/dynatrace-oss/template-project)) — used here as the engineering-culture benchmark, not as a code template.
**Companion docs:** `REPORT.md` (six audit passes) and `REPORT-2.md` (current state, API-contract verification) — this plan assumes their findings.

---

## 1. What "Dynatrace-grade" actually means (distilled from dtctl)

Reading dtctl's repo, CONTRIBUTING.md, and CI reveals a small set of non-negotiables. Everything in this plan derives from them:

1. **Layered architecture with a hard boundary.** dtctl is `sdk/` (transport, auth, generated clients) → `pkg/` (domain logic, resource handlers) → `cmd/` (presentation). No layer reaches around another. The UI never builds an HTTP request; the SDK never formats output.
2. **Contract-first against the real API.** dtctl ships `.integrationtests.env.example` and runs integration tests against a live tenant. Schemas are not invented — this is precisely where Epic 2.0 failed (REPORT-2 V1–V6).
3. **Enforced quality gates, not aspirations.** Coverage thresholds in CONTRIBUTING (70% overall, 80% new code, 90% for client/config packages), `golangci-lint` zero-errors, `govulncheck`, multi-OS CI. The numbers matter less than the fact that CI *fails* when they're missed.
4. **Explicit safety model.** dtctl has safety levels separating read from write operations, and a documented [Token Scopes](https://dynatrace-oss.github.io/dtctl/docs/token-scopes/) page per resource. Least privilege is a feature, not a footnote.
5. **Complete OSS scaffold.** Apache-2.0 + NOTICE, SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md with PR requirements and conventional commits, CHANGELOG discipline, issue/PR templates, a docs site with per-resource guides.
6. **Predictable surface.** kubectl-style verb-noun grammar means every resource behaves identically: `get`, `describe`, `create`, `edit`, `delete`, `watch`. Uniformity is what makes a tool feel professional — each dtctl resource supports the same verbs with the same flags.

The rewrite is therefore not "rewrite all the code" — it is: enforce the layering, re-found every API contract on verified reality, install the gates, and grow features in a fixed, uniform pattern.

---

## 2. Target architecture

```
src/
├── sdk/                        # Layer 1 — Dynatrace client (zero Raycast imports, zero React)
│   ├── auth/                   #   OAuth client-credentials, token cache, TenantConfig
│   ├── http/                   #   single transport: timeout, retry-once-on-401, rate-limit,
│   │                           #   pagination (nextPageKey / offset), classic-proxy resolution,
│   │                           #   structured DynatraceError
│   ├── grail/                  #   DQL execution, query builders, escapeDqlString
│   ├── resources/              #   one module per resource: problems.ts, slos.ts, workflows.ts,
│   │                           #   logs.ts, settings.ts, synthetics.ts, davis.ts ...
│   │                           #   each = endpoints + zod schemas + normalizers (API → domain model)
│   └── index.ts                #   public surface of the SDK
├── services/                   # Layer 2 — application logic (no fetch, no JSX)
│   ├── tenants.ts              #   tenant CRUD + active-tenant state
│   ├── savedQueries.ts
│   └── export.ts, deepLinks.ts
├── ui/                         # Layer 3 — Raycast presentation
│   ├── commands/<name>/        #   one folder per command, thin: hooks + rendering
│   ├── components/             #   shared List/Detail/Form building blocks
│   └── hooks/                  #   useTenant, useSdk (wraps sdk calls in useCachedPromise)
└── mocks/                      #   fixtures-derived mock data (see §4) + mock transport
```

Rules that make the boundary real (enforced by ESLint `no-restricted-imports` + a CI grep, the same way the AI-ban was enforced):

- `sdk/` imports nothing from `@raycast/api` or `react`. It is a standalone TypeScript client — publishable later as `@dynatrace-oss/dynatrace-ts-client` if desired, which is the dtctl `sdk/` analogy.
- All fetches live in `sdk/http/`. A command that calls `fetch` directly fails review by definition. (Today: `query.ts`, `rest.ts`, `auth.ts`, `jira.ts`, and alerts each have their own fetch handling — V12-class bugs are the direct result.)
- Every resource module exports **normalized domain models**, not raw API shapes. The `event.severity`/`event.category` confusion (REPORT-2 V2) and `compliance` vs `evaluatedPercentage` (V1) become impossible to leak into UI: the normalizer maps verified API fields to one internal `Problem`/`Slo` type, in exactly one place.
- Mock mode is a **transport implementation**, not `if (isMockMode())` sprinkled through commands. `sdk/http` gets a `MockTransport` loaded with fixtures; commands don't know mocks exist. This kills the registerMock race (V13) and the three-layer mock sprawl (B3) permanently.

---

## 3. Repository & process standards (the template-project checklist)

Adopt the dynatrace-oss/template-project scaffold verbatim. Concretely:

| Item | Action |
|---|---|
| License | Switch MIT → **Apache-2.0** + `NOTICE` file (dynatrace-oss standard; decide before external contributions arrive — relicensing later is painful) |
| `SECURITY.md` | Vulnerability reporting process (dtctl has one; required in the org) |
| `CODE_OF_CONDUCT.md` | From template-project |
| `CONTRIBUTING.md` | Dev setup, PR requirements, **numeric coverage gates** (70% overall / 80% new / 90% for `sdk/http`+`sdk/auth`), conventional commits (`feat:`, `fix:`, `docs:`...), review SLA |
| Issue/PR templates | `.github/ISSUE_TEMPLATE/` bug + feature (dtctl's bug template: steps, expected/actual, version, env) |
| Git history | **Prerequisite:** rewrite history to purge `.env` (`git filter-repo`), rotate the leaked token — an org repo cannot be created from a repo with a live credential in history (SEC-X1) |
| CI | Extend current lint+tsc+build+test with: coverage gate, `gitleaks`, `npm audit --omit=dev`, markdownlint, and an **integration-test job** (manual/nightly trigger, tenant creds from repo secrets, `.integrationtests.env.example` documents the variables — dtctl pattern) |
| CHANGELOG | Keep-a-Changelog with honest entries only (E9); one entry per release, Raycast Store format `## [Title] - {PR_MERGE_DATE}` |
| Docs | `docs/` with per-resource pages: what the command does, required scopes, API endpoints used, known limitations — the analog of dtctl's command reference + Token Scopes page |
| Versioning | Conventional commits → semver; tag releases; Store publish as the release artifact |

---

## 4. Quality gates: the anti-"на коленке" machinery

The single biggest lesson from REPORT-2: **257 green unit tests coexisted with 5 broken commands**, because tests validated hand-written mocks against hand-written schemas. The fix is a three-level test pyramid where the bottom level is reality:

1. **Contract fixtures (the foundation).** For every endpoint the SDK touches, capture one sanitized live response into `src/sdk/resources/__fixtures__/<resource>/<endpoint>.json`. A `contract.test.ts` per resource asserts `schema.parse(fixture)` succeeds. Mocks for the UI are **generated from fixtures**, never written by hand. Rule: *a PR adding an endpoint without a fixture is rejected.* This makes "the schema is invented" a failing test instead of a demo surprise.
2. **Unit tests** on builders, normalizers, services (the existing 257 tests largely survive; the severity/category and SLO tests get rewritten against fixtures).
3. **Integration smoke (nightly/pre-release).** A script that runs each SDK resource call against a real tenant (`DT_TENANT_URL`, `DT_CLIENT_ID/SECRET` from env) and validates schemas — dtctl's `.integrationtests.env.example` approach. ~20 calls, read-only scopes, minutes to run. Release checklist requires a green run.

Plus a **per-command Definition of Done** (the uniformity tool — dtctl's "every resource supports the same verbs" translated to Raycast):

> A command is *done* when: (1) every API call goes through the SDK with a fixture-backed schema; (2) loading / empty / error states are all rendered distinctly — an API failure is never visually identical to "all healthy" (V4/E6 class); (3) required scopes are declared in the resource module and surfaced in the 403 error message and docs; (4) it works in mock mode via MockTransport; (5) it has a deep link to the corresponding Dynatrace app; (6) README table + docs page updated; (7) integration smoke covers it. **No placeholder data, ever** — a metric we can't fetch is not rendered (no `availability: 100` defaults), and a feature we can't implement is not in the manifest.

---

## 5. Feature triage: what the rewrite carries forward

Based on REPORT-2 verification, the current 20 commands sort into three tiers:

**Tier A — proven core (port as-is, harden):**
Search Logs, Active Problems, Search Traces, Find Entity¹, Recent Deployments, Run DQL Query, Saved Queries, Manage Tenants, Test Connection, Menu Bar Problems, Background Alerts, Log/Problem detail + Jira integration.
*These run on the verified Grail path and survived six audits. They are the product.*
¹ Find Entity needs the `dt.entity.*` vs `smartscapeNodes` fallback (V9).

**Tier B — valuable but contract-broken (re-found on verified contracts, ship one by one):**
SLOs + Menu Bar SLO (V1: `evaluatedPercentage`, `evaluate=true`, use API `status` field), Workflows list/execute/executions (V6: real `/platform/automation/v1/executions?workflow=`), Maintenance Windows (V5: proper settings-object payload, `validateOnly` testing), Settings browser (V11: `schemaIds` parameter), System Status (V4: rebuild as aggregation of already-fixed resources), Davis nl2dql + Ask Davis (V8: honest single-turn first — drop the fake conversation UI until `conversationId` is actually wired).

**Tier C — cut from the manifest until honestly implementable:**
Metrics Explorer (V3: currently mock-only; reimplement later via `timeseries` DQL through the existing Grail client — it then becomes cheap), Synthetics (V10: fabricated availability; needs the execution-results call), the OpenTelemetry instrumentation experiment (out of scope for an extension; dtctl-style OTLP makes sense for a CLI, not a Raycast process).

New cheap wins borrowed from neighbors: **Open in Dynatrace** (configurable quick-links command on top of the existing excellent `deepLinks.ts` — the entire value proposition of raycast-datadog) and **Copy as Markdown link** for problems/logs (for Jira/PR write-ups).

---

## 6. The sequence: five phases, each independently shippable

The strangler pattern — never a big-bang rewrite. The extension stays releasable after every phase.

### Phase 0 — Hygiene & foundation (prerequisite, ~days)
- Purge `.env` from git history, rotate token, add gitleaks to CI (SEC-X1 — blocks everything else).
- Apply the template-project scaffold (§3): license decision, SECURITY/CONTRIBUTING/CoC, templates, CHANGELOG reset.
- Land the ESLint boundary rules and the `src/sdk|services|ui` skeleton (empty but enforced).
- Decide the repo identity: name (`raycast-dynatrace`?), description, single icon set.

**Exit criteria:** clean history, CI with all gates green on the unchanged codebase.

### Phase 1 — SDK extraction (the heart of the rewrite, ~1–2 weeks of focused work)
- Build `sdk/http`: one transport with timeout (V12), 401-retry ordered before feature-specific 403 handling (V8), `nextPageKey`/offset pagination done right (V7), classic-proxy resolution, structured errors. Move `auth.ts` under `sdk/auth`. Port `grail.ts` (already clean) under `sdk/grail`.
- Migrate **Tier A only**: create `sdk/resources/{problems,logs,spans,entities,deployments}.ts` with fixture-backed schemas captured from a live tenant. Fix the severity→category contract (V2) inside the problems normalizer; UI receives a normalized `severityCategory` field.
- Introduce MockTransport + fixtures-derived mocks; delete `registerMock`, `mockTenant.ts` branching, and query-sniffing remnants.
- Commands change minimally: same UX, calls now go `ui → services/sdk`.

**Exit criteria:** Tier A green on live tenant smoke; coverage gate ≥80% on `sdk/`; zero direct `fetch` outside `sdk/http` (CI grep); Tier B/C commands temporarily removed from `package.json` (they're broken anyway — REPORT-2).

### Phase 2 — Read-only resources return, one PR each (~1 resource / few days)
Order by value-to-risk: **SLOs → Workflows (list/describe) → Settings → Status → Synthetics**. Each follows the same recipe, which is what prevents "на коленке": capture fixtures from live API → write schema + normalizer in `sdk/resources/` → contract test → command UI against the SDK → DoD checklist (§4) → docs page with scopes → re-add to manifest.
- Status is rebuilt last in this phase as a pure composition of already-verified SDK calls — with `Promise.allSettled` results rendered honestly per-section (fulfilled/failed), and `launchCommand` actions.
- Ship "Open in Dynatrace" quick-links here too (zero API risk, immediate value).

**Exit criteria per resource:** integration smoke includes it; DoD satisfied. No resource merges while another is half-done.

### Phase 3 — Write operations, behind a safety model (~1 week)
dtctl's safety-levels concept, translated: the tenant form gets **Read-only / Operate** modes. Read-only default scopes contain zero write permissions (V15); Operate adds `automation:workflows:execute`, `settings:objects:write` with explicit UI confirmation before every mutating call.
- Workflow execute (fix falsy-validation V14, honor schema defaults), Maintenance window create (correct array payload + real schema value, tested with `validateOnly=true` first — V5).
- Every write action: confirmation alert + result deep link + revalidate.

**Exit criteria:** write paths tested against live tenant; commands degrade gracefully (clear 403 message naming the missing scope) when the user stays read-only.

### Phase 4 — Davis AI, honestly (~1 week)
- nl2dql and explain-DQL are simple and already nearly correct — wire `davis-copilot:*` scopes into the scopes model and docs.
- Ask Davis: implement **real** conversation context via `conversationId`/`messageToken` from the API, or ship it explicitly as single-turn Q&A. Remove the hardcoded entity dropdown; populate from the entities SDK or drop the field (V8).
- Add `nl2dql → Run in DQL Runner` as the flagship flow (it composes three already-solid pieces).

### Phase 5 — Polish & store/OSS release
- Hub command rebuilt on `launchCommand` (kills the 17-eager-imports problem A4/D5 for good).
- README rewritten: per-command scopes table (Token-Scopes-page analog), real screenshots refreshed (`metadata/`), honest CHANGELOG for the release.
- Resolve `platforms` (drop Windows until tested), drop the stray `version` field, dependabot already in place.
- Submit to Raycast Store; propose transfer to dynatrace-oss with the scaffold already matching org standards.

---

## 7. dtctl conventions → Raycast equivalents (quick reference)

| dtctl | This extension |
|---|---|
| `sdk/` Go client | `src/sdk/` TypeScript client (no Raycast/React imports) |
| verb-noun commands, uniform flags | uniform command anatomy: List + Detail + ActionPanel with the same action order (Open in Dynatrace, Copy ID, Export, Filter) everywhere |
| `--watch` | menu-bar commands + background refresh intervals |
| `dtctl doctor` | Test Connection command (already exists — extend to check scopes per resource and report what's missing) |
| safety levels | Read-only vs Operate scope profiles in tenant form (§ Phase 3) |
| Token Scopes docs page | README/docs scopes-per-command table; 403 errors name the missing scope |
| `.integrationtests.env.example` | same file, used by the nightly smoke job |
| `dtctl commands -o json` (AI-agent surface) | out of scope for v1; revisit after the SDK exists (the SDK is the reusable asset an AI tool would consume) |
| goreleaser + brew tap | Raycast Store publish flow + git tags |

---

## 8. What survives from today's code

Not a from-scratch rewrite. Direct ports: `grail.ts` (already the model SDK module), `auth.ts`, `lib/dql/escape`, `fenceRaw`/`formatLogContent`, `deepLinks.ts`, `sparkline.ts`, `storageKeys.ts`, `exportData.ts` (with its injection tests), `parseTimeframe`, the Jira integration, and most Tier-A command UI. Rewritten: `rest.ts`/`useRest.ts` (becomes `sdk/http`), every Tier-B schema (from fixtures), all mock plumbing, the status command, tenant scopes model. Deleted: the 12-endpoint guess loop, fabricated synthetics/metrics data, the fake conversation/entity-context UI, `devMode.ts` dead exports.

A realistic overall shape: **Phase 0–1 is ~70% of the engineering risk and ~30% of the calendar time; Phases 2–5 are mechanical once the recipe exists.** That inversion — hard foundation first, then cheap uniform growth — is exactly what separates dtctl-grade projects from prototypes that grew sideways.
