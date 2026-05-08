# OpenTelemetry Dependencies to Install

Для добавления инструментации (трейсинга и логирования) в расширение, выполните:

```bash
npm install \
  @opentelemetry/api \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/api-logs \
  @opentelemetry/sdk-logs \
  @opentelemetry/exporter-logs-otlp-http \
  @opentelemetry/core
```

## Описание зависимостей

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| `@opentelemetry/api` | ^1.x | Core API для трейсинга и логирования |
| `@opentelemetry/sdk-trace-base` | ^1.x | SDK для отправки трейсов |
| `@opentelemetry/resources` | ^1.x | Resource definition для трейсов |
| `@opentelemetry/semantic-conventions` | ^1.x | Стандартные атрибуты для трейсов |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.x | HTTP экспортер для трейсов (OTLP) |
| `@opentelemetry/api-logs` | ^0.x | API для логирования |
| `@opentelemetry/sdk-logs` | ^0.x | SDK для отправки логов |
| `@opentelemetry/exporter-logs-otlp-http` | ^0.x | HTTP экспортер для логов (OTLP) |
| `@opentelemetry/core` | ^1.x | Core utilities (W3CTraceContextPropagator) |

## Версии (на май 2026)

```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-trace-base": "^1.25.0",
  "@opentelemetry/resources": "^1.25.0",
  "@opentelemetry/semantic-conventions": "^1.25.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.51.0",
  "@opentelemetry/api-logs": "^0.51.0",
  "@opentelemetry/sdk-logs": "^0.51.0",
  "@opentelemetry/exporter-logs-otlp-http": "^0.51.0",
  "@opentelemetry/core": "^1.25.0"
}
```

## Проверка установки

После установки проверьте, что все зависимости установлены:

```bash
npm ls @opentelemetry/api
npm ls @opentelemetry/sdk-trace-base
npm ls @opentelemetry/exporter-trace-otlp-http
```

## Размер bundle

Эти зависимости добавят примерно **500-700 KB** к build размеру (gzip ~150-200 KB).

Если это критично, можете использовать динамический import:

```typescript
import { initializeTelemetry } from './lib/instrumentation';

// Загружается только когда нужно
if (shouldEnableInstrumentation()) {
  await initializeTelemetry();
}
```

## Альтернативы

Если вам не нужна полная функциональность OpenTelemetry, можете использовать более легкие альтернативы:

### Вариант 1: Только логирование без трейсинга

```bash
npm install \
  @opentelemetry/api-logs \
  @opentelemetry/sdk-logs \
  @opentelemetry/exporter-logs-otlp-http
```

Размер: ~300 KB

### Вариант 2: Custom logger без OpenTelemetry

Можете написать простой logger самостоятельно и отправлять логи в Dynatrace API:

```typescript
// Simple logger that sends to Dynatrace Logs API
async function sendLog(level: string, message: string, attributes?: any) {
  await fetch('https://your-env.live.dynatrace.com/api/v2/logs/ingest', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      log_entries: [{
        content: message,
        severity: level,
        attributes
      }]
    })
  });
}
```

Размер: минимальный (только сетевые запросы)

## Troubleshooting

### Ошибка: "Cannot find module '@opentelemetry/api'"

```bash
# Очистите npm cache
npm cache clean --force

# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install
```

### Конфликты версий

Если есть конфликты версий, используйте `npm install --legacy-peer-deps`:

```bash
npm install --legacy-peer-deps
```

### Несовместимость с Node версией

Убедитесь, что используется Node 18+:

```bash
node --version  # должно быть v18.0.0 или выше
```

В `package.json` уже указано: `"node": ">=22"`
