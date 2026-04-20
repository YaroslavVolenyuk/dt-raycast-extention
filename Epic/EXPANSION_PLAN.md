# План расширения Raycast-расширения Dynatrace

## 1. Анализ текущего состояния

### Что уже есть
- Одна команда `dt` — **Search Logs**: запрашивает Grail через `POST /platform/storage/query/v1/query:execute`, фильтрует по уровню лога и таймфрейму.
- Аргументы команды: `timeframeValue` (число), `timeframeUnit` (`h`/`m`/`d`), `query` (уровень лога).
- Preferences: `dynatraceEndpoint`, `dynatraceToken`, `useMockData`.
- **List view** (`src/dt.tsx`):
  - иконка и цвет тега по `loglevel`;
  - dropdown фильтра по `service.name` / `dt.app.name` (появляется при ≥ 2 сервисах);
  - персистентность последнего таймфрейма и выбранного сервиса через `LocalStorage`;
  - empty / error states, retry action.
- **Detail view** (`src/log-detail-view.tsx`):
  - структурированные секции (Log Info, Service/Process, Infrastructure, K8s, Pipeline, Telemetry);
  - deep-link в Dynatrace Logs (± 60 с), в Distributed Tracing Explorer (по `trace_id`, наносекундный `tt`);
  - DQL-фильтр на конкретную запись + Copy to Clipboard.
- **Mock mode** (`fakeDB/dql.ts`) с отдельным путём в `useDynatraceQuery`, что сильно ускоряет разработку.
- Типы (`src/types/log.ts`) покрывают основные Grail-поля.

### Сильные стороны
- Чистая декомпозиция: хук + утилиты + типы + вьюхи — легко расширять.
- Хороший UX деталки: секции скрываются, если нет данных; цветовая сигнализация статусов.
- Product-grade ошибки: токен/HTML-редирект отдельно обрабатывается, есть retry.
- Персистентность фильтров между запусками.

### Проблемы и технический долг
1. **Нет отмены предыдущего запроса** — при быстрой смене фильтров возможна гонка (позднейший запрос перезаписывается более ранним).
2. **Нет пагинации / load more** — жёсткий `limit 50` в `buildDqlQuery`. Grail может вернуть десятки тысяч записей, а дропдаун сервисов строится только по загруженным 50.
3. **Дубликат типов**: `GrailRecord` в `dql/dql.ts` и `LogRecord` в `src/types/log.ts` описывают одно и то же, а `GrailResponse` из `dql/dql.ts` нигде не используется в коде хука.
4. **Фильтр по сервису — только клиентский** (по уже загруженным 50 записям). Для реального use-case он должен быть параметром DQL-запроса.
5. **Нет свободного текстового поиска / ключевого слова в контенте** — Raycast ищет только по `title`/`subtitle`, а не по массиву `log.content`.
6. **Timeframe-конфликт UX**: аргумент команды перезаписывает сохранённый `dt_last_timeframe`, но при пустом аргументе восстанавливается — и при этом сразу же перезаписывается в effect на тот же `timeframe`. Можно сократить до одного источника истины.
7. **Нет поддержки пользовательского DQL** — опытный инженер не может выполнить свой запрос.
8. **Нет кеширования** (нет `useCachedPromise` из `@raycast/utils`), каждый вход в команду — новый round-trip.
9. **Токен — обычный preference, без валидации** и без OAuth-flow. При `401` пользователь видит абстрактную ошибку.
10. **Один CHANGELOG.md с placeholder'ом, пустой README.md** — блокер для публикации в Raycast Store.
11. **Windows vs macOS** — `platforms` содержит обе, но файловые логи и `open URL` могут вести себя иначе; не проверено.
12. **Assets**: в репозитории и `extension-icon.png`, и `dynatrace-icon.png` — один лишний.

---

## 2. Направления расширения

Разобьём по осям: новые команды, улучшения поиска, детали лога, UX/производительность, интеграции и DX.

### 2.1. Новые команды (основная ось роста)

