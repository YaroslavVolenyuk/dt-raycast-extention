# Dynatrace Instrumentation Setup

Этот документ описывает, как добавить трейсинг и логирование в Raycast расширение для отправки в Dynatrace.

## 1. Установка зависимостей

Добавьте следующие зависимости в `package.json`:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/api-logs \
  @opentelemetry/sdk-logs \
  @opentelemetry/exporter-logs-otlp-http \
  @opentelemetry/core
```

## 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# Dynatrace configuration
DYNATRACE_ENVIRONMENT_ID=your-environment-id
DYNATRACE_API_TOKEN=your-api-token
DYNATRACE_CLUSTER_ID=your-cluster-id

# OpenTelemetry exporter
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-environment.live.dynatrace.com/api/v2/otlp
```

## 3. Инициализация в главном входе расширения

Откройте `src/index.tsx` (или основной файл) и добавьте инициализацию в начале:

```typescript
import { initializeTelemetry } from "./lib/instrumentation";

// Initialize telemetry before rendering
initializeTelemetry().catch(console.error);
```

## 4. Использование в компонентах

### 4.1 Базовое логирование

```typescript
import { logger } from "./lib/instrumentation";

// Логирование информации
logger.info("User opened problems view", { userId: "user123" });

// Логирование ошибок
try {
  await fetchData();
} catch (error) {
  logger.error("Failed to fetch data", error as Error, { 
    endpoint: "/api/problems" 
  });
}
```

### 4.2 Трейсинг асинхронных операций

```typescript
import { useTracing } from "./lib/instrumentation/useTracing";

export function MyComponent() {
  const { traceAsync, log } = useTracing({
    commandName: "dt-problems",
    userId: "user123",
  });

  const handleFetchProblems = async () => {
    await traceAsync("fetch_problems", async (span) => {
      const response = await fetch("/api/problems");
      span.setAttributes({
        "http.status_code": response.status,
      });
      return response.json();
    });
  };

  return (
    <button onClick={handleFetchProblems}>Fetch Problems</button>
  );
}
```

### 4.3 Трейсинг DQL запросов

```typescript
import { traceQueryExecution } from "./lib/instrumentation/queryTracing";

async function executeProblemsQuery(dql: string, tenant: TenantConfig) {
  return traceQueryExecution(
    "problems_query",
    async (span) => {
      return await fetchDynatraceData(dql, tenant);
    },
    {
      query: dql,
      queryType: "problems",
      tenant: tenant.id,
    }
  );
}
```

### 4.4 Интеграция с существующим query hook

Обновите `src/lib/query.ts` для добавления трейсинга:

```typescript
import { traceQueryExecution } from "./instrumentation/queryTracing";

export function useDynatraceQuery<T = unknown>() {
  const [data, setData] = useState<{ records: T[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (query: string, timeframe?: { start: string; end: string }, tenant?: TenantConfig) => {
      return traceQueryExecution(
        "dql_execution",
        async (span) => {
          // Ваш существующий код
          // ...
          span.setAttributes({
            "dql.query": query.substring(0, 500),
            "dql.tenant": tenant?.id,
          });
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

## 5. Отслеживание ошибок

Добавьте глобальный обработчик ошибок:

```typescript
import { recordException } from "./lib/instrumentation";

// Для unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  recordException(event.reason);
});

// Для uncaught exceptions
window.addEventListener("error", (event) => {
  if (event.error) {
    recordException(event.error);
  }
});
```

## 6. Структура логов в Dynatrace

Все логи отправляются с следующими атрибутами:

```
raycast.command        - Название команды Raycast
raycast.user_id        - ID пользователя
raycast.operation      - Название операции
dql.query             - DQL запрос (для query трейсинга)
dql.execution_time_ms - Время выполнения запроса
http.method           - HTTP метод
http.status_code      - HTTP статус код
http.duration_ms      - Длительность HTTP запроса
error.type            - Тип ошибки
error.message         - Сообщение ошибки
exception.stacktrace  - Stack trace ошибки
```

## 7. Примеры запросов DQL в Dynatrace

### Все логи расширения

```dql
fetch logs
| filter attributes["raycast.command"] != null
| stats count() as log_count by attributes["raycast.command"]
```

### Ошибки в расширении

```dql
fetch logs
| filter attributes["raycast.command"] != null and severity == "ERROR"
| fields timestamp, attributes["raycast.command"], body, attributes["error.type"]
| sort timestamp desc
```

### Время выполнения DQL запросов

```dql
fetch spans
| filter attributes["dql.query_name"] != null
| stats avg(duration) as avg_duration, max(duration) as max_duration, count() as count by attributes["dql.query_name"]
| sort avg_duration desc
```

### Проблемы пользователей

```dql
fetch logs
| filter attributes["raycast.command"] != null and severity in ("ERROR", "FATAL")
| stats count() as error_count by attributes["raycast.user_id"]
| sort error_count desc
```

## 8. Мониторинг расширения в Dynatrace UI

1. Откройте Dynatrace
2. Перейдите в **Logs**
3. Примените фильтр: `raycast.command != null`
4. Используйте Dynatrace Analytics для анализа:
   - Ошибки по командам
   - Время выполнения операций
   - Пользовательское поведение
   - Проблемы интеграции с API

## 9. Best Practices

- ✅ Логируйте начало и конец важных операций
- ✅ Добавляйте контекстную информацию (user ID, command name)
- ✅ Оборачивайте API вызовы в трейсинг
- ✅ Ловите и записывайте все ошибки
- ✅ Используйте батчинг для больших объемов логов

- ❌ Не логируйте чувствительные данные (пароли, токены)
- ❌ Не отправляйте полные DQL запросы (обрезайте до 500 символов)
- ❌ Не перегружайте система логированием в development mode

## 10. Performance Considerations

- Используйте `BatchLogRecordProcessor` в production
- Используйте `BatchSpanProcessor` в production
- Настройте правильные sampling ratios
- Мониторьте объем отправляемых логов

## Troubleshooting

### Логи не отправляются в Dynatrace

1. Проверьте переменные окружения в `.env`
2. Убедитесь, что API token валиден
3. Проверьте OTEL_EXPORTER_OTLP_ENDPOINT
4. Посмотрите браузер консоль для ошибок инициализации

### Слишком много логов

1. Уменьшите sampling ratio в tracer.ts
2. Используйте фильтры для логирования в production
3. Отключите debug-level логирование

### Потеря данных

1. Используйте BatchSpanProcessor и BatchLogRecordProcessor
2. Увеличьте timeout значения
3. Проверьте network connectivity
