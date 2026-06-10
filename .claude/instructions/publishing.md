# Publishing Rules

Use this before releasing a new version or submitting to the Raycast Store.

## Pre-publish Checklist

Run all checks locally before submitting:

```bash
npm run lint        # must pass with zero errors
npm run build       # must succeed
npm test -- --runInBand  # all tests pass
npx tsc --noEmit    # no type errors
```

Then verify:

- [ ] `assets/dynatrace-icon.png` is **512×512 PNG**, looks good in both light and dark mode
- [ ] `metadata/` screenshots are current and show real UI (not mock data)
- [ ] `CHANGELOG.md` exists and has an entry for the new version with a clear description; create it before publishing if missing
- [ ] `package.json` version is bumped (follow semver: patch for fixes, minor for new commands, major for breaking changes)
- [ ] All new preferences have `description` and `placeholder` filled in
- [ ] `README.md` exists and explains OAuth app setup steps in Dynatrace; create it before publishing if missing

## Submit

```bash
npm run publish     # runs: npx @raycast/api@latest publish
```

This opens a browser flow to submit a PR to `raycast/extensions`. The Raycast team reviews and provides feedback via PR comments.

## Raycast Store Requirements

- License: MIT (already set in `package.json`)
- Extension must work without a Raycast Pro subscription
- All preferences must have human-readable descriptions
- Icon must be 512×512 PNG — no transparency issues, no text too small to read
- Screenshots in `metadata/` must show real, representative use — no placeholder data
- README must include setup instructions because Dynatrace OAuth app creation is non-obvious

## Versioning

```
patch (1.0.x) — bug fixes, copy changes, minor UI tweaks
minor (1.x.0) — new commands, new preferences, new integrations
major (x.0.0) — breaking changes to tenant config storage or auth flow
```

Bump `version` in `package.json` and add or update `CHANGELOG.md` before every publish.

## CI Gate

`.github/workflows/ci.yml` runs on every PR and push to `main`:
1. `npx ray lint`
2. `npx ray build`
3. `npm test -- --passWithNoTests`

All three must be green before merging or submitting to the Store.

CI must use the same major Node version as `package.json` (`>=22`) to avoid Raycast CLI/runtime mismatches.
