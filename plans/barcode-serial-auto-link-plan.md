# План: Авто-isSerial для штрихкода + привязка текста к штрихкоду

## Проблема

Сейчас в редакторе этикеток:

1. Штрихкод при добавлении НЕ помечается `isSerial` — для пакетной печати нужно отдельное текстовое поле с флагом `isSerial`.
2. Невозможно сделать этикетку **только со штрихкодом** (без текста) и печатать её в серийном режиме.
3. Невозможно "привязать" текстовое поле к штрихкоду, чтобы текст отображал то же значение (человекочитаемая подпись под штрихкодом).

## Текущая архитектура (as-is)

```
LabelElementProps {
  isSerial?: boolean       // есть и у text, и у barcode
  barcodeType?: BarcodeType
  testValue?: string       // тестовое значение для barcode
  ...
}
```

- `toggleSerial(id)` — переключает `isSerial` на элементе, сбрасывает на всех остальных.
- `hasSerialInTemplate` — true, если хоть один элемент имеет `isSerial`.
- `templateTextFields` — только **text** элементы **без** `isSerial`.
- `resolveValue()` в обоих рендерерах:
  - Если элемент имеет `isSerial` и передан `serial` → возвращает `serial`.
  - Если barcode → `serial ?? data['serial'] ?? data[dataField]`.
  - Если text → `data[dataField]`.
- `buildSinglePrintData()`: для barcode с `isSerial` берёт `testValue` как serial.

**Главная проблема UI**: В панели свойств штрихкода (`ElementPropsPanel.vue:361`) отсутствует кнопка `SN` (isSerial), которая есть у текста.

## Целевая архитектура (to-be)

### 1. Новый проп `inheritSerial` на тексте

```typescript
// LabelElementProps
inheritSerial?: boolean  // текст показывает то же значение, что и штрихкод (serial)
```

Логика разрешения значения в рендерерах:

```typescript
function resolveValue(element, data, serial): string {
  if (element.props.isSerial && serial !== undefined) return serial;
  if (element.type === "barcode")
    return serial ?? data["serial"] ?? data[dataField] ?? "";
  if (
    element.type === "text" &&
    element.props.inheritSerial &&
    serial !== undefined
  )
    return serial; // NEW
  if (element.type === "text") return data[dataField] ?? "";
  return "";
}
```

### 2. Авто-isSerial при добавлении barcode

В `addElement()` для типа `'barcode'` — `isSerial: true` (сейчас `false`).  
Это автоматически делает `hasSerialInTemplate = true`, включая серийный режим печати.

### 3. Исключение inheritSerial из templateTextFields

Тексты с `inheritSerial` исключаются из `templateTextFields` — они не требуют ввода в `batchCommonData`, их значение приходит из serial.

### 4. Исключение inheritSerial из buildSinglePrintData

Тексты с `inheritSerial` не участвуют в формировании `common` данных для одиночной печати.

## Изменения по файлам

### 1. [`frontend/src/types/label.ts`](frontend/src/types/label.ts:55)

Добавить в `LabelElementProps`:

```typescript
inheritSerial?: boolean  // текст наследует значение от штрихкода (serial)
```

Также добавить в `SavedElementProps` (Omit).

---

### 2. [`frontend/src/stores/labelEditor.ts`](frontend/src/stores/labelEditor.ts)

#### a) `addElement()` — авто-isSerial для barcode (строка ~260)

```typescript
// Было:
isSerial: false; // для barcode

// Стало:
isSerial: true; // для barcode — автоматически включает серийный режим
```

#### b) `templateTextFields` (строка ~102)

```typescript
// Было:
.filter((el) => el.type === 'text' && !el.props.isSerial)

// Стало:
.filter((el) => el.type === 'text' && !el.props.isSerial && !el.props.inheritSerial)
```

#### c) `buildSinglePrintData()` (строка ~468)

```typescript
// Было:
if (el.type === "text") {
  const val = el.props.customText ?? getDefaultText(el.dataField);
  common[el.dataField] = val;
  if (el.props.isSerial) serial = val;
}

// Стало:
if (el.type === "text" && !el.props.inheritSerial) {
  const val = el.props.customText ?? getDefaultText(el.dataField);
  common[el.dataField] = val;
  if (el.props.isSerial) serial = val;
}
```

#### d) `buildTemplateData()` — сохранять `inheritSerial` (строка ~320)

```typescript
// В секции text:
isSerial: el.props.isSerial,
inheritSerial: el.props.inheritSerial,  // NEW
```

#### e) `applyTemplateData()` — загружать `inheritSerial` (строка ~382)

```typescript
// При загрузке шаблона inheritSerial уже будет в el.props,
// так как мы делаем spread ...el.props. Нужно только убедиться,
// что для текста customText не перетирается.
```

---

### 3. [`frontend/src/assets/htmlRenderer.ts`](frontend/src/assets/htmlRenderer.ts:55)

Обновить `resolveValue()`:

```typescript
function resolveValue(
  element: PrintLabelElement,
  data: CommonData,
  serial?: string,
): string {
  if (element.props.isSerial && serial !== undefined) return serial;
  if (element.props.inheritSerial && serial !== undefined) return serial; // NEW
  if (element.type === "barcode")
    return serial ?? data["serial"] ?? data[element.dataField] ?? "";
  if (element.type === "text") return data[element.dataField] ?? "";
  return "";
}
```

---

