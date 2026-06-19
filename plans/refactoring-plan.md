# План рефакторинга проекта TAU

> На основе аудита архитектуры: разделение на серверную часть (Bun + Fastify + Prisma + MSSQL) и фронтенд (Vue 3 + Pinia + Vuetify + Neutralino.js)

---

## 🖥️ Серверная часть (server/)

### 🔴 Уровень 1 — Срочно исправить (критические проблемы)

#### 1.1. Дублирование точек входа: `index.ts` vs `server.ts`

**Проблема:** Два независимых entry point с дублирующейся логикой:

- [`server/index.ts`](../server/index.ts) — ручная регистрация роутов, встроенная авторизация через preHandler, встроенный WebSocket
- [`server/server.ts`](../server/server.ts) — вызов `registerRoutes()`, отдельный `authMiddleware`, отдельный `setupWebSocket`

**Непоследовательности:**

- В [`index.ts`](../server/index.ts:40-52) публичные роуты = `['/pid', '/ws']`, а в [`middleware/auth.ts`](../server/middleware/auth.ts:5) = `['/pid', '/ws', '/health', '/callback']`
- API-ключ хардкодом в [`index.ts`](../server/index.ts:23) (`'your-secret-api-key-12345'`)
- В [`server.ts`](../server/server.ts:36) — поиск свободного порта, в [`index.ts`](../server/index.ts:185-193) — retry +1 при EADDRINUSE

**Что сделать:** Выбрать один entry point (рекомендуется [`server.ts`](../server/server.ts) — чище архитектура), удалить [`index.ts`](../server/index.ts), перенести нужную логику (graceful shutdown, heartbeat) в [`server.ts`](../server/server.ts).

#### 1.2. Утечка credentials в репозиторий

**Проблема:** В [`server/prisma/schema.prisma`](../server/prisma/schema.prisma:17-19) строка подключения к MSSQL содержит:

```
sqlserver://10.69.19.59:1433;database=TAU;user=TAUadmin;password=Tau74;...
```

Это **production-credentials в открытом виде**. Аналогично shadowDatabaseUrl.

**Что сделать:** Немедленно вынести в переменные окружения (`DATABASE_URL`, `SHADOW_DATABASE_URL`), заменить на `env("DATABASE_URL")`. Добавить `.env.*` в `.gitignore` и перевыпустить credentials.

#### 1.3. Хардкод API-ключа

**Проблема:** В [`server/index.ts`](../server/index.ts:23) и [`server/middleware/auth.ts`](../server/middleware/auth.ts:4) API-ключ задан как `'your-secret-api-key-12345'` — фиктивное значение, но являющееся дефолтом для всех сред.

**Что сделать:** Убрать fallback-значение. Сделать API-ключ строго обязательным через `process.env.API_KEY` и бросать ошибку при его отсутствии.

#### 1.4. Дублирующиеся интерфейсы: `server/models/interfaces.ts` vs Prisma-генерированные типы

**Проблема:** В [`server/models/interfaces.ts`](../server/models/interfaces.ts) вручную написаны интерфейсы `Component`, `Product`, `Specification`, `Operation`, `Template` и т.д., которые полностью дублируют (и частично расходятся с) Prisma-генерированными типами из `../shared/src`.

**Пример расхождения:** В `models/interfaces.ts` у `Product` поля `operationId`, `specificationId`, `templateId`, `testId`, а в Prisma-схеме эти поля удалены — продукт связан через `specificationProductMP`.

**Что сделать:** Удалить [`server/models/interfaces.ts`](../server/models/interfaces.ts), везде использовать `import { Prisma } from "../shared/src"` и Prisma-генерированные типы (`Prisma.ProductCreateInput`, `Prisma.ComponentGetPayload` и т.д.).

---

### 🟡 Уровень 2 — Важные улучшения (средний приоритет)

#### 2.1. `console.log()` вместо структурированного логирования

**Проблема:** Почти все роуты используют `console.log(error)` вместо `app.log.error(error)`. Примеры: [server/routes/product.ts:29](../server/routes/product.ts:29), [server/routes/product.ts:81](../server/routes/product.ts:81), [server/routes/component.ts:97](../server/routes/component.ts:97).