| Команда | Суть | Primary API | Ценность |
|---|---|---|---|
| `problems` — **Active Problems** | Список текущих проблем Davis (severity, entity, duration) | `fetch dt.davis.problems` или Problems API v2 | Моментальный interrupt-driven мониторинг |
| `entities` — **Find Entity** | Поиск сервиса/хоста/процесса по имени, deep-link | `fetch dt.entity.*` | Ускоряет навигацию |
| `traces` — **Search Traces** | Поиск spans по service / status / duration | `fetch spans` | Parity с Logs |
| `metrics` — **Query Metric** | Быстрый график по метрике (sparkline в Detail) | `timeseries` DQL | Быстрый health-check |
| `deployments` — **Recent Deployments** | Последние `event.type == DEPLOYMENT` | `fetch events` | Корреляция инцидентов |
| `synthetic` — **Synthetic Monitors** | Статус HTTP/browser-мониторов | Synthetic API | Проактивная диагностика |
| `menubar` — **Errors Menu Bar** | Раскат счётчика ERROR+FATAL за N минут в menu bar | `mode: "menu-bar"` | Ambient monitoring |
| `notify` — **Background Alerts** | Раз в N минут запрос на новые проблемы, push-уведомление | `mode: "no-view"` + Raycast's background refresh | Без необходимости открывать команду |
| `saved-queries` — **My DQL Queries** | CRUD пользовательских DQL с запуском | `LocalStorage` | Power-user workflow |
| `dql-runner` — **Run Custom DQL** | TextArea для произвольного DQL и рендер таблицы | generic query | Избавляет от переключения в браузер |

### 2.2. Улучшения существующей команды `dt`

- **Серверный фильтр по сервису**: передавать `service.name` в DQL, а не фильтровать по загруженным 50.
- **Фильтр по ключевому слову в `content`** — дополнительный аргумент команды или search-field с дебаунсом, который добавляет `filter contains(content, "...")` или `matchesPhrase`.
- **Пагинация**:
  - variant A — «Load more» через `limit N offset M` (или `sort timestamp desc | limit 50` + `| filter timestamp < <oldestSeenTs>`);
  - variant B — использовать async Grail API (`/query:poll` с `requestToken`) для больших наборов.
- **Live tail** (F5 / `cmd+R` / автообновление раз в 10 c) — режим hands-off при дебаге прод-инцидента.
- **Пресеты таймфрейма**: 15m / 1h / 4h / 24h / 7d как dropdown-секция.
- **Группировка**: `List.Section` по сервису, по хосту, по namespace (переключатель в action panel).
- **Экспорт**: Copy всех видимых записей как JSON / CSV / Markdown-таблица, либо Save to file в рабочую папку.
- **Множественный выбор уровней** — сейчас только один level. Добавить «Error+Fatal+Warn» пресет.
- **Поиск по traceId / spanId** как отдельный быстрый режим.
- **Свободный DQL-хвост**: текстовое поле для `extraFilter` (уже поддержано в `buildDqlQuery`, не подключено к UI).

### 2.3. Улучшения `log-detail-view`

- **Related logs**: action «Find logs for this trace» (loads `trace_id == "..."` в широком окне), «Find logs for this service ±5 min».
- **Pretty-print**: если `content` — валидный JSON / stack trace, развернуть в fenced code с подсветкой (Raycast markdown поддерживает `json`, `bash`, etc.).
- **Stack trace parser**: выделение первой причинной строки как заголовок, остальные как свернутый раздел.
- **AI Actions**: «Explain this error», «Suggest fix», «Summarize last N errors» — через `@raycast/api` AI.
- **Share as snippet**: сохранить Markdown-снимок в outputs — удобно вставлять в Jira/Slack.
- **Copy curl**: сгенерировать curl-запрос к Grail с текущим DQL-фильтром, чтобы воспроизвести в терминале.
- **Deep-link в Notebook / Workflow**: Dynatrace позволяет открыть DQL в Notebook по URL, это полезный shortcut.

### 2.4. Производительность и UX

- `useCachedPromise` из `@raycast/utils` для кэширования последнего результата и мгновенной отрисовки при повторном запуске.
- `AbortController` в `useDynatraceQuery` — отменять предыдущий запрос при смене параметров.
- Адаптация к тёмной/светлой теме: использовать `Color.*` вместо хардкода `#e85555` в `dt.tsx`.
- Улучшение пустого состояния: советы «ослабить фильтр», «расширить таймфрейм», кнопка Retry.
- Accessibility: keywords в `List.Item` для лучшего fuzzy-поиска (сейчас поиск Raycast идёт только по title/subtitle).
- Показ `scannedBytes` / `executionTimeMillis` из ответа Grail в тост — видно, во сколько обходится запрос.