### 4. [`frontend/src/assets/renderToSVG.ts`](frontend/src/assets/renderToSVG.ts:386)

Аналогичное изменение `resolveValue()`.

---

### 5. [`frontend/src/components/label-editor/ElementPropsPanel.vue`](frontend/src/components/label-editor/ElementPropsPanel.vue)

#### a) Кнопка SN для barcode (после строки ~417, в секции barcode)

Добавить кнопку `isSerial` (SN) в секцию штрихкода, как у текста:

```html
<div class="sep" />
<div class="ctrl-group">
  <v-tooltip
    :text="selectedElement!.props.isSerial
      ? 'Убрать: серийный номер'
      : 'Использовать как серийный номер'"
    location="bottom"
  >
    <template #activator="{ props: tp }">
      <button
        v-bind="tp"
        :class="['btn', 'btn--lbl', { 'btn--serial': selectedElement!.props.isSerial }]"
        @click="store.toggleSerial(selectedId!)"
      >
        <v-icon size="14">mdi-pound</v-icon><span>SN</span>
      </button>
    </template>
  </v-tooltip>
</div>
```

#### b) Кнопка "Привязать к штрихкоду" для текста (рядом с SN)

Добавить в секцию текста (после SN toggle):

```html
<v-tooltip
  :text="selectedElement!.props.inheritSerial
    ? 'Отвязать от штрихкода'
    : 'Привязать к штрихкоду (значение как у штрихкода)'"
  location="bottom"
>
  <template #activator="{ props: tp }">
    <button
      v-bind="tp"
      :class="['btn', 'btn--lbl', { 'btn--link': selectedElement!.props.inheritSerial }]"
      @click="selectedElement!.props.inheritSerial = !selectedElement!.props.inheritSerial"
    >
      <v-icon size="14">mdi-link-variant</v-icon><span>Связать</span>
    </button>
  </template>
</v-tooltip>
```

**Важно**: Кнопка видна только когда `hasBarcodeInTemplate` (есть хотя бы один barcode в шаблоне).  
Добавить computed `hasBarcodeInTemplate`:

```typescript
const hasBarcode = computed(() =>
  Object.values(store.elements).some((el) => el.type === "barcode"),
);
```

---

### 6. [`frontend/src/components/label-editor/PrintDataPanel.vue`](frontend/src/components/label-editor/PrintDataPanel.vue)

Проверить, что:

- `hasSerialInTemplate` корректно возвращает `true` при barcode с `isSerial` (уже работает ✅)
- Батч-тоггл включается при barcode с `isSerial` (уже работает ✅)
- Нет необходимости показывать что-то дополнительно для inheritSerial

Возможно, обновить текст тултипа "Нет поля серийного номера в шаблоне" — но это косметика.

---

## Сценарии использования

### Сценарий A: Этикетка только со штрихкодом (серийная печать)

1. Пользователь добавляет штрихкод → авто `isSerial: true`
2. `hasSerialInTemplate = true` → батч-тоггл активен
3. Пользователь вводит серийные номера → печать
4. Каждый штрихкод отображает свой серийный номер ✅

### Сценарий B: Этикетка со штрихкодом и подписью (текст привязан к штрихкоду)

1. Пользователь добавляет штрихкод → авто `isSerial: true`
2. Пользователь добавляет текст → нажимает "Связать" (inheritSerial)
3. В обоих рендерерах текст получает то же значение, что и штрихкод (serial)
4. При пакетной печати: каждый штрихкод + подпись = один серийный номер ✅

### Сценарий C: Этикетка со штрихкодом + статический текст + связанный текст

1. Штрихкод (isSerial) + текст "Дата: 01.01.2024" (обычный) + текст "SN:" (inheritSerial)
2. В `templateTextFields` попадает только "Дата: 01.01.2024"
3. В `batchCommonData` пользователь вводит дату
4. При печати: штрихкод = serial, "SN:" = serial, "Дата:" = из common ✅

---

## Диаграмма потока данных

```mermaid
flowchart TD
    A[Пользователь добавляет штрихкод] --> B[store.addElement type=barcode]
    B --> C[isSerial = true]
    C --> D[hasSerialInTemplate = true]
    D --> E[Батч-тоггл активен]

    F[Пользователь добавляет текст] --> G[Нажимает Связать]
    G --> H[inheritSerial = true]
    H --> I[Текст исключён из templateTextFields]

    J[Печать] --> K{batchPrintEnabled?}
    K -->|Да| L[serial из списка]
    K -->|Нет| M[testValue / customText]
    L --> N[resolveValue]
    M --> N
    N --> O{barcode?}
    O -->|Да| P[return serial]
    O -->|Нет, text?| Q{inheritSerial?}
    Q -->|Да| R[return serial]
    Q -->|Нет| S[return data[dataField]]
```

---

## Проверка регрессии

| Сценарий                                      | Ожидание                                 | Статус                  |
| --------------------------------------------- | ---------------------------------------- | ----------------------- |
| Текст + isSerial (без штрихкода)              | Работает как раньше                      | ✅                      |
| Только текст, без serial                      | Обычная печать                           | ✅                      |
| Загрузка старого шаблона (без inheritSerial)  | inheritSerial = undefined → игнорируется | ✅                      |
| Сохранение → загрузка шаблона с inheritSerial | Флаг сохраняется и восстанавливается     | ✅ (через spread props) |
| Кисточка (copy brush)                         | Не копирует isSerial и inheritSerial     | ✅ (явно исключено)     |
