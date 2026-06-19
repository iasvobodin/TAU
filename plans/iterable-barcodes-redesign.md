# План: Итерируемые barcode — каждый со своим списком значений

## Концепция

| Термин                           | Описание                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Итерируемый barcode**          | Barcode с флагом `isSerial = true`. В групповой печати получает значения из своего многострочного списка |
| **Обычный barcode**              | Barcode с `isSerial = false`. Получает одно значение из общих данных (common data)                       |
| **Итерируемых может быть много** | Несколько barcode могут быть итерируемыми одновременно                                                   |
| **Авто-isSerial удалён**         | Никто не получает isSerial автоматически                                                                 |
| **isSerial ТОЛЬКО на barcode**   | У текста isSerial БОЛЬШЕ НЕТ. Текст либо статичный, либо привязан к barcode через linkedBarcodeId        |
| **hasSerialInTemplate**          | Проверяет ТОЛЬКО barcode элементы                                                                        |

## Валидация

При групповой печати все итерируемые barcode должны иметь **одинаковое количество значений** в своих списках. Если не совпадает — предупреждение и блокировка печати.

```
barcode_1: [AA1, AA2, AA3]     ← 3 строки
barcode_2: [BB1, BB2, BB3]     ← 3 строки ✓
───────────────────────────────────────
Печатается 3 этикетки

barcode_1: [AA1, AA2, AA3]     ← 3 строки
barcode_2: [BB1, BB2]          ← 2 строки ✗
───────────────────────────────────────
Предупреждение: несовпадение количества
```

## Что удаляется (из предыдущей реализации)

1. **`toggleSerial()`** — больше не нужен (текст без isSerial)
2. **SN кнопка на тексте** в ElementPropsPanel — удалить
3. **isSerial на тексте** — убрать из `addElement()` для text, убрать из `templateTextFields` фильтрации по тексту
4. **Авто-isSerial для barcode** — `isSerial: false` по умолчанию

## Что добавляется

1. **`toggleBarcodeIterable(id)`** — переключает isSerial на barcode без влияния на другие элементы
2. **`batchIterableTexts`** — `Record<string, string>` — многострочные значения для каждого итерируемого barcode
3. **`iterableFields`** — computed: список dataField-ов итерируемых barcode
4. **`iterableCounts`** — computed: количество значений в каждом списке
5. **`iterableCountMismatch`** — computed: true если длины не совпадают
6. **PrintDataPanel** — textarea для каждого итерируемого barcode + валидация

## Изменения по файлам

### 🔧 1. [`labelEditor.ts`](frontend/src/stores/labelEditor.ts)

#### a) `addElement()` — убрать isSerial с текста и barcode

```typescript
// Для text — убрать isSerial: false (не нужно)
// Для barcode — isSerial: false (было true, теперь false)
```

#### b) Удалить `toggleSerial()` — больше не нужен

#### c) Добавить `toggleBarcodeIterable(id)`:

```typescript
function toggleBarcodeIterable(id: string): void {
  const el = elements.value[id];
  if (!el || el.type !== "barcode") return;
  el.props.isSerial = !el.props.isSerial;
}
```

#### d) `templateTextFields` — исправить фильтрацию (без isSerial для текста)

```typescript
const templateTextFields = computed(() => {
  const seen = new Set<string>()

  const texts = Object.values(elements.value)
    .filter((el) => el.type === 'text' && !el.props.linkedBarcodeId)
    .filter(...)

  const barcodes = Object.values(elements.value)
    .filter((el) => el.type === 'barcode' && !el.props.isSerial)
    .filter(...)

  return [...texts, ...barcodes]
})
```

#### e) `hasSerialInTemplate` — только barcode

```typescript
const hasSerialInTemplate = computed(() =>
  Object.values(elements.value).some(
    (el) => el.type === "barcode" && el.props.isSerial === true,
  ),
);
```

#### f) `buildSinglePrintData()` — убрать проверку isSerial на тексте

```typescript
function buildSinglePrintData() {
  const common: Record<string, string> = {};
  let serial = "";
  for (const el of Object.values(elements.value)) {
    if (el.type === "text" && !el.props.linkedBarcodeId) {
      const val = el.props.customText ?? getDefaultText(el.dataField);
      common[el.dataField] = val;
    } else if (el.type === "barcode" && el.props.isSerial) {
      serial = el.props.testValue ?? "";
    }
  }
  if (serial) common["serial"] = serial;
  return { items: [{ serial }], common };
}
```

#### g) `buildTemplateData()` — убрать linkedBarcodeId и isSerial для текста

```typescript
// Для text: убрать isSerial и linkedBarcodeId из сохранения
// (linkedBarcodeId всё ещё нужен — это связь текста с barcode)
```

#### h) `batchIterableTexts` state + computed + printLabels (как в плане ниже)

