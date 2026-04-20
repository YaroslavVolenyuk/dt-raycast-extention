# Implementation Stories — Dynatrace Raycast Extension
> **Format:** каждая история — самодостаточная задача для LLM-агента.  
> Агент получает один story-блок, читает указанные файлы, реализует изменения, убеждается, что критерии приёмки выполнены.  
> Зависимости помечены в поле `Depends on`.

---

## Условные обозначения

| Поле | Смысл |
|---|---|
| **ID** | Уникальный идентификатор в формате `P<phase>-S<seq>` |
| **Epic** | Название эпика из дорожной карты |
| **Priority** | `must` / `should` / `nice-to-have` |
| **Depends on** | Story ID, которые нужно завершить раньше |
| **Context files** | Файлы, которые агент обязан прочесть перед реализацией |
| **AC** | Acceptance Criteria — условия, при которых задача считается выполненной |

---

# PHASE 0 — Foundation

---

## P0-S1 · Repo hygiene: удалить дубли, перевести комментарии, убрать лишние assets

**Epic:** Repo hygiene for Store review  
**Priority:** must  
**Depends on:** —  
**Context files:**
- `src/dt.tsx`
- `src/log-detail-view.tsx`
- `src/useDynatraceQuery.ts`
- `dql/dql.ts`
- `src/types/log.ts`
- `package.json`

**Goal:**  
Привести кодовую базу в порядок перед добавлением новых фич: убрать лишние файлы, перевести все inline-комментарии на английский, заменить hex-цвета на константы Raycast API.

**Tasks:**
1. В `assets/` удалить `extension-icon.png`. В `package.json` в поле `"icon"` убедиться, что указан `"assets/dynatrace-icon.png"`.
2. В `src/dt.tsx` найти все хардкод hex-цвета (напр. `#e85555`, `#f5a623`) и заменить на константы из `@raycast/api`: `Color.Red`, `Color.Orange`, `Color.Green`, `Color.Blue`, `Color.Yellow`, `Color.SecondaryText` и т.д.
3. Во всех `.ts` / `.tsx` файлах перевести inline-комментарии с русского на английский (напр. `// Дефолтный payload` → `// Default payload — matches working Postman example`).
4. Убрать неиспользуемые import-ы (если `GrailResponse` из `dql/dql.ts` нигде не используется — либо использовать, либо удалить экспорт).
5. В `CHANGELOG.md` добавить секцию `[Unreleased]` с кратким списком грядущих изменений.
6. В `README.md` добавить placeholder-структуру: заголовок, раздел Features, раздел Setup, раздел Commands, раздел Screenshots (с пустым списком), раздел Contributing.

**AC:**
- [ ] `assets/extension-icon.png` отсутствует в репозитории.
- [ ] В `package.json` `"icon"` указывает на `"assets/dynatrace-icon.png"`.
- [ ] `ray lint` не выдаёт ошибок и предупреждений, связанных с хардкод цветами.
- [ ] В файлах `.ts`/`.tsx` нет комментариев на русском языке.
- [ ] `CHANGELOG.md` содержит секцию `[Unreleased]`.
- [ ] `README.md` содержит все 6 разделов (хотя бы с placeholder-текстом).

---

## P0-S2 · Типы: единый источник, Zod-схемы, убрать `any`

**Epic:** Repo hygiene / Type safety  
**Priority:** must  
**Depends on:** P0-S1  
**Context files:**
- `src/types/log.ts`
- `dql/dql.ts`
- `fakeDB/dql.ts`
- `src/useDynatraceQuery.ts`

**Goal:**  
Устранить дублирование типов `GrailRecord` / `LogRecord`, добавить Zod-валидацию ответа Grail, убрать все `any`.

**Tasks:**
1. Создать файл `src/types/grail.ts`:
   - Перенести `GrailResponse` и `GrailRecord` из `dql/dql.ts` сюда.
   - Добавить Zod-схему `grailResponseSchema` (валидирует поля `results`, `types`, `metadata`).
   - Добавить Zod-схему `logRecordSchema` — объединение полей из `GrailRecord` и `LogRecord` (включая опциональные k8s, trace, pipeline поля).
   - Экспортировать inferred type `LogRecord = z.infer<typeof logRecordSchema>`.
2. В `src/types/log.ts` удалить дублирующееся определение `LogRecord`, вместо него ре-экспортировать из `src/types/grail.ts`.
3. В `dql/dql.ts` удалить старые определения `GrailResponse` / `GrailRecord`, использовать импорт из `src/types/grail.ts`.
4. В `src/useDynatraceQuery.ts` после `fetch`:
   - Парсить ответ через `grailResponseSchema.parse(json)` — Zod бросит исключение, если структура неожиданная.
   - Убрать все места с `as any` и `as GrailRecord[]`, заменить на inferred типы.
5. В `fakeDB/dql.ts` убедиться, что mock-данные соответствуют `logRecordSchema` (добавить недостающие обязательные поля или сделать их `optional()` в схеме).
6. Установить `zod` как зависимость: `npm install zod`.

**AC:**
- [ ] `src/types/grail.ts` существует и экспортирует `grailResponseSchema`, `logRecordSchema`, `LogRecord`.
- [ ] В `src/types/log.ts` нет самостоятельного определения `LogRecord` — только ре-экспорт.
- [ ] `dql/dql.ts` не содержит `GrailRecord` / `GrailResponse` определений.
- [ ] В кодовой базе нет `as any`.
- [ ] `npm run build` завершается без ошибок TypeScript.
- [ ] При получении неожиданного JSON от Grail `useDynatraceQuery` выбрасывает ошибку с читаемым сообщением (проверить в mock-режиме, подав сломанный ответ).

---

## P0-S3 · GitHub Actions: lint + build + test на каждый PR

**Epic:** CI/CD infrastructure  
**Priority:** must  
**Depends on:** P0-S2  
**Context files:**
- `package.json`
- `tsconfig.json`

**Goal:**  
Настроить GitHub Actions workflow, который при каждом PR запускает `ray lint`, `ray build` и `npm test`.

**Tasks:**
1. Создать `.github/workflows/ci.yml` со следующей структурой:
   - trigger: `pull_request` и `push` на `main`.
   - job `lint-build-test`:
     - `ubuntu-latest`
     - `actions/checkout@v4`
     - `actions/setup-node@v4` с версией Node из `package.json#engines.node` (или `20.x`).
     - `npm ci`
     - `npx ray lint` (не фатально при warnings, фатально при errors — использовать `--fix=false`).
     - `npx ray build`
     - `npm test -- --passWithNoTests` (чтобы не падало до написания тестов).
2. В `package.json` убедиться, что `"scripts"` содержат:
   - `"lint": "ray lint"`
   - `"build": "ray build"`
   - `"test": "jest"` (или vitest, если предпочтительнее).
3. Добавить `jest.config.ts` (или `vitest.config.ts`) с настройкой для TypeScript:
   - `transform: { '*.ts': 'ts-jest' }` или `'*.ts': ['@swc/jest']`.
   - `testMatch: ['**/__tests__/**/*.test.ts']`.
