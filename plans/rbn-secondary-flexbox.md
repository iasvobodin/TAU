# Замена grid на flexbox в .rbn-secondary

## Проблема

`grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))` при ширине ~1360px создаёт **4 колонки**, хотя блоков всего 3 (паддинги, геометрия, хвост). Из-за разной ширины блоков раскладка становится непредсказуемой, и геометрия может переноситься на вторую строку.

## Решение

Заменить `display: grid` на `display: flex; flex-wrap: wrap;`.

### Изменения CSS

**Было:**

```css
.rbn-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  align-items: center;
  gap: 4px 0;
  padding: 4px 10px;
  ...
}

.sec-cell {
  display: flex;
  ...
  padding: 0 4px;
  min-height: 28px;
}
```

**Стало:**

```css
.rbn-secondary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  padding: 4px 10px;
  ...
}

.sec-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  min-height: 28px;
  flex: 1 1 auto;
  min-width: 240px;
}
```

### Дополнительно

Поправить комментарий в шаблоне (строки 457-460), заменив упоминание grid на flexbox.

### Принцип работы

| Ширина окна | Поведение                                                              |
| ----------- | ---------------------------------------------------------------------- |
| > 800px     | Все 3 блока в одну строку, растягиваются равномерно (`flex: 1 1 auto`) |
| 500-800px   | Блоки переносятся: 2 в первой строке, 1 во второй                      |
| < 500px     | Каждый блок на своей строке                                            |