### 2.5. Интеграции

- **OAuth 2.0 client credentials** вместо bearer token — автоматическое обновление, exp-aware. Можно пользоваться `OAuthService` из `@raycast/api`.
- **Jira**: action «Create incident ticket from log» — заполнить поля из `log.content`, `service.name`, deep-link.
- **Slack/Teams**: «Share log to channel» (через Raycast Slack, если стоит).
- **Apple Notes / Notion**: «Append to incident note».
- **MCP-расширение**: отдельная обвязка для Claude Code, чтобы можно было в Cowork-сессии сразу делать `fetch logs`.

### 2.6. DX и инфраструктура

- **Раскрытые типы API**: перенести `GrailResponse` в `types/`, использовать в хуке; убрать `any`.
- **Deduplicate `LogRecord`** — единый источник, поделиться между fakeDB и src.
- **Schema-валидация ответа** через `zod` — защитит от поломок API.
- **Unit-тесты** на `buildDqlQuery`, `parseTimeframe`, `toNanoIso`, `buildDqlFilter` — критический код, без тестов.
- **GitHub Actions** с `ray lint` + `ray build`.
- **Raycast Store publish checklist**:
  - заполнить `README.md` со скриншотами,
  - реальный `CHANGELOG.md`,
  - убрать неиспользуемый `extension-icon.png`,
  - проверить preferences на валидные placeholder'ы.
- **i18n**: хоть Raycast и английский, комментарии `// Дефолтный payload — точная копия того что работает в Postman` стоит перевести или вынести — Store-реюверы часто это отмечают.

---

## 3. Принятые решения (апрель 2026)

1. Целевая аудитория — **админы партнёров**, сопровождающие мониторинг нескольких клиентских тенантов Dynatrace. Из этого следует: нужен **multi-tenant**, быстрый overview (проблемы, деплои, логи), корреляция инцидентов, минимум «игрушечных» AI-фич.
2. Расширение должно быть **набором команд**, а не одной командой — и структурно, и в `package.json`.
3. Аутентификация — **OAuth 2.0 (client credentials)** с автоматической ротацией access-токена. Статический `dt0s16`-токен убираем.
4. Цель — **публикация в Raycast Store**. Следовательно, с Phase 0 соблюдаем все требования ревью: README со скриншотами, CHANGELOG, `Color.*` вместо хексов, никаких `any`, не публиковать тестовые артефакты, платформы macOS + Windows проверены.

Порядок «сначала OAuth + multi-tenant + мульти-команды, потом фичи» продиктован тем, что позже их встраивать дороже: OAuth меняет контракт хука запросов, multi-tenant меняет форму preferences, а мульти-команды меняют структуру `package.json` и импортов.

---

## 4. Дорожная карта

### Phase 0 — Foundation (≈ 1 неделя)
Готовим фундамент под всё остальное. Без этого Phase 1+ будут переделываться.

1. **OAuth 2.0 client credentials flow** (см. §5.1):
   - новые preferences: `oauthClientId`, `oauthClientSecret`, `ssoEndpoint` (по умолчанию `https://sso.dynatrace.com/sso/oauth2/token`), `tenantEndpoint`, `scopes`;
   - удалить `dynatraceToken`;
   - сервис `getAccessToken()` с кэшем в `Cache` + превентивный refresh за 30 c до `exp`;
   - `useDynatraceQuery` использует `getAccessToken()` вместо статического prefs.
2. **Multi-tenant preferences** (см. §5.2):
   - JSON-список тенантов в одном текстовом preference либо отдельная команда `Manage Tenants` (Form + LocalStorage);
   - компонент `TenantSwitcher` (searchBarAccessory во всех list-командах);
   - активный тенант хранится в `LocalStorage` и применяется ко всем командам.
3. **Репо-гигиена для Store-ревью**:
   - реальный `README.md` со скриншотами всех команд (генерируем позже, но структуру добавляем сразу);
   - `CHANGELOG.md` с `[Unreleased]` секцией;
   - убрать неиспользуемый `extension-icon.png`, оставить только `dynatrace-icon.png`;
   - вынести `GrailResponse` в `src/types/grail.ts`, слить `GrailRecord` с `LogRecord`;
   - заменить хардкод `#e85555` на `Color.Red`, все комментарии перевести на английский (Store-ревью страдает от неанглийского кода);
   - `zod`-схемы для `LogRecord`, `Problem`, `Entity`, `DeploymentEvent`;
   - GitHub Actions: `ray lint`, `ray build`, `npm test` на PR.
