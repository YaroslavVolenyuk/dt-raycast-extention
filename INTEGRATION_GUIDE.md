# 🔗 Integration Guide

Пошаговое руководство по интеграции инструментации в существующий код.

## Шаг 1: Обновить `src/lib/query.ts`

Добавьте импорты в начало файла:

```typescript
import { traceQueryExecution, traceApiCall } from "./instrumentation/queryTracing";
import { logger, recordException } from "./instrumentation";
```

Обновите функцию `execute` в `useDynatraceQuery`:

```typescript
export function useDynatraceQuery<T = unknown>() {
  const [data, setData] = useState<{ records: T[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (query: string, timeframe?: { start: string; end: string }, tenant?: TenantConfig) => {
      // Abort previous request
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setIsLoading(true);
      setError(null);

      // 🆕 ADD TRACING HERE
      return traceQueryExecution(
        "dql_query_execution",
        async (span) => {
          // Mock mode (Development)
          if (isMockMode()) {
            devLog("Executing query in mock mode", { query, timeframe });
            await simulateNetworkDelay(100, 400);

            // ... existing mock logic ...
            
            setData({ records: mockData as T[] });
            setIsLoading(false);
            return mockData;
          }

          // Real API call
          try {
            const tenant_obj = tenant || (await getActiveTenant());
            if (!tenant_obj) {
              throw new Error("No tenant configured");
            }

            const token = await getAccessToken(tenant_obj);
            const payload: QueryPayload = { query, ...DEFAULT_PAYLOAD, ...timeframeParams };

            logger.info("Executing DQL query", {
              queryLength: query.length,
              tenant: tenant_obj.id,
            });

            // 🆕 Trace the API call
            const response = await traceApiCall(
              "/api/v2/query/execute",
              async () => {
                return fetch(`${tenant_obj.url}/api/v2/query/execute`, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal,
                });
              },
              "POST",
              { tenant: tenant_obj.id }
            );

            if (!response.ok) {
              const errorData = await response.json();
              const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
              throw new Error(`Query failed: ${errorMsg}`);
            }

            const result = await response.json();

            // Validate response
            const validated = grailResponseSchema.parse(result);

            // Record metrics
            const recordCount = validated.records?.length || 0;
            logger.info("Query executed successfully", {
              recordCount,
              duration: Date.now() - startTime,
            });

            setData({ records: validated.records as T[] });
            setIsLoading(false);

            return validated.records;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            
            // 🆕 Record exception
            if (err instanceof Error) {
              recordException(err, span);
              logger.error("Query execution failed", err, {
                query: query.substring(0, 500),
                tenant: tenant?.id,
              });
            }

            setError(errorMessage);
            setIsLoading(false);
            throw err;
          }
        },
        {
          query,
          tenant: tenant?.id,
          timeframe,
        }
      );
    },
    []
  );

  return { data, isLoading, error, execute };
}
```

## Шаг 2: Интегрировать в `src/commands/problems/index.tsx`

Замените начало файла:

```typescript
// 🆕 INSTRUMENTATION IMPORTS
import { logger } from "../../lib/instrumentation";
import { useTracing } from "../../lib/instrumentation/useTracing";
import { traceQueryExecution } from "../../lib/instrumentation/queryTracing";

// ... existing imports ...

export default function ProblemsCommand() {
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  // ... other state ...

  // 🆕 ADD TRACING HOOK
  const { traceAsync, log } = useTracing({
    commandName: "dt-problems",
    attributes: { view: "problems-list" },
  });

  // ... existing useState and other hooks ...

  // UPDATE EFFECT: Add logging
  useEffect(() => {
    log("debug", "Problems view loaded");

    Promise.all([
      getActiveTenantOrMock(() => getActiveTenant()),
      listTenants(),
    ])
      .then(([activeTenant, tenants]) => {
        setTenant(activeTenant);
        setAllTenants(tenants);
        setTenantChecked(true);
        setFiltersLoaded(true);

        // 🆕 Add logging
        log("info", "Tenants loaded", {
          tenantCount: tenants.length,
          activeTenant: activeTenant?.id,
        });
      })
      .catch((err) => {
        // 🆕 Add error logging
        logger.error("Failed to load tenants", err as Error);
      });
  }, [log]);

  // UPDATE EFFECT: Wrap query in tracing
  useEffect(() => {
    if (!filtersLoaded || !tenant) return;

    // 🆕 Wrap in tracing
    traceAsync("execute_problems_query", async () => {
      const dql = buildProblemsQuery(statusFilter);

      log("debug", "Executing problems query", {
        statusFilter,
        tenantId: tenant.id,
      });

      return execute(dql, undefined, tenant);
    }).catch((err) => {
      logger.error("Problems query failed", err as Error);
    });
  }, [statusFilter, filtersLoaded, tenant, execute, traceAsync, log]);

  // UPDATE FUNCTIONS: Add tracing to handlers
  const handleTenantChange = async (id: string) => {
    await traceAsync("switch_tenant", async () => {
      log("info", "Switching tenant", { toTenant: id });
      await setActiveTenant(id);
      // ... rest of logic ...
    });
  };

  const handleExportJson = async () => {
    await traceAsync("export_json", async () => {
      try {
        const problems = data?.records ?? [];
        const json = toJson(problems);
        await Clipboard.copy(json);

        log("info", "Exported to JSON", { count: problems.length });
        
        await showToast({
          style: Toast.Style.Success,
          title: "Exported",
          message: `${problems.length} problems exported`,
        });
      } catch (error) {
        logger.error("Export failed", error as Error);
        // ... rest of error handling ...
      }
    });
  };

  const handleExportCsv = async () => {
    // Similar pattern to handleExportJson
    await traceAsync("export_csv", async () => {
      // ... implementation ...
    });
  };

  // ... rest of component ...
}
```

