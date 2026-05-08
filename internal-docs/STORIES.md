# User Stories — Dynatrace Raycast Extension v2.0

> **Epic:** EPIC2.0 · **Date:** April 29, 2026  
> **Status:** Ready for Development  
> **Total stories:** 54 · **Sprints:** ~10 недель

---

## Содержание

- [Shared Infrastructure](#shared-infrastructure)
- [Subproject A — Customer Observability](#subproject-a--customer-observability)
- [Subproject B — Platform & Engineering](#subproject-b--platform--engineering)

---

## Shared Infrastructure

### SI-1 · REST API Client

> **Priority:** P0 · **Effort:** 1 день · **Blocker для:** всех REST-фич

---

#### SI-1-1 · Generic REST helper для DT Config/Platform API

**As a** developer implementing new features,  
**I want** a shared `dynatraceRest<T>()` function in `src/lib/api/rest.ts`,  
**so that** I can make authenticated API calls to any Dynatrace REST endpoint without duplicating auth logic.

**Acceptance Criteria:**
- [ ] Функция `dynatraceRest<T>(tenant, options)` поддерживает методы GET, POST, PUT, PATCH, DELETE
- [ ] Автоматически получает токен через существующий `getAccessToken()` из `src/lib/auth.ts`
- [ ] Принимает опциональную Zod-схему для валидации ответа
- [ ] Выбрасывает понятные ошибки для HTTP 4xx/5xx, сетевых ошибок и невалидного JSON
- [ ] Поддерживает query params через объект `Record<string, string>`
- [ ] Поддерживает отмену запроса через `AbortController`

**Technical Notes:**
```
src/lib/api/rest.ts   ← новый файл
src/__tests__/rest.test.ts
```

---

#### SI-1-2 · React hook `useDynatraceRest`

**As a** developer building UI components,  
**I want** a `useDynatraceRest<T>()` hook,  
**so that** I can declaratively fetch REST data with loading/error states and auto-refresh.

**Acceptance Criteria:**
- [ ] Хук возвращает `{ data, isLoading, error, revalidate }`
- [ ] Принимает опциональный `interval` (мс) для автоматического polling
- [ ] Поддерживает `isMockMode()` — возвращает mock data без HTTP-запросов
- [ ] При ошибке `error` содержит человекочитаемое сообщение (не raw HTTP status)
- [ ] `revalidate()` вызывает повторный fetch немедленно

---

#### SI-1-3 · Pagination support (nextPageKey)

**As a** developer working with large datasets,  
**I want** the REST client to support Dynatrace's `nextPageKey` pagination pattern,  
**so that** I can fetch full lists without manual page management.

**Acceptance Criteria:**
- [ ] `dynatraceRest` принимает опцию `paginate: true`
- [ ] При наличии `nextPageKey` в ответе автоматически делает следующий запрос
- [ ] Возвращает объединённый массив всех страниц
- [ ] Максимальный лимит страниц: 10 (защита от бесконечного цикла)

---

#### SI-1-4 · Mock mode registry для REST

**As a** developer,  
**I want** a path-based mock registry in the REST client,  
**so that** each feature can register its mock data and the client routes requests in mock mode.

**Acceptance Criteria:**
- [ ] Mock registry: `Map<string | RegExp, unknown>` для сопоставления path → mock data
- [ ] `registerMock(path, data)` API для регистрации моков из feature-файлов
- [ ] Когда `isMockMode()` = true, клиент возвращает mock без HTTP-вызова
- [ ] Если mock для пути не найден — логирует предупреждение и возвращает пустой ответ

---

### SI-2 · Davis CoPilot API Client

> **Priority:** P0 · **Effort:** 0.5 дня · **Blocker для:** A1, A2, A3

---

#### SI-2-1 · Davis API client (`src/lib/api/davis.ts`)

**As a** developer implementing Davis CoPilot features,  
**I want** a shared `src/lib/api/davis.ts` module with typed methods,  
**so that** all three Davis features (A1, A2, A3) use the same auth and error handling.

**Acceptance Criteria:**
- [ ] `convertNl2Dql(text: string): Promise<string>` — вызывает `POST /davis/v1/copilot/nl2dql`
- [ ] `explainDql(dql: string): Promise<string>` — вызывает `POST /davis/v1/copilot/dql2nl`
- [ ] `askDavis(message: string, context?: DavisContext): Promise<DavisAnswer>` — вызывает `POST /davis/v1/copilot/ask`
- [ ] При 403 (нет лицензии) выбрасывает специфическую ошибку `DavisCopilotUnavailableError`
- [ ] Mock режим: возвращает preset ответы без HTTP-вызова

**Technical Notes:**
```
src/lib/api/davis.ts
src/lib/types/davis.ts   ← DavisContext, DavisAnswer, типы ответов
src/__tests__/davis.test.ts
```

---

### SI-3 · Deep Links Utility

> **Priority:** P0 · **Effort:** 0.5 дня · **Используется:** всеми командами

---

#### SI-3-1 · Утилита `buildDeepLink()`

**As a** developer adding "Open in Dynatrace" actions,  
**I want** a `buildDeepLink(type, id, tenant)` utility in `src/lib/utils/deepLinks.ts`,  
**so that** every command generates correct deep link URLs consistently.

**Acceptance Criteria:**
- [ ] Поддерживает типы: `problem`, `trace`, `entity`, `log-query`, `slo`, `deployment`, `workflow`, `synthetic`
- [ ] Возвращает корректный URL вида `{tenantUrl}/ui/apps/{appId}/...`
- [ ] Fallback URL `{tenantUrl}/ui/` если тип не известен
- [ ] Корректное URL-encoding для special characters в entity ID
- [ ] Unit тесты покрывают все типы + edge cases

**Technical Notes:**
```
src/lib/utils/deepLinks.ts
src/__tests__/deepLinks.test.ts
```

---

## Subproject A — Customer Observability

---

### A1 · Davis CoPilot — NL2DQL

> **Priority:** P0 · **Effort:** 1-2 дня · **Depends on:** SI-1, SI-2

---

#### A1-1 · Команда `dt-nl2dql` — ввод запроса на естественном языке

**As a** Dynatrace user,  
**I want** to type a question in plain English and get a DQL query back,  
**so that** I don't need to know DQL syntax to query my data.

**Acceptance Criteria:**
- [ ] Команда `dt-nl2dql` зарегистрирована в `package.json`
- [ ] Re-export `src/dt-nl2dql.tsx` создан
- [ ] Команда добавлена в dt hub (`src/commands/dt/index.tsx`)
- [ ] TextField принимает текст запроса (placeholder: "error logs from payment service last hour")
- [ ] Кнопка "Convert" / submit запускает конвертацию
- [ ] Loading indicator пока идёт запрос к Davis

---

#### A1-2 · Отображение результата DQL в Detail view

**As a** user who converted a natural language query,  
**I want** to see the resulting DQL in a formatted Detail view,  
**so that** I can review the query before running it.

**Acceptance Criteria:**
- [ ] Результат отображается в Detail view
- [ ] DQL показан в markdown code block с подсветкой синтаксиса
- [ ] Показан оригинальный текст запроса в subtitle
- [ ] Action **"Run Query"** — push в `dt-dql-runner` с предзаполненным DQL
- [ ] Action **"Copy DQL"** — копирует в clipboard, HUD "DQL copied"
- [ ] Action **"Save as Query"** — сохраняет в saved queries

---

#### A1-3 · Обработка ошибок Davis CoPilot

**As a** user whose tenant doesn't have Davis CoPilot licensed,  
**I want** to see a clear error message instead of a crash,  
**so that** I understand what's missing and what to do.

**Acceptance Criteria:**
- [ ] При 403 (нет лицензии): HUD "Davis CoPilot requires a Platform Subscription"
- [ ] При 429 (rate limit): HUD "Rate limit exceeded, please wait..."
- [ ] При сетевой ошибке: Toast с кнопкой "Retry"
- [ ] Mock mode: возвращает хардкоженный DQL для 5+ тестовых фраз

---

### A2 · Davis CoPilot — DQL2NL (Explain Query)

> **Priority:** P0 · **Effort:** 1 день · **Depends on:** SI-2 (A1)

---

#### A2-1 · Action "Explain Query" в Saved Queries

**As a** user looking at a saved DQL query,  
**I want** to press "Explain Query" and get a plain-language description,  
**so that** I understand what an unfamiliar query does without running it.

**Acceptance Criteria:**
- [ ] Action "Explain Query" добавлен в `src/commands/saved-queries/index.tsx`
- [ ] Объяснение открывается в Detail view с markdown форматированием
- [ ] Loading state с анимацией пока Davis обрабатывает
- [ ] Action "Copy Explanation" — копирует текст

---

#### A2-2 · Action "Explain Query" в DQL Runner

**As a** developer who just ran a complex DQL query,  
**I want** to press "Explain" in the DQL Runner,  
**so that** I can understand what the query is doing and share it with teammates.

**Acceptance Criteria:**
- [ ] Action "Explain Query" добавлен в `src/commands/dql-runner/index.tsx`
- [ ] Использует тот же `explainDql()` из `src/lib/api/davis.ts`
- [ ] Доступен только когда есть активный DQL в поле ввода
- [ ] Mock mode: возвращает описание для 3+ тестовых DQL

---

### A3 · Davis CoPilot — Chat

> **Priority:** P1 · **Effort:** 5-7 дней · **Depends on:** SI-2 (A1)

---

#### A3-1 · Команда `dt-ask` — задать вопрос Davis

**As an** on-call engineer during an incident,  
**I want** to ask Davis "What's wrong with order-service?" in natural language,  
**so that** I get an AI-powered diagnosis without opening the Dynatrace browser UI.

**Acceptance Criteria:**
- [ ] Команда `dt-ask` зарегистрирована в `package.json`
- [ ] Re-export `src/dt-ask.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] TextField для вопроса с placeholder "What's wrong with payment-service?"
- [ ] Optional Dropdown для entity context (service/environment)
- [ ] Ответ отображается в Detail view с markdown

---

#### A3-2 · Sources и контекст в ответе Davis

**As a** user reading a Davis answer,  
**I want** to see the data sources Davis used to form its answer,  
**so that** I can trust the response and drill down into the raw data.

**Acceptance Criteria:**
- [ ] Sources (если есть в ответе) отображаются как отдельная секция в markdown
- [ ] Каждый source кликабельен — Action "Open Source" открывает deep link
- [ ] При пустом ответе показывается "Davis couldn't find relevant data for this question"

---

#### A3-3 · Conversation history (follow-up questions)

**As a** user in the middle of a diagnostic session,  
**I want** to ask follow-up questions that reference my previous messages,  
**so that** I can have a real back-and-forth diagnostic conversation.

**Acceptance Criteria:**
- [ ] История чата хранится в session state (`useState`)
- [ ] При каждом запросе история передаётся в API payload
- [ ] Action "Clear Conversation" сбрасывает историю
- [ ] Не сохраняется между сессиями Raycast (не в LocalStorage)

---

#### A3-4 · Mock mode и тестовые пары вопрос-ответ

**As a** developer running in mock mode,  
**I want** the chat command to return realistic mock answers,  
**so that** I can develop and test the UI without a real Davis CoPilot license.

**Acceptance Criteria:**
- [ ] Mock mode: минимум 5 пар вопрос-ответ в `src/lib/api/mock.ts`
- [ ] Mock ответы содержат markdown, sources, разную длину
- [ ] Content sniffing по ключевым словам в вопросе (error, slow, latency, deployment)

---

### A4 · SLO Dashboard

> **Priority:** P0 · **Effort:** 2-3 дня · **Depends on:** SI-1

---

#### A4-1 · Команда `dt-slo` — список всех SLO

**As an** SRE,  
**I want** to see all my SLOs with current compliance percentage and error budget,  
**so that** I can quickly assess service health without opening the browser.

**Acceptance Criteria:**
- [ ] Команда `dt-slo` зарегистрирована в `package.json`
- [ ] Re-export `src/dt-slo.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] List view: название SLO, compliance % (accessories), error budget remaining %
- [ ] Search по имени SLO
- [ ] Данные загружаются через `useDynatraceRest` (GET `/api/v2/slo`)

**Technical Notes:**
```
src/commands/slo/index.tsx
src/dt-slo.tsx
src/lib/types/slo.ts   ← SLO type + Zod schema
```

---

#### A4-2 · Цветовая индикация статуса SLO

**As an** SRE scanning the SLO list,  
**I want** color-coded status indicators (green/yellow/red),  
**so that** I can spot violations at a glance without reading numbers.

**Acceptance Criteria:**
- [ ] `compliance >= target` → зелёный (Color.Green)
- [ ] `compliance >= warning && compliance < target` → жёлтый (Color.Yellow)
- [ ] `compliance < warning` → красный (Color.Red)
- [ ] Status dot отображается как Icon в List.Item accessories
- [ ] Unit тест для threshold comparison logic

---

#### A4-3 · Detail view для SLO

**As a** user who wants to understand an SLO better,  
**I want** to see full SLO details on click,  
**so that** I can understand its target, timeframe, and metric definition.

**Acceptance Criteria:**
- [ ] Detail view: target %, warning threshold, timeframe, metric expression/DQL definition
- [ ] Текущий evaluated value с датой последней оценки
- [ ] Action **"Evaluate Now"** → POST `/api/v2/slo/{id}/evaluate` → refresh list
- [ ] Action **"Open in Dynatrace"** → deep link через `buildDeepLink("slo", id, tenant)`
- [ ] Action **"Copy SLO ID"**

**Technical Notes:**
```
src/commands/slo/slo-detail.tsx
```

---

#### A4-4 · Mock data для SLO

**As a** developer working in mock mode,  
**I want** realistic SLO mock data covering all statuses,  
**so that** I can test the UI without a real tenant.

**Acceptance Criteria:**
- [ ] Минимум 5 SLO в `src/lib/api/mock.ts`: 2 OK, 1 WARNING, 2 FAILED
- [ ] Mock data содержит все поля схемы (`compliance`, `target`, `warning`, `errorBudget`, `timeframe`)
- [ ] Zod-схема из `slo.ts` валидирует mock data без ошибок

---

### A5 · SLO Menubar

> **Priority:** P1 · **Effort:** 1-2 дня · **Depends on:** A4

---

#### A5-1 · Menubar команда `dt-menubar-slo`

**As an** SRE,  
**I want** to see the count of violated SLOs in my macOS menubar,  
**so that** I'm alerted to SLO issues without actively checking Raycast.

**Acceptance Criteria:**
- [ ] Menu-bar команда `dt-menubar-slo` зарегистрирована с `interval: "5m"`
- [ ] Иконка показывает число нарушенных SLO
- [ ] 0 нарушений → зелёная галочка `✓`
- [ ] 1+ FAILED → красный счётчик
- [ ] 1+ WARNING, 0 FAILED → жёлтый счётчик
- [ ] Re-export `src/dt-menubar-slo.tsx` создан

**Technical Notes:**
```
src/commands/menubar-slo/index.tsx   ← MenuBarExtra component
src/dt-menubar-slo.tsx
```

---

#### A5-2 · Dropdown список проблемных SLO из menubar

**As a** user who clicked the SLO menubar icon,  
**I want** to see a list of violated SLOs inline,  
**so that** I can identify which SLOs are failing without opening the full command.

**Acceptance Criteria:**
- [ ] Клик на menubar → выпадающий список нарушенных SLO с % compliance
- [ ] Каждый SLO item: имя, compliance %, цветной статус
- [ ] Action **"Open SLO Dashboard"** → push в `dt-slo`
- [ ] Action **"Open in Dynatrace"** → deep link

---

### A6 · Metrics Explorer

> **Priority:** P1 · **Effort:** 3-4 дня · **Depends on:** SI-1

---

#### A6-1 · Команда `dt-metrics` — список и поиск метрик

**As an** engineer investigating a performance issue,  
**I want** to search available metrics by name,  
**so that** I can find the right metric without knowing its exact selector string.

**Acceptance Criteria:**
- [ ] Команда `dt-metrics` зарегистрирована
- [ ] Re-export `src/dt-metrics.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] Поиск по имени метрики (GET `/api/v2/metrics?metricSelector=...`)
- [ ] Preset метрики на главном экране: CPU %, Memory %, Response Time, Error Rate, Throughput
- [ ] Dropdown для выбора entity (service/host)

**Technical Notes:**
```
src/commands/metrics/index.tsx
src/dt-metrics.tsx
src/lib/types/metric.ts   ← Metric, DataPoint types
```

---

#### A6-2 · Detail view метрики с агрегацией и трендом

**As an** engineer looking at a metric,  
**I want** to see current value, min/max/avg, and a visual trend,  
**so that** I can understand the metric's behavior over time at a glance.

**Acceptance Criteria:**
- [ ] Detail view: текущее значение с unit (ms, %, bytes)
- [ ] Aggregation: min / max / avg за выбранный timeframe
- [ ] ASCII sparkline или тренд-метка ("↑ 15% vs 1h ago")
- [ ] Dropdown timeframe: Last 1h / 6h / 24h / 7d
- [ ] Unit formatting: ms → s если >1000ms, bytes → GB если >1e9

**Technical Notes:**
```
src/commands/metrics/metric-detail.tsx
src/lib/utils/sparkline.ts   ← ASCII sparkline generator
```

---

#### A6-3 · Mock data и unit тесты для Metrics

**As a** developer,  
**I want** unit tests for sparkline generation and metric calculations,  
**so that** the aggregation and formatting logic is reliable.

**Acceptance Criteria:**
- [ ] Mock data: 5 метрик с реалистичными data points в `src/lib/api/mock.ts`
- [ ] Unit тест: sparkline generation из массива data points
- [ ] Unit тест: min/max/avg calculation
- [ ] Unit тест: unit formatting (ms→s, bytes→GB, % без изменений)

---

### A7 · Synthetic Monitors

> **Priority:** P1 · **Effort:** 2-3 дня · **Depends on:** SI-1

---

#### A7-1 · Команда `dt-synthetics` — список мониторов

**As a** user responsible for uptime,  
**I want** to see all synthetic monitors with their current status,  
**so that** I can immediately spot failing checks.

**Acceptance Criteria:**
- [ ] Команда `dt-synthetics` зарегистрирована
- [ ] Re-export `src/dt-synthetics.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] List: имя монитора, тип (HTTP/Browser), статус (🟢/🔴), availability %, avg response time
- [ ] Dropdown фильтр по типу: All / HTTP / Browser / Third-party
- [ ] Данные из GET `/api/v2/synthetic/monitors`

**Technical Notes:**
```
src/commands/synthetics/index.tsx
src/dt-synthetics.tsx
src/lib/types/synthetic.ts   ← Monitor, Execution types
```

---

#### A7-2 · Detail view монитора с результатами по локациям

**As a** user investigating a failing synthetic,  
**I want** to see results broken down by location,  
**so that** I can determine if the issue is geographic or global.

**Acceptance Criteria:**
- [ ] Detail view: URL, schedule (interval), locations list
- [ ] Per-location результаты последнего execution: статус, response time, error (если есть)
- [ ] Action **"Execute Now"** (POST к execution endpoint, если доступно)
- [ ] Action **"Open in Dynatrace"** → deep link

**Technical Notes:**
```
src/commands/synthetics/monitor-detail.tsx
```

---

#### A7-3 · Mock data для Synthetic Monitors

**As a** developer in mock mode,  
**I want** realistic synthetic monitor mock data,  
**so that** I can test both OK and FAILED states in the UI.

**Acceptance Criteria:**
- [ ] Минимум 4 монитора в mock.ts: 2 OK, 1 FAILED, 1 с частичными сбоями
- [ ] Mix типов: HTTP и Browser мониторы
- [ ] Mock execution results с per-location breakdown
- [ ] Availability % calculation протестирован unit-тестом

---

### A8 · Quick Status Dashboard

> **Priority:** P2 · **Effort:** 3-5 дней · **Depends on:** A4, A7

---

#### A8-1 · Команда `dt-status` — сводный health check

**As an** SRE starting their morning,  
**I want** to open one command and see a complete health summary,  
**so that** I know the state of my systems in under 10 seconds.

**Acceptance Criteria:**
- [ ] Команда `dt-status` зарегистрирована и добавлена в dt hub **первым пунктом**
- [ ] Detail view с markdown-formatted summary
- [ ] Секции: **Problems** (count by severity), **SLOs** (violations), **Synthetics** (failing), **Recent Deployments** (last 3)
- [ ] Все данные загружаются параллельно через `Promise.allSettled`
- [ ] "Last checked: 2 min ago" timestamp

**Technical Notes:**
```
src/commands/status/index.tsx
src/dt-status.tsx
```

---

#### A8-2 · Graceful degradation при недоступности API

**As a** user on a flaky connection,  
**I want** the status dashboard to show partial data when some APIs fail,  
**so that** I still see whatever information is available.

**Acceptance Criteria:**
- [ ] Если один API недоступен → секция показывает "Unavailable" вместо crash
- [ ] Другие секции продолжают отображаться корректно
- [ ] Unit тест: `Promise.allSettled` с одним rejected promise

---

#### A8-3 · Навигация из Status Dashboard

**As a** user who sees an issue in the status summary,  
**I want** to click on a section and navigate to the detailed view,  
**so that** I can investigate without leaving Raycast.

**Acceptance Criteria:**
- [ ] Клик на секцию Problems → push в `dt-problems`
- [ ] Клик на секцию SLOs → push в `dt-slo`
- [ ] Клик на секцию Synthetics → push в `dt-synthetics`
- [ ] Auto-refresh каждые 60 секунд

---

### A9 · Release Health / Version Comparison

> **Priority:** P2 · **Effort:** 3-4 дня · **Depends on:** existing deployments command

---

#### A9-1 · Action "Compare Release" в `dt-deployments`

**As a** developer who just deployed a new version,  
**I want** to compare error rate and latency before and after the deployment,  
**so that** I can quickly detect regressions without opening Dynatrace.

**Acceptance Criteria:**
- [ ] Action **"Compare Release"** добавлен в `src/commands/deployments/`
- [ ] Form: service name, current version (auto-detected из deployment), previous version, timeframe
- [ ] 2 параллельных DQL запроса: до и после деплоя
- [ ] Результат в Detail view: side-by-side comparison в markdown table

**Technical Notes:**
```
src/commands/deployments/release-compare.tsx
src/lib/utils/releaseHealth.ts
src/__tests__/releaseHealth.test.ts
```

---

#### A9-2 · Цветовая индикация regression / improvement

**As a** developer reading release comparison,  
**I want** color indicators for regressions and improvements,  
**so that** I can instantly see if the release degraded performance.

**Acceptance Criteria:**
- [ ] Delta > +5% errors или latency → красный 🔴 "Regression"
- [ ] Delta < -5% errors или latency → зелёный 🟢 "Improvement"
- [ ] |delta| ≤ 5% → серый "Neutral"
- [ ] Unit тест для delta calculation и threshold logic
- [ ] Fallback если нет version data: сравнение по timeframe (last 1h vs previous 1h)

---

### A10 · App Intents — Deep Links

> **Priority:** P0 · **Effort:** 1-2 дня · **Depends on:** SI-3

---

#### A10-1 · Action "Open in Dynatrace" во все существующие команды

**As a** user working in any Raycast command,  
**I want** an "Open in Dynatrace" action available everywhere,  
**so that** I can jump to the exact Dynatrace UI screen with one keypress.

**Acceptance Criteria:**
- [ ] Action **"Open in Dynatrace"** добавлен во ВСЕ существующие команды:
  - `dt-problems`, `dt-logs`, `dt-traces`, `dt-entities`, `dt-deployments`, `dt-saved-queries`, `dt-dql-runner`
- [ ] Использует `buildDeepLink()` из `src/lib/utils/deepLinks.ts`
- [ ] `openInBrowser()` с корректным URL
- [ ] Горячая клавиша: `Cmd+Shift+O`

---

#### A10-2 · Deep links для новых команд

**As a** user in any new command (SLO, Workflows, Synthetics, etc.),  
**I want** to be able to open the relevant item in Dynatrace browser UI,  
**so that** I can access advanced features not available in Raycast.

**Acceptance Criteria:**
- [ ] Deep link поддержка для: SLO, Workflow, Synthetic Monitor, Settings Object, Maintenance Window
- [ ] Каждый новый тип зарегистрирован в `buildDeepLink()`
- [ ] Unit тест для URL generation каждого типа
- [ ] URL encoding работает для entity IDs со специальными символами

---

### A11 · Query Templates Library

> **Priority:** P2 · **Effort:** 1-2 дня · **Depends on:** нет

---

#### A11-1 · Browse Templates в DQL Runner

**As a** Dynatrace beginner,  
**I want** to browse a library of pre-built DQL templates,  
**so that** I can run common queries without knowing DQL syntax.

**Acceptance Criteria:**
- [ ] Action **"Browse Templates"** в `dt-dql-runner`
- [ ] 10+ шаблонов по категориям: Logs, Problems, Traces, Metrics, K8s
- [ ] Каждый шаблон: имя, описание, категория, DQL с параметрами
- [ ] Клик → Form для заполнения параметров (service name, timeframe, namespace)

**Technical Notes:**
```
src/lib/queryTemplates.ts        ← шаблоны как TS объект
src/commands/dql-runner/templates.tsx
src/__tests__/queryTemplates.test.ts
```

---

#### A11-2 · Run и Save шаблона

**As a** user who configured a template,  
**I want** to run it directly or save it for later,  
**so that** I can either get immediate results or build my saved queries library.

**Acceptance Criteria:**
- [ ] Action **"Run"** → push в DQL Runner с подставленными параметрами
- [ ] Action **"Save as Query"** → сохраняет в saved queries с именем шаблона
- [ ] Template parameter substitution: `{{service_name}}` → значение из Form
- [ ] Unit тест: parameter substitution для каждого шаблона
- [ ] Unit тест: все шаблоны генерируют синтаксически валидный DQL

---

## Subproject B — Platform & Engineering

---

### B1 · Workflows — List & Execute

> **Priority:** P0 · **Effort:** 5-7 дней · **Depends on:** SI-1

---

#### B1-1 · Команда `dt-workflows` — список workflows

**As an** engineer,  
**I want** to see all Dynatrace workflows with their trigger type and last execution status,  
**so that** I know what automations are configured and their current state.

**Acceptance Criteria:**
- [ ] Команда `dt-workflows` зарегистрирована в `package.json`
- [ ] Re-export `src/dt-workflows.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] List: название, trigger type icon (⏰ schedule / ⚡ event / 👆 manual), owner, last execution status
- [ ] Search по имени workflow
- [ ] Dropdown фильтр по owner и trigger type

**Technical Notes:**
```
src/commands/workflows/index.tsx
src/dt-workflows.tsx
src/lib/types/workflow.ts   ← Workflow, Execution types + Zod
```

---

#### B1-2 · Detail view workflow с историей запусков

**As a** user looking at a workflow,  
**I want** to see its configuration and recent execution history,  
**so that** I understand what it does and whether it's been running successfully.

**Acceptance Criteria:**
- [ ] Detail view: описание, trigger configuration, input parameters schema
- [ ] Последние 5 executions: статус (✅/❌/⏳), timestamp, duration
- [ ] Action **"Open in Dynatrace"** → deep link

**Technical Notes:**
```
src/commands/workflows/workflow-detail.tsx
```

---

#### B1-3 · Execute workflow без параметров

**As an** on-call engineer,  
**I want** to trigger a remediation workflow with one click,  
**so that** I can start automated fixes immediately during an incident.

**Acceptance Criteria:**
- [ ] Action **"Execute"** для workflow без input parameters
- [ ] Confirmation dialog: "Run {workflow name}?"
- [ ] POST `/platform/automation/v1/workflows/{id}/run`
- [ ] HUD "Started execution: {executionId}" после успешного запуска
- [ ] Начинает polling статуса каждые 3 секунды, пока RUNNING

---

#### B1-4 · Execute workflow с параметрами

**As an** engineer running a workflow that needs input,  
**I want** to fill in input parameters via a form,  
**so that** I can provide the right context for the workflow execution.

**Acceptance Criteria:**
- [ ] Если workflow имеет input parameters schema → Form с полями
- [ ] Типы полей: text, number, boolean (Checkbox), dropdown (если enum)
- [ ] Required поля помечены, форма не отправляется без них
- [ ] POST с `{ input: { ...formValues } }` в body
- [ ] Unit тест: маппинг JSON Schema → Form fields

---

#### B1-5 · Mock mode для Workflows

**As a** developer,  
**I want** realistic workflow mock data,  
**so that** I can develop and test all UI states without an Automation license.

**Acceptance Criteria:**
- [ ] Минимум 4 workflows в mock.ts: manual, scheduled, event-triggered, с параметрами
- [ ] Каждый workflow имеет mock execution history
- [ ] Mock mode поддерживает simulate execution: возвращает fake executionId

---

### B2 · Workflow Executions — History & Logs

> **Priority:** P1 · **Effort:** 3-4 дня · **Depends on:** B1

---

#### B2-1 · Task breakdown для execution

**As an** engineer investigating a failed workflow,  
**I want** to see per-task breakdown with status and error messages,  
**so that** I can pinpoint exactly which step failed and why.

**Acceptance Criteria:**
- [ ] Клик на execution → task breakdown detail
- [ ] Каждый task: статус icon (✅/❌/⏳/⏸), имя, duration, error message
- [ ] Error message показывается полностью (scrollable)
- [ ] GET `/platform/automation/v1/executions/{id}/tasks`

**Technical Notes:**
```
src/commands/workflows/execution-detail.tsx
src/commands/workflows/executions-list.tsx
```

---

#### B2-2 · Cancel и Re-run execution

**As a** user who sees a stuck or failed execution,  
**I want** to cancel it or re-run it with the same parameters,  
**so that** I can quickly recover without navigating to the browser UI.

**Acceptance Criteria:**
- [ ] Action **"Cancel Execution"** для RUNNING executions → PATCH с cancel request → HUD "Cancelled"
- [ ] Action **"Re-run"** для FAILED/SUCCEEDED → POST с теми же parameters
- [ ] Pagination для истории (nextPageKey)
- [ ] Unit тест: cancel и re-run API call construction

---

### B3 · Settings / Config Management

> **Priority:** P1 · **Effort:** 2-3 дня · **Depends on:** SI-1

---

#### B3-1 · Команда `dt-settings` — поиск settings objects

**As a** platform engineer,  
**I want** to search Dynatrace settings by name and type,  
**so that** I can quickly check if a specific configuration exists without opening the UI.

**Acceptance Criteria:**
- [ ] Команда `dt-settings` зарегистрирована
- [ ] Re-export `src/dt-settings.tsx` создан
- [ ] Команда добавлена в dt hub
- [ ] Dropdown по типу schema: Alerting Profiles, Management Zones, Auto-Tags, Maintenance Windows
- [ ] Search по имени объекта
- [ ] List: name, schema type, scope, last modified

**Technical Notes:**
```
src/commands/settings/index.tsx
src/dt-settings.tsx
src/lib/types/settings.ts
```

---

#### B3-2 · Detail view settings object с JSON

**As a** platform engineer inspecting a setting,  
**I want** to see the full JSON definition,  
**so that** I can audit the configuration details.

**Acceptance Criteria:**
- [ ] Detail view: JSON definition в markdown code block
- [ ] Action **"Copy JSON"** → clipboard
- [ ] Action **"Copy Object ID"** → clipboard, HUD "ID copied"
- [ ] Action **"Open in Dynatrace"** → deep link

**Technical Notes:**
```
src/commands/settings/setting-detail.tsx
```

---

### B4 · Maintenance Windows

> **Priority:** P1 · **Effort:** 2 дня · **Depends on:** SI-1

---

#### B4-1 · Список maintenance windows

**As a** DevOps engineer,  
**I want** to see all maintenance windows with their status and schedule,  
**so that** I can check whether a maintenance window is active before investigating an alert.

**Acceptance Criteria:**
- [ ] Команда `dt-maintenance` зарегистрирована (или секция в `dt-settings`)
- [ ] List: имя, тип (PLANNED/ONE_TIME/RECURRING), start/end time, status (ACTIVE/SCHEDULED/PAST)
- [ ] Сортировка: ACTIVE сначала → SCHEDULED → PAST
- [ ] Status determination по времени: unit тест обязателен

**Technical Notes:**
```
src/commands/maintenance/index.tsx
src/dt-maintenance.tsx
src/lib/types/maintenance.ts
```

---

#### B4-2 · Создание maintenance window

**As a** DevOps engineer before a release,  
**I want** to create a maintenance window in under 30 seconds,  
**so that** alerts are suppressed during planned downtime.

**Acceptance Criteria:**
- [ ] Action **"Create"** → Form с полями: name, type (ONE_TIME/RECURRING), start datetime, end datetime, scope
- [ ] Scope варианты: All environment / Management Zone / Specific entity
- [ ] Toggle "Suppress alerting"
- [ ] POST `/api/v2/settings/objects` с корректным schema ID
- [ ] HUD "Maintenance window created" + refresh list

---

#### B4-3 · Удаление maintenance window

**As a** user who created a maintenance window by mistake,  
**I want** to delete a scheduled window,  
**so that** alerts are not accidentally suppressed.

**Acceptance Criteria:**
- [ ] Action **"Delete"** для SCHEDULED и PAST окон (не для ACTIVE?)
- [ ] Confirmation alert: "Delete '{name}'? This cannot be undone."
- [ ] DELETE request → HUD "Deleted" → refresh list
- [ ] ACTIVE окна: Action "End Now" вместо Delete (optional, P2)

---

### B5 · Notifications Viewer

> **Priority:** P2 · **Effort:** 1-2 дня · **Depends on:** SI-1

---

#### B5-1 · Команда `dt-notifications`

**As a** platform engineer,  
**I want** to see platform-level notifications (integration failures, config warnings),  
**so that** I can address system health issues without checking the browser UI.

**Acceptance Criteria:**
- [ ] Команда `dt-notifications` зарегистрирована (или Action в dt-status)
- [ ] List: тип, статус, timestamp, message preview
- [ ] Auto-refresh каждые 60 секунд
- [ ] Action **"Dismiss"** → DELETE `/api/v2/notifications/{id}` → убирает из списка

**Technical Notes:**
```
src/commands/notifications/index.tsx
src/dt-notifications.tsx
src/lib/types/notification.ts
```

---

### B6 · Ownership / Team Lookup

> **Priority:** P2 · **Effort:** 1-2 дня · **Depends on:** SI-1

---

#### B6-1 · "Who Owns This?" в `dt-entities` и `dt-problems`

**As an** on-call engineer during an incident,  
**I want** to see the owner team and contact info for any service or problem,  
**so that** I can escalate to the right team without searching through wikis.

**Acceptance Criteria:**
- [ ] Action **"Who Owns This?"** добавлен в `dt-entities` и `dt-problems`
- [ ] Detail view: team name, contacts (email, Slack handle), responsible person
- [ ] GET `/api/v2/settings/objects?schemaIds=builtin:ownership.teams`

**Technical Notes:**
```
src/commands/ownership/index.tsx
src/dt-ownership.tsx
src/lib/types/ownership.ts
```

---

#### B6-2 · Standalone поиск ownership

**As a** user who knows a service name but doesn't have it open,  
**I want** a standalone `dt-ownership` command to search by service name,  
**so that** I can find the owner directly.

**Acceptance Criteria:**
- [ ] Search Field для ввода service name
- [ ] List: service/entity name, owning team, primary contact
- [ ] Пустое состояние: "No ownership configured for this service"
- [ ] Mock mode: 3+ teams с разными сервисами

---

### B7 · Extensions Browser

> **Priority:** P2 · **Effort:** 1-2 дня · **Depends on:** SI-1

---

#### B7-1 · Команда `dt-extensions`

**As a** platform engineer,  
**I want** to see all installed Extensions 2.0 with versions and monitoring config counts,  
**so that** I can verify the right extensions are installed at the right versions.

**Acceptance Criteria:**
- [ ] Команда `dt-extensions` зарегистрирована
- [ ] List: name, version, author, monitoring configurations count
- [ ] Detail: description, monitoring configurations list с статусами (GET `.../monitoringConfigurations`)
- [ ] Action **"Open in Extension Hub"** → deep link
- [ ] Mock mode: 4+ extensions

**Technical Notes:**
```
src/commands/extensions/index.tsx
src/dt-extensions.tsx
src/lib/types/extension.ts
```

---

### B8 · Live Debugger — Breakpoints

> **Priority:** P2 · **Effort:** 4-5 дней · **Depends on:** SI-1

---

#### B8-1 · Команда `dt-debugger` — список breakpoints

**As a** developer using Dynatrace Live Debugger,  
**I want** to see all active non-breaking breakpoints with their hit counts,  
**so that** I can monitor debugging sessions without switching to the browser.

**Acceptance Criteria:**
- [ ] Команда `dt-debugger` зарегистрирована
- [ ] List: file path, line number, condition (если есть), hit count, enabled/disabled
- [ ] Toggle icon: 🟢 (enabled) / ⚫ (disabled)

**Technical Notes:**
```
src/commands/debugger/index.tsx
src/dt-debugger.tsx
src/lib/types/debugger.ts   ← Breakpoint, Snapshot types
```

---

#### B8-2 · Create / Toggle / Delete breakpoint

**As a** developer,  
**I want** to create, enable/disable, and delete breakpoints from Raycast,  
**so that** I can manage debugging sessions without leaving my editor workflow.

**Acceptance Criteria:**
- [ ] Action **"Create Breakpoint"** → Form: file path, line number, condition (optional), workspace filter
- [ ] Action **"Toggle Enabled"** → PATCH `{ enabled: !current }` → refresh
- [ ] Action **"Delete"** → DELETE → HUD "Breakpoint removed"
- [ ] Detail view: captured variable snapshots (последние значения)

---

### B9 · Filter Segments

> **Priority:** P2 · **Effort:** 1-2 дня · **Depends on:** SI-1

---

#### B9-1 · Filter segment picker в DQL Runner и Search Logs

**As a** user who needs to scope queries to a specific environment,  
**I want** to select a filter segment in DQL Runner or Log Search,  
**so that** my queries automatically apply data access restrictions.

**Acceptance Criteria:**
- [ ] Dropdown picker для filter segments добавлен в `dt-dql-runner`
- [ ] Dropdown picker добавлен в `dt-search-logs`
- [ ] Выбранный segment UID передаётся в query payload
- [ ] GET `/platform/storage/filter-segments/v1/filter-segments`
- [ ] "No segment" — дефолтный вариант (без ограничений)
- [ ] Mock mode: 2+ segments с описаниями

**Technical Notes:**
```
src/lib/types/filterSegment.ts
src/commands/dql-runner/index.tsx   ← добавить segment picker
src/commands/search-logs/index.tsx  ← добавить segment picker
```

---

## Сводная таблица сторис

| Story | Feature | Priority | Effort |
|-------|---------|----------|--------|
| SI-1-1 | REST helper | P0 | 0.5d |
| SI-1-2 | useDynatraceRest hook | P0 | 0.25d |
| SI-1-3 | Pagination support | P0 | 0.25d |
| SI-1-4 | Mock registry | P0 | 0.25d |
| SI-2-1 | Davis API client | P0 | 0.5d |
| SI-3-1 | buildDeepLink utility | P0 | 0.5d |
| A1-1 | NL2DQL команда | P0 | 0.5d |
| A1-2 | NL2DQL Detail view | P0 | 0.5d |
| A1-3 | NL2DQL error handling | P0 | 0.25d |
| A2-1 | Explain в Saved Queries | P0 | 0.5d |
| A2-2 | Explain в DQL Runner | P0 | 0.5d |
| A3-1 | Davis Chat команда | P1 | 1d |
| A3-2 | Davis Chat sources | P1 | 0.5d |
| A3-3 | Conversation history | P1 | 1d |
| A3-4 | Davis Chat mock | P1 | 0.5d |
| A4-1 | SLO список | P0 | 0.5d |
| A4-2 | SLO цвета | P0 | 0.25d |
| A4-3 | SLO detail | P0 | 0.5d |
| A4-4 | SLO mock | P0 | 0.25d |
| A5-1 | SLO Menubar команда | P1 | 0.5d |
| A5-2 | SLO Menubar dropdown | P1 | 0.5d |
| A6-1 | Metrics список | P1 | 1d |
| A6-2 | Metrics detail + sparkline | P1 | 1d |
| A6-3 | Metrics tests | P1 | 0.5d |
| A7-1 | Synthetics список | P1 | 0.5d |
| A7-2 | Synthetics detail | P1 | 0.5d |
| A7-3 | Synthetics mock | P1 | 0.25d |
| A8-1 | Status Dashboard | P2 | 1d |
| A8-2 | Status graceful degradation | P2 | 0.5d |
| A8-3 | Status навигация | P2 | 0.5d |
| A9-1 | Release compare action | P2 | 1d |
| A9-2 | Release color indicators | P2 | 0.5d |
| A10-1 | Deep links existing cmds | P0 | 1d |
| A10-2 | Deep links new cmds | P0 | 0.5d |
| A11-1 | Templates browse | P2 | 0.5d |
| A11-2 | Templates run/save | P2 | 0.5d |
| B1-1 | Workflows список | P0 | 1d |
| B1-2 | Workflows detail | P0 | 1d |
| B1-3 | Execute без params | P0 | 1d |
| B1-4 | Execute с params Form | P0 | 1d |
| B1-5 | Workflows mock | P0 | 0.5d |
| B2-1 | Execution task breakdown | P1 | 1d |
| B2-2 | Cancel и Re-run | P1 | 1d |
| B3-1 | Settings список | P1 | 0.5d |
| B3-2 | Settings detail JSON | P1 | 0.5d |
| B4-1 | Maintenance список | P1 | 0.5d |
| B4-2 | Maintenance create | P1 | 0.5d |
| B4-3 | Maintenance delete | P1 | 0.25d |
| B5-1 | Notifications viewer | P2 | 0.5d |
| B6-1 | Who Owns This action | P2 | 0.5d |
| B6-2 | Ownership search | P2 | 0.5d |
| B7-1 | Extensions browser | P2 | 0.5d |
| B8-1 | Debugger список | P2 | 1d |
| B8-2 | Debugger CRUD | P2 | 1d |
| B9-1 | Filter Segments picker | P2 | 0.5d |

---

*Сгенерировано на основе EPIC2.0.md · April 29, 2026*
