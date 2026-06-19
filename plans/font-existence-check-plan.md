# План: Фильтрация шрифтов по физическому наличию на диске

## Проблема

[`FontManager`](frontend/src/assets/fontManager.ts) кэширует шрифты в файл `.tmp/fonts-db.json`.
База **накопительная** — хранит шрифты со всех компьютеров, на которых запускалось приложение,
потому что наборы шрифтов на разных компах разные.

[`getSupportedFonts()`](frontend/src/assets/fontManager.ts:149) возвращает **все** записи из БД
независимо от того, существуют ли файлы шрифтов на текущем компьютере. Нужно, чтобы в UI
показывались только те шрифты, которые **физически найдены** на данном компьютере.

## Требования (уточнённые)

1. **База не очищается** — накопительная, удалять записи нельзя
2. **Двухэтапный показ**:
   - Сразу после `init()` — показать список из кэша (мгновенно, все шрифты из БД)
   - После завершения `scan()` — обновить список, оставив только шрифты, найденные на диске

## Предлагаемое решение

### Изменение 1: [`FontManager`](frontend/src/assets/fontManager.ts) — добавить `scannedFileNames`

Добавить поле, хранящее список имён файлов (lowercase), обнаруженных при последнем сканировании.

```typescript
// Новое поле в классе
private scannedFileNames = new Set<string>()
```

Заполнять в конце [`scan()`](frontend/src/assets/fontManager.ts:96) после сбора `discovered`:

```typescript
// После цикла сканирования (после строки 101)
this.scannedFileNames = new Set(discovered.map((f) => f.name.toLowerCase()));
```

### Изменение 2: [`getSupportedFonts()`](frontend/src/assets/fontManager.ts:149) — параметр `onlyScanned`

Добавить опциональный параметр для фильтрации по `scannedFileNames`:

```typescript
getSupportedFonts(onlyScanned?: boolean): FontEntry[] {
  let result = this.database.filter(e => e.supported)
  if (onlyScanned && this.scannedFileNames.size > 0) {
    result = result.filter(e => this.scannedFileNames.has(e.fileName.toLowerCase()))
  }
  return result.sort((a, b) => a.fullName.localeCompare(b.fullName))
}
```

### Изменение 3: [`labelEditor.ts`](frontend/src/stores/labelEditor.ts) — двухфазное обновление

Изменить блок инициализации (строки 49-70):

```typescript
(async () => {
  await fontManager.init();
  // Фаза 1: мгновенный показ из кэша (все шрифты из БД)
  const fromCache = fontManager.getSupportedFonts(); // без флага
  if (fromCache.length) {
    availableFonts.value = fromCache.map((e) => ({
      label: e.fullName,
      value: e.fullName,
      svgPreviewPath: e.svgPreviewPath,
    }));
  }
  fontsLoading.value = false;
  // Фаза 2: после scan() — только реально найденные на диске
  fontManager.scan().then(() => {
    const scanned = fontManager.getSupportedFonts(true); // с флагом onlyScanned
    if (scanned.length) {
      availableFonts.value = scanned.map((e) => ({
        label: e.fullName,
        value: e.fullName,
        svgPreviewPath: e.svgPreviewPath,
      }));
    }
  });
})();
```

**Ключевое отличие от текущего кода**: после `scan()` вызывается `getSupportedFonts(true)`
вместо `getSupportedFonts()`. Флаг `true` фильтрует только те шрифты, чьи файлы были найдены
при сканировании.

## Поток после изменений

```
fontManager.init()
  ├─ загружает .tmp/fonts-db.json в this.database
  └─ scannedFileNames = пустой Set

getSupportedFonts()          ← без флага — все supported из БД
  → availableFonts (все из кэша, мгновенно)
  → UI показывает все шрифты (включая возможные отсутствующие)

fontManager.scan()
  ├─ сканирует системные папки
  ├─ добавляет новые файлы в this.database
  ├─ scannedFileNames = имена найденных файлов
  └─ сохраняет БД на диск

getSupportedFonts(true)      ← с флагом — только scannedFileNames
  → availableFonts (только найденные на этом компе)
  → UI обновляется, отсутствующие шрифты исчезают
```

## Файлы для изменения

| Файл                                                                       | Изменения                                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`frontend/src/assets/fontManager.ts`](frontend/src/assets/fontManager.ts) | 1) Добавить поле `scannedFileNames: Set<string>` 2) Заполнять его в конце `scan()` 3) Модифицировать `getSupportedFonts(onlyScanned?)` |
| [`frontend/src/stores/labelEditor.ts`](frontend/src/stores/labelEditor.ts) | После `scan()` вызывать `getSupportedFonts(true)` вместо `getSupportedFonts()`                                                         |

## Что НЕ меняется

- [`ElementPropsPanel.vue`](frontend/src/components/label-editor/ElementPropsPanel.vue) — без изменений
- [`renderToSVG.ts`](frontend/src/assets/renderToSVG.ts) — без изменений
- [`types/label.ts`](frontend/src/types/label.ts) — без изменений
- База `.tmp/fonts-db.json` — не очищается, только пополняется

## Edge cases

1. **`scan()` ещё не запущен**: `scannedFileNames` пуст → `getSupportedFonts(true)` вернёт пустой массив → в UI не будет шрифтов. Это ок, так как первая фаза уже показала кэш, а вторая фаза запускается только после `scan()`.
2. **Нет ни одного шрифта на компе**: `scannedFileNames` пуст после `scan()` → список очистится. Логично.
3. **Пользователь добавил шрифт после старта приложения**: Понадобится перезапустить приложение или вызвать `scan()` повторно.