---

### 🔧 2. [`htmlRenderer.ts`](frontend/src/assets/htmlRenderer.ts:55) + [`renderToSVG.ts`](frontend/src/assets/renderToSVG.ts:386)

`resolveValue()` — переписать без текстового isSerial:

```typescript
function resolveValue(
  element: PrintLabelElement,
  data: CommonData,
  serial?: string,
  elements?: Record<string, PrintLabelElement>,
): string {
  if (element.type === "barcode") {
    // Для barcode: dataField из common/batch data
    if (data[element.dataField]) return data[element.dataField];
    return serial ?? data["serial"] ?? "";
  }

  if (element.type === "text") {
    // Текст, связанный с barcode → рекурсивно берём значение barcode
    if (
      element.props.linkedBarcodeId &&
      elements?.[element.props.linkedBarcodeId]
    ) {
      return resolveValue(
        elements[element.props.linkedBarcodeId],
        data,
        serial,
        elements,
      );
    }
    return data[element.dataField] ?? "";
  }

  return "";
}
```

**Важно**: `printLabels()` передаёт items где каждый item содержит значения по dataField-ключам.  
В `renderLabelsToHTMLPage()`:

```typescript
items.map((item) =>
  renderLabelToHTML(templateData, { ...common, ...item }, ""),
);
```

`serial` параметр больше не используется для batch (данные в `data`).

---

### 🔧 3. [`PrintDataPanel.vue`](frontend/src/components/label-editor/PrintDataPanel.vue)

#### a) iterable секция (после common data):

```html
<div
  v-for="field in store.iterableFields"
  :key="field"
  class="pp-iterable-field"
>
  <label class="pp-field-label">{{ field }} (итерируемый)</label>
  <textarea
    v-model="store.batchIterableTexts[field]"
    class="pp-serials-textarea"
    :placeholder="`AA1\nAA2\nAA3`"
    rows="3"
  />
  <span class="pp-count">{{ store.iterableCounts[field] ?? 0 }} шт.</span>
</div>
```

#### b) Предупреждение:

```html
<div v-if="store.iterableCountMismatch" class="pp-warning">
  <v-icon size="14" color="#e65100">mdi-alert</v-icon>
  <span>Несовпадение количества значений у итерируемых barcode</span>
</div>
```

#### c) Блокировка печати:

```html
<button
  class="pp-print-btn"
  :disabled="batchPrintEnabled && store.iterableCountMismatch"
  @click="store.printLabels"
></button>
```

---

### 🔧 4. [`ElementPropsPanel.vue`](frontend/src/components/label-editor/ElementPropsPanel.vue)

1. **Убрать SN кнопку из секции текста**
2. **В секции barcode**: SN кнопка вызывает `store.toggleBarcodeIterable(selectedId!)`
3. **Оставить кнопку "Связать"** для текста (linkBrush) — без изменений

---

### 🔧 5. [`LabelCanvas.vue`](frontend/src/components/label-editor/LabelCanvas.vue)

Без изменений — linkBrush уже работает.

---

### 🔧 6. [`types/label.ts`](frontend/src/types/label.ts)

`BatchItem` — может иметь не только `serial`, но и другие поля:

```typescript
export interface BatchItem {
  serial?: string;
  [key: string]: string | undefined;
}
```

---

## Пример работы

1. Добавить barcode_1 (isSerial=false, обычный)
2. Добавить barcode_2 (isSerial=false, обычный)
3. Нажать SN на barcode_1 → isSerial=true (итерируемый)
4. Нажать SN на barcode_2 → isSerial=true (итерируемый)
5. Включить серийный режим
6. В PrintDataPanel ввести:
   - barcode_1: `AA1\nAA2\nAA3`
   - barcode_2: `BB1\nBB2\nBB3`
7. Нажать Печать → 3 этикетки:
   - Этикетка 1: barcode_1=AA1, barcode_2=BB1
   - Этикетка 2: barcode_1=AA2, barcode_2=BB2
   - Этикетка 3: barcode_1=AA3, barcode_2=BB3

## Проверка регрессии

| Сценарий                                    | Ожидание                                     |
| ------------------------------------------- | -------------------------------------------- |
| Один barcode, isSerial=false                | Обычный, значение из common data ✅          |
| Один barcode, isSerial=true                 | Итерируемый, свой список ✅                  |
| Текст linkedBarcodeId                       | Связан с barcode, показывает его значение ✅ |
| Batch с 0 итерируемых                       | Недоступен ✅                                |
| Batch с 2+ итерируемыми (одинаковое кол-во) | Работает ✅                                  |
| Batch с 2+ итерируемыми (разное кол-во)     | Предупреждение, печать заблокирована ✅      |
| Одиночная печать                            | Без изменений ✅                             |
| Текст без barcode                           | Статичный, из common data ✅                 |