4. Установить dev-зависимости: `npm install -D jest ts-jest @types/jest` (или `vitest`).
5. Создать `src/__tests__/.gitkeep` — директорию для будущих тестов.

**AC:**
- [ ] `.github/workflows/ci.yml` существует и синтаксически корректен (можно проверить через `act` или просто `yaml lint`).
- [ ] `npm run lint` выполняется локально без ошибок.
- [ ] `npm run build` выполняется локально без ошибок.
- [ ] `npm test -- --passWithNoTests` выполняется без ошибок.
- [ ] Workflow включает все три шага: lint, build, test.

---

## P0-S4 · Реструктуризация в multi-command layout

**Epic:** Multi-command architecture  
**Priority:** must  
**Depends on:** P0-S2  
**Context files:**
- `src/dt.tsx`
- `src/log-detail-view.tsx`
- `src/useDynatraceQuery.ts`
- `src/utils/buildDqlQuery.ts`
- `src/utils/parseTimeframe.ts`
- `src/types/log.ts`
- `src/types/grail.ts` (создан в P0-S2)
- `dql/dql.ts`
- `fakeDB/dql.ts`
- `package.json`

**Goal:**  
Переместить существующий код в новую директориальную структуру `src/commands/` + `src/lib/`, не меняя логику. Обновить `package.json` под multi-command layout.

**Tasks:**
1. Создать следующую структуру директорий:
   ```
   src/
   ├── commands/
   │   ├── search-logs/
   │   │   ├── index.tsx          ← перенести src/dt.tsx
   │   │   └── log-detail.tsx     ← перенести src/log-detail-view.tsx
   │   ├── problems/              ← пустая директория (реализация в P1-S2)
   │   ├── deployments/           ← пустая директория (реализация в P1-S3)
   │   ├── entities/              ← пустая директория (реализация в P1-S4)
   │   ├── dql-runner/            ← пустая директория (реализация в P2-S1)
   │   ├── saved-queries/         ← пустая директория (реализация в P2-S2)
   │   ├── tenants/               ← пустая директория (реализация в P0-S6)
   │   └── menubar-problems/      ← пустая директория (реализация в P2-S3)
   └── lib/
       ├── auth.ts                ← пустой файл (реализация в P0-S5)
       ├── query.ts               ← перенести src/useDynatraceQuery.ts
       ├── types/
       │   ├── grail.ts           ← перенести src/types/grail.ts
       │   └── log.ts             ← перенести src/types/log.ts
       └── utils/
           ├── buildDqlQuery.ts   ← перенести src/utils/buildDqlQuery.ts
           └── parseTimeframe.ts  ← перенести src/utils/parseTimeframe.ts
   ```
2. Обновить все import-пути во всех перемещённых файлах.
3. Обновить `package.json`:
   ```json
   "commands": [
     {
       "name": "search-logs",
       "title": "Search Logs",
       "subtitle": "Dynatrace",
       "description": "Search Dynatrace Grail logs with DQL filters",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png",
       "arguments": [
         { "name": "timeframeValue", "placeholder": "1", "type": "text", "required": false },
         { "name": "timeframeUnit", "placeholder": "h", "type": "text", "required": false },
         { "name": "query", "placeholder": "ERROR", "type": "text", "required": false }
       ]
     },
     {
       "name": "problems",
       "title": "Active Problems",
       "subtitle": "Dynatrace",
       "description": "View active Davis AI problems",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "deployments",
       "title": "Recent Deployments",
       "subtitle": "Dynatrace",
       "description": "View recent deployment events",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "entities",
       "title": "Find Entity",
       "subtitle": "Dynatrace",
       "description": "Search services, hosts and process groups",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "dql-runner",
       "title": "Run DQL Query",
       "subtitle": "Dynatrace",
       "description": "Execute a custom DQL query",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "saved-queries",
       "title": "Saved DQL Queries",
       "subtitle": "Dynatrace",
       "description": "Manage and run saved DQL queries",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "tenants",
       "title": "Manage Tenants",
       "subtitle": "Dynatrace",
       "description": "Add, edit and switch between Dynatrace tenants",
       "mode": "view",
       "icon": "assets/dynatrace-icon.png"
     },
     {
       "name": "menubar-problems",
       "title": "Problems in Menu Bar",
       "subtitle": "Dynatrace",
       "description": "Show open problem count in macOS menu bar",
       "mode": "menu-bar",
       "icon": "assets/dynatrace-icon.png",
       "interval": "5m"
     }
   ]
   ```
4. Переместить `dql/dql.ts` → `src/lib/api/grail.ts` (переименовать для ясности). Обновить импорты.
5. Переместить `fakeDB/dql.ts` → `src/lib/api/mock.ts`. Обновить импорты.
6. Убедиться, что `npm run build` завершается без ошибок после переноса.

**AC:**
- [ ] Все файлы находятся в новых путях, старые директории `src/dt.tsx`, `src/log-detail-view.tsx`, `src/useDynatraceQuery.ts` — удалены.
- [ ] `src/commands/search-logs/index.tsx` рендерит то же, что раньше `src/dt.tsx`.
- [ ] `package.json` содержит 8 команд (включая `menubar-problems`).
- [ ] `npm run build` завершается без ошибок.
- [ ] Raycast может запустить команду `search-logs` без ошибок (проверить в dev режиме).

---

## P0-S5 · OAuth 2.0 client credentials: сервис `getAccessToken`

**Epic:** OAuth 2.0 authentication  
**Priority:** must  
**Depends on:** P0-S4  
**Context files:**
- `src/lib/auth.ts` (создан пустым в P0-S4)
- `src/lib/query.ts` (бывший `useDynatraceQuery.ts`)
- `package.json` (preferences секция)

**Goal:**  
Реализовать сервис получения access token через OAuth 2.0 client credentials grant от Dynatrace SSO. Токен должен кэшироваться с превентивным refresh за 30 сек до истечения.

**Tasks:**

1. Обновить `package.json` → `"preferences"`:
   - Удалить поле `dynatraceToken`.
   - Оставить `dynatraceEndpoint` (переименовать в `tenantEndpoint` если необходимо) или удалить — в multi-tenant варианте endpoint хранится в `LocalStorage`.
   - Добавить опциональный `useMockData` (boolean, уже есть — сохранить).
   - **Примечание:** OAuth credentials переносятся в `Manage Tenants` UI (P0-S6), поэтому в глобальных preferences они не нужны.

2. В `src/lib/auth.ts` реализовать:
   ```ts
   // Types
   export interface TenantConfig {
     id: string;
     name: string;
     tenantEndpoint: string;  // e.g. https://abc123.live.dynatrace.com
     clientId: string;
     clientSecret: string;
     ssoEndpoint: string;     // default: https://sso.dynatrace.com/sso/oauth2/token
     scopes: string[];        // e.g. ["storage:logs:read", "storage:problems:read"]
     accountUrn?: string;     // urn:dtaccount:<uuid> for account-level clients
   }

   interface CachedToken {
     access_token: string;
     exp: number;  // Date.now() + expires_in * 1000
   }

   // Custom error class
   export class OAuthError extends Error {
     constructor(public statusCode: number, public body: string) { ... }
   }

   // Main function
   export async function getAccessToken(tenant: TenantConfig): Promise<string>
   ```
   
   Логика `getAccessToken`:
   - Создать `Cache` из `@raycast/api` с namespace `"dt-oauth"`.
   - Ключ кэша: `"token:" + tenant.id`.
   - Если в кэше есть валидный токен (не истёк с запасом 30 000 мс) — вернуть его.
   - Иначе: `POST tenant.ssoEndpoint` с `URLSearchParams` (grant_type, client_id, client_secret, scope, resource опционально).
   - При `!res.ok` — бросить `OAuthError(res.status, body)`.
   - Записать в кэш и вернуть `access_token`.

