# 🚀 Instrumentation Quick Start

Добавляем трейсинг и логирование в расширение за 5 минут!

## Шаг 1: Установка зависимостей

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

## Шаг 2: Создание `.env` файла

```env
DYNATRACE_ENVIRONMENT_ID=abc123def456
DYNATRACE_API_TOKEN=your-api-token-here
OTEL_EXPORTER_OTLP_ENDPOINT=https://abc123def456.live.dynatrace.com/api/v2/otlp
```

## Шаг 3: Инициализация в начале приложения

Найдите основной файл расширения и добавьте в самый начало:

```typescript
import { initializeTelemetry } from "./lib/instrumentation";

// Initialize once on app start
initializeTelemetry().catch(console.error);
```

## Шаг 4: Логирование в компонентах

### Простое логирование

```typescript
import { logger } from "./lib/instrumentation";

// В функции компонента
logger.info("Problems view opened");
logger.error("Failed to load data", error);
```

### С асинхронными операциями

```typescript
import { useTracing } from "./lib/instrumentation/useTracing";

export function MyComponent() {
  const { traceAsync, log } = useTracing({
    commandName: "dt-problems",
  });

  const handleFetch = async () => {
    await traceAsync("fetch_data", async () => {
      const data = await fetchProblems();
      log("info", `Loaded ${data.length} problems`);
      return data;
    });
  };

  return <button onClick={handleFetch}>Load</button>;
}
```

### DQL запросы

```typescript
import { traceQueryExecution } from "./lib/instrumentation/queryTracing";

const result = await traceQueryExecution(
  "problems_query",
  async () => {
    return await dynatraceFetch(dqlQuery);
  },
  { query: dqlQuery }
);
```

## Шаг 5: Просмотр логов в Dynatrace

1. Откройте Dynatrace
2. Перейдите в **Logs**
3. Введите в поиск: `raycast.command != null`
4. Смотрите логи вашего расширения!

## 📊 Полезные DQL запросы

```dql
// Все операции расширения
fetch logs | filter attributes["raycast.command"] != null

// Только ошибки
fetch logs | filter attributes["raycast.command"] != null and severity == "ERROR"

// Время выполнения операций
fetch spans | filter attributes["raycast.command"] != null 
| stats avg(duration) by attributes["raycast.operation"]
```

## 🎯 Что дальше?

1. **Логируйте важные события** - начало/конец операций
2. **Добавляйте контекст** - user ID, command name, параметры
3. **Ловите ошибки** - оборачивайте API вызовы в try/catch
4. **Мониторьте performance** - добавляйте временные метрики

## 📚 Полная документация

Смотрите [INSTRUMENTATION_SETUP.md](./INSTRUMENTATION_SETUP.md) для:
- Детальной конфигурации
- Всех доступных методов
- Advanced паттернов
- Troubleshooting