4. **Переорганизация в multi-command layout**:
   - `src/commands/search-logs/`
   - `src/commands/problems/`
   - `src/commands/deployments/`
   - `src/commands/entities/`
   - `src/commands/dql-runner/`
   - `src/commands/tenants/`
   - `src/commands/menubar-problems/`
   - общий `src/lib/` (auth, query, types, utils).

### Phase 1 — Основные команды для админа (≈ 2 недели)

1. **Search Logs** (hardened из существующего):
   - `AbortController` + `useCachedPromise`;
   - серверный фильтр по `service.name`;
   - поиск по `content` через дополнительный аргумент / debounce-поиск;
   - пагинация «Load more» через cursor-by-timestamp;
   - пресеты таймфрейма (15m / 1h / 4h / 24h / 7d);
   - Related logs в Detail (same `trace_id`, same service ±5 мин);
   - pretty-print JSON и stack trace в markdown.
2. **Active Problems** — list-команда:
   - `fetch dt.davis.problems | filter status == "OPEN" | sort severityLevel, startTime desc`;
   - иконка/цвет по `severityLevel` (AVAILABILITY / ERROR / PERFORMANCE / RESOURCE);
   - Detail: affected entities, root cause, временная шкала;
   - deep-link в Dynatrace Problems UI;
   - action «Show Logs for this service» — пушит Search Logs с префиллом.
3. **Recent Deployments** — list-команда:
   - `fetch events | filter event.type == "CUSTOM_DEPLOYMENT" or event.kind == "DAVIS_DEPLOYMENT"`;
   - показывает service/host/version/timestamp;
   - корреляция: action «Show problems in this window» и «Show errors in this service ±15 min».
4. **Find Entity** — Grid/List с переключателем по типу (Service / Host / Process Group):
   - `fetch dt.entity.service | filter matchesPhrase(entity.name, "...")`;
   - Detail с метриками за 1 час + deep-link.
5. Финальные touch-ups перед первым внутренним релизом.

### Phase 2 — Power-user tooling и ambient-мониторинг (≈ 2 недели)

1. **DQL Runner**:
   - Form с `TextArea` для произвольного DQL;
   - saveable как шаблон в LocalStorage;
   - результат рендерится в универсальной `List` с колонками-аксессорами, которые строятся из `result.types[0].mappings`.
2. **Saved Queries** — отдельная команда:
   - CRUD над LocalStorage (name, dql, timeframe, tenant);
   - favourites, run from command (`actions.runCommand`).
3. **Menu Bar — Problems & Errors**:
   - `mode: "menu-bar"`;
   - обновление раз в `interval` (preference, по умолчанию 5 мин);
   - title: число OPEN problems; подменю: топ-проблемы, быстрый запуск Search Logs.
4. **Background Alerts** (`mode: "no-view"`):
   - раз в N минут проверяет новые OPEN problems;
   - `showHUD` + системное уведомление;
   - включается через preference (не всем нужно).
5. **Export Action** в Search Logs и Problems:
   - Copy as JSON / Copy as CSV;
   - Save to workspace directory через `fs.writeFile`.

### Phase 3 — Интеграции и расширенная observability (≈ 2–3 недели)

1. **Traces** — `fetch spans` с фильтром по `service.name` / статусу / длительности, Detail с waterfall-виджетом (Raycast detail поддерживает mermaid, можно попробовать `gantt`).
2. **Metrics quick-look** — выборочный `timeseries` запрос + sparkline в markdown (через base64-изображение из external renderer, либо ASCII-chart).
3. **Synthetic Monitors** — статус HTTP/browser мониторов.
4. **Integrations**:
   - **Create Jira ticket** из Problem или Log entry;
   - **Send to Slack** (поддержка official Raycast Slack, если стоит);
   - **Append to Apple Notes** — инцидент-журнал.
5. **AI Explain** (опционально, по отзывам пользователей): Explain stack trace, Suggest next step при Detail logs.

### Phase 4 — Store submission (≈ 1 неделя)

