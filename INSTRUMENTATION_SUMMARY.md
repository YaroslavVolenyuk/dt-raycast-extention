# 📊 Instrumentation Implementation Summary

Полная система для отправки трейсов и логов из Raycast расширения в Dynatrace!

## 📁 Созданные файлы

### Основные модули (`src/lib/instrumentation/`)

1. **`index.ts`** - Главный экспорт всех инструментов
   - Инициализация telemetry
   - Экспорт logger, tracer, utilities
   - Одна функция инициализации: `initializeTelemetry()`

2. **`tracer.ts`** - OpenTelemetry конфигурация
   - Настройка TracerProvider
   - Настройка LoggerProvider
   - OTLP HTTP экспортеры для Dynatrace
   - Инициализация провайдеров

3. **`logger.ts`** - High-level логирование и трейсинг
   - Класс Logger с методами: `debug()`, `info()`, `warning()`, `error()`, `fatal()`
   - Функции: `createSpan()`, `recordException()`
   - Утилиты: `withTracing()`, `withTracingSync()`
   - Автоматическое отправление в Dynatrace

4. **`useTracing.ts`** - React хуки для трейсинга
   - `useTracing()` - основной хук для компонентов
   - `usePageTracing()` - отслеживание загрузки страниц
   - `useFetchTracing()` - отслеживание получения данных
   - Упрощенное использование в компонентах

5. **`queryTracing.ts`** - Специализированный трейсинг для DQL
   - `traceQueryExecution()` - трейсинг одного запроса
   - `traceMultipleQueries()` - батч запросов
   - `traceApiCall()` - отслеживание API вызовов
   - Детальная метрика: время, результаты, ошибки

6. **`config.ts`** - Конфигурация инструментации
   - `loadConfig()` - загрузка из environment переменных
   - `validateConfig()` - проверка корректности
   - `shouldInstrument()` - условие включения
   - Тип `InstrumentationConfig`

### Примеры и документация

1. **`examples.tsx`** - 10 практических примеров
   - Простое логирование
   - Использование хуков
   - Трейсинг DQL запросов
   - Обработка ошибок
   - Batch операции
   - Performance мониторинг

2. **`index.instrumented.tsx`** - Готовый пример интеграции в problems команду
   - Полностью интегрированный компонент
   - Все лучшие практики применены
   - Можно скопировать в реальный файл

### Документация

1. **`INSTRUMENTATION_QUICK_START.md`** - Быстрое начало (5 минут)
   - Установка зависимостей
   - Настройка .env
   - Первое логирование
   - Просмотр логов в Dynatrace

2. **`INSTRUMENTATION_SETUP.md`** - Полная документация
   - Детальная конфигурация
   - Все API методы
   - DQL запросы для анализа
   - Troubleshooting
   - Best practices

3. **`INSTRUMENTATION_DEPENDENCIES.md`** - Информация о зависимостях
   - Список всех пакетов
   - Версии и размеры
   - Альтернативные варианты
   - Troubleshooting

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/resources \
  @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-http \
  @opentelemetry/core
```

### 2. Создание `.env` файла

```env
DYNATRACE_ENVIRONMENT_ID=abc123xyz
DYNATRACE_API_TOKEN=your-token-here
OTEL_EXPORTER_OTLP_ENDPOINT=https://abc123xyz.live.dynatrace.com/api/v2/otlp
```

### 3. Инициализация в главном файле

```typescript
import { initializeTelemetry } from "./lib/instrumentation";
initializeTelemetry().catch(console.error);
```

### 4. Использование в компонентах

```typescript
import { logger } from "./lib/instrumentation";
import { useTracing } from "./lib/instrumentation/useTracing";

