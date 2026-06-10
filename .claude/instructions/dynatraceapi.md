# Dynatrace API Rules

Use this before changing OAuth, tenants, Grail queries, DQL builders, mock mode, Davis integration, Jira integration, or any Dynatrace API code.

## API Layers

| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | OAuth 2.0 client credentials flow, token cache, credential validation |
| `src/lib/tenants.ts` | Tenant CRUD and active tenant selection via Raycast LocalStorage |
| `src/lib/query.ts` | `useDynatraceQuery<T>()` — single hook for all Grail DQL execution |
| `src/lib/api/rest.ts` | Generic REST client for Classic/Platform APIs, Zod validation, retries, pagination, mock registry |
| `src/lib/api/useRest.ts` | React hook around `dynatraceRest()` for REST-backed commands |
| `src/lib/api/davis.ts` | Davis CoPilot helpers: NL2DQL, DQL explanation, Ask Davis |
| `src/lib/api/mock.ts` | Mock datasets: logs, problems, deployments, spans, entities, workflows, settings, metrics, synthetics, maintenance |
| `src/lib/integrations/jira.ts` | Jira issue creation via REST API |
| `src/lib/types/grail.ts` | Canonical Zod schemas: `grailResponseSchema`, `logRecordSchema`, `grailRecordSchema` |
| `src/lib/types/*.ts` | Domain types and schemas: problem, deployment, entity, span, log, savedQuery, slo, workflow, metric, synthetic, maintenance, status |
| `src/lib/utils/buildDqlQuery.ts` | DQL query builder with injection-safe `escapeDqlString()` |

## Data Flow

### Grail/DQL

```
User action in command
  → useDynatraceQuery<T>().execute(dql, timeframe, tenant)
    → isMockMode() ? return from mock.ts : real API
    → getAccessToken(tenant)          // cached, 30s proactive refresh
    → POST /platform/storage/query/v1/query:execute
    → grailResponseSchema.parse(response)   // Zod — throws on shape mismatch
    → setData({ records: T[] })
  → React re-render with typed records
```

### Classic/Platform REST

```
User action in command
  → useDynatraceRest<T>(tenant, path, { schema, queryParams })
    → dynatraceRest<T>()
    → isMockMode() ? registered mock data : real API
    → getAccessToken(tenant)
    → fetch {tenantEndpoint}{path}
    → schema.parse(response)
  → React re-render with typed data
```

## Contract Rules

- Grail responses are **not bare arrays** — records are nested at `result.records`
- Many Classic APIs use wrappers: `items`, `results`, `slo`, `monitors`, `problems`, `nextPageKey`, `pageToken`
- Always validate response shapes with Zod schemas before using data in UI
- Keep schemas close to the API contract; do not force external data into idealized mock-only shapes
- Add fixtures or tests for every new response shape being supported

## Auth and Retry

- Always use `getAccessToken(tenant)` from `src/lib/auth.ts` — never call the SSO endpoint directly
- On a 401 response: call `invalidateTokenCache(tenant.id)`, then retry once
- Do not retry non-idempotent writes (POST, DELETE) unless the API semantics are explicitly known and safe
- Preserve missing-scope errors — make them actionable by naming the likely scope family (e.g. `storage:logs:read`)

## DQL Safety

Always escape user input with `escapeDqlString()` before interpolating into DQL:

```typescript
// ✅ Safe
`filter service.name == "${escapeDqlString(userInput)}"`

// ❌ Unsafe — DQL injection
`filter service.name == "${userInput}"`
```

The `extraFilter` field in `buildDqlQuery()` is intentionally **unescaped** — it accepts raw DQL from trusted power-user input only. Never pass untrusted user input to `extraFilter`.

## Mock Mode

- Enable via **"Use Mock Data"** checkbox in Raycast extension preferences (`useMockData`)
- `isMockMode()` in `src/lib/devMode.ts` reads this flag
- Mock mode must support UI development — do not use it to hide missing production behavior
- Mock data must pass the same Zod schema as production data
- Query sniffing in `query.ts` selects the dataset:
  - `query.includes("dt.davis.problems")` → MOCK_PROBLEMS
  - `query.includes("DEPLOYMENT")` → MOCK_DEPLOYMENTS
  - `query.includes("spans")` → MOCK_SPANS
  - `query.includes("entity")` → MOCK_ENTITIES
  - default → MOCK_LOGS (with optional level filter)

## Endpoint Hygiene

- Use only documented Dynatrace endpoints — no "try 12 endpoints" probing in production code
- Grail endpoint: `POST {tenantEndpoint}/platform/storage/query/v1/query:execute`
- SSO endpoint: `https://sso.dynatrace.com/sso/oauth2/token` (default, configurable per tenant)
- If an endpoint is uncertain, document it as a known limitation and keep the UI honest
- Debug/discovery scripts may live outside `src/` but must not be wired into production commands

## Current Fragile Areas

These areas have incomplete or uncertain API integration — tread carefully and verify before refactoring:

- **SLO**: response shape and menubar warning calculation unverified against real API
- **Metrics**: real API integration not implemented — currently mock only
- **Synthetics**: real API integration not implemented — currently mock only
- **Workflow execution history**: endpoint not confirmed
- **Maintenance windows**: Settings API create/delete payloads not validated
- **Status dashboard**: navigation and response mapping incomplete
