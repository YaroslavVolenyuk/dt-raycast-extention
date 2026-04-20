# Mock Mode Development Guide

This guide explains how to use mock mode to develop and test the Dynatrace Raycast extension without setting up OAuth credentials.

## Quick Start

### Enable Mock Mode

1. Open Raycast Preferences → **Extensions** → **Dynatrace Connector**
2. Toggle **"Use Mock Data"** checkbox
3. All commands will now return sample data instead of hitting the real Dynatrace API

### Verify It's Working

Run any command (e.g., **Search Logs**) and you should see:
- ✅ Mock data loads instantly
- ✅ Console shows `[DevMode]` prefix on logging (if verbose)
- ✅ Sample problems, deployments, logs, and traces appear

## Available Mock Data

### Logs (MOCK_LOGS)
- **18 realistic log entries** spanning 6 hours
- **Severity levels**: ERROR, WARN, INFO, DEBUG, FATAL
- **Services**: payment-service, order-service, api-gateway, auth-service, user-service, and more
- **Real-world scenarios**: NullPointerException, database connection errors, memory issues, SSL certificate warnings, etc.

### Problems (MOCK_PROBLEMS)
- **5 open problems** with various severity levels
- **Severities**: AVAILABILITY, ERROR, PERFORMANCE, RESOURCE_CONTENTION, CUSTOM_ALERT
- **Duration**: Some ongoing for 45+ minutes
- **Affected entities**: Multiple services and hosts per problem

### Deployments (MOCK_DEPLOYMENTS)
- **5 recent deployments** spanning 6 hours
- **Types**: CUSTOM_DEPLOYMENT, DAVIS_DEPLOYMENT
- **Providers**: kubernetes, docker, batch-job
- **Versions**: Realistic version numbers and release stages (canary, production)

### Spans / Traces (MOCK_SPANS)
- **8 distributed traces** with realistic durations
- **Status codes**: OK, ERROR (mixed)
- **Services involved**: payment, order, checkout, api-gateway, cache, auth
- **Duration range**: 5.2ms to 1.25s

### Entities (MOCK_ENTITIES)
- **14 entities**: 8 services, 3 hosts, 3 process groups
- **Real service names**: payment-service, order-service, api-gateway, etc.
- **Host names**: prod-api-01, prod-db-primary, prod-cache-01, etc.
- **Process groups**: Language-specific (Java, Node.js, Python)

### Saved Queries (MOCK_SAVED_QUERIES)
- **5 pre-saved DQL queries** for common use cases
- **Examples**: "Error logs last 24h", "Payment service latency", "OOM errors across services"
- **Mix of favorites and non-favorites** for UI testing

---

## Development Workflow

### 1. Testing a New Command

```typescript
// In src/commands/mycommand/index.tsx

import { isMockMode, devLog } from "../../lib/devMode";
import { MOCK_PROBLEMS } from "../../lib/api/mock";

export default function MyCommand() {
  useEffect(() => {
    if (isMockMode()) {
      devLog("Loading mock problems", { count: MOCK_PROBLEMS.length });
      // Your component immediately has realistic data to render
      setData(MOCK_PROBLEMS);
    }
  }, []);
}
```

### 2. Testing UI States

**Empty state:**
```typescript
// Return empty array in mock mode
const data = isMockMode() && someCondition ? [] : realData;
```

**Error state:**
```typescript
// Manually throw error to test error UI
if (isMockMode() && testErrorCondition) {
  throw new Error("Simulated API error");
}
```

**Loading state:**
```typescript
// Use simulateNetworkDelay for realistic loading indicators
import { simulateNetworkDelay } from "../../lib/devMode";

await simulateNetworkDelay(500, 2000); // Random 500-2000ms delay
```

### 3. Filtering Mock Data

The `useDynatraceQuery` hook automatically selects the right mock dataset based on DQL query content:

```typescript
// This will return MOCK_PROBLEMS
const { data } = useDynatraceQuery();
execute('fetch dt.davis.problems | filter status == "OPEN"');

// This will return MOCK_DEPLOYMENTS
execute('fetch events | filter event.type == "CUSTOM_DEPLOYMENT"');

// This will return MOCK_SPANS
execute('fetch spans | limit 50');

// This will return MOCK_ENTITIES
execute('fetch dt.entity.service | limit 20');

// This will return MOCK_LOGS (default)
execute('fetch logs | limit 100');
```

---

## Development Utilities

### DevLog Function