## Шаг 3: Инициализировать в главной точке входа

В файле `src/index.tsx` или основной entry point добавьте:

```typescript
import { initializeTelemetry } from "./lib/instrumentation";

// Initialize telemetry before rendering anything
initializeTelemetry().catch((err) => {
  console.error("Failed to initialize telemetry:", err);
  // Continue anyway - don't let telemetry errors break the app
});

// ... rest of your index.tsx code ...
```

## Шаг 4: Добавить в другие команды (опционально)

Повторите шаги 2-3 для других команд:
- `dt-search-logs.tsx`
- `dt-deployments.tsx`
- `dt-entities.tsx`
- и т.д.

Паттерн везде одинаковый:
1. Импортировать `useTracing` и `logger`
2. Создать хук в компоненте: `const { traceAsync, log } = useTracing({ commandName: "..." })`
3. Обернуть важные операции в `traceAsync`
4. Добавить логирование для начала/конца операций и ошибок

## Шаг 5: Проверить работу

1. Запустите расширение:
```bash
npm run dev
```

2. Откройте проблемы в Raycast
3. Проверьте консоль браузера (F12) - должны быть логи
4. Откройте Dynatrace и проверьте Logs
5. Фильтруйте по: `raycast.command != null`

## Примеры для разных операций

### Логирование в компоненте

```typescript
export function MyComponent() {
  const { log } = useTracing({ commandName: "my-command" });

  useEffect(() => {
    log("info", "Component mounted");
    return () => log("info", "Component unmounted");
  }, [log]);
}
```

### Обработка ошибок

```typescript
try {
  const result = await apiCall();
  log("info", "API call succeeded");
  return result;
} catch (error) {
  if (error instanceof Error) {
    logger.error("API call failed", error, { endpoint: "/api/v2/..." });
  }
  throw error;
}
```

### Длительная операция

```typescript
const handleLongOperation = async () => {
  await traceAsync("long_operation", async (span) => {
    const startTime = Date.now();
    
    // Do work
    await doSomething();
    
    const duration = Date.now() - startTime;
    span.setAttributes({ operation_duration_ms: duration });
    log("info", "Long operation completed", { duration });
  });
};
```

## Чек-лист интеграции

- [ ] Установлены все OpenTelemetry зависимости
- [ ] Создан файл `.env` с Dynatrace credentials
- [ ] Добавлена инициализация `initializeTelemetry()` в главном файле
- [ ] Импортированы `logger` и `useTracing` в основные компоненты
- [ ] Обернуты асинхронные операции в `traceAsync`
- [ ] Добавлено логирование ошибок
- [ ] Протестирована отправка логов в Dynatrace
- [ ] Проверены DQL запросы в Dynatrace UI

## Troubleshooting

### Логи не приходят в Dynatrace

1. Проверьте `.env` файл - все ли переменные установлены?
2. Проверьте консоль браузера - есть ли ошибки?
3. Проверьте сетевые запросы (Network tab) - отправляются ли запросы к Dynatrace?
4. Убедитесь, что API token валиден

### Ошибка "Cannot find module"

1. Убедитесь, что установлены все зависимости: `npm install`
2. Очистите node_modules: `rm -rf node_modules && npm install`
3. Перезапустите dev сервер

### Слишком много логов

Отключите debug логирование в production:

```typescript
if (process.env.NODE_ENV === 'production') {
  // Используйте только info, warning, error уровни
}
```