В то же время в `app.ts` настроен Pino-логгер. Middleware логирования на WebSocket в `logger.ts` есть, но не используется в роутах.

**Что сделать:** Заменить все `console.log` на `app.log.info` / `app.log.error`. Удалить `console.log` из error-handler блоков.

#### 2.2. Кривой error-handling: `reply.code(500).send({ error: "Internal Server Error" })` без деталей

**Проблема:** Во всех роутах дублируется паттерн try-catch с отправкой 500 и без возврата кода. Нет единого error-handler middleware.

Пример: [`server/routes/product.ts:28-33`](../server/routes/product.ts:28-33), [`server/routes/component.ts:20-22`](../server/routes/component.ts:20-22).

При этом есть [`handleError.ts`](../server/handleError.ts) — утилита для обработки Prisma-ошибок, но она **нигде не используется**.

**Что сделать:** Зарегистрировать глобальный error-handler в Fastify (`app.setErrorHandler`), использовать `handlePrismaError()` из [`handleError.ts`](../server/handleError.ts). Убрать try-catch из каждого роута.

#### 2.3. Отсутствие валидации входящих данных

**Проблема:** В POST/PUT-роутах валидация manual: `if (!data.snComponent || !data.pnComponentId ...) throw`. Установлен `zod` в зависимостях, но он не используется для валидации. Есть `prisma-zod-generator` в `schema.prisma`, генерирующий Zod-схемы в `../zod`.

**Что сделать:** Использовать Zod-схемы (сгенерированные или рукописные) для валидации body/params/query через `@fastify/type-provider-zod` или встроенный Fastify schema validation.

#### 2.4. Миграционные скрипты и сиды в корне сервера

**Проблема:** В корне [`server/`](../server/) находятся:

- `CHIR1.ts`, `CHIR2.ts`, `CHIR_M.ts`, `CHIR_T.ts` — одноразовые миграции SN
- `bb.ts`, `rr.ts` — backup/restore
- `seed.ts`, `seed2.ts`, `seedKD.ts`, `seedOK.ts` — seed-скрипты

Они засоряют корень и могут быть случайно выполнены в production.

**Что сделать:** Переместить в `server/scripts/` или `server/migrations/`. Заблокировать их выполнение при `NODE_ENV=production`.

#### 2.5. Unused файлы

**Проблема:** [`server/index_backup.ts`](../server/index_backup.ts), [`server/prisma-backup 11.06.2026.json`](../server/prisma-backup%2011.06.2026.json) — устаревшие бэкапы. [`server/models/interfaces.ts`](../server/models/interfaces.ts) — не используется. [`frontend/src/api/wsServices.ts`](../frontend/src/api/wsServices.ts) — вероятно, не используется. [`frontend/src/components/DefectDetailModal_old.vue`](../frontend/src/components/DefectDetailModal_old.vue) — старая версия. [`frontend/src/components/views/__AddArticle.vue`](../frontend/src/components/views/__AddArticle.vue), [`_ProductAssembly.vue`](../frontend/src/components/views/_ProductAssembly.vue) — старые версии.

**Что сделать:** Аудит и удаление unused-файлов. Использовать `git rm` для отслеживаемых, проверять imports через TypeScript.

---

### 🟢 Уровень 3 — Улучшения (когда будет время)

#### 3.1. Синглтон PrismaClient

**Проблема:** PrismaClient создаётся в плагине ([`prisma.plugin.ts`](../server/prisma.plugin.ts)) и декорируется в Fastify. Но CHIR-скрипты и seed-файлы создают новый `new PrismaClient()` в каждом файле — это может привести к исчерпанию соединений.

**Что сделать:** Вынести создание PrismaClient в отдельный модуль (singleton pattern), использовать единый инстанс.

#### 3.2. WebSocket дублирование: `server/index.ts` vs `server/routes/index.ts`