export function MyComponent() {
  const { traceAsync, log } = useTracing({ commandName: "my-command" });

  const handleClick = async () => {
    await traceAsync("action_name", async () => {
      log("info", "Action started");
      // ваш код
      log("info", "Action completed");
    });
  };

  return <button onClick={handleClick}>Click</button>;
}
```

## 📊 Что будет отправляться в Dynatrace?

### Логи

- **Все операции**: загрузка данных, смену тенанта, экспорт
- **Ошибки**: с полным stack trace
- **Контекст**: command name, user ID, параметры операции

Пример лога:
```
timestamp: 2026-05-06T10:30:45.123Z
severity: INFO
body: "Problems loaded successfully"
attributes:
  raycast.command: "dt-problems"
  raycast.user_id: "user@company.com"
  dql.result_count: 5
  http.duration_ms: 234
```

### Трейсы (Spans)

- **Query execution**: время выполнения DQL запроса
- **API calls**: HTTP запросы к Dynatrace API
- **Component lifecycle**: загрузка, рендеринг
- **Async operations**: любые асинхронные операции

Пример спана:
```
Operation: "execute_problems_query"
Duration: 245 ms
Attributes:
  dql.query_name: "problems_query"
  dql.status: "success"
  dql.result_count: 12
  dql.execution_time_ms: 245
```

## 🔍 Просмотр в Dynatrace

### Логи

Перейдите в **Logs** и введите:
```dql
fetch logs | filter attributes["raycast.command"] != null
```

### Трейсы

Перейдите в **Traces** и фильтруйте по:
```
Service Name = "raycast-dynatrace-connector"
```

### Аналитика

```dql
// Ошибки по командам
fetch logs 
| filter attributes["raycast.command"] != null and severity == "ERROR"
| stats count() as error_count by attributes["raycast.command"]

// Среднее время выполнения операций
fetch spans
| filter attributes["raycast.command"] != null
| stats avg(duration) as avg_time by attributes["raycast.operation"]

// Проблемы пользователей
fetch logs
| filter attributes["raycast.command"] != null and severity == "ERROR"
| stats count() as issues by attributes["raycast.user_id"]
```

## 🎯 Возможности

- ✅ **Автоматическое отслеживание** операций в расширении
- ✅ **Логирование ошибок** с полным контекстом
- ✅ **Трейсинг DQL запросов** к Dynatrace
- ✅ **Performance метрики** (время выполнения, размер данных)
- ✅ **User tracking** - отслеживание действий пользователей
- ✅ **React хуки** для удобного использования
- ✅ **Zero-config** - работает с environment переменными
- ✅ **Production-ready** - батч отправка, error handling

## 📚 Дальнейшие шаги

### 1. Интегрируйте в существующие команды
- Скопируйте паттерны из `index.instrumented.tsx`
- Добавьте логирование в каждую команду
- Оборачивайте API вызовы в `traceAsync`

### 2. Добавьте метрики
- User engagement (сколько раз используется каждая команда)
- Error rates (сколько ошибок в каждой команде)
- Performance metrics (время выполнения операций)

### 3. Настройте алерты в Dynatrace
- High error rate в расширении
- Slow queries
- Specific errors

### 4. Анализируйте поведение пользователей
- Какие команды используются чаще?
- Где пользователи сталкиваются с проблемами?
- Какой процент операций завершается успешно?

## 🔐 Безопасность

- ✅ Не логируйте пароли или токены
- ✅ Обрезайте DQL запросы (первые 500 символов)
- ✅ Используйте Bearer token для авторизации
- ✅ Отправляйте только необходимые атрибуты

## ⚡ Performance

- **Легкий вес**: ~50 KB gzip для основного модуля
- **Батчинг**: логи отправляются батчами (по умолчанию 100)
- **Асинхронность**: не блокирует UI
- **Отключаемость**: легко отключить в production если нужно

## 📞 Поддержка

Если возникли вопросы, смотрите:
- `INSTRUMENTATION_QUICK_START.md` - для быстрого старта
- `INSTRUMENTATION_SETUP.md` - для детальной информации
- `examples.tsx` - для практических примеров
- `index.instrumented.tsx` - для готового примера интеграции

---

**Готово!** 🎉 Расширение теперь будет отправлять трейсы и логи в Dynatrace.