3. В `src/lib/query.ts` (бывший `useDynatraceQuery`):
   - Добавить импорт `getAccessToken`, `TenantConfig`.
   - В функции выполнения запроса: вместо `getPreferenceValues().dynatraceToken` вызывать `await getAccessToken(tenant)`.
   - Передавать `tenant` как параметр в `useDynatraceQuery` (или получать через `getActiveTenant()` из P0-S6).
   - Обработать `OAuthError` отдельно: показывать пользователю специфичное сообщение «OAuth error: check client_id / client_secret in Manage Tenants».

4. Написать unit-тест `src/__tests__/auth.test.ts`:
   - Мок `fetch` — возвращает `{ access_token: "test-token", expires_in: 300 }`.
   - Тест 1: `getAccessToken` возвращает токен при первом вызове.
   - Тест 2: второй вызов использует кэш (fetch вызван ровно 1 раз).
   - Тест 3: при `res.ok = false` бросает `OAuthError`.
   - Мок `Cache` из `@raycast/api` (в `__mocks__/@raycast/api.ts`).

**AC:**
- [ ] `src/lib/auth.ts` экспортирует `TenantConfig`, `OAuthError`, `getAccessToken`.
- [ ] При валидном токене в кэше `fetch` не вызывается повторно.
- [ ] При токене, истекающем через < 30 сек, происходит refresh.
- [ ] `OAuthError` содержит `statusCode` и читаемое `body`.
- [ ] Все 3 unit-теста проходят (`npm test`).
- [ ] В `src/lib/query.ts` нет прямого чтения `dynatraceToken` из preferences.

---

## P0-S6 · Команда `tenants`: Manage Tenants UI + `getActiveTenant`

**Epic:** Multi-tenant management  
**Priority:** must  
**Depends on:** P0-S5  
**Context files:**
- `src/commands/tenants/` (пустая директория)
- `src/lib/auth.ts`
- `src/lib/query.ts`

**Goal:**  
Реализовать полноценный CRUD для конфигурации тенантов через Raycast Form. Функция `getActiveTenant()` должна использоваться всеми командами.

**Tasks:**

1. Создать `src/lib/tenants.ts`:
   ```ts
   const STORAGE_KEY = "tenants:v1";
   const ACTIVE_KEY = "tenants:active";

   export async function listTenants(): Promise<TenantConfig[]>
   export async function saveTenant(t: TenantConfig): Promise<void>
   export async function deleteTenant(id: string): Promise<void>
   export async function getActiveTenant(): Promise<TenantConfig | null>
   export async function setActiveTenant(id: string): Promise<void>
   ```
   - Хранить массив `TenantConfig[]` в `LocalStorage` под ключом `"tenants:v1"`.
   - `getActiveTenant` — возвращает тенант с `id === activeId` или первый в списке, или `null` если список пуст.
   - Добавить Zod-схему `tenantConfigSchema` для валидации.

2. Создать `src/commands/tenants/index.tsx` — List-команда:
   - Список тенантов с иконкой, названием, `tenantEndpoint` как subtitle.
   - Активный тенант помечается `accessories: [{ icon: Icon.Checkmark }]`.
   - Actions для каждого элемента:
     - `Set as Active` (primary, если не активен).
     - `Edit` → пушит форму редактирования.
     - `Delete` → `Alert` с подтверждением.
   - Кнопка `Add Tenant` в `ActionPanel`.

3. Создать `src/commands/tenants/tenant-form.tsx` — Form-компонент:
   - Поля: `name` (TextField), `tenantEndpoint` (TextField, placeholder `https://abc123.live.dynatrace.com`), `clientId` (TextField), `clientSecret` (PasswordField), `ssoEndpoint` (TextField, default `https://sso.dynatrace.com/sso/oauth2/token`), `scopes` (TextField, placeholder разделённые пробелом), `accountUrn` (TextField, optional).
   - При submit — `saveTenant(...)` + `pop()`.
   - При edit — предзаполнить поля из существующего `TenantConfig`.

4. Создать `src/components/TenantSwitcher.tsx` — `List.Dropdown` компонент:
   - Принимает `value: string`, `onChange: (id: string) => void`.
   - Читает список тенантов из `listTenants()`.
   - Отображает имена тенантов, value — `tenant.id`.
   - Предназначен для `searchBarAccessory` во всех list-командах.

5. Создать `src/components/EmptyTenantState.tsx`:
   - `List.EmptyView` с описанием и action «Open Manage Tenants» (`Action.OpenExtensionPreferences` или `Action.Push` на команду tenants).

6. В `src/commands/search-logs/index.tsx` добавить `TenantSwitcher` в `searchBarAccessory`. При смене тенанта — `setActiveTenant(id)` + перезапустить запрос.

**AC:**
- [ ] Команда `tenants` открывается в Raycast, показывает список (пустой при первом запуске).
- [ ] Можно добавить новый тенант через форму.
- [ ] Активный тенант отмечен галочкой.
- [ ] После смены активного тенанта в Search Logs используется новый endpoint.
- [ ] При пустом списке тенантов все команды показывают `EmptyTenantState`.
- [ ] `getActiveTenant()` возвращает `null` если тенантов нет, первый тенант если `activeId` не установлен.

---

## P0-S7 · Unit-тесты для `lib/utils`

**Epic:** Test coverage  
**Priority:** must  
**Depends on:** P0-S3, P0-S4  
**Context files:**
- `src/lib/utils/buildDqlQuery.ts`
- `src/lib/utils/parseTimeframe.ts`
- `src/lib/api/grail.ts`

**Goal:**  
Покрыть unit-тестами критические утилиты, которые форматируют DQL-запросы и парсят таймфреймы. Это защитит от регрессий при добавлении новых параметров фильтрации.

**Tasks:**

1. `src/__tests__/buildDqlQuery.test.ts`:
   - Тест: базовый запрос с `logLevel: "ERROR"` содержит `filter loglevel == "ERROR"`.
   - Тест: с `serviceName` добавляет `filter service.name == "..."`.
   - Тест: с `contentFilter` добавляет `filter matchesPhrase(content, "...")`.
   - Тест: с `before` (timestamp) добавляет `filter timestamp < "..."`.
   - Тест: `limit 50` присутствует по умолчанию.
   - Тест: порядок секций — `fetch`, `filter`, `sort`, `limit` (проверить что `sort` идёт перед `limit`).

2. `src/__tests__/parseTimeframe.test.ts`:
   - Тест: `"1h"` → `{ value: 1, unit: "h" }`.
   - Тест: `"30m"` → `{ value: 30, unit: "m" }`.
   - Тест: `"7d"` → `{ value: 7, unit: "d" }`.
   - Тест: пустая строка → дефолтное значение.
   - Тест: невалидная строка → дефолтное значение или `null`.