1. Финальный набор скриншотов (Raycast Store требует минимум 4, желательно 6–8).
2. Metadata: `categories`, `keywords`, extended `description`.
3. Cross-platform проверка macOS + Windows (или снять Windows из `platforms`, если не тестировалось).
4. Security review: токены в `Cache`/LocalStorage не логируются, ошибки не раскрывают секретов.
5. Unit-тесты ≥ 70% на `lib/*`.
6. Changelog для `v1.0.0`.
7. `npx @raycast/api@latest publish`.

---

## 5. Технический дизайн ключевых фич

### 5.1. OAuth 2.0 client credentials (Dynatrace Platform)

Dynatrace использует **client credentials grant**: машина-машина, без пользовательского браузера. Это проще и подходит для админ-инструмента.

**Поток:**
```
POST https://sso.dynatrace.com/sso/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=dt0s02.xxxxx
&client_secret=dt0s02.xxxxx.yyyyyy
&scope=storage:logs:read storage:events:read storage:entities:read
       storage:metrics:read storage:spans:read storage:problems:read
       environment:roles:viewer
&resource=urn:dtaccount:<account_uuid>  (для account-level OAuth-клиента)
```

Ответ:
```json
{ "scope": "...", "token_type": "Bearer",
  "expires_in": 300, "access_token": "eyJ...",
  "resource": "urn:dtaccount:..." }
```

**Имплементация:**

```ts
// src/lib/auth.ts
import { Cache, getPreferenceValues } from "@raycast/api";

const cache = new Cache({ namespace: "dt-oauth" });
const KEY = (tenantId: string) => `token:${tenantId}`;

interface CachedToken { access_token: string; exp: number; }

export async function getAccessToken(tenant: TenantConfig): Promise<string> {
  const raw = cache.get(KEY(tenant.id));
  if (raw) {
    const t = JSON.parse(raw) as CachedToken;
    if (t.exp - 30_000 > Date.now()) return t.access_token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: tenant.clientId,
    client_secret: tenant.clientSecret,
    scope: tenant.scopes.join(" "),
    ...(tenant.accountUrn ? { resource: tenant.accountUrn } : {}),
  });
  const res = await fetch(tenant.ssoEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new OAuthError(res.status, await res.text());
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const token: CachedToken = {
    access_token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  };
  cache.set(KEY(tenant.id), JSON.stringify(token));
  return token.access_token;
}
```

Инструкция для пользователя в README:
1. В Dynatrace: Account → OAuth clients → Create.
2. Скоупы: `storage:*:read` + `environment:roles:viewer`.
3. Скопировать `client_id` и `client_secret` в preferences.

### 5.2. Multi-tenant

**Вариант A (рекомендуемый): отдельная команда `Manage Tenants`**.

```ts
// shape
interface TenantConfig {
  id: string;            // uuid, генерим при create
  name: string;          // "ACME Production"
  tenantEndpoint: string;// https://abc123.dev.dynatracelabs.com
  clientId: string;
  clientSecret: string;  // stored only in LocalStorage, not cloud-sync'd
  ssoEndpoint: string;
  scopes: string[];
  accountUrn?: string;
  isActive: boolean;
}
```

Храним список в `LocalStorage` (ключ `tenants:v1`). `TenantSwitcher` — `List.Dropdown` в searchBarAccessory: активный tenant, Edit, Add new.

Во всех командах первый шаг — `const tenant = await getActiveTenant()`. Если их 0 — пушить пустой state с кнопкой «Add tenant».

**Вариант B: JSON в одном preference** — быстрее сделать, но хуже UX (правка JSON руками).

### 5.3. Новая форма `useDynatraceQuery`

```ts
export function useDynatraceQuery<T>() {
  const abortRef = useRef<AbortController | null>(null);
  const execute = useCallback(async (dql: string, timeframe?: Timeframe) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const tenant = await getActiveTenant();
    const token = await getAccessToken(tenant);
    // fetch with signal: ctrl.signal
  }, []);
  // ...
}
```

Возможно, вместо собственного стейта перейти на `useCachedPromise` / `usePromise` из `@raycast/utils` — там уже встроена отмена, кэш и `revalidate`.

### 5.4. Structure `package.json`