Log only when in mock mode (doesn't clutter production):

```typescript
import { devLog } from "../lib/devMode";

devLog("Building DQL query", { 
  service: "payment-service", 
  timeframe: "1h" 
});
// Output: [DevMode] Building DQL query {...}
// (only shown when useMockData=true)
```

### SimulateNetworkDelay

Test loading states and UI responsiveness:

```typescript
import { simulateNetworkDelay } from "../lib/devMode";

// In execute function:
if (isMockMode()) {
  await simulateNetworkDelay(300, 800); // 300-800ms random delay
  // Your loading spinners actually spin!
}
```

### MockDataScenarios

Reference for various testing scenarios:

```typescript
import { MockDataScenarios } from "../lib/devMode";

// Document expected behavior in each scenario
console.log(MockDataScenarios.empty);        // Test empty state
console.log(MockDataScenarios.full);         // Normal operation
console.log(MockDataScenarios.error);        // Error handling
console.log(MockDataScenarios.slowNetwork);  // Performance testing
```

---

## Useful Mock Data Characteristics

### Time-based Testing

All mock data uses `ago(ms)` function to generate timestamps relative to now:

```typescript
import { ago } from "../lib/api/mock";

const m = 60_000;    // 1 minute
const h = 3_600_000; // 1 hour

ago(2 * m)   // 2 minutes ago
ago(5 * h)   // 5 hours ago
ago(1 * 24 * h) // 1 day ago
```

This means mock data is always "fresh" and realistic regardless of when you run it.

### Variety for UI Testing

Mock datasets deliberately include:

- **Multiple services**: Test filtering, search, grouping
- **Various severity levels**: Test color-coding, icons, sorting
- **Different durations**: Test formatting (ms, s, hours ago)
- **Mixed status codes**: Test success/error visualization
- **Edge cases**: Long names, special characters, null values

---

## When to Switch to Real OAuth

Once you're confident with UI testing in mock mode:

1. **Set up OAuth credentials** in your Dynatrace environment (Settings → IAM → OAuth Clients)
2. **Disable mock mode** in Raycast Preferences
3. **Add your first tenant** via Manage Tenants command
4. **Test against real data** to catch integration issues

See [README.md](README.md#setup) for OAuth setup instructions.

---

## Debugging Tips

### Check Mock Mode Status

```bash
# In Raycast, run this in terminal:
cat ~/.config/Raycast/env.json | grep useMockData
```

### Add Logging

```typescript
import { devLog } from "../lib/devMode";

// These only appear when mock mode is ON
devLog("Query executed", { query, count: data.length });
```

### Test Data Volume

Change `MOCK_LOGS` array size to test:
- **Small datasets**: 3-5 items (fast rendering)
- **Medium**: Current 18 items (realistic)
- **Large**: 100+ items (performance testing)

Edit `src/lib/api/mock.ts` to adjust data volume.

---

## Troubleshooting

### "Mock data not appearing"

1. ✅ Check Raycast Preferences → Dynatrace Connector → "Use Mock Data" is **enabled**
2. ✅ Command has been reloaded (restart Raycast: `cmd+K` → "Reload Extension")
3. ✅ Check browser console for errors (if applicable)

### "Getting OAuth errors even with mock mode on"

Mock mode is command-level, not global. Some older commands might not respect it. File an issue with the command name.

### "Mock data is stale/old"

All mock timestamps are relative (`ago(2 * m)`), so they're always fresh. If a timestamp looks wrong, check the current time equals the mock generation time.

---

## Best Practices

1. **Develop with mock mode ON** — faster iteration, no OAuth setup
2. **Test with varied data** — add/remove mock entries for edge cases
3. **Use devLog for debugging** — keeps development console clean
4. **Test error paths** — modify mock data to trigger error conditions
5. **Switch to OAuth for final testing** — catch real API integration issues
6. **Keep mock data realistic** — use real error messages, realistic names

---

## Examples

### Testing Search Logs with Different Filters

```typescript
// Mock mode will intelligently filter based on DQL:

// Show only errors
execute('fetch logs | filter loglevel == "ERROR"');
// Returns: 9 error logs from MOCK_LOGS

// Show only payment-service
execute('fetch logs | filter service.name == "payment-service"');
// Returns: Multiple logs from that service

// Show with debug
execute('fetch logs | filter loglevel == "DEBUG"');
// Returns: 2 debug logs
```

### Testing Saved Queries Feature

```typescript
// Mock mode includes 5 pre-saved queries
// Run "Saved DQL Queries" command to see them in UI
// Test: Click "Run Query" → DQL Runner executes the mock query
// Test: Toggle "Favorite" → moves between sections
// Test: Delete → removes from the list
```

### Testing Menu Bar with Problems

```typescript
// Menu Bar shows count: "5" (number of MOCK_PROBLEMS)
// Click submenu → shows top-5 problems
// Verify color (red if count > 0, green if empty)
```

---

## Contributing New Mock Data

To add more realistic mock scenarios:

1. Edit `src/lib/api/mock.ts`
2. Add new entries to appropriate array (MOCK_LOGS, MOCK_PROBLEMS, etc.)
3. Use realistic field values and timestamps
4. Test in mock mode to ensure data structure matches schemas
5. Submit PR with description of scenario

---

*Last updated: April 2026*
*Mock mode is essential for fast development cycles.*