3. `src/__tests__/grailApi.test.ts` (тест для `toNanoIso` если такая функция есть):
   - Тест: число наносекунд правильно конвертируется в ISO-строку.
   - Тест: граничные значения (0, очень большое число).

**AC:**
- [ ] `npm test` проходит все тесты без ошибок.
- [ ] Покрытие `buildDqlQuery.ts` ≥ 90% (строк).
- [ ] Покрытие `parseTimeframe.ts` ≥ 90% (строк).
- [ ] Тесты запускаются изолированно (нет зависимости от Raycast runtime).

---

# PHASE 1 — Core Commands

---

## P1-S1 · Search Logs: hardened (AbortController + кэш + серверный фильтр + пагинация)

**Epic:** Search Logs improvements  
**Priority:** must  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/search-logs/index.tsx`
- `src/lib/query.ts`
- `src/lib/utils/buildDqlQuery.ts`
- `src/lib/types/grail.ts`

**Goal:**  
Улучшить существующую команду Search Logs: добавить отмену race-condition запросов, кэш последних результатов, серверный фильтр по сервису, поиск по `content`, пагинацию и пресеты таймфреймов.

**Sub-tasks:**

### 1a. AbortController в `useDynatraceQuery`

В `src/lib/query.ts`:
- Добавить `abortRef = useRef<AbortController | null>(null)`.
- В `execute()`: вызвать `abortRef.current?.abort()`, создать новый `AbortController`, передать `signal` в `fetch`.
- При `AbortError` — не устанавливать error state, просто игнорировать.

### 1b. `useCachedPromise` вместо ручного state

Заменить `useEffect` + ручной `useState` на `useCachedPromise` из `@raycast/utils`:
```ts
import { useCachedPromise } from "@raycast/utils";
const { data, isLoading, error, revalidate, pagination } = useCachedPromise(
  fetchLogs,
  [params],
  { keepPreviousData: true }
);
```
Это даст мгновенную отрисовку прошлых данных при повторном открытии команды.

### 1c. Серверный фильтр по `service.name`

В `buildDqlQuery.ts` принять параметр `serviceName?: string` и добавить в DQL:
```
| filter service.name == "${serviceName}"
```
В `index.tsx` `TenantSwitcher` остаётся в `searchBarAccessory`. Дропдаун фильтра сервиса (`List.Dropdown`) переработать: при выборе сервиса — параметр идёт в DQL, не клиентская фильтрация.

### 1d. Поиск по `content`

Добавить в `buildDqlQuery.ts` параметр `contentFilter?: string`:
```
| filter matchesPhrase(content, "${contentFilter}")
```
В `index.tsx` добавить `searchBarPlaceholder="Search in log content..."` и debounce (300 мс) перед вызовом `revalidate`.

### 1e. Пагинация «Load more»

В `buildDqlQuery.ts` добавить параметр `before?: string` (ISO-timestamp):
```
| filter timestamp < datetime("${before}")
```
В `index.tsx`:
- Хранить `oldestTimestamp` (timestamp последней записи в текущем списке).
- Action «Load more» → `execute({ ...params, before: oldestTimestamp })` и конкатенировать результаты.
- Показывать `List.Item` с subtitle «Load 50 more...» в конце списка.

### 1f. Пресеты таймфрейма

Заменить ввод аргументов на `List.Dropdown` в `searchBarAccessory` (или второй дропдаун если `TenantSwitcher` занят место):
- `15m`, `1h`, `4h`, `24h`, `7d`.
- Сохранять выбранный пресет в `LocalStorage` (ключ `"dt_timeframe_preset"`).

**AC:**
- [ ] При быстрой смене фильтра сервиса не возникает race condition (старый запрос отменяется).
- [ ] При повторном открытии команды показываются кэшированные результаты до завершения нового запроса.
- [ ] Фильтр по сервису работает через DQL (проверить в mock: строка DQL содержит `service.name ==`).
- [ ] Ввод текста в search bar с задержкой 300 мс вызывает повторный запрос с `matchesPhrase`.
- [ ] «Load more» подгружает следующие 50 записей и добавляет их к списку.
- [ ] Выбранный пресет таймфрейма сохраняется между запусками команды.

---

## P1-S2 · Команда `problems`: Active Problems

**Epic:** Active Problems command  
**Priority:** must  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/problems/` (пустая директория)
- `src/lib/query.ts`
- `src/lib/auth.ts`
- `src/lib/types/grail.ts`

**Goal:**  
Создать команду для отображения активных проблем Davis AI с цветовой кодировкой по severity, деталями и deep-link в Dynatrace UI.

**Tasks:**

1. Создать Zod-схему `problemSchema` в `src/lib/types/problem.ts`:
   ```ts
   // Ключевые поля из dt.davis.problems
   {
     event.id: string,
     event.name: string,
     event.status: "OPEN" | "CLOSED",
     event.severity: "AVAILABILITY" | "ERROR" | "PERFORMANCE" | "RESOURCE_CONTENTION" | "CUSTOM_ALERT",
     event.start: string,       // ISO timestamp
     event.end: string | null,
     affected_entity_ids: string[],
     maintenance_window: boolean,
     root_cause_entity_id: string | null,
   }
   ```

2. В `src/lib/utils/buildDqlQuery.ts` или отдельном файле `src/lib/utils/buildProblemsQuery.ts` создать функцию:
   ```ts
   export function buildProblemsQuery(status: "OPEN" | "ALL" = "OPEN"): string {
     return `fetch dt.davis.problems
       | filter event.status == "${status}"
       | sort event.severity asc, event.start desc
       | limit 50`;
   }
   ```

3. Создать `src/commands/problems/index.tsx`:
   - `List` с `isLoading`, `searchBarAccessory={<TenantSwitcher .../>}`.
   - Каждый `List.Item`:
     - `title`: `event.name`
     - `subtitle`: затронутые сервисы (из `affected_entity_ids` первые 2 + «…+N more»)
     - `accessories`: длительность (`event.start` → «X hours ago» или `formatDistanceToNow`)
     - `icon`: по severity (AVAILABILITY → `Color.Red`, ERROR → `Color.Orange`, PERFORMANCE → `Color.Yellow`, RESOURCE → `Color.Blue`)
   - Empty state: «No open problems — all systems operational 🎉».
   - Дропдаун фильтра: `OPEN` / `ALL`.

4. Создать `src/commands/problems/problem-detail.tsx`:
   - Секции: Problem Info (id, status, severity, duration), Affected Entities (список), Root Cause (entity если есть).
   - Actions:
     - `Open in Dynatrace` — deep-link `${tenant.tenantEndpoint}/ui/problems/${event.id}`.
     - `Show Logs for this Problem` — `Action.Push` на Search Logs с префиллом `service.name` из первого affected entity (если определяется) и таймфреймом ±30 мин.
     - `Copy Problem ID`.

5. Добавить mock-данные для problems в `src/lib/api/mock.ts` (3-5 примеров с разными severity).

