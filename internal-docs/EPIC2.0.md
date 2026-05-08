# Dynatrace Raycast Extension — Epic Plan

> **Version:** 1.0 · **Date:** April 29, 2026  
> **Author:** Yaro · **Status:** Draft  
> **Scope:** 20 features across 2 subprojects, 3 приоритета, ~8-12 недель

---

## Содержание

1. [Обзор архитектуры и конвенции](#1-обзор-архитектуры-и-конвенции)
2. [Subproject A — Customer Observability](#2-subproject-a--customer-observability)
3. [Subproject B — Platform & Engineering](#3-subproject-b--platform--engineering)
4. [Shared Infrastructure](#4-shared-infrastructure)
5. [Приоритеты и фазы](#5-приоритеты-и-фазы)
6. [Тестовая стратегия](#6-тестовая-стратегия)
7. [Чеклист для каждой фичи](#7-чеклист-для-каждой-фичи)

---

## 1. Обзор архитектуры и конвенции

Все новые фичи ДОЛЖНЫ следовать существующим паттернам кодовой базы.

### Структура команды

```
src/commands/<name>/index.tsx    ← основной компонент (List/Detail/Form)
src/dt-<name>.tsx                ← тонкий re-export для Raycast
package.json → commands[]        ← регистрация команды
src/commands/dt/index.tsx        ← добавить в hub (entries[])
```

### Data flow для DQL-команд (Grail)

```
Component → useDynatraceQuery<T>() → getAccessToken(tenant) → POST /platform/storage/query/v1/query:execute
                                   ↘ isMockMode() → return MOCK_DATA
```

### Data flow для REST API команд (НЕ-Grail)

Для фич, которые используют REST API v2 (SLO, Workflows, Metrics и т.д.), нужен **новый shared helper** — `src/lib/api/rest.ts` (см. секцию [Shared Infrastructure](#4-shared-infrastructure)). Паттерн:

```
Component → useDynatraceRest<T>(path, options) → getAccessToken(tenant) → GET/POST {tenantEndpoint}/{path}
                                               ↘ isMockMode() → return MOCK_DATA
```

### Mock mode

Каждая фича ОБЯЗАНА поддерживать mock mode. Mock data добавляется в `src/lib/api/mock.ts` и маршрутизируется по content sniffing или по новому механизму (endpoint path).

### Типы

Новые domain types идут в `src/lib/types/<name>.ts` с Zod-схемами для валидации API responses.

### Тесты

Тесты в `src/__tests__/<name>.test.ts`, используют Jest + ts-jest. Raycast API замоканы в `src/__mocks__/@raycast/api.ts`.

### OAuth scopes

Каждая фича документирует необходимые scopes. Пользователь должен добавить их при настройке OAuth client в Dynatrace.

---

## 2. Subproject A — Customer Observability

**Цель:** Дать пользователям Dynatrace полную картину здоровья системы без открытия браузера. Утренний health check за 10 секунд.

**Целевая аудитория:** SRE, on-call инженеры, разработчики, DevOps — все кто ежедневно мониторит свои сервисы.

---

### A1. Davis CoPilot — NL2DQL
**Priority: P0 · Effort: 1-2 дня · API: REST (не Grail)**

**Что:** Конвертация запроса на естественном языке в DQL. "error logs from payment service last hour" → готовый DQL.

**API:**
- `POST /davis/v1/copilot/nl2dql`
- Scope: `davis:copilot:execute`
- Request body: `{ "text": "...", "context": { ... } }`
- Response: `{ "dqlQuery": "fetch logs | filter ..." }`

**User Stories:**
- US-A1.1: Как пользователь, я ввожу запрос на естественном языке и получаю DQL строку
- US-A1.2: Как пользователь, я могу запустить полученный DQL одним кликом через dt-dql-runner
- US-A1.3: Как пользователь, я могу скопировать DQL в буфер обмена
- US-A1.4: Как пользователь, я вижу понятную ошибку если Davis CoPilot недоступен (no Platform Subscription)

**Acceptance Criteria:**
- [ ] Команда `dt-nl2dql` зарегистрирована в package.json
- [ ] TextField принимает текст на английском языке
- [ ] После "Convert" отображается DQL в Detail view с подсветкой синтаксиса (markdown code block)
- [ ] Action "Run Query" → push(DqlRunnerCommand) с предзаполненным DQL
- [ ] Action "Copy DQL" → Clipboard
- [ ] Action "Save as Query" → сохранение в saved queries
- [ ] Graceful error если scope отсутствует или Davis CoPilot не лицензирован → HUD с сообщением
- [ ] Mock mode возвращает хардкоженный DQL для нескольких тестовых фраз
- [ ] Команда добавлена в dt hub (index.tsx)

**Файлы:**
```
src/commands/nl2dql/index.tsx         ← основной компонент
src/dt-nl2dql.tsx                     ← re-export
src/lib/api/davis.ts                  ← Davis CoPilot API client (shared с A2, A3)
src/lib/types/davis.ts                ← типы ответов Davis API
src/__tests__/davis.test.ts           ← unit tests для API client
```

**Тесты:**
- Unit: парсинг ответа Davis API, обработка ошибок (403, 404, 500, timeout)
- Unit: mock mode routing — проверить что mock возвращает DQL для тестовых фраз
- Manual: ввести 5+ запросов разной сложности, убедиться что DQL валидный
- Manual: проверить graceful degradation без Davis license

**Зависимости:** `src/lib/api/rest.ts` (Shared Infrastructure), Davis CoPilot license

---

### A2. Davis CoPilot — DQL2NL (Explain Query)
**Priority: P0 · Effort: 1 день · API: REST**

**Что:** Объяснение DQL запроса на человеческом языке. Полезно для saved queries — понять что делает чужой запрос.

**API:**
- `POST /davis/v1/copilot/dql2nl`
- Scope: `davis:copilot:execute`
- Request: `{ "dqlQuery": "fetch logs | filter ..." }`
- Response: `{ "description": "This query fetches error logs from..." }`

**User Stories:**
- US-A2.1: Как пользователь, я нажимаю "Explain Query" на любом saved query и вижу описание
- US-A2.2: Как пользователь, я нажимаю "Explain" в DQL Runner после выполнения запроса
- US-A2.3: Как пользователь, я могу скопировать объяснение

**Acceptance Criteria:**
- [ ] Не отдельная команда, а Action "Explain Query" в dt-saved-queries и dt-dql-runner
- [ ] Объяснение открывается в Detail view с markdown форматированием
- [ ] Переиспользует `src/lib/api/davis.ts` из A1
- [ ] Mock mode возвращает описание для нескольких тестовых DQL
- [ ] Loading state с анимацией пока Davis обрабатывает

**Файлы:**
```
src/commands/saved-queries/index.tsx  ← добавить Action "Explain Query"
src/commands/dql-runner/index.tsx     ← добавить Action "Explain Query"
src/lib/api/davis.ts                  ← добавить explainQuery() метод
```

**Тесты:**
- Unit: парсинг DQL2NL ответа
- Manual: объяснить 3+ сохранённых запроса разной сложности

**Зависимости:** A1 (shared davis.ts)

---

### A3. Davis CoPilot — Chat
**Priority: P1 · Effort: 5-7 дней · API: REST**

**Что:** Conversational AI для диагностики. "Why is payment-service slow?" → аналитический ответ от Davis с контекстом данных Dynatrace.

**API:**
- `POST /davis/v1/copilot/ask`
- Scope: `davis:copilot:execute`
- Request: `{ "message": "...", "context": { "entity": "...", "timeframe": "..." }, "instructions": "..." }`
- Response: streaming или `{ "answer": "...", "sources": [...] }`

**User Stories:**
- US-A3.1: Как on-call инженер, я задаю вопрос "What's wrong with order-service?" и получаю диагностику
- US-A3.2: Как пользователь, я могу указать context (service name, environment) для точного ответа
- US-A3.3: Как пользователь, я вижу источники данных, на которых основан ответ
- US-A3.4: Как пользователь, я могу задать follow-up вопрос (conversation history)

**Acceptance Criteria:**
- [ ] Отдельная команда `dt-ask` зарегистрирована в package.json
- [ ] TextField для вопроса + optional Dropdown для entity context
- [ ] Ответ отображается в Detail view с markdown
- [ ] Sources (если есть) показаны как accessories или в конце markdown
- [ ] Conversation history хранится в session state (не persisted)
- [ ] Streaming отображение если API поддерживает (progressive rendering)
- [ ] Mock mode — 3-5 тестовых пар вопрос-ответ
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/ask/index.tsx            ← основной компонент
src/dt-ask.tsx                        ← re-export
src/lib/api/davis.ts                  ← добавить askDavis() метод
src/lib/types/davis.ts                ← типы для chat response
```

**Тесты:**
- Unit: парсинг streaming и non-streaming ответов
- Unit: conversation history formatting
- Manual: 5+ вопросов разной сложности, включая follow-up
- Manual: проверить timeout на длинных ответах

**Зависимости:** A1 (shared davis.ts), Davis CoPilot license

---

### A4. SLO Dashboard
**Priority: P0 · Effort: 2-3 дня · API: REST (Config v2)**

**Что:** Список Service Level Objectives: compliance %, error budget remaining, статус (OK / WARNING / FAILED).

**API:**
- `GET /api/v2/slo` — список всех SLO
- `GET /api/v2/slo/{id}` — детали конкретного SLO
- `POST /api/v2/slo/{id}/evaluate` — on-demand пересчёт
- Scope: `slo.read`, `slo.write` (для evaluate)

**User Stories:**
- US-A4.1: Как SRE, я вижу все SLO с текущим % compliance и error budget
- US-A4.2: Как пользователь, я вижу цветовую индикацию: зелёный (OK), жёлтый (WARNING), красный (FAILED)
- US-A4.3: Как пользователь, я могу пересчитать SLO on-demand ("Evaluate Now")
- US-A4.4: Как пользователь, я вижу детали SLO: target %, warning threshold, timeframe, metric expression
- US-A4.5: Как пользователь, я могу открыть SLO в Dynatrace UI (deep link)

**Acceptance Criteria:**
- [ ] Команда `dt-slo` зарегистрирована в package.json
- [ ] List view: название SLO, compliance % (accessories), error budget remaining %
- [ ] Цветовая кодировка: ≥ target → зелёный, ≥ warning → жёлтый, < warning → красный
- [ ] Detail view при нажатии: target, warning, timeframe, definition (metric/DQL), evaluated value
- [ ] Action "Evaluate Now" → POST → refresh list
- [ ] Action "Open in Dynatrace" → openInBrowser с deep link
- [ ] Action "Copy SLO ID"
- [ ] Search по имени SLO
- [ ] Mock mode: 5+ SLO в разных статусах (OK, WARNING, FAILED)
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/slo/index.tsx            ← List + Detail
src/commands/slo/slo-detail.tsx       ← Detail view
src/dt-slo.tsx                        ← re-export
src/lib/types/slo.ts                  ← SLO type + Zod schema
src/lib/api/mock.ts                   ← MOCK_SLOS
```

**Тесты:**
- Unit: парсинг SLO API response, цветовая логика (threshold comparison)
- Unit: error budget calculation (если API не возвращает его напрямую)
- Unit: mock data covers all statuses
- Manual: проверить отображение с реальным tenant (10+ SLO)
- Manual: Evaluate Now на реальном SLO, проверить refresh

**Зависимости:** `src/lib/api/rest.ts`

---

### A5. SLO Menubar
**Priority: P1 · Effort: 1-2 дня · API: REST (Config v2)**

**Что:** Иконка в menubar с числом SLO в WARNING/FAILED. Аналог dt-menubar-problems.

**API:** Тот же `GET /api/v2/slo` с filter по status
**Scope:** `slo.read`

**User Stories:**
- US-A5.1: Как SRE, я вижу в menubar число нарушенных SLO (или зелёную галочку)
- US-A5.2: Как пользователь, я кликаю на menubar item и вижу список проблемных SLO
- US-A5.3: Как пользователь, я могу перейти к полному SLO Dashboard из menubar

**Acceptance Criteria:**
- [ ] Menu-bar команда `dt-menubar-slo` с interval "5m"
- [ ] Иконка: число нарушенных SLO (красный если FAILED, жёлтый если WARNING, зелёный если все OK)
- [ ] Клик → список проблемных SLO с % compliance
- [ ] Action "Open SLO Dashboard" → push(SloCommand)
- [ ] Action "Open in Dynatrace"
- [ ] Mock mode: показывать 2 нарушенных SLO

**Файлы:**
```
src/commands/menubar-slo/index.tsx    ← MenuBarExtra component
src/dt-menubar-slo.tsx                ← re-export
```

**Тесты:**
- Unit: подсчёт нарушенных SLO, формирование title для menubar
- Manual: проверить polling каждые 5 минут, обновление при изменении статуса

**Зависимости:** A4 (переиспользует types/slo.ts и mock data)

---

### A6. Metrics Explorer
**Priority: P1 · Effort: 3-4 дня · API: REST (Metrics v2)**

**Что:** Просмотр ключевых метрик (CPU, memory, response time, error rate) по entity. Самый частый юзкейс — "а что с нагрузкой?".

**API:**
- `GET /api/v2/metrics` — список доступных метрик
- `POST /api/v2/metrics/query` — получение data points
- Scope: `metrics.read`
- Query params: `metricSelector`, `entitySelector`, `from`, `to`, `resolution`

**User Stories:**
- US-A6.1: Как инженер, я выбираю entity (service/host) и вижу ключевые метрики
- US-A6.2: Как пользователь, я могу искать метрики по имени (typeahead)
- US-A6.3: Как пользователь, я вижу текущее значение, min, max, avg за выбранный timeframe
- US-A6.4: Как пользователь, я могу выбрать timeframe (last 1h, 6h, 24h, 7d)
- US-A6.5: Как пользователь, я вижу визуальный тренд (ASCII sparkline или текстовый summary)

**Acceptance Criteria:**
- [ ] Команда `dt-metrics` зарегистрирована
- [ ] Dropdown для entity selection (из entities API или manual input)
- [ ] Search по имени метрики
- [ ] Detail view: значение, unit, min/max/avg, timeframe
- [ ] ASCII sparkline или текстовый тренд ("↑ 15% vs 1h ago")
- [ ] Preset метрики: CPU %, Memory %, Response Time, Error Rate, Throughput
- [ ] Custom metric search для продвинутых пользователей
- [ ] Mock mode: реалистичные data points для 5 метрик
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/metrics/index.tsx        ← List + search
src/commands/metrics/metric-detail.tsx ← Detail с данными
src/dt-metrics.tsx                    ← re-export
src/lib/types/metric.ts              ← Metric, DataPoint types
src/lib/api/mock.ts                   ← MOCK_METRICS
src/lib/utils/sparkline.ts           ← ASCII sparkline generator
```

**Тесты:**
- Unit: sparkline generation из data points
- Unit: метрика aggregation (min/max/avg из data points)
- Unit: unit formatting (ms → s, bytes → GB)
- Manual: проверить 5+ метрик на реальном tenant
- Manual: проверить timeframe switching

**Зависимости:** `src/lib/api/rest.ts`, entity types из existing codebase

---

### A7. Synthetic Monitors
**Priority: P1 · Effort: 2-3 дня · API: REST (Synthetic v2)**

**Что:** Статус синтетических мониторов: HTTP checks, browser monitors. "Сайт доступен из всех локаций?"

**API:**
- `GET /api/v2/synthetic/monitors` — список мониторов
- `GET /api/v2/synthetic/monitors/{id}` — детали
- `GET /api/v2/synthetic/monitors/{id}/executions` — последние результаты
- Scope: `syntheticMonitors.read`

**User Stories:**
- US-A7.1: Как пользователь, я вижу все synthetic мониторы с текущим статусом (OK/FAILED)
- US-A7.2: Как пользователь, я вижу availability % и response time
- US-A7.3: Как пользователь, я вижу с каких локаций есть проблемы
- US-A7.4: Как пользователь, я могу запустить on-demand execution
- US-A7.5: Как пользователь, я могу отфильтровать по типу (HTTP/Browser/3rd party)

**Acceptance Criteria:**
- [ ] Команда `dt-synthetics` зарегистрирована
- [ ] List: имя, тип (HTTP/Browser), статус (зелёный/красный), availability %, response time
- [ ] Detail: URL, locations, schedule, last execution results per location
- [ ] Action "Execute Now" (если API поддерживает)
- [ ] Action "Open in Dynatrace"
- [ ] Dropdown фильтр по типу монитора
- [ ] Mock mode: 4+ монитора (mix OK и FAILED, разные типы)
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/synthetics/index.tsx     ← List
src/commands/synthetics/monitor-detail.tsx ← Detail
src/dt-synthetics.tsx                 ← re-export
src/lib/types/synthetic.ts            ← Monitor, Execution types
src/lib/api/mock.ts                   ← MOCK_SYNTHETICS
```

**Тесты:**
- Unit: парсинг monitor API response, статус determination
- Unit: availability % calculation
- Manual: проверить с tenant у которого 10+ мониторов

**Зависимости:** `src/lib/api/rest.ts`

---

### A8. Quick Status Dashboard
**Priority: P2 · Effort: 3-5 дней · API: Composite (multiple endpoints)**

**Что:** Единая команда `dt-status` — утреннее summary: problems, SLO violations, failing synthetics, top errors. Всё на одном экране.

**API:** Композиция нескольких вызовов:
- `GET /api/v2/slo` (SLO status)
- DQL query для problems count
- `GET /api/v2/synthetic/monitors` (synthetics status)
- DQL query для top errors (optional)

**User Stories:**
- US-A8.1: Как SRE, я открываю одну команду и за 2 секунды вижу полную картину здоровья
- US-A8.2: Как пользователь, я вижу summary: "3 problems, 1 SLO warning, all synthetics OK"
- US-A8.3: Как пользователь, я могу кликнуть на любую секцию и перейти к деталям (push)
- US-A8.4: Как пользователь, я вижу "last checked" timestamp

**Acceptance Criteria:**
- [ ] Команда `dt-status` зарегистрирована
- [ ] Detail view с markdown-formatted summary
- [ ] Секции: Problems (count by severity), SLO (violations count), Synthetics (failing count), Recent Deployments (last 3)
- [ ] Каждая секция кликабельна → переход к соответствующей команде
- [ ] Parallel fetch всех данных (Promise.allSettled)
- [ ] Graceful degradation: если один API недоступен, показать "N/A" для этой секции
- [ ] Auto-refresh каждые 60 секунд
- [ ] Mock mode: композитный mock с данными из всех источников
- [ ] Добавлена в dt hub как ПЕРВЫЙ пункт

**Файлы:**
```
src/commands/status/index.tsx         ← Composite dashboard
src/dt-status.tsx                     ← re-export
```

**Тесты:**
- Unit: aggregation logic, parallel fetch error handling
- Unit: graceful degradation — один API отдаёт 500, остальные работают
- Manual: проверить с реальным tenant, сравнить данные с UI

**Зависимости:** A4 (SLO), A7 (Synthetics), existing problems/deployments. Это интеграционная фича — реализуется после A4 и A7.

---

### A9. Release Health / Version Comparison
**Priority: P2 · Effort: 3-4 дня · API: DQL (Grail)**

**Что:** Сравнение error rate и latency до/после деплоя. При релизе — быстрая проверка "стало хуже или нет?"

**API:** DQL queries к spans/logs:
```
fetch dt.entity.service
| filter entity.name == "payment-service"
| fieldsAdd runs[dt.release_version]
```
Сравнение двух timeframes через 2 DQL запроса.

**User Stories:**
- US-A9.1: Как разработчик, я выбираю сервис и вижу текущую и предыдущую версии
- US-A9.2: Как пользователь, я вижу сравнение error rate: "v2.1 → v2.2: +0.3% errors"
- US-A9.3: Как пользователь, я вижу сравнение latency: "p95 response time: 120ms → 145ms (+21%)"
- US-A9.4: Как пользователь, я вижу цветовой индикатор: regression (красный) / improvement (зелёный) / neutral (серый)

**Acceptance Criteria:**
- [ ] Action "Compare Release" в dt-deployments
- [ ] Form: service name, current version (auto-detected), previous version, timeframe
- [ ] Detail view: side-by-side comparison в markdown table
- [ ] Цветовая индикация delta (>5% regression = красный, >5% improvement = зелёный)
- [ ] Fallback если нет version data: сравнение по timeframe (last 1h vs previous 1h)
- [ ] Mock mode: 2 версии с различиями в метриках

**Файлы:**
```
src/commands/deployments/release-compare.tsx ← comparison view
src/lib/utils/releaseHealth.ts              ← DQL query builders, delta calculation
src/__tests__/releaseHealth.test.ts         ← unit tests
```

**Тесты:**
- Unit: delta calculation, threshold logic, formatting
- Unit: DQL query generation для version comparison
- Manual: сравнить 2 реальных деплоя, сверить с Dynatrace UI

**Зависимости:** Existing deployments command, `useDynatraceQuery`

---

### A10. App Intents — Deep Links
**Priority: P0 · Effort: 1-2 дня · API: REST**

**Что:** Action "Open in Dynatrace" для всех существующих команд. Генерирует deep-link URL в нужный экран Dynatrace UI.

**API:**
- `GET /platform/app-engine/v1/intents` — discovery интентов
- Scope: `app-engine:apps:run`
- Или: ручная генерация URL по паттерну `{tenantUrl}/ui/apps/{appId}/...`

**User Stories:**
- US-A10.1: Как пользователь, из любого view я могу нажать "Open in Dynatrace" и попасть в нужное место в браузере
- US-A10.2: Как пользователь, deep link из dt-problems открывает проблему в Davis app
- US-A10.3: Как пользователь, deep link из dt-traces открывает трейс в Distributed Tracing app

**Acceptance Criteria:**
- [ ] Utility функция `buildDeepLink(type, id, tenant)` в shared module
- [ ] Поддержка типов: problem, trace, entity, log query, SLO, deployment
- [ ] Action "Open in Dynatrace" добавлена во ВСЕ существующие команды
- [ ] openInBrowser с корректным URL
- [ ] Fallback если Intent API недоступен: generic URL `{tenantUrl}/ui/` + entity type
- [ ] Unit test для генерации URL каждого типа

**Файлы:**
```
src/lib/utils/deepLinks.ts           ← buildDeepLink() utility
src/__tests__/deepLinks.test.ts       ← unit tests
src/commands/*/index.tsx              ← добавить Action во все команды
```

**Тесты:**
- Unit: URL generation для каждого entity type
- Unit: edge cases — URL encoding, special characters в entity ID
- Manual: проверить что каждый deep link открывает правильную страницу

**Зависимости:** Нет. Может быть реализована параллельно с любой фичей.

---

### A11. Query Templates Library
**Priority: P2 · Effort: 1-2 дня · API: нет (local data)**

**Что:** Коллекция готовых DQL шаблонов: top errors, slow endpoints, K8s pod restarts, failed deployments. Отличается от saved queries — это предустановленные шаблоны с параметрами.

**User Stories:**
- US-A11.1: Как новичок, я выбираю шаблон "Top Errors by Service" и вижу готовый DQL
- US-A11.2: Как пользователь, я могу заполнить параметры шаблона (service name, timeframe)
- US-A11.3: Как пользователь, я могу запустить шаблон или сохранить в saved queries

**Acceptance Criteria:**
- [ ] Action "Browse Templates" в dt-dql-runner или отдельная секция в dt-saved-queries
- [ ] 10+ предустановленных шаблонов по категориям (Logs, Problems, Traces, Metrics, K8s)
- [ ] Form для параметров (service name, timeframe, namespace и т.д.)
- [ ] Action "Run" → dt-dql-runner, Action "Save" → saved queries
- [ ] Шаблоны хранятся в коде как JSON/TS объект (не в API)

**Файлы:**
```
src/lib/queryTemplates.ts             ← шаблоны с метаданными
src/commands/dql-runner/templates.tsx  ← UI для выбора шаблонов
src/__tests__/queryTemplates.test.ts  ← validation что шаблоны валидный DQL
```

**Тесты:**
- Unit: template parameter substitution
- Unit: все шаблоны генерируют синтаксически валидный DQL
- Manual: запустить каждый шаблон на реальном tenant

**Зависимости:** Нет

---

## 3. Subproject B — Platform & Engineering

**Цель:** Инструменты для управления Dynatrace платформой, incident response, и DevOps workflow. Для тех, кто не только смотрит данные, но и действует.

**Целевая аудитория:** Platform engineers, DevOps, on-call engineers, Dynatrace admins.

---

### B1. Workflows — List & Execute
**Priority: P0 · Effort: 5-7 дней · API: REST (Automation)**

**Что:** Просмотр workflows, запуск on-demand, просмотр последнего статуса. Аналог `dtctl exec workflow`.

**API:**
- `GET /platform/automation/v1/workflows` — список
- `GET /platform/automation/v1/workflows/{id}` — детали
- `POST /platform/automation/v1/workflows/{id}/run` — запуск
- `GET /platform/automation/v1/executions?workflow={id}` — история
- Scope: `automation:workflows:read`, `automation:workflows:run`

**User Stories:**
- US-B1.1: Как инженер, я вижу все workflows с типом триггера и статусом последнего запуска
- US-B1.2: Как on-call, я запускаю remediation workflow одним кликом
- US-B1.3: Как пользователь, я могу указать input parameters при запуске
- US-B1.4: Как пользователь, я вижу HUD с execution ID после запуска
- US-B1.5: Как пользователь, я могу фильтровать workflows по owner, trigger type

**Acceptance Criteria:**
- [ ] Команда `dt-workflows` зарегистрирована
- [ ] List: название, trigger type icon (⏰ schedule, ⚡ event, 👆 manual), owner, last execution status
- [ ] Detail: описание, trigger config, input parameters schema, last 5 executions
- [ ] Action "Execute" → если workflow имеет input params → Form → POST → HUD "Started: {executionId}"
- [ ] Action "Execute" → если нет params → confirm dialog → POST → HUD
- [ ] Execution status polling: при запуске автоматически refresh каждые 3s пока RUNNING
- [ ] Action "Open in Dynatrace"
- [ ] Search по имени workflow
- [ ] Mock mode: 4+ workflows (manual, scheduled, event-triggered) с разными статусами
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/workflows/index.tsx          ← List
src/commands/workflows/workflow-detail.tsx ← Detail + execute form
src/dt-workflows.tsx                      ← re-export
src/lib/types/workflow.ts                 ← Workflow, Execution types + Zod
src/lib/api/mock.ts                       ← MOCK_WORKFLOWS, MOCK_EXECUTIONS
src/__tests__/workflow.test.ts            ← unit tests
```

**Тесты:**
- Unit: парсинг workflow API response, trigger type detection
- Unit: input parameter schema → Form fields mapping
- Unit: execution status polling logic
- Unit: mock mode routing
- Integration: запустить workflow на тестовом tenant, проверить execution tracking
- Manual: запустить workflow с параметрами, убедиться в корректности

**Зависимости:** `src/lib/api/rest.ts`, Automation API license

---

### B2. Workflow Executions — History & Logs
**Priority: P1 · Effort: 3-4 дня · API: REST (Automation)**

**Что:** История запусков workflow: статус, время, длительность. Per-task breakdown с логами каждого шага.

**API:**
- `GET /platform/automation/v1/executions/{id}` — детали execution
- `GET /platform/automation/v1/executions/{id}/tasks` — task-level breakdown
- Scope: `automation:workflows:read`

**User Stories:**
- US-B2.1: Как инженер, я вижу историю запусков конкретного workflow
- US-B2.2: Как пользователь, я вижу per-task breakdown: ✅ check_health (1.2s) / ❌ notify_slack — Error: 403
- US-B2.3: Как пользователь, я могу отменить RUNNING execution
- US-B2.4: Как пользователь, я могу re-run failed execution с теми же параметрами

**Acceptance Criteria:**
- [ ] Subview в workflow detail → "Recent Executions" list
- [ ] Клик на execution → task breakdown в markdown detail
- [ ] Каждый task: status icon (✅/❌/⏳/⏸), name, duration, error message (если есть)
- [ ] Action "Cancel Execution" для RUNNING (PATCH с cancel request)
- [ ] Action "Re-run" → POST с теми же parameters
- [ ] Pagination для длинной истории
- [ ] Mock mode: 3+ executions с разными статусами, per-task breakdown

**Файлы:**
```
src/commands/workflows/execution-detail.tsx ← execution task breakdown
src/commands/workflows/executions-list.tsx  ← history list
```

**Тесты:**
- Unit: task breakdown parsing, duration formatting
- Unit: cancel/re-run API calls
- Manual: проверить на workflow с 5+ tasks

**Зависимости:** B1 (workflows infrastructure)

---

### B3. Settings / Config Management
**Priority: P1 · Effort: 2-3 дня · API: REST (Settings v2)**

**Что:** Поиск по Dynatrace settings: alerting profiles, management zones, auto-tagging rules. "У нас настроен alerting для X?"

**API:**
- `GET /api/v2/settings/objects` — список settings objects
- `GET /api/v2/settings/schemas` — доступные schema IDs
- Scope: `settings.read`
- Query params: `schemaIds`, `filter`, `pageSize`

**User Stories:**
- US-B3.1: Как platform engineer, я ищу настройку по имени и вижу где она сконфигурирована
- US-B3.2: Как пользователь, я могу фильтровать по типу: alerting, management zones, auto-tags
- US-B3.3: Как пользователь, я вижу JSON definition настройки в Detail view
- US-B3.4: Как пользователь, я могу скопировать settings object ID или JSON

**Acceptance Criteria:**
- [ ] Команда `dt-settings` зарегистрирована
- [ ] Dropdown для schema type (предустановленные: alerting profiles, management zones, auto-tags, maintenance windows)
- [ ] Search по имени объекта
- [ ] List: name, schema type, scope (environment/host/service), last modified
- [ ] Detail: JSON definition в markdown code block
- [ ] Action "Copy JSON", "Copy Object ID", "Open in Dynatrace"
- [ ] Mock mode: 5+ settings objects разных типов
- [ ] Добавлена в dt hub

**Файлы:**
```
src/commands/settings/index.tsx       ← List + search
src/commands/settings/setting-detail.tsx ← Detail с JSON
src/dt-settings.tsx                   ← re-export
src/lib/types/settings.ts            ← SettingsObject type
```

**Тесты:**
- Unit: settings API response parsing
- Unit: filter by schema type
- Manual: поиск настроек на реальном tenant с 50+ объектами

**Зависимости:** `src/lib/api/rest.ts`

---

### B4. Maintenance Windows
**Priority: P1 · Effort: 2 дня · API: REST (Settings v2)**

**Что:** Активные и запланированные maintenance windows. Быстрое создание перед релизом.

**API:**
- `GET /api/v2/settings/objects?schemaIds=builtin:alerting.maintenance-window`
- `POST /api/v2/settings/objects` — создание
- Scope: `settings.read`, `settings.write`

**User Stories:**
- US-B4.1: Как DevOps, я вижу все активные и запланированные maintenance windows
- US-B4.2: Как пользователь, я создаю maintenance window перед релизом за 30 секунд
- US-B4.3: Как пользователь, я могу указать scope (всё окружение / конкретный entity / management zone)
- US-B4.4: Как пользователь, я могу удалить/отменить maintenance window

**Acceptance Criteria:**
- [ ] Команда `dt-maintenance` или секция в dt-settings
- [ ] List: имя, тип (PLANNED/ONE_TIME/RECURRING), start/end time, scope, status (ACTIVE/SCHEDULED/PAST)
- [ ] Action "Create" → Form: name, type, schedule, scope (entity/MZ/all), suppress events toggle
- [ ] Action "Delete" для запланированных окон
- [ ] Сортировка: active first → scheduled → past
- [ ] Mock mode: 3 окна в разных статусах

**Файлы:**
```
src/commands/maintenance/index.tsx     ← List + Create form
src/dt-maintenance.tsx                 ← re-export (или добавить в dt-settings)
src/lib/types/maintenance.ts           ← MaintenanceWindow type
```

**Тесты:**
- Unit: schedule parsing, status determination (active/scheduled/past based on time)
- Unit: create payload generation
- Manual: создать и удалить maintenance window на тестовом tenant

**Зависимости:** `src/lib/api/rest.ts`. Можно объединить с B3 (Settings).

---

### B5. Notifications Viewer
**Priority: P2 · Effort: 1-2 дня · API: REST**

**Что:** Platform notifications: integration failures, config warnings. Не Davis problems, а platform-level.

**API:**
- `GET /api/v2/notifications`
- `DELETE /api/v2/notifications/{id}`
- Scope: `notifications.read`, `notifications.write`

**User Stories:**
- US-B5.1: Как platform engineer, я вижу platform notifications без захода в UI
- US-B5.2: Как пользователь, я могу dismiss уведомления

**Acceptance Criteria:**
- [ ] Команда `dt-notifications` или Action в dt-status
- [ ] List: type, status, timestamp, message preview
- [ ] Action "Dismiss" → DELETE
- [ ] Auto-refresh каждые 60 секунд
- [ ] Mock mode: 3+ уведомления разных типов

**Файлы:**
```
src/commands/notifications/index.tsx  ← List
src/dt-notifications.tsx              ← re-export
src/lib/types/notification.ts         ← Notification type
```

**Тесты:**
- Unit: notification parsing, timestamp formatting
- Manual: проверить с tenant у которого есть integration failures

**Зависимости:** `src/lib/api/rest.ts`

---

### B6. Ownership / Team Lookup
**Priority: P2 · Effort: 1-2 дня · API: REST (Settings v2)**

**Что:** "Кто owner этого сервиса?" — мгновенный ответ во время инцидента.

**API:**
- `GET /api/v2/settings/objects?schemaIds=builtin:ownership.teams`
- Или entity properties (ownership field)
- Scope: `settings.read`

**User Stories:**
- US-B6.1: Как on-call, я ввожу имя сервиса и мгновенно вижу team-owner и контакты
- US-B6.2: Как пользователь, я вижу ownership info как Action в dt-entities и dt-problems

**Acceptance Criteria:**
- [ ] Action "Who Owns This?" в dt-entities и dt-problems
- [ ] Detail view: team name, contacts (email/Slack), responsible person
- [ ] Standalone search: dt-ownership с поиском по service name
- [ ] Mock mode: 3+ teams с ownership assignments

**Файлы:**
```
src/commands/ownership/index.tsx      ← Search view
src/dt-ownership.tsx                  ← re-export
src/lib/types/ownership.ts           ← Team, OwnershipAssignment types
```

**Тесты:**
- Unit: ownership data parsing
- Manual: проверить с tenant с настроенным Ownership

**Зависимости:** `src/lib/api/rest.ts`, Ownership module в tenant

---

### B7. Extensions Browser
**Priority: P2 · Effort: 1-2 дня · API: REST**

**Что:** Список установленных Extensions 2.0 с версиями. "Правильная ли версия установлена?"

**API:**
- `GET /api/v2/extensions`
- `GET /api/v2/extensions/{name}/monitoringConfigurations`
- Scope: `extensions.read`

**User Stories:**
- US-B7.1: Как platform engineer, я вижу все extensions с версиями
- US-B7.2: Как пользователь, я вижу количество monitoring configurations на каждый extension

**Acceptance Criteria:**
- [ ] Команда `dt-extensions` зарегистрирована
- [ ] List: name, version, author, monitoring configs count
- [ ] Detail: description, monitoring configurations list с статусами
- [ ] Action "Open in Extension Hub"
- [ ] Mock mode: 4+ extensions

**Файлы:**
```
src/commands/extensions/index.tsx     ← List
src/dt-extensions.tsx                 ← re-export
src/lib/types/extension.ts           ← Extension type
```

**Тесты:**
- Unit: extensions API parsing
- Manual: сверить с Extensions Hub в UI

**Зависимости:** `src/lib/api/rest.ts`

---

### B8. Live Debugger — Breakpoints
**Priority: P2 · Effort: 4-5 дней · API: REST**

**Что:** Управление non-breaking breakpoints: создать, включить/выключить, удалить. Нишевая, но уникальная.

**API:**
- `GET /api/v2/debugger/breakpoints`
- `POST /api/v2/debugger/breakpoints`
- `PATCH /api/v2/debugger/breakpoints/{id}`
- `DELETE /api/v2/debugger/breakpoints/{id}`
- Scope: `debugger.read`, `debugger.write`

**User Stories:**
- US-B8.1: Как разработчик, я вижу все активные breakpoints с hit count
- US-B8.2: Как пользователь, я создаю breakpoint указав file path, line number, optional condition
- US-B8.3: Как пользователь, я могу toggle enabled/disabled
- US-B8.4: Как пользователь, я вижу captured snapshots (последние значения переменных)

**Acceptance Criteria:**
- [ ] Команда `dt-debugger` зарегистрирована
- [ ] List: file path, line, condition, hit count, enabled status
- [ ] Action "Create Breakpoint" → Form (file path, line, condition, workspace filter)
- [ ] Action "Toggle Enabled"
- [ ] Action "Delete"
- [ ] Detail: captured variable snapshots (если есть)
- [ ] Mock mode: 3+ breakpoints с captures

**Файлы:**
```
src/commands/debugger/index.tsx       ← List + Create form
src/dt-debugger.tsx                   ← re-export
src/lib/types/debugger.ts            ← Breakpoint, Snapshot types
```

**Тесты:**
- Unit: breakpoint CRUD API calls
- Manual: создать breakpoint на реальном сервисе, проверить captures

**Зависимости:** `src/lib/api/rest.ts`, LiveDebugger module

---

### B9. Filter Segments
**Priority: P2 · Effort: 1-2 дня · API: REST (Grail)**

**Что:** Именованные фильтры данных ("только production", "только EU"). Применяются к DQL запросам.

**API:**
- `GET /platform/storage/filter-segments/v1/filter-segments`
- Scope: `storage:filter-segments:read`

**User Stories:**
- US-B9.1: Как пользователь, я выбираю filter segment в DQL Runner и он автоматически применяется
- US-B9.2: Как пользователь, я вижу список доступных segments

**Acceptance Criteria:**
- [ ] Dropdown picker в dt-dql-runner и dt-search-logs для выбора segment
- [ ] Segment UID передаётся в query payload или URL parameter
- [ ] List доступных segments с описаниями
- [ ] Mock mode: 2+ segments

**Файлы:**
```
src/lib/types/filterSegment.ts        ← FilterSegment type
src/commands/dql-runner/index.tsx      ← добавить segment picker
src/commands/search-logs/index.tsx     ← добавить segment picker
```

**Тесты:**
- Unit: segment application к query
- Manual: применить segment к запросу, сверить результаты

**Зависимости:** `src/lib/api/rest.ts`

---

## 4. Shared Infrastructure

Перед началом работы над фичами нужно реализовать shared компоненты.

### SI-1. REST API Client (`src/lib/api/rest.ts`)
**Priority: P0 · Effort: 1 день · Blocker для всех REST-фич**

```typescript
// src/lib/api/rest.ts
// Generic REST API client for Dynatrace Config/Platform APIs (non-Grail).

interface RestOptions<T> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;          // e.g. "/api/v2/slo"
  body?: unknown;
  query?: Record<string, string>;
  schema?: ZodSchema<T>; // optional Zod validation
}

export async function dynatraceRest<T>(
  tenant: TenantConfig,
  options: RestOptions<T>,
): Promise<T>

// React hook version
export function useDynatraceRest<T>(
  path: string,
  options?: { query?: Record<string, string>; schema?: ZodSchema<T>; interval?: number },
): { data: T | null; isLoading: boolean; error: string | null; revalidate: () => void }
```

**Acceptance Criteria:**
- [ ] Supports GET, POST, PUT, PATCH, DELETE
- [ ] Uses getAccessToken() from existing auth.ts
- [ ] Zod validation on response (optional)
- [ ] Error handling: HTTP errors, network errors, HTML responses
- [ ] Mock mode support: registry of path → mock data
- [ ] AbortController for request cancellation
- [ ] Pagination support (nextPageKey pattern)

**Тесты:**
- Unit: HTTP method routing, error handling, Zod validation, pagination
- Unit: mock mode path matching

---

### SI-2. Davis CoPilot API Client (`src/lib/api/davis.ts`)
**Priority: P0 · Effort: 0.5 дня · Blocker для A1, A2, A3**

Shared client для всех Davis CoPilot API endpoints (nl2dql, dql2nl, ask).

---

### SI-3. Deep Links Utility (`src/lib/utils/deepLinks.ts`)
**Priority: P0 · Effort: 0.5 дня · Используется всеми командами**

Utility для генерации deep-link URL. Реализуется в рамках A10.

---

### SI-4. Mock Data Registry Expansion
**Priority: P0 · Effort: ongoing**

Расширение `src/lib/api/mock.ts` mock данными для каждой новой фичи. Каждая фича должна добавить свой mock dataset при реализации.

---

## 5. Приоритеты и фазы

### P0 — Must Have (недели 1-3)

Фичи без которых расширение не готово к open source. Quick wins с максимальным impact.

| # | Feature | Subproject | Effort | Блокеры |
|---|---------|------------|--------|---------|
| SI-1 | REST API Client | Shared | 1d | — |
| SI-2 | Davis API Client | Shared | 0.5d | SI-1 |
| SI-3 | Deep Links Utility | Shared | 0.5d | — |
| A1 | NL2DQL | A | 2d | SI-2 |
| A2 | DQL2NL Explain | A | 1d | SI-2 |
| A4 | SLO Dashboard | A | 3d | SI-1 |
| A10 | Deep Links (all commands) | A | 2d | SI-3 |
| B1 | Workflows List + Execute | B | 7d | SI-1 |

**Итого P0:** ~17 рабочих дней (3-4 недели с учётом review)

### P1 — Should Have (недели 4-6)

Фичи, которые делают расширение полноценным рабочим инструментом.

| # | Feature | Subproject | Effort | Блокеры |
|---|---------|------------|--------|---------|
| A3 | Davis Chat | A | 5d | SI-2 |
| A5 | SLO Menubar | A | 2d | A4 |
| A6 | Metrics Explorer | A | 4d | SI-1 |
| A7 | Synthetic Monitors | A | 3d | SI-1 |
| B2 | Workflow Executions | B | 4d | B1 |
| B3 | Settings Management | B | 3d | SI-1 |
| B4 | Maintenance Windows | B | 2d | SI-1 |

**Итого P1:** ~23 рабочих дня (4-5 недель)

### P2 — Nice to Have (недели 7-10+)

Specialist features по запросу команды.

| # | Feature | Subproject | Effort | Блокеры |
|---|---------|------------|--------|---------|
| A8 | Quick Status Dashboard | A | 5d | A4, A7 |
| A9 | Release Health | A | 4d | — |
| A11 | Query Templates | A | 2d | — |
| B5 | Notifications Viewer | B | 2d | SI-1 |
| B6 | Ownership Lookup | B | 2d | SI-1 |
| B7 | Extensions Browser | B | 2d | SI-1 |
| B8 | Live Debugger | B | 5d | SI-1 |
| B9 | Filter Segments | B | 2d | SI-1 |

**Итого P2:** ~24 рабочих дня (по запросу)

---

### Gantt-like View

```
Week 1:  [SI-1 REST Client][SI-2 Davis][SI-3 Deep Links]
Week 2:  [A1 NL2DQL][A2 DQL2NL][A10 Deep Links across all]
Week 3:  [A4 SLO Dashboard][B1 Workflows ──────────────────
Week 4:  ──── B1 Workflows]  [A5 SLO Menubar][A3 Davis Chat─
Week 5:  ─ A3 Chat] [A6 Metrics Explorer ────][B2 Executions─
Week 6:  ─ B2 Exec] [A7 Synthetics ───][B3 Settings][B4 Maint]
Week 7+: P2 features on demand
```

---

## 6. Тестовая стратегия

### Уровни тестирования

**Level 1 — Unit Tests (обязательно для каждой фичи)**
- API response parsing (Zod schema validation)
- Business logic (threshold comparison, status determination, delta calculation)
- Utility functions (deep links, sparklines, formatting)
- Mock mode data routing
- Error handling (HTTP errors, network failures, invalid responses)
- Запускаются: `npm test`

**Level 2 — Component Tests (рекомендуется для сложных фич)**
- React hook behavior (useDynatraceRest — loading, error, data states)
- State machine logic (polling, pagination, form submission)
- Запускаются: `npm test`

**Level 3 — Integration Tests (manual, на тестовом tenant)**
- Каждая фича тестируется с реальным Dynatrace tenant
- Чеклист для manual testing по каждой фиче (описан в Acceptance Criteria)
- Mock mode OFF → проверить реальные API calls
- Mock mode ON → проверить mock data отображение

**Level 4 — E2E / Smoke Tests (перед релизом)**
- Все команды доступны через dt hub
- Tenant switching работает для всех новых команд
- Mock mode toggle работает для всех новых команд
- Background commands (menubar, alerts) работают с новыми endpoints

### Тестовый tenant

Для интеграционного тестирования нужен:
- Dynatrace tenant с Platform Subscription (для Davis CoPilot, Workflows)
- OAuth client с полным набором scopes для всех фич
- Тестовые данные: минимум 1 SLO, 1 workflow, 1 synthetic monitor, настроенные settings
- Рекомендация: использовать Dynatrace Free Trial или internal dev tenant

### Coverage targets

- Shared infrastructure (SI-1, SI-2, SI-3): >90% line coverage
- Business logic (utils/): >80% line coverage
- API type parsing: 100% (каждый Zod schema протестирован)
- React components: функциональные тесты через hook testing

---

## 7. Чеклист для каждой фичи

Перед тем как считать фичу готовой, проверь:

- [ ] **Code:** команда зарегистрирована в `package.json`
- [ ] **Code:** re-export файл `src/dt-<name>.tsx` создан
- [ ] **Code:** команда добавлена в dt hub (`src/commands/dt/index.tsx`)
- [ ] **Code:** domain types в `src/lib/types/<name>.ts` с Zod schema
- [ ] **Code:** mock data добавлена в `src/lib/api/mock.ts`
- [ ] **Code:** mock mode работает (isMockMode() path)
- [ ] **Tests:** unit tests написаны и проходят (`npm test`)
- [ ] **Tests:** manual testing на реальном tenant пройдено
- [ ] **Tests:** error scenarios проверены (нет tenant, нет scope, API 500, timeout)
- [ ] **UX:** search/filter работает
- [ ] **UX:** Actions корректны (Open in Dynatrace, Copy, Export)
- [ ] **UX:** Empty state понятный (нет данных vs. нет подключения)
- [ ] **UX:** Loading state отображается
- [ ] **Docs:** необходимые OAuth scopes задокументированы
- [ ] **Lint:** `npm run lint` проходит без ошибок
- [ ] **Build:** `npm run build` проходит без ошибок

---

## Appendix: OAuth Scopes Summary

Полный список scopes, необходимых для всех фич:

| Scope | Фичи |
|-------|-------|
| `storage:logs:read` | Existing (logs) |
| `storage:events:read` | Existing (problems, deployments) |
| `storage:spans:read` | Existing (traces) |
| `storage:entities:read` | Existing (entities) |
| `davis:copilot:execute` | A1, A2, A3 |
| `slo.read` | A4, A5 |
| `slo.write` | A4 (evaluate) |
| `metrics.read` | A6 |
| `syntheticMonitors.read` | A7 |
| `app-engine:apps:run` | A10 |
| `automation:workflows:read` | B1, B2 |
| `automation:workflows:run` | B1 |
| `settings.read` | B3, B4, B6 |
| `settings.write` | B4 (create) |
| `notifications.read` | B5 |
| `notifications.write` | B5 (dismiss) |
| `extensions.read` | B7 |
| `debugger.read` | B8 |
| `debugger.write` | B8 |
| `storage:filter-segments:read` | B9 |
