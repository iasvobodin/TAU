# План: Иконки редактирования и удаления на канвасе + inline-редактирование текста

## Текущее поведение

- Удаление блока — двойным кликом (`@dblclick`) на элементе в [`LabelCanvas.vue`](frontend/src/components/label-editor/LabelCanvas.vue:220)
- Редактирование текста — через кнопку «Текст» (с иконкой карандаша) в панели [`ElementPropsPanel.vue`](frontend/src/components/label-editor/ElementPropsPanel.vue) → открывается popup с textarea
- Кнопка удаления есть также в [`ElementPropsPanel.vue`](frontend/src/components/label-editor/ElementPropsPanel.vue:642)

## Целевое поведение

1. **При выборе блока** — в правом верхнем углу блока на канвасе отображаются две маленькие иконки:
   - 🖊️ Ручка (редактировать) — только для текстовых блоков
   - 🗑️ Корзинка (удалить) — для всех типов блоков
2. **Удаление** — при клике на корзинку вызывается `store.removeElement(id)` (как сейчас по двойному клику)
3. **Редактирование** — при клике на ручку текстовый блок переходит в режим inline-редактирования: текст можно редактировать прямо на канвасе в textarea, наложенной поверх содержимого блока
4. **Двойной клик** — убираем, т.к. теперь удаление через иконку

## Изменения только в файле `LabelCanvas.vue`

### 1. Script: добавить состояние inline-редактирования

Добавить в `<script setup>`:

```
const editingId = ref<string | null>(null)
const editingText = ref('')
const editInputEl = ref<HTMLTextAreaElement | null>(null)
```

Функции управления редактированием:

| Функция                 | Назначение                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `onStartEdit(id)`       | Устанавливает `editingId`, сохраняет текущий текст в `editingText`, фокусит textarea |
| `onSaveEdit(id, value)` | Сохраняет `customText` в props элемента, сбрасывает `editingId`                      |
| `onCancelEdit()`        | Сбрасывает `editingId` без сохранения                                                |

В `onCanvasClick()` добавить проверку: если `editingId` активен — вызвать `onCancelEdit()`.

### 2. Template: убрать `@dblclick`

Удалить атрибут `@dblclick="store.removeElement(String(id))"` из `<VueDraggableResizable>`.

### 3. Template: добавить плавающую панель действий

Внутри `<VueDraggableResizable>`, после блоков TEXT/BARCODE/IMAGE добавить:

```vue
<div
  v-if="
    !copyBrushActive &&
    !linkBrushActive &&
    selectedId === String(id) &&
    editingId !== String(id)
  "
  class="el-actions"
>
  <!-- Ручка (только для text) -->
  <button v-if="elements[id]?.type === 'text'" class="el-actions__btn" ...>
    <svg .../> <!-- иконка карандаша -->
  </button>
  <!-- Корзинка (для всех) -->
  <button class="el-actions__btn el-actions__btn--del" ...>
    <svg .../> <!-- иконка корзины -->
  </button>
</div>
```

Важно: на кнопках использовать `@mousedown.stop` и `@click.stop`, чтобы предотвратить захват события VDR и переключение выделения.

### 4. Template: добавить textarea для inline-редактирования

В блоке TEXT заменить статичный `<span>` на условный рендер:

```vue
<textarea
  v-if="editingId === String(id)"
  ref="editInputEl"
  v-model="editingText"
  class="el-text-editor"
  :style="getTextEditorStyle(elements[id]?.props ?? {})"
  @keydown.esc="onCancelEdit"
  @keydown.enter.ctrl="onSaveEdit(String(id), editingText)"
  @blur="onSaveEdit(String(id), editingText)"
  @mousedown.stop
  @pointerdown.stop
/>
<span
  v-else
  :style="getTextSpanStyle(...)"
>{{ store.getDisplayText(...) }}</span>
```

### 5. Script: добавить `getTextEditorStyle()`

Функция возвращает стили textarea, зеркалирующие стили текстового блока (шрифт, размер, выравнивание), чтобы редактирование было WYSIWYG:

```
function getTextEditorStyle(props): Record<string, string> {
  // берём fontSize с учётом zoom, fontFamily, lineHeight, bold, textAlign
  // position: absolute, top:0, left:0, width:100%, height:100%
  // border: none, outline: none, resize: none, background: transparent
}
```

### 6. Styles: добавить CSS

**`.el-actions`** — абсолютное позиционирование поверх блока:

- `position: absolute; top: -22px; right: 0; z-index: 10`
- flex-контейнер для двух кнопок

**`.el-actions__btn`** — маленькая квадратная кнопка:

- 18×18px, border-radius: 3px, border: 1px solid `#1976d2`
- при hover — заливка фона

**`.el-actions__btn--del`** — красная рамка, при hover красный фон

**`.el-text-editor`** — textarea на весь блок:

- `position: absolute; top: 0; left: 0; z-index: 5; pointer-events: auto`
- При focus: полупрозрачный белый фон + синяя рамка

## Поведение в деталях

| Сценарий                 | Результат                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Выбран текст, клик по ✏️ | Блок переходит в режим редактирования: поверх содержимого появляется textarea с текущим текстом |
| Ввод текста в textarea   | Текст меняется в реальном времени (v-model → `editingText`)                                     |
| Нажатие Ctrl+Enter       | Сохранить текст, выйти из режима                                                                |
| Нажатие Esc              | Отменить изменения, выйти из режима                                                             |
| Blur (клик вне textarea) | Сохранить текст, выйти из режима                                                                |
| Клик по 🗑️               | Удалить элемент (вызов `store.removeElement`)                                                   |
| Выделен barcode/image    | Показывается только 🗑️, ✏️ нет                                                                  |

## Что НЕ меняется

- `ElementPropsPanel.vue` — панель свойств остаётся без изменений (кнопки «Текст» и «Удалить» там остаются)
- `labelEditor.ts` store — никаких изменений не требуется
- `label.ts` types — не меняется

## Файлы для изменений

| Файл                                                                                                           | Действие                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [`frontend/src/components/label-editor/LabelCanvas.vue`](frontend/src/components/label-editor/LabelCanvas.vue) | Единственный файл с изменениями |