**AC:**
- [ ] Команда `problems` открывается, показывает список с цветовыми иконками.
- [ ] В mock-режиме отображается не менее 3 проблем разных severity.
- [ ] Клик на проблему открывает detail view с корректными секциями.
- [ ] Action «Open in Dynatrace» формирует корректный URL.
- [ ] Action «Show Logs» переходит в Search Logs с предзаполненным фильтром.
- [ ] Дропдаун `OPEN / ALL` перезапрашивает данные.

---

## P1-S3 · Команда `deployments`: Recent Deployments

**Epic:** Recent Deployments command  
**Priority:** must  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/deployments/` (пустая директория)
- `src/lib/query.ts`
- `src/lib/types/grail.ts`

**Goal:**  
Показывать последние deployment-события с возможностью корреляции с проблемами и ошибками.

**Tasks:**

1. Создать `src/lib/types/deployment.ts` с Zod-схемой:
   ```ts
   {
     event.id: string,
     event.name: string,               // deployment name
     event.type: string,               // CUSTOM_DEPLOYMENT / DAVIS_DEPLOYMENT
     event.start: string,
     event.provider: string | null,
     affected_entity_name: string | null,
     deployment.version: string | null,
     deployment.release_stage: string | null,
   }
   ```

2. DQL-запрос:
   ```
   fetch events
   | filter event.type == "CUSTOM_DEPLOYMENT" or event.kind == "DAVIS_DEPLOYMENT"
   | sort event.start desc
   | limit 30
   ```

3. Создать `src/commands/deployments/index.tsx`:
   - `title`: `event.name` или `affected_entity_name`.
   - `subtitle`: версия + провайдер.
   - `accessories`: относительное время.
   - Icon: `Icon.Upload` или кастомная иконка.

4. Создать `src/commands/deployments/deployment-detail.tsx`:
   - Секции: Deployment Info, Affected Entity, Timeline.
   - Actions:
     - `Show Problems in This Window` — переход на Problems команду с таймфреймом `event.start ± 30 мин`.
     - `Show Errors in This Service ±15 min` — переход на Search Logs с `service.name` + таймфреймом.
     - `Open in Dynatrace` — deep-link.

5. Mock-данные: 5 примеров deployment событий.

**AC:**
- [ ] Команда показывает список deployments.
- [ ] Detail view корректно отображает все секции.
- [ ] Оба correlation action-а (problems, logs) формируют корректные параметры перехода.
- [ ] В mock-режиме отображается минимум 5 deployment событий.

---

## P1-S4 · Команда `entities`: Find Entity

**Epic:** Find Entity command  
**Priority:** should  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/entities/` (пустая директория)
- `src/lib/query.ts`

**Goal:**  
Быстрый поиск сервисов, хостов и process groups по имени с deep-link.

**Tasks:**

1. Создать `src/lib/types/entity.ts` с Zod-схемой:
   ```ts
   {
     entity.id: string,
     entity.name: string,
     entity.type: "SERVICE" | "HOST" | "PROCESS_GROUP" | "PROCESS_GROUP_INSTANCE",
   }
   ```

2. DQL-запрос (параллельный для каждого типа или объединённый):
   ```
   fetch dt.entity.service
   | filter matchesPhrase(entity.name, "${query}")
   | fields entity.id, entity.name, entity.type
   | limit 20
   ```
   Аналогично для `dt.entity.host`, `dt.entity.process_group`.

3. Создать `src/commands/entities/index.tsx`:
   - `List.Dropdown` для типа сущности: `All / Service / Host / Process Group`.
   - Поиск через `searchBarPlaceholder="Search entities..."` с debounce 400 мс.
   - `List.Section` по типу сущности.
   - Иконки: SERVICE → `Icon.Globe`, HOST → `Icon.Desktop`, PROCESS_GROUP → `Icon.Box`.

4. Actions:
   - `Open in Dynatrace` — `${tenantEndpoint}/ui/entity/${entity.id}`.
   - `Show Logs` — переход на Search Logs с `service.name = entity.name` (если SERVICE).
   - `Copy Entity ID`.

**AC:**
- [ ] Поиск по части имени возвращает релевантные результаты.
- [ ] Фильтр по типу работает корректно.
- [ ] Debounce не вызывает запрос при каждом нажатии клавиши.
- [ ] Deep-link формируется корректно.

---

## P1-S5 · Detail view: pretty-print JSON и stack traces

**Epic:** Log detail view improvements  
**Priority:** should  
**Depends on:** P0-S4  
**Context files:**
- `src/commands/search-logs/log-detail.tsx`

**Goal:**  
Улучшить отображение `content` поля в detail view: автоматически форматировать JSON и stack traces в читаемый вид через Raycast Markdown.

**Tasks:**

1. Создать утилиту `src/lib/utils/formatLogContent.ts`:
   ```ts
   export function formatLogContent(content: string): string
   ```
   Логика:
   - Попробовать `JSON.parse(content)`. Если успешно — вернуть markdown code block:
     ` ```json\n${JSON.stringify(parsed, null, 2)}\n``` `
   - Если содержит `\tat ` или `Exception:` или `Error:` — определить как stack trace, обернуть в ` ```\n...\n``` `.
   - Иначе — вернуть как есть.

2. В `log-detail.tsx` в секции "Log Message" / "Content" применить `formatLogContent(log.content)` перед рендером в `Detail.Metadata` или в markdown body.

3. Если `content` — stack trace, выделить первую строку (`Error: message`) как заголовок секции, остальные свернуть под `<details>` (через markdown).

4. Написать unit-тест `src/__tests__/formatLogContent.test.ts`:
   - JSON-строка → возвращает fenced code block с `json`.
   - Stack trace строка → возвращает fenced code block без языка.
   - Обычная строка → возвращает без изменений.

**AC:**
- [ ] JSON `content` отображается с подсветкой синтаксиса.
- [ ] Stack trace отображается моноширинным шрифтом.
- [ ] Обычный текст не изменяется.
- [ ] Все 3 unit-теста проходят.

---

## P1-S6 · Detail view: Related logs actions

**Epic:** Log detail view — related logs  
**Priority:** should  
**Depends on:** P1-S1  
**Context files:**
- `src/commands/search-logs/log-detail.tsx`
- `src/lib/utils/buildDqlQuery.ts`

**Goal:**  
Добавить в detail view быстрые действия для поиска связанных логов: по `trace_id` и по сервису в ±5-минутном окне.

**Tasks:**

1. В `log-detail.tsx` добавить в `ActionPanel` секцию «Related»:
   - `Find logs with this trace_id` — только если `log.trace_id` определён:
     - `Action.Push` на `SearchLogsView` с параметрами `{ extraFilter: 'trace_id == "${log.trace_id}"', timeframe: "30m" }`.
   - `Find logs for this service ±5 min` — только если `log.service?.name` определён:
     - Вычислить `startTime = log.timestamp - 5 мин`, `endTime = log.timestamp + 5 мин`.
     - `Action.Push` на `SearchLogsView` с абсолютным таймфреймом.
   - `Find all errors in this service today` — если `log.service?.name`:
     - Action.Push на Search Logs с `logLevel: "ERROR"` + `serviceName`.

