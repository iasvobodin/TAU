# План: Настройка "Функциональное тестирование dev" и кнопка "Отметить все Pass"

## UPD: Ограничение по пользователям

Строка с настройкой **"Функциональное тестирование dev"** в `SettingsView.vue` должна отображаться **только** для пользователей `NBarnich` и `ISvobodin` (поле `userStore.userName`).

## 1. Добавить новое поле в store [`counter.ts`](frontend/src/stores/counter.ts)

Добавить новый ref `functionalTestDev` рядом с существующим `settings`:

```ts
const functionalTestDev = ref(false);
```

И вернуть его в return-объекте:

```ts
return {
  count,
  inputData,
  doubleCount,
  settings,
  functionalTestDev, // <-- добавить
  adminView,
  logs,
  addLogs,
  increment,
  setInputData,
};
```

## 2. Добавить чекбокс в [`SettingsView.vue`](frontend/src/components/views/SettingsView.vue)

**Дополнение:**
Новый `<v-row>` с настройкой должен иметь условие `v-if`, проверяющее имя пользователя:

```html
<v-row
  v-if="userStore.userName === 'NBarnich' || userStore.userName === 'ISvobodin'"
>
  <v-col align-self="center">
    <p>Функциональное тестирование dev</p>
  </v-col>
  <v-col>
    <v-checkbox
      hide-details
      v-model="counterStore.functionalTestDev"
    ></v-checkbox>
  </v-col>
</v-row>
```

`userStore` уже импортирован и инициализирован в `SettingsView.vue` (строки 4, 11), поэтому дополнительных импортов не требуется.

После строки с `<p>Разблокировать кнопки на этапе производства</p>` (строка 66) добавить новый блок `<v-row>`:

```html
<v-row>
  <v-col align-self="center">
    <p>Функциональное тестирование dev</p>
  </v-col>
  <v-col>
    <v-checkbox
      hide-details
      v-model="counterStore.functionalTestDev"
    ></v-checkbox>
  </v-col>
</v-row>
```

**Важно**: новый `<v-row>` должен располагаться сразу после закрывающего `</v-row>` существующего блока (строка 69) и перед `<hr />` (строка 70).

Итоговая структура изменений:

```
Строка 66:   <p>Разблокировать кнопки на этапе производства</p>
Строка 67-68: <v-col> ... <v-checkbox ...> ...
Строка 69:   </v-row>
Строка 70:   НОВЫЙ <v-row> ... Функциональное тестирование dev ... </v-row>   <-- ДОБАВИТЬ
Строка 71:   <hr />
```

## 3. Модифицировать [`_ChecklistViewerV2.vue`](frontend/src/components/_ChecklistViewerV2.vue)

### 3.1. Импортировать store

Добавить импорт `useCounterStore` в секции `<script setup>`:

```ts
import { useCounterStore } from "@/stores/counter";
const counterStore = useCounterStore();
```

### 3.2. Добавить метод `markAllPass()`

В секцию `<script setup>` добавить функцию:

```ts
const markAllPass = () => {
  template.value.fields.forEach((field) => {
    const fieldId = field.id || field.name;
    if (values.value[fieldId]) {
      values.value[fieldId].status = "pass";
    }
  });
};
```

### 3.3. Добавить кнопку в шапку компонента

В шаблоне, в первой строке с заголовком (строки 242-261), добавить кнопку "Отметить все Pass" рядом с существующей кнопкой сохранения.

```html
<v-col cols="auto" v-if="counterStore.functionalTestDev">
  <v-tooltip text="Отметить все пункты как Pass" location="bottom">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn
        color="success"
        @click="markAllPass"
        v-bind="activatorProps"
        size="small"
      >
        <v-icon left>mdi-check-all</v-icon>
        Все Pass
      </v-btn>
    </template>
  </v-tooltip>
</v-col>
```

Эта кнопка должна быть видна только когда `counterStore.functionalTestDev === true`.

### 3.4. Расположение в шаблоне

Текущая шапка (строки 242-261):

```
<v-row class="ma-0">
  <v-col><h3>ЧЕК ЛИСТ</h3></v-col>
  <v-col cols="4" class="text-right"><v-tabs ...></v-col>
  <v-col cols="2" class="text-right"><... save button ...></v-col>
</v-row>
```

Новая структура:

```
<v-row class="ma-0">
  <v-col><h3>ЧЕК ЛИСТ</h3></v-col>
  <v-col cols="auto" v-if="counterStore.functionalTestDev"><... Mark All Pass button ...></v-col>
  <v-col cols="4" class="text-right"><v-tabs ...></v-col>
  <v-col cols="2" class="text-right"><... save button ...></v-col>
</v-row>
```

## Схема работы

```mermaid
flowchart LR
    A[SettingsView.vue] -->|v-model| B[counterStore.functionalTestDev]
    B -->|reactive binding| C[_ChecklistViewerV2.vue]

    C --> D{functionalTestDev?}
    D -->|true| E[Показать кнопку\nОтметить все Pass]
    D -->|false| F[Скрыть кнопку]

    E -->|click| G[markAllPass]
    G --> H[values[fieldId].status = 'pass'\nдля всех полей]
```

## Файлы, которые нужно изменить

| Файл                                                                                               | Изменение                                             |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`frontend/src/stores/counter.ts`](frontend/src/stores/counter.ts)                                 | Добавить `functionalTestDev` ref                      |
| [`frontend/src/components/views/SettingsView.vue`](frontend/src/components/views/SettingsView.vue) | Добавить чекбокс после строки "Разблокировать кнопки" |
| [`frontend/src/components/_ChecklistViewerV2.vue`](frontend/src/components/_ChecklistViewerV2.vue) | Импорт store, метод markAllPass, кнопка в шапке       |

## Примечания

- Настройка `functionalTestDev` не сохраняется в localStorage/базу данных (по аналогии с существующей настройкой `settings`). При перезагрузке приложения сбросится.
- Кнопка "Отметить все Pass" работает в обоих режимах отображения (таблица и карточки), т.к. изменяет общие данные `values`.