**Проблема:** В [`server/index.ts`](../server/index.ts:104-177) реализован WebSocket-сервер, а в [`server/routes/index.ts`](../server/routes/index.ts) импортируются `activeClients` и `sendToClient` из несуществующего пути `../websocket/websocketStore`. Это указывает на незавершённый рефакторинг.

**Что сделать:** Унифицировать WebSocket-логику: вынести всё управление клиентами в отдельный модуль `server/websocket/manager.ts` (или доработать [`logger.ts`](../server/logger.ts)).

#### 3.3. Отсутствие типов ответов в API

**Проблема:** Роуты не типизированы через Fastify-generics. Пример: `app.get("/products", async (request, reply) => {...})` — нет типов для request/response.

**Что сделать:** Использовать `app.get<{ Reply: Product[] }>("/products", ...)`. Прописать типы ответов для всех эндпоинтов.

#### 3.4. Нет миграций Prisma

**Проблема:** В директории [`server/prisma/migrations/`](../server/prisma/migrations/) есть только `migration_lock.toml`, но самих миграций нет. База, вероятно, синхронизируется через `prisma db push`.

**Что сделать:** Сгенерировать начальную миграцию: `prisma migrate dev --name init`. Настроить `prisma migrate deploy` в CI/CD.

#### 3.5. Структура роутов: функциональный подход против `registerRoutes()`

**Проблема:** В [`index.ts`](../server/index.ts) роуты регистрируются по одному, в [`server.ts`](../server/server.ts) через `registerRoutes()`. Некоторые файлы роутов импортируют `handleError.ts` и `prismaModelMap.ts`, но не используют их.

**Что сделать:** Выбрать единую стратегию (рекомендуется `registerRoutes()`), убрать дублирование, удалить неиспользуемые импорты.

---

## 🎨 Фронтенд (frontend/)

### 🔴 Уровень 1 — Срочно исправить (критические проблемы)

#### 1.1. Neutralino.js: Активация вызовов команд, закомментированных в production

**Проблема:** В [`frontend/src/main.ts`](../frontend/src/main.ts:31-36) и [`frontend/src/stores/websockets.ts`](../frontend/src/stores/websockets.ts:118-207) множество закомментированных вызовов `send()` для `appClientConnect` и heartbeat. Код предполагает, что эти команды когда-то должны были отправляться, но сейчас отключены. При этом heartbeat-функция [`localHeartbeat.ts`](../frontend/src/assets/utils/localHeartbeat.ts) импортируется, но не используется.

**Что сделать:** Провести аудит: либо включить и донастроить heartbeat/appClientConnect, либо удалить мёртвый код.

#### 1.2. Неиспользуемые и дублирующиеся компоненты

**Проблема:**

- [`_ChecklistViewerV2.vue`](../frontend/src/components/_ChecklistViewerV2.vue) — старая версия, есть [`ChecklistViewerV2.vue`](../frontend/src/components/ChecklistViewerV2.vue)
- [`DefectWorkflow__.vue`](../frontend/src/components/DefectWorkflow__.vue) — старая версия, есть [`DefectWorkflow.vue`](../frontend/src/components/DefectWorkflow.vue)
- [`DefectDetailModal_old.vue`](../frontend/src/components/DefectDetailModal_old.vue) — старая версия, есть [`DefectDetailModal.vue`](../frontend/src/components/DefectDetailModal.vue)
- [`__AddArticle.vue`](../frontend/src/components/views/__AddArticle.vue) — старая версия, есть [`AddArticle.vue`](../frontend/src/components/views/AddArticle.vue)
- [`_ProductAssembly.vue`](../frontend/src/components/views/_ProductAssembly.vue) — старая версия, есть [`ProductAssembly.vue`](../frontend/src/components/views/ProductAssembly.vue)

**Что сделать:** Удалить все файлы-призраки (с префиксами `_`, `__`). Проверить, что imports в компонентах указывают на актуальные файлы.

#### 1.3. Закомментированный код — «кладбище» в production

**Проблема:** Почти каждый ключевой файл содержит блоки закомментированного кода:

- [`App.vue`](../frontend/src/App.vue:57-65) — закомментированный `setTitle()`
- [`ToolBar.vue`](../frontend/src/components/ToolBar.vue:7-10) — закомментированные импорты
- [`store/user.ts`](../frontend/src/stores/user.ts:67-90) — целый закомментированный метод `getUserName` внутри `getUserName`
- [`store/websockets.ts`](../frontend/src/stores/websockets.ts:118-177) — закомментированные send/heartbeat

**Что сделать:** Вычистить весь закомментированный код. Если он нужен для истории — git хранит историю. Если нужен для документации — перенести в комментарии над методами.

#### 1.4. `console.log()` в production

**Проблема:** Повсеместное использование `console.log()` для отладки во всех view-компонентах, сторах и утилитах. В production это создаёт нагрузку и засоряет консоль.

**Что сделать:** Настроить ESLint-правило `no-console` (с исключением для `warn`/`error`). Либо создать обёртку-логгер, которая отключается в production.

---

### 🟡 Уровень 2 — Важные улучшения (средний приоритет)

#### 2.1. Pinia stores: дублирование логики между сторами и API-сервисами

**Проблема:** Сторы (например, [`user.ts`](../frontend/src/stores/user.ts), [`websockets.ts`](../frontend/src/stores/websockets.ts)) напрямую вызывают API-функции, а также содержат логику авторизации Windows. API-слой ([`apiService.ts`](../frontend/src/api/apiService.ts)) — это просто обёртка над fetch, без абстракций.

**Что сделать:** Разделить ответственность: API-сервисы — только HTTP-запросы. Сторы — только state management. Вынести бизнес-логику (авторизация, heartbeat) в composables или утилиты.

#### 2.2. Neutralino API: прямые вызовы из компонентов

**Проблема:** Вызовы `os.execCommand`, `neuWindow.setTitle`, `filesystem.*` разбросаны по компонентам и сторам: [`App.vue`](../frontend/src/App.vue:51), [`user.ts:97`](../frontend/src/stores/user.ts:97), [`websockets.ts:51`](../frontend/src/stores/websockets.ts:51).

**Что сделать:** Создать слой абстракции `services/neutralino.service.ts`, который инкапсулирует Neutralino API. Компоненты не должны знать о Neutralino.

#### 2.3. Отсутствие типов для API-ответов

**Проблема:** В [`apiService.ts`](../frontend/src/api/apiService.ts) метод `fetchData<T>` использует generic, но API-сервисы почти никогда не передают конкретный тип.

Пример: [`componentServices.ts`](../frontend/src/api/componentServices.ts) — вызовы `post<Component>("/components", body)` используют `Component` из Prisma, но тип ответа может не совпадать.

**Что сделать:** Прописать конкретные типы для каждого эндпоинта. Использовать `Prisma.ComponentGetPayload<{ include: ... }>` вместо базового `Component`.

#### 2.4. Vite config: неиспользуемые плагины и дублирование

**Проблема:** В [`vite.config.ts`](../frontend/vite.config.ts:10) определён `__BUILD_DATE__`, который используется только в `user.ts:9`. `VueDevTools` включён (может быть в production).

**Что сделать:** Условно подключать `plugin-vue-devtools` только для dev-сборки. Убрать лишние глобальные переменные.

#### 2.5. index.html: неиспользуемые public-файлы

**Проблема:** В [`frontend/public/`](../frontend/public/) десятки скриптов (`.ps1`, `.vbs`, `.cs`, `.exe`), которые не подключаются через `index.html`. Среди них:

- `auth.cs`, `auth.exe` — C#-компилируемая авторизация
- `convert.ps1`, `convert2.ps1`, `convert.vbs`, `convert2.vbs`, `simpleConvert.*` — скрипты конвертации
- `testLog.ps1`, `RunFromNetwork.ps1`

**Что сделать:** Аудит: какие из них реально используются через Neutralino API (`os.execCommand`)? Остальные — удалить или переместить в `conversion-scripts/` на одном уровне с проектом.

---

### 🟢 Уровень 3 — Улучшения (когда будет время)

#### 3.1. Изолировать Prisma-типы на фронтенде