2. `SearchLogsView` должен принять опциональный `initialParams` prop для предзаполнения всех фильтров.

**AC:**
- [ ] Action «Find logs with this trace_id» виден только при наличии `trace_id`.
- [ ] Переход корректно передаёт `trace_id` в DQL-фильтр.
- [ ] Action «Find logs for this service ±5 min» использует корректный абсолютный таймфрейм.
- [ ] Все три action-а отображаются в отдельной секции «Related».

---

# PHASE 2 — Power-user Tooling

---

## P2-S1 · Команда `dql-runner`: произвольный DQL

**Epic:** DQL Runner  
**Priority:** should  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/dql-runner/` (пустая директория)
- `src/lib/query.ts`
- `src/lib/types/grail.ts`

**Goal:**  
Дать опытному пользователю возможность выполнить произвольный DQL-запрос и увидеть результаты в виде динамической таблицы.

**Tasks:**

1. Создать `src/commands/dql-runner/index.tsx` — `Form`-команда:
   - `Form.TextArea` для DQL (placeholder с примером: `fetch dt.entity.service | limit 10`).
   - `Form.Dropdown` для таймфрейма: `15m`, `1h`, `4h`, `24h`, `custom`.
   - При `custom` показывать `Form.TextField` для абсолютного from/to.
   - `Form.Checkbox` «Save as template» — при чекнутом показывать `Form.TextField name`.
   - Action `Run` → `Action.SubmitForm`.

2. При submit: `push(<QueryResultsView dql={values.dql} timeframe={...} />)`.

3. Создать `src/commands/dql-runner/query-results.tsx`:
   - Принимает `dql: string`, `timeframe`.
   - Использует `useDynatraceQuery` для выполнения.
   - Получает `result.types[0].mappings` — массив имён колонок.
   - Рендерит `List` с динамическими accessories: первый маппинг → `title`, второй → `subtitle`, остальные → `accessories: [{ text: value }]` (до 3 аксессоров, Raycast ограничен).
   - Action `Save as Saved Query` — сохраняет в LocalStorage (интеграция с P2-S2).
   - Action `Copy as JSON` — все результаты в буфер.
   - Action `Copy DQL` — только запрос.

4. Если `values.saveAsTemplate` при submit → сохранить в LocalStorage через `saveSavedQuery(...)`.

**AC:**
- [ ] Форма DQL Runner открывается и принимает ввод.
- [ ] После submit выполняется запрос и результаты отображаются в list.
- [ ] Колонки строятся динамически из `result.types[0].mappings`.
- [ ] «Save as template» сохраняет запрос в LocalStorage.
- [ ] «Copy as JSON» копирует массив результатов.

---

## P2-S2 · Команда `saved-queries`: CRUD сохранённых запросов

**Epic:** Saved DQL Queries  
**Priority:** should  
**Depends on:** P2-S1  
**Context files:**
- `src/commands/saved-queries/` (пустая директория)
- `src/commands/dql-runner/index.tsx`

**Goal:**  
Предоставить пользователю личную библиотеку DQL-запросов с возможностью запуска в один клик.

**Tasks:**

1. Создать `src/lib/savedQueries.ts`:
   ```ts
   interface SavedQuery {
     id: string;
     name: string;
     dql: string;
     timeframe: string;
     tenantId?: string;   // если привязан к конкретному тенанту
     createdAt: string;
     isFavorite: boolean;
   }
   const STORAGE_KEY = "saved-queries:v1";

   export async function listSavedQueries(): Promise<SavedQuery[]>
   export async function saveSavedQuery(q: Omit<SavedQuery, 'id' | 'createdAt'>): Promise<SavedQuery>
   export async function deleteSavedQuery(id: string): Promise<void>
   export async function toggleFavorite(id: string): Promise<void>
   ```

2. Создать `src/commands/saved-queries/index.tsx`:
   - `List` с двумя секциями: «Favorites» и «All Queries».
   - `title`: `q.name`, `subtitle`: первые 60 символов DQL.
   - Actions:
     - `Run Query` (primary) → `push(<QueryResultsView dql={q.dql} .../>)`.
     - `Edit` → форма редактирования.
     - `Toggle Favorite` → перемещает между секциями.
     - `Copy DQL`.
     - `Delete` с подтверждением.

3. В `src/commands/dql-runner/query-results.tsx` action «Save as Saved Query» вызывает `saveSavedQuery(...)` и показывает `showToast({ title: "Saved!" })`.

**AC:**
- [ ] Список saved queries разбит на «Favorites» и остальные.
- [ ] Run Query открывает QueryResultsView с корректным DQL.
- [ ] Toggle Favorite перемещает между секциями.
- [ ] Delete требует подтверждения.
- [ ] Сохранённые запросы персистентны между запусками Raycast.

---

## P2-S3 · Menu Bar: Problems & Errors counter

**Epic:** Menu Bar ambient monitoring  
**Priority:** should  
**Depends on:** P1-S2  
**Context files:**
- `src/commands/menubar-problems/` (пустая директория)
- `src/lib/query.ts`
- `src/lib/tenants.ts`

**Goal:**  
Показывать число открытых проблем в macOS menu bar. Обновляться каждые 5 минут без открытия Raycast.

**Tasks:**

1. Создать `src/commands/menubar-problems/index.tsx` — `MenuBarExtra` команда:
   ```tsx
   export default function MenuBarProblems() {
     const { data } = useCachedPromise(fetchOpenProblemsCount, [], { keepPreviousData: true });
     const count = data ?? 0;
     return (
       <MenuBarExtra
         icon={{ source: "assets/dynatrace-icon.png", tintColor: count > 0 ? Color.Red : Color.Green }}
         title={count > 0 ? `${count}` : undefined}
       >
         ...
       </MenuBarExtra>
     );
   }
   ```

2. Submenu содержит:
   - Top-5 открытых проблем (name + severity + «X ago»).
   - Разделитель.
   - `MenuBarExtra.Item` «Open Active Problems» → `open("raycast://extensions/...")`
   - `MenuBarExtra.Item` «Refresh» → `revalidate()`.

3. `fetchOpenProblemsCount` — выполняет DQL `fetch dt.davis.problems | filter status == "OPEN" | stats count()`, возвращает число.

4. Если тенантов нет — показывать иконку без цифры + submenu с «Setup Tenants».

5. В `package.json` команда `menubar-problems` уже добавлена (P0-S4) с `"interval": "5m"`.

**AC:**
- [ ] Menu bar иконка появляется в macOS status bar.
- [ ] При наличии OPEN problems показывает красную иконку с числом.
- [ ] При 0 проблемах иконка зелёная без цифры.
- [ ] Submenu содержит top-5 проблем.
- [ ] «Refresh» обновляет данные немедленно.
- [ ] Обновление происходит каждые 5 минут автоматически (через Raycast interval).

---

## P2-S4 · Export Actions: Copy as JSON/CSV, Save to file

**Epic:** Export functionality  
**Priority:** nice-to-have  
**Depends on:** P1-S1, P1-S2  
**Context files:**
- `src/commands/search-logs/index.tsx`
- `src/commands/problems/index.tsx`

**Goal:**  
Добавить экспорт данных из списков в JSON, CSV и файл в рабочей директории.

**Tasks:**

1. Создать `src/lib/utils/exportData.ts`:
   ```ts
   export function toJson(records: unknown[]): string
   export function toCsv(records: Record<string, unknown>[]): string
   // CSV: первая строка — заголовки из ключей первого объекта
   ```

2. В `search-logs/index.tsx` добавить `Action` в ActionPanel (секция «Export»):
   - `Copy all as JSON` → `Clipboard.copy(toJson(data))` + `showToast`.
   - `Copy all as CSV` → `Clipboard.copy(toCsv(data))` + `showToast`.
   - `Save to file` → `fs.writeFile(path.join(os.homedir(), "Downloads", "dt-logs-<timestamp>.json"), ...)` + `showInFinder`.

3. Аналогично для `problems/index.tsx`.

4. Unit-тесты для `toCsv`:
   - Пустой массив → только заголовок или пустая строка.
   - Массив объектов → корректные строки с экранированием запятых.

**AC:**
- [ ] «Copy all as JSON» копирует корректный JSON в буфер обмена.
- [ ] «Copy all as CSV» копирует корректный CSV с заголовком.
- [ ] «Save to file» создаёт файл в `~/Downloads/` и открывает Finder.
- [ ] Unit-тесты `toCsv` проходят.

---

# PHASE 3 — Integrations & Advanced Observability

---

## P3-S1 · Команда `traces`: Search Traces

**Epic:** Traces command  
**Priority:** should  
**Depends on:** P0-S6  
**Context files:**
- `src/commands/` (пустая директория `traces/` создать)
- `src/lib/query.ts`
- `src/lib/types/grail.ts`

**Goal:**  
Реализовать поиск distributed traces (spans) с фильтрацией по сервису, статусу и длительности.

**Tasks:**

1. Добавить команду `traces` в `package.json` → `"commands"`.

2. Создать `src/lib/types/span.ts` с Zod-схемой:
   ```ts
   {
     trace_id: string,
     span_id: string,
     span.name: string,
     service.name: string,
     "span.duration.us": number,
     status_code: "UNSET" | "OK" | "ERROR",
     timestamp: string,
   }
   ```

3. DQL-запрос:
   ```
   fetch spans
   | filter service.name == "${serviceName}"        // опционально
   | filter status_code == "${statusCode}"           // опционально
   | filter span.duration.us > ${minDurationUs}     // опционально
   | sort timestamp desc
   | limit 50
   ```

4. Создать `src/commands/traces/index.tsx`:
   - Фильтры: сервис (TextField с debounce), статус (Dropdown: ALL / OK / ERROR), длительность (Dropdown: any / >100ms / >500ms / >1s / >5s).
   - `List.Item`: `title` = `span.name`, `subtitle` = `service.name`, accessories = длительность + статус-иконка.

5. Создать `src/commands/traces/trace-detail.tsx`:
   - Секции: Trace Info (trace_id, span_id, duration), Service, Timeline (start → end в ms).
   - Actions:
     - `Open in Distributed Traces` — deep-link (формат из существующего `log-detail.tsx`).
     - `Find related logs` — переход в Search Logs с `trace_id == "..."`.

**AC:**
- [ ] Команда `traces` открывается.
- [ ] Фильтр по сервису выполняет серверный DQL-запрос.
- [ ] Фильтр по статусу работает.
- [ ] Фильтр по длительности (в мс) конвертируется в микросекунды для DQL.
- [ ] «Find related logs» переходит в Search Logs с `trace_id` фильтром.

---

## P3-S2 · AI Explain: объяснение stack trace

**Epic:** AI Actions in log detail  
**Priority:** nice-to-have  
**Depends on:** P1-S5  
**Context files:**
- `src/commands/search-logs/log-detail.tsx`
- `src/lib/utils/formatLogContent.ts`

**Goal:**  
Добавить action «Explain this error» в detail view логов, использующий Raycast AI API для анализа stack trace.

**Tasks:**

1. В `log-detail.tsx` добавить action:
   ```tsx
   import { AI, Action } from "@raycast/api";
   
   <Action
     title="Explain This Error"
     icon={Icon.LightBulb}
     onAction={async () => {
       const explanation = await AI.ask(
         `Explain this error and suggest a fix:\n\n${log.content}`,
         { creativity: "low" }
       );
       await push(<Detail markdown={explanation} />);
     }}
   />
   ```

2. Показывать `showToast({ style: Toast.Style.Animated, title: "Analyzing..." })` во время запроса.

3. Добавить action «Summarize last 10 errors for this service»:
   - Загружает последние 10 ERROR записей для `log.service.name`.
   - Формирует промпт с их `content`.
   - Показывает markdown-детейл с суммаризацией.

4. Оба action-а видны только если Raycast AI доступен (проверить через `environment.canAccess(AI)`).

**AC:**
- [ ] Action «Explain This Error» виден только при наличии `AI` доступа.
- [ ] Ответ AI отображается в новом Detail view.
- [ ] Во время запроса показывается `Animated` toast.
- [ ] «Summarize last 10 errors» загружает данные и показывает суммаризацию.

---

## P3-S3 · Интеграция: Create Jira ticket из проблемы/лога

**Epic:** External integrations  
**Priority:** nice-to-have  
**Depends on:** P1-S2  
**Context files:**
- `src/commands/problems/problem-detail.tsx`
- `src/commands/search-logs/log-detail.tsx`

**Goal:**  
Создать Jira-тикет напрямую из Problem или Log detail view с предзаполненными полями.

**Tasks:**

1. В `package.json` добавить глобальные preferences:
   - `jiraUrl` (TextField, `https://yourcompany.atlassian.net`).
   - `jiraEmail` (TextField).
   - `jiraApiToken` (PasswordField).
   - `jiraProjectKey` (TextField, e.g. `OPS`).

