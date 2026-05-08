# Testing Rules

Use this when changing tests, schemas, API clients, utilities, or any behavior that affects data contracts.

## Commands

```bash
npm test -- --runInBand                              # Full test suite (sequential, required)
npm test -- --runInBand src/__tests__/<name>.test.ts # Single test file
npx tsc --noEmit                                     # Type check without building
npm run lint                                         # Raycast ESLint
npm run build                                        # Full Raycast build
```

Always use `--runInBand` — tests share mock state and must not run in parallel.

## Quality Gate — run in this order

1. Focused tests for the changed area
2. `npx tsc --noEmit`
3. `npm test -- --runInBand`
4. `npm run lint` and `npm run build` when Raycast CLI is available

If a check cannot run because of environment limitations, report the exact failing command — do not skip silently.

## Test Strategy

**What is tested (pure, isolated):**
- Utilities: `buildDqlQuery`, `parseTimeframe`, `exportData`, `formatLogContent`, `jiraUrlValidator`
- Auth: token caching, OAuthError parsing, mock tenant passthrough
- Grail: response validation with Zod, error shape handling
- Security: DQL injection prevention, secret redaction in errors

**What is not tested and why:**
- React components — Raycast's renderer is unavailable in Jest; extract logic into utilities instead
- `useDynatraceQuery` hook — too coupled to Raycast internals; covered by integration in mock mode

## Adding a Test

1. Create `src/__tests__/<unitName>.test.ts`
2. Import the module under test directly — no Raycast imports needed for utility tests
3. Jest auto-applies `src/__mocks__/@raycast/api.ts` for any module that imports `@raycast/api`
4. For every new API client or endpoint mapper, cover:
   - Happy-path response parsing
   - Empty response / zero results
   - Malformed or unexpected response shape
   - Relevant auth/error status behavior (401, 403, 400)

Use real-shaped fixtures for external API responses — do not rely only on mock arrays matching internal idealized types.

## Mocks

- Raycast API mock lives at `src/__mocks__/@raycast/api.ts` — stubs Cache, LocalStorage, showToast, Clipboard, getPreferenceValues, open, useNavigation
- If you add a new `@raycast/api` import in lib code, add the corresponding stub here
- When mocking `getAccessToken` in auth tests, return a non-empty token string unless the test is specifically about auth failure
- Keep mocks close to real Raycast behavior where it matters for the test outcome

## Coverage Priorities

**High** — must have tests:
- `src/lib/auth.ts` — token cache logic, OAuthError, validation
- `src/lib/utils/*` — all utility functions
- `src/lib/types/grail.ts` — Zod schema validation

**Medium** — add when changing:
- Command-specific transformation helpers
- Detail view markdown builders
- Export formatting

**Low** — not worth testing:
- Thin `src/dt-*.tsx` re-exports
- Static Raycast layout (List, Detail structure without logic)