**Проблема:** Импорты из `../../../shared/src` разбросаны по всему фронтенду: [`interfaces.ts:1`](../frontend/src/assets/interfaces.ts:1), [`user.ts:3`](../frontend/src/stores/user.ts:3). Это создаёт жёсткую связь с серверной частью.

**Что сделать:** Сгенерировать локальные типы на фронтенде (через `prisma-json-schema` или вручную) либо использовать копию Prisma-клиента только с типами. Либо вынести `shared/` в отдельный npm-пакет.

#### 3.2. Неявный порядок инициализации в `main.ts`

**Проблема:** В [`main.ts:31-36`](../frontend/src/main.ts:31-36):

```typescript
userStore.getAuth().then(() => {
  userStore.getUserENV().then(() => {
    wsStore.connect();
    userStore.getUserName();
  });
});
```

Цепочка `.then()` создаёт жесткую последовательность, которую трудно отслеживать. Нет обработки ошибок на каждом уровне.

**Что сделать:** Использовать `async/await` с try-catch для каждого шага инициализации. Добавить лоадер на время инициализации.

#### 3.3. Работа со строками подключения: `import.meta.env.VITE_*` разбросаны по компонентам

**Проблема:** Переменные `VITE_OK_PATH`, `VITE_URL_WS`, `VITE_URL_API` используются непосредственно в компонентах: [`InputControl.vue:22`](../frontend/src/components/views/InputControl.vue:22), [`websockets.ts:12`](../frontend/src/stores/websockets.ts:12).

**Что сделать:** Создать единый конфигурационный модуль `src/config/index.ts`, экспортирующий все переменные окружения с типизацией.

#### 3.4. Тесты: минимальное покрытие

**Проблема:** В [`frontend/src/tests/`](../frontend/src/tests/) только два теста: `svgGeneration.test.ts` и `useTableEditor.test.ts`. Нет тестов для API-сервисов, сторов, основных view-компонентов.

**Что сделать:** Добавить unit-тесты для API-сервисов (с mocking fetch), Pinia stores, ключевых утилит (генерация SN, трансформация спецификации).

#### 3.5. Vue Router: только 3 маршрута, основная навигация — через ToolBar

**Проблема:** Vue Router используется минимально (3 маршрута). Фактическая навигация — через компонент [`ToolBar.vue`](../frontend/src/components/ToolBar.vue) с динамическими компонентами (v-tabs + `<component :is="current">`). Это bypass роутера, потеря URL-адресации.

**Что сделать:** Перевести навигацию на полноценные роуты: `/input-control`, `/pre-production`, `/assembly`, `/admin`. Использовать `<router-view>` внутри ToolBar или отдельных layout-компонентов.

---

## 📊 Сводная карта этапов рефакторинга

```
┌────────────────────────────────────────────────────────────────┐
│                      ЭТАП 1: СРОЧНО                             │
│  server: index.ts vs server.ts             │ очистка credentials │
│  server: хардкод API-ключа                 │ удалить дубликаты   │
│  server: models/interfaces.ts              │                    │
│  frontend: удалить файлы-призраки          │                    │
│  frontend: вычистить console.log           │                    │
│  frontend: вычистить dead code             │                    │
├────────────────────────────────────────────────────────────────┤
│                     ЭТАП 2: ВАЖНО                               │
│  server: заменить console.log на Pino      │ error-handler     │
│  server: Zod-валидация                     │ Prisma-миграции   │
│  server: переместить скрипты в scripts/    │                   │
│  frontend: абстрагировать Neutralino API   │                   │
│  frontend: централизовать .env             │                   │
│  frontend: типизировать API-ответы         │                   │
├────────────────────────────────────────────────────────────────┤
│                    ЭТАП 3: УЛУЧШЕНИЯ                            │
│  server: singletone Prisma                 │ WebSocket-рефакт  │
│  server: типизировать ответы               │                   │
│  frontend: изолировать Prisma-типы         │                   │
│  frontend: async/await инициализацию       │                   │
│  frontend: полноценный Vue Router          │                   │
│  frontend: тесты                           │                   │
└────────────────────────────────────────────────────────────────┘
```