```json
"commands": [
  { "name": "search-logs",     "title": "Search Logs",       "mode": "view", ... },
  { "name": "problems",        "title": "Active Problems",   "mode": "view" },
  { "name": "deployments",     "title": "Recent Deployments","mode": "view" },
  { "name": "entities",        "title": "Find Entity",       "mode": "view" },
  { "name": "dql-runner",      "title": "Run DQL Query",     "mode": "view" },
  { "name": "saved-queries",   "title": "Saved DQL Queries", "mode": "view" },
  { "name": "tenants",         "title": "Manage Tenants",    "mode": "view" },
  { "name": "menubar-problems","title": "Problems in Menu Bar","mode": "menu-bar","interval": "5m" },
  { "name": "alerts",          "title": "Background Problem Alerts","mode": "no-view","interval": "5m" }
]
```

### 5.5. Store-checklist (перед `publish`)

- [ ] README.md с 6+ скриншотами (каждая ключевая команда).
- [ ] CHANGELOG.md с `[1.0.0]` секцией и датой.
- [ ] Все строки в UI на английском.
- [ ] `keywords`, `categories` в package.json заполнены.
- [ ] Нет hardcoded credentials, mock-режим либо убран, либо явно dev-only (мы оставляем — полезно).
- [ ] Windows-совместимость проверена (или `platforms: ["macOS"]`).
- [ ] Cyclic CI зелёный.
- [ ] `ray lint` без ошибок и warnings.
- [ ] Unit-тесты для `lib/auth`, `lib/query`, `utils/*`.

---

## 6. Следующие шаги

1. **Решить по multi-tenant UI** — вариант A (отдельная команда) vs B (JSON в preference). Рекомендую A.
2. **Подтвердить скоупы OAuth** — какие API-области нужны сразу. Минимум: `storage:logs:read`, `storage:events:read`, `storage:entities:read`, `storage:problems:read`. Traces/metrics можно добавить позже.
3. **Завести ветки**: `feat/oauth`, `feat/multi-tenant`, `feat/command-problems` — они слабо зависимы после Phase 0 кроме `oauth` → всё остальное.
4. **Запустить Phase 0** — пункт 1 (OAuth) и пункт 2 (multi-tenant) делать параллельно не стоит: tenant-конфиг хранит OAuth-credentials, сначала стабилизируем `getAccessToken`.

---

## 4. Технические заметки на ключевые фичи

### 4.1. Пагинация через cursor-by-timestamp

В `buildDqlQuery` добавить параметр `before?: string`:

```ts
if (before) parts.push(`filter timestamp < "${before}"`);
```

В `dt.tsx`:
- хранить `oldestTimestamp` из последних results;
- action «Load more» вызывает `execute(buildDqlQuery({ logLevel, before: oldestTimestamp }), timeframe)` и склеивает результат.

### 4.2. AbortController

```ts
const abortRef = useRef<AbortController | null>(null);
const execute = useCallback(async (...) => {
  abortRef.current?.abort();
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  // fetch(..., { signal: ctrl.signal })
}, []);
```

### 4.3. Live tail

Дополнительная кнопка в ActionPanel, которая стартует `setInterval(() => execute(...), 10_000)`. Раяст-доки советуют `useEffect` cleanup + `revalidate` через `useCachedPromise`. Нужно аккуратно с rate-limit Grail (стандартно ~30 запросов/мин).

### 4.4. Menubar

`mode: "menu-bar"` + `MenuBarExtra` из `@raycast/api`. Запрос раз в N минут, в `title` — цифра, в submenu — top-5 логов по частоте.

### 4.5. OAuth

`@raycast/api` содержит `OAuthService` c helper-флоу для Dynatrace. Endpoint `sso.<env>/sso/oauth2/token`. Храним `access_token` в keychain через `LocalStorage`/`Cache`.

### 4.6. DQL Runner

`Form` command с `TextArea` для DQL. После submit — `push` на `QueryResults` view, который отрисует dynamic `List` или `Detail` в зависимости от того, скаляр это или записи. Хорошо ложится на готовый `useDynatraceQuery`.

---

## 5. Принципиальные вопросы (нужно решить перед Phase 1)

1. **Хотим ли мы remain lightweight (1 команда) vs суите команд** (Problems, Metrics, Traces)?
2. **Аудитория**: только админы Dynatrace или dev-команды, которые только смотрят логи своих сервисов? От этого зависит, дефолтно ли сужать до `service.name` пользователя.
3. **Ставим OAuth now** или оставляем static token до Phase 4?
4. **Публикуем в Raycast Store** или остаётся private?

Ответы на эти вопросы меняют приоритизацию Phase 1–3; без них можно начать с Phase 0 и Phase 1 — они полезны в любом сценарии.