2. Создать `src/lib/integrations/jira.ts`:
   ```ts
   export async function createJiraIssue(params: {
     summary: string;
     description: string;
     issueType: "Bug" | "Incident" | "Task";
   }): Promise<{ key: string; url: string }>
   ```
   - `POST {jiraUrl}/rest/api/3/issue` с Basic Auth.
   - `description` форматируется как Atlassian Document Format (ADF) — минимальная реализация: параграф с текстом.

3. В `problem-detail.tsx` добавить action «Create Jira Incident»:
   - Формирует `summary`: `[DT] ${event.name}`.
   - Формирует `description`: severity, affected entities, deep-link, duration.
   - После успеха: `showToast({ title: `Created ${key}` })` + action «Open in Jira».

4. В `log-detail.tsx` добавить action «Create Jira Bug»:
   - `summary`: первые 80 символов `log.content`.
   - `description`: полный `log.content` + service + deep-link.

5. Action видны только если `jiraUrl` и `jiraApiToken` заполнены в preferences.

**AC:**
- [ ] При заполненных Jira preferences action «Create Jira Incident» виден в `problem-detail`.
- [ ] При незаполненных preferences action скрыт.
- [ ] Успешное создание показывает `key` в toast.
- [ ] Созданный тикет содержит deep-link на Dynatrace.

---

# PHASE 4 — Store Submission

---

