# Документация проекта TAU (Система управления производством)

## Оглавление

1. [Общее описание](#общее-описание)
2. [Архитектура проекта](#архитектура-проекта)
3. [Frontend (Клиентская часть)](#frontend-клиентская-часть)
4. [Backend (Серверная часть)](#backend-серверная-часть)
5. [Shared (Общие типы)](#shared-общие-типы)
6. [База данных](#база-данных)
7. [Основные функции системы](#основные-функции-системы)

---

## Общее описание

**TAU** - это десктопное приложение для управления производственным процессом, построенное на базе **Neutralino.js**. Система предназначена для отслеживания жизненного цикла изделий, от предпроизводства до упаковки.

### Технологический стек:

- **Frontend**: Vue 3 + TypeScript + Vuetify + Vite
- **Backend**: Node.js + Fastify + Prisma ORM
- **Database**: PostgreSQL
- **Desktop Framework**: Neutralino.js
- **Real-time**: WebSocket (Socket.IO)

---

## Архитектура проекта

Проект имеет монорепозиторную структуру:

```
TAU/
├── frontend/          # Клиентская часть (Vue 3)
├── server/            # Серверная часть (Fastify API)
├── shared/            # Общие типы и схемы (Prisma)
└── neutralino.config.json  # Конфигурация Neutralino
```

---

## Frontend (Клиентская часть)

### Структура директорий

```
frontend/
├── src/
│   ├── assets/             # Ресурсы и утилиты
│   │   ├── interfaces.ts   # TypeScript интерфейсы
│   │   ├── utils/          # Утилиты
│   │   ├── printer.ts      # Функции печати
│   │   ├── yandexWatcher.ts # Интеграция с Яндекс.Диском
│   │   └── transformSP.ts  # Трансформация спецификаций
│   │
│   ├── components/         # Vue компоненты
│   │   ├── views/          # Компоненты-представления
│   │   ├── ToolBar.vue     # Панель инструментов
│   │   └── ProductInformation.vue
│   │
│   ├── stores/             # Pinia хранилища
│   │   ├── user.ts         # Управление пользователем
│   │   ├── websockets.ts   # WebSocket соединение
│   │   ├── counter.ts      # Счетчики и флаги
│   │   ├── errorStore.ts   # Управление ошибками
│   │   └── partNumberComponents.ts
│   │
│   ├── api/                # API клиенты
│   │   ├── productServices.ts
│   │   ├── componentServices.ts
│   │   ├── userServices.ts
│   │   └── ...
│   │
│   ├── router/             # Vue Router конфигурация
│   ├── App.vue             # Главный компонент
│   └── main.ts             # Точка входа
│
├── package.json
└── vite.config.ts
```

### Основные компоненты

#### 1. **App.vue**

- Корневой компонент приложения
- Инициализирует Neutralino.js
- Управляет WebSocket соединением
- Обрабатывает регистрацию пользователя
- Монтирует локальный сервер

#### 2. **Views (Представления)**

##### **AddArticle.vue**

- Добавление компонентов в систему
- Сканирование серийных номеров
- Интеграция с Яндекс.Диском для фотографий
- Генерация QR-кодов для загрузки фото

##### **PreProduction.vue**

- Предпроизводственная подготовка
- Создание продуктов в базе
- Генерация документов с штрих-кодами
- Привязка корпусов к продуктам

##### **AssemblyView.vue** / **ProductAssembly.vue**

- Процесс сборки изделий
- Проверка комплектности компонентов
- Маркировка брака
- Открытие операционных карт (ОК)

##### **ProductFunctionalTest.vue**

- Функциональное тестирование
- Создание дефект-истории при браке
- Управление статусами компонентов
- Сохранение чек-листов

##### **ProductPackage.vue**

- Упаковка готовых изделий
- Финальный этап производства

##### **OrderToProduction.vue**

- Просмотр заказов на производство (ЗНП)
- Отслеживание выполнения операций
- Табличное представление статусов

### Stores (Хранилища Pinia)

#### **useUserStore**

```typescript
- userName: string           // Имя пользователя из OS
- userFullName: string       // ФИО оператора
- userENV: string           // USER_COMPUTERNAME
- getUserENV()              // Получение данных из окружения
- saveFullName()            // Сохранение ФИО в БД
```

#### **useWebSocketStore**

```typescript
- socket: WebSocket         // WebSocket соединение
- connected: boolean        // Статус подключения
- connect()                 // Подключение к серверу
- send()                    // Отправка сообщений
- initNeutralinoEvents()    // Инициализация событий
```

#### **useErrorStore**

```typescript
- errors: Array             // Массив ошибок
- info: Array               // Массив информационных сообщений
- addError()                // Добавление ошибки
- addInfo()                 // Добавление информации
- removeError()             // Удаление ошибки
```

#### **usePartNumberComponents**

```typescript
- listPartNumbers: Array    // Список номенклатуры
- getPartNumberComponents() // Загрузка из API
```

### API Services

Все сервисы расположены в `src/api/` и предоставляют функции для работы с backend:

- **productServices.ts** - CRUD операции с продуктами
- **componentServices.ts** - Управление компонентами
- **productionOperationServices.ts** - Операции производства
- **userServices.ts** - Управление пользователями
- **specificationServices.ts** - Работа со спецификациями
- **partNumberComponentsServices.ts** - Номенклатура

### Утилиты

#### **yandexWatcher.ts**

Мониторинг папки на Яндекс.Диске для автоматической загрузки фотографий:

```typescript
interface YandexDiskWatcherOptions {
  token: string; // OAuth токен
  path: string; // Путь к папке
  intervalSec: number; // Период опроса
  autoDownload: boolean; // Автозагрузка
  onChange: callback; // Обработчик новых файлов
}
```

#### **transformSP.ts**

Преобразование спецификаций продуктов в удобный формат для отображения.

#### **printer.ts**

Функции для печати документов (закомментированы, используется альтернативный подход).

### Основные зависимости

```json
{
  "@neutralinojs/lib": "^6.3.0", // Desktop framework
  "vue": "^3.5.17", // UI framework
  "vuetify": "^3.8.11", // UI components
  "pinia": "^3.0.3", // State management
  "socket.io-client": "^4.8.1", // WebSocket client
  "docx": "^9.5.1", // Word documents
  "bwip-js": "^4.6.0", // Barcode generation
  "qr-code-styling": "^1.9.2" // QR codes
}
```

---

## Backend (Серверная часть)

### Структура директорий

```
server/
├── routes/                 # API маршруты
│   ├── component.ts        # /api/component/*
│   ├── product.ts          # /api/product/*
│   ├── user.ts             # /api/user/*
│   ├── productionOperation.ts
│   ├── specification.ts
│   ├── template.ts
│   ├── test.ts
│   ├── partNumberComponent.ts
│   └── checkList.ts
│
├── app.ts                  # Конфигурация Fastify
├── index.ts                # Точка входа (prod)
├── index_backup.ts         # Backup с API key защитой
├── seed.ts                 # Данные для инициализации БД
└── package.json
```

### Технологии

- **Fastify** - быстрый web framework
- **Prisma ORM** - работа с базой данных
- **WebSocket** - real-time коммуникация
- **dotenv** - управление окружением

### API Endpoints

#### **Products** (`/api/product`)

```
GET    /all                 # Все продукты
GET    /:snProduct          # Продукт по SN
GET    /znp/:orderNumber    # Продукты по ЗНП
POST   /                    # Создать продукт
PUT    /:snProduct          # Обновить продукт
DELETE /:snProduct          # Удалить продукт
```

#### **Components** (`/api/component`)

```
GET    /all                 # Все компоненты
GET    /:snComponent        # Компонент по SN
POST   /                    # Создать компонент
PUT    /:snComponent        # Обновить компонент
DELETE /:snComponent        # Удалить компонент
```

#### **Users** (`/api/user`)

```
GET    /all                 # Все пользователи
GET    /:userName           # Пользователь по имени
POST   /                    # Создать пользователя
PUT    /:userName           # Обновить пользователя
```

#### **Production Operations** (`/api/production-operation`)

```
GET    /all                 # Все операции
GET    /:id                 # Операция по ID
GET    /product/:snProduct  # Операции продукта
POST   /                    # Создать операцию
PUT    /:id                 # Обновить операцию
```

#### **Specifications** (`/api/specification`)

```
GET    /all                 # Все спецификации
GET    /:productMP          # Спецификация по артикулу
POST   /                    # Создать спецификацию
```

#### **Part Number Components** (`/api/part-number-component`)

```
GET    /all                 # Вся номенклатура
GET    /:partNumber         # Компонент по PN
POST   /                    # Создать номенклатуру
```

### WebSocket Events

Server отправляет события клиентам:

- `shutdown` - команда на закрытие приложения
- `update` - обновление данных
- `notification` - уведомления

### Безопасность

В `index_backup.ts` реализована защита через API-key:

```typescript
const API_KEY = "your-secret-api-key-12345";
// Middleware проверяет header: x-api-key
```

---

## Shared (Общие типы)

Директория `shared/` содержит Prisma схему и генерируемые типы, используемые как в frontend, так и в backend.

### Prisma Schema

Основные модели:

#### **Product** (Продукт)

```prisma
model Product {
  snProduct           String   # Серийный номер (PK)
  specificationProductMP String # Артикул спецификации
  orderToProduction   String   # Номер ЗНП
  comment             String?  # Комментарии/статус

  components          Component[]           # Компоненты
  productionOperations ProductionOperation[] # Операции
  specification       Specification         # Спецификация
  checkList           CheckList?            # Чек-лист
}
```

#### **Component** (Компонент)

```prisma
model Component {
  id              Int      # ID
  snComponent     String   # Серийный номер (unique)
  pnComponentId   String   # Номер номенклатуры
  supplier        String   # Поставщик
  invoice         String   # Накладная
  status          String   # passed/on_hold/rejected
  comment         Json?    # Комментарии
  photos          String[] # Фотографии
  snProductId     String?  # FK к Product

  pnComponent     PartNumberComponent      # Номенклатура
  productionOperations ProductionOperation[] # Операции
  defectHistory   DefectHistory[]          # История дефектов
}
```

#### **ProductionOperation** (Производственная операция)

```prisma
model ProductionOperation {
  id              Int       # ID
  stageType       String    # Тип этапа
  status          String    # passed/on_hold/rejected
  user            String    # Оператор
  productId       String?   # FK к Product
  componentId     String?   # FK к Component
  productSN       String?   # SN продукта
  usedComponents  String?   # Использованные компоненты
  comment         String?   # Комментарий
  createdAt       DateTime  # Дата создания
  updatedAt       DateTime  # Дата обновления
}
```

#### **Specification** (Спецификация)

```prisma
model Specification {
  id                Int       # ID
  type              String    # Тип изделия
  productName       String    # Наименование
  productMM         String    # ММ
  productMP         String    # МП (unique)

  # Компоненты спецификации
  electronicBoard1  String    # Плата 1
  electronicBoard2  String    # Плата 2
  electronicBoard3  String    # Плата 3
  electronicBoard4  String    # Плата 4
  electronicBoard5  String    # Плата 5
  electronicBoard6  String    # Плата 6
  otherCirciutry    String    # Другие схемы
  enclosureType     String    # Корпус
  mountingScrew     String    # Крепеж

  version           Int       # Версия
  packingBox        String    # Упаковка

  operation         Operation # Операции
  template          Template  # Шаблоны
  test              Test      # Испытания
  products          Product[] # Продукты
}
```

#### **PartNumberComponent** (Номенклатура)

```prisma
model PartNumberComponent {
  partNumber      String      # Артикул (PK)
  descriptionEN   String      # Описание EN
  descriptionRU   String      # Описание RU
  components      Component[] # Компоненты
}
```

#### **Operation** (Операции спецификации)

```prisma
model Operation {
  id                Int       # ID
  version           Int       # Версия
  issue             Boolean   # Выпуск
  preProdaction     Boolean   # Предпроизводство
  assembly          Boolean   # Сборка
  marking           Boolean   # Маркировка
  functionalTest    Boolean   # Функциональные испытания
  verification      Boolean   # Верификация
  package           Boolean   # Упаковка
}
```

#### **User** (Пользователь)

```prisma
model User {
  id              Int      # ID
  userName        String   # Имя пользователя (unique)
  fullName        String   # Полное имя
  role            String?  # Роль
}
```

#### **DefectHistory** (История дефектов)

```prisma
model DefectHistory {
  id              Int       # ID
  componentSN     String    # SN компонента
  actionType      String    # Тип действия
  status          String    # Статус
  user            String    # Пользователь
  description     String    # Описание
  createdAt       DateTime  # Дата создания
}
```

---

## База данных

### Технология

- **PostgreSQL** - основная БД
- **Prisma ORM** - для миграций и работы с БД

### Конфигурация

Файл `.env.development` / `.env.production`:

```
DATABASE_URL="postgresql://user:password@host:port/database"
PORT=3000
HOST=localhost
DATA_MODEL=production
LOG_LEVEL=info
ENABLE_TRACING=false
```

### Миграции

```bash
cd server
npx prisma migrate dev  # Создать миграцию
npx prisma migrate deploy  # Применить миграции
npx prisma generate  # Генерировать типы
```

### Seed данные

Файл `server/seed.ts` содержит начальные данные:

- Номенклатура компонентов (`partNumberComponent`)
- Спецификации изделий (`specification`)
- Шаблоны операций (`operation`, `template`, `test`)

---

## Основные функции системы

### 1. Жизненный цикл продукта

```
Предпроизводство → Маркировка → Сборка →
Функциональные испытания → Упаковка
```

#### **Предпроизводство** (PreProduction)

- Создание продуктов по ЗНП
- Генерация серийных номеров
- Привязка корпусов
- Создание документов с штрих-кодами

#### **Маркировка** (Marking)

- Маркировка корпусов
- Создание операции marking
- Привязка компонентов к продукту

#### **Сборка** (Assembly)

- Проверка комплектности
- Сканирование компонентов
- Создание операции assembly
- Обработка брака

#### **Функциональные испытания** (FunctionalTest)

- Тестирование продукта
- Создание операции functionalTest
- Регистрация дефектов
- Сохранение чек-листов

#### **Упаковка** (Package)

- Финальная проверка
- Создание операции package
- Завершение производства

### 2. Управление компонентами

- **Входной контроль** - регистрация компонентов в системе
- **Фотофиксация** - интеграция с Яндекс.Диском через QR-коды
- **Статусы**:
  - `passed` - принят
  - `on_hold` - брак/на удержании
  - `rejected` - отклонён

### 3. Отслеживание операций

Каждая операция записывается в `ProductionOperation`:

- Тип этапа (`stageType`)
- Статус (`status`)
- Оператор (`user`)
- Используемые компоненты (`usedComponents`)
- Timestamp создания/обновления

### 4. Работа с документами

- **Генерация Word документов** через библиотеку `docx`
- **Штрих-коды** через `bwip-js`
- **QR-коды** через `qr-code-styling`
- Открытие файлов из сетевых папок через `os.execCommand`

### 5. Real-time обновления

WebSocket соединение обеспечивает:

- Уведомления об обновлениях
- Команды управления (shutdown)
- Синхронизацию между клиентами

---

## Развертывание

### Требования

- Node.js 20+
- PostgreSQL 14+
- Neutralino.js CLI

### Установка

1. **Клонировать репозиторий**

```bash
git clone <repo-url>
cd TAU
```

2. **Установить зависимости**

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../server
npm install
```

3. **Настроить базу данных**

```bash
cd server
cp .env.example .env.development
# Отредактировать DATABASE_URL
npx prisma migrate deploy
npx prisma generate
```

4. **Собрать frontend**

```bash
cd frontend
npm run build
```

5. **Запустить backend**

```bash
cd server
npm run dev  # или npm start
```

6. **Собрать Neutralino приложение**

```bash
neu build
```

---

## Структура проекта (детальная)

```
TAU/
├── frontend/
│   ├── src/
│   │   ├── api/                    # API клиенты
│   │   ├── assets/                 # Ресурсы
│   │   │   ├── interfaces.ts       # TypeScript интерфейсы
│   │   │   ├── utils/              # Утилиты
│   │   │   ├── printer.ts          # Печать
│   │   │   ├── yandexWatcher.ts    # Яндекс.Диск
│   │   │   └── transformSP.ts      # Трансформации
│   │   ├── components/
│   │   │   ├── views/              # Представления
│   │   │   │   ├── AddArticle.vue
│   │   │   │   ├── PreProduction.vue
│   │   │   │   ├── AssemblyView.vue
│   │   │   │   ├── ProductAssembly.vue
│   │   │   │   ├── ProductFunctionalTest.vue
│   │   │   │   ├── ProductPackage.vue
│   │   │   │   ├── OrderToProduction.vue
│   │   │   │   └── MyAbout.vue
│   │   │   ├── ToolBar.vue
│   │   │   ├── ProductInformation.vue
│   │   │   └── ErrorComponent.vue
│   │   ├── stores/                 # Pinia stores
│   │   │   ├── user.ts
│   │   │   ├── websockets.ts
│   │   │   ├── counter.ts
│   │   │   ├── errorStore.ts
│   │   │   ├── partNumberComponents.ts
│   │   │   └── serialNumberData.ts
│   │   ├── router/
│   │   │   └── index.ts            # Vue Router
│   │   ├── App.vue                 # Главный компонент
│   │   └── main.ts                 # Entry point
│   ├── public/                     # Статические файлы
│   ├── index.html                  # HTML шаблон
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── server/
│   ├── routes/                     # API маршруты
│   │   ├── component.ts
│   │   ├── product.ts
│   │   ├── user.ts
│   │   ├── productionOperation.ts
│   │   ├── specification.ts
│   │   ├── template.ts
│   │   ├── test.ts
│   │   ├── partNumberComponent.ts
│   │   └── checkList.ts
│   ├── app.ts                      # Fastify app
│   ├── index.ts                    # Entry point
│   ├── index_backup.ts             # Backup with API key
│   ├── seed.ts                     # DB seed data
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   ├── prisma/
│   │   └── schema.prisma           # Prisma схема
│   └── src/
│       └── index.ts                # Экспорт типов
│
├── neutralino.config.json          # Neutralino конфиг
├── package.json
└── README.md
```

---

## Ключевые особенности

### 1. Neutralino.js Integration

- Десктопное приложение без Electron
- Доступ к OS через `@neutralinojs/lib`
- Запуск команд через `os.execCommand`
- Работа с файловой системой через `filesystem`

### 2. Модульная архитектура

- Разделение на frontend/backend/shared
- Переиспользуемые компоненты
- Типобезопасность через TypeScript
- Общие типы из Prisma схемы

### 3. Real-time коммуникация

- WebSocket для мгновенных обновлений
- Heartbeat для проверки соединения
- Reconnect логика при обрывах

### 4. Интеграция с внешними сервисами

- Яндекс.Диск для хранения фотографий
- Сетевые папки для документов
- Генерация QR-кодов для быстрого доступа

### 5. Управление производством

- Полный жизненный цикл продукта
- Отслеживание каждой операции
- История изменений компонентов
- Система дефектов и брака

---

## Рекомендации по разработке

### Добавление нового этапа производства

1. Создать Vue компонент в `frontend/src/components/views/`
2. Добавить маршрут в `router/index.ts`
3. Обновить `StageType` в `assets/interfaces.ts`
4. Создать операцию в базе через `ProductionOperation`
5. Обновить логику в `processMissingOperations.ts`

### Добавление нового API endpoint

1. Создать маршрут в `server/routes/`
2. Зарегистрировать в `server/index.ts`
3. Создать клиентскую функцию в `frontend/src/api/`
4. Использовать в компонентах

### Изменение схемы БД

1. Обновить `shared/prisma/schema.prisma`
2. Создать миграцию: `npx prisma migrate dev`
3. Сгенерировать типы: `npx prisma generate`
4. Обновить зависимые компоненты

---

## Заключение

Система TAU представляет собой комплексное решение для управления производственным процессом с полным контролем качества на каждом этапе. Архитектура позволяет легко расширять функционал и адаптировать систему под новые требования производства.

**Основные преимущества:**

- ✅ Полный контроль жизненного цикла изделий
- ✅ Real-time отслеживание операций
- ✅ Интеграция с внешними системами хранения
- ✅ Типобезопасность на всех уровнях
- ✅ Модульная и расширяемая архитектура
- ✅ Десктопное приложение с low footprint (Neutralino)

---