## P4-S1 · README.md с полным описанием и структурой скриншотов

**Epic:** Store submission  
**Priority:** must  
**Depends on:** все Phase 1 завершены  
**Context files:**
- `README.md`
- `package.json`

**Goal:**  
Написать финальный README.md, пригодный для публикации в Raycast Store.

**Tasks:**

1. Структура `README.md`:
   ```markdown
   # Dynatrace for Raycast
   
   > Monitor your Dynatrace environment directly from Raycast.
   
   ## Features
   - 🔍 Search Logs — ...
   - 🚨 Active Problems — ...
   - 🚀 Recent Deployments — ...
   - 🏷 Find Entity — ...
   - ⚡ Run DQL Query — ...
   - 💾 Saved DQL Queries — ...
   - 🖥 Menu Bar Problems — ...
   
   ## Setup
   ### 1. Create OAuth credentials in Dynatrace
   ...step-by-step...
   
   ### 2. Add your first tenant
   ...
   
   ## Commands
   | Command | Description |
   ...
   
   ## Screenshots
   ![Search Logs](metadata/search-logs.png)
   ...
   
   ## Contributing
   ...
   ```

2. Создать директорию `metadata/` — placeholder для скриншотов (минимум 6 файлов `.png`, можно пустые на этапе подготовки).

3. В `package.json` заполнить `"description"`, `"categories"` (предложение: `["Developer Tools", "Productivity"]`), `"keywords"` (предложение: `["dynatrace", "observability", "logs", "monitoring", "apm", "dql", "grail"]`).

**AC:**
- [ ] `README.md` содержит все 6 секций.
- [ ] `package.json` содержит непустые `categories` и `keywords`.
- [ ] Директория `metadata/` создана.
- [ ] `ray lint` не ругается на структуру `package.json`.

---

## P4-S2 · Security review: убедиться, что секреты не логируются

**Epic:** Store submission / Security  
**Priority:** must  
**Depends on:** P0-S5, P0-S6  
**Context files:**
- `src/lib/auth.ts`
- `src/lib/tenants.ts`
- `src/lib/query.ts`
- `src/commands/tenants/tenant-form.tsx`

**Goal:**  
Провести security review кода для Store: убедиться, что токены и секреты не попадают в логи, toast-сообщения или error outputs.

**Tasks:**

1. Проверить все места с `console.log`, `console.error`, `showToast` — секреты (`clientSecret`, `access_token`) должны быть заменены на `[REDACTED]` или полностью исключены из вывода.

2. В `OAuthError`: убедиться, что тело ошибки не содержит `client_secret` — Dynatrace SSO не должен его возвращать, но добавить sanity-check:
   ```ts
   const safeBody = body.replace(/client_secret=[^&]+/, "client_secret=[REDACTED]");
   ```

3. В `src/lib/tenants.ts`: поля `clientSecret` хранятся в `LocalStorage`. Добавить комментарий о том, что это не CloudSync (`LocalStorage` в Raycast не синхронизируется — хорошо для секретов, задокументировать).

4. Проверить, что `useMockData` preference не активирован по умолчанию (`"default": false` или отсутствует в production build).

5. Создать `src/__tests__/security.test.ts`:
   - Тест: `OAuthError` не содержит `client_secret` в сообщении.
   - Тест: `getAccessToken` не логирует `access_token`.

**AC:**
- [ ] Нет `console.log` с токенами или секретами.
- [ ] `OAuthError` редактирует `client_secret` в body.
- [ ] `useMockData` по умолчанию `false`.
- [ ] Security тесты проходят.
- [ ] Добавлен комментарий в tenants.ts о non-CloudSync LocalStorage.

---

## P4-S3 · CHANGELOG.md и финальный `v1.0.0`

**Epic:** Store submission  
**Priority:** must  
**Depends on:** P4-S1, P4-S2  
**Context files:**
- `CHANGELOG.md`
- `package.json`

**Goal:**  
Подготовить финальный CHANGELOG для релиза v1.0.0 и поднять версию в package.json.

**Tasks:**

1. `CHANGELOG.md` структура:
   ```markdown
   # Changelog
   
   ## [1.0.0] — YYYY-MM-DD
   
   ### Added
   - OAuth 2.0 client credentials authentication
   - Multi-tenant support via Manage Tenants command
   - Search Logs with server-side filtering, pagination and content search
   - Active Problems command with Davis AI severity levels
   - Recent Deployments with incident correlation actions
   - Find Entity command for services, hosts, and process groups
   - Run DQL Query for arbitrary Grail queries
   - Saved DQL Queries library
   - Menu Bar Problems counter with 5-minute refresh
   - Log detail view with JSON pretty-print and stack trace formatting
   - Related logs navigation (by trace_id, service ±5 min)
   
   ### Changed
   - Replaced static Bearer token with OAuth 2.0 flow
   - Refactored to multi-command architecture
   
   ### Fixed
   - Race condition on rapid filter changes (AbortController)
   - Client-side service filter replaced with server-side DQL filter
   
   ### Security
   - OAuth credentials stored in non-synced LocalStorage only
   - Tokens never appear in logs or error messages
   ```

2. В `package.json` поднять `"version"` до `"1.0.0"`.

3. Убедиться, что все команды в `package.json` имеют непустые `"description"`.

**AC:**
- [ ] `CHANGELOG.md` содержит секцию `[1.0.0]` с датой.
- [ ] Все подсекции (Added, Changed, Fixed, Security) заполнены.
- [ ] `package.json` `"version"` == `"1.0.0"`.
- [ ] `ray lint` без ошибок на финальном состоянии проекта.

---

# Приложение: Зависимости между сторисами

```
P0-S1 ──► P0-S2 ──► P0-S3
               │
               └──► P0-S4 ──► P0-S5 ──► P0-S6 ──► P1-S1
                                              │
                                              ├──► P1-S2 ──► P2-S3
                                              │         └──► P3-S3
                                              ├──► P1-S3
                                              └──► P1-S4

P0-S4 ──► P0-S7

P0-S4 ──► P1-S5 ──► P3-S2
P1-S1, P1-S5 ──► P1-S6

P0-S6 ──► P2-S1 ──► P2-S2
P0-S6 ──► P3-S1

P1-S1, P1-S2 ──► P2-S4

P1-S1..P1-S4 ──► P4-S1
P0-S5, P0-S6 ──► P4-S2
P4-S1, P4-S2 ──► P4-S3
```

---

# Быстрая сводка: какие истории реализовать в первую очередь

| Порядок | Story | Причина |
|---|---|---|
| 1 | P0-S1 | Быстро, даёт чистую базу |
| 2 | P0-S2 | Убирает tech debt с типами |
| 3 | P0-S3 | CI защищает все последующие PR |
| 4 | P0-S4 | Реструктуризация до добавления команд |
| 5 | P0-S5 | OAuth — основа всех запросов |
| 6 | P0-S6 | Multi-tenant — основа всех команд |
| 7 | P0-S7 | Тесты для критических утилит |
| 8 | P1-S1 | Hardened Search Logs |
| 9 | P1-S2 | Active Problems — главная фича для админов |
| 10 | P1-S3 | Deployments — корреляция инцидентов |
