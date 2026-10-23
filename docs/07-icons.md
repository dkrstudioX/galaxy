# Система иконок — `data/icons.js`

## Обзор

Единый каталог SVG-иконок, используемый во всех модулях проекта.
17 иконок для представления объектов, категорий и действий.

### Файл

```
data/icons.js
```

## Иконки

### Полный список

| Ключ | Название | Описание |
|------|----------|----------|
| `ship` | Ship | Корабль (основная иконка) |
| `weapon` | Weapon | Оружие |
| `shield` | Shield | Щит |
| `resource` | Resource | Ресурс (кристалл) |
| `rocket` | Rocket | Ракета / запуск |
| `engine` | Engine | Двигатель |
| `fuel` | Fuel | Топливо |
| `crate` | Crate | Ящик / контейнер |
| `gem` | Gem | Драгоценный камень |
| `bolt` | Bolt | Энергия / молния |
| `tool` | Tool | Инструмент |
| `box` | Box | Коробка |
| `radar` | Radar | Радар / сканер |
| `store` | Store | Магазин |
| `hangar` | Hangar | Ангар |
| `station` | Station | Станция |
| `grid` | Grid | Сетка |

## API

### `Icons.keys()`

Возвращает массив всех ключей иконок.

```javascript
Icons.keys()
// ['ship', 'weapon', 'shield', 'resource', 'rocket', 'engine', 'fuel',
//  'crate', 'gem', 'bolt', 'tool', 'box', 'radar', 'store', 'hangar',
//  'station', 'grid']
```

### `Icons.svg(name, size)`

Возвращает SVG-строку для указанной иконки.

```javascript
Icons.svg('ship', 24)
// '<svg width="24" height="24" viewBox="0 0 24 24" ...>...</svg>'

Icons.svg('weapon', 16)
// SVG иконка оружия размером 16x16
```

Параметры:
- `name` — ключ иконки (из списка выше)
- `size` — размер в пикселях (width и height)

### `Icons.random()`

Возвращает случайный ключ иконки.

```javascript
Icons.random()
// 'radar'  // (случайно)
```

Используется в админ-панели для быстрой установки случайной иконки объекту.

### `Icons.forCategory(name)`

Возвращает иконку по умолчанию для категории.

```javascript
Icons.forCategory('ships')
// 'ship'

Icons.forCategory('resources')
// 'resource'

Icons.forCategory('equipment')
// 'bolt'
```

## Использование

### В админ-панели (ui.js)

```javascript
// Icon picker в форме объекта
UI.createIconPicker(selected, onChange) {
  const keys = Icons.keys();
  const grid = document.createElement('div');
  grid.className = 'icon-picker';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, 36px)';
  grid.style.gap = '8px';

  keys.forEach(key => {
    const btn = document.createElement('button');
    btn.innerHTML = Icons.svg(key, 20);
    btn.className = key === selected ? 'active' : '';
    btn.onclick = () => onChange(key);
    grid.appendChild(btn);
  });

  // Кнопка "Random"
  const randomBtn = document.createElement('button');
  randomBtn.textContent = '🎲';
  randomBtn.onclick = () => onChange(Icons.random());
  grid.appendChild(randomBtn);

  return grid;
}
```

### В ангаре (base.js)

```javascript
// Отображение иконки товара
Base.svg(item.icon, 20)

// Отображение иконки слота
Base.svg(slot.icon, 16)
```

### В карте (space)

Иконки используются для обозначения типов объектов в дереве навигации.

## SVG-паттерны

Каждая иконка — inline SVG с viewBox="0 0 24 24":

```xml
<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none"
     xmlns="http://www.w3.org/2000/svg">
  <!-- path / circle / rect для конкретной иконки -->
</svg>
```

Цвет задаётся через CSS `fill`/`stroke` родителя:
```css
.icon-ship { fill: #7fe8ff; }
.icon-weapon { fill: #ff5f7a; }
```

## Интеграция с категориями

При создании объекта в админ-панели иконка категории автоматически
предлагается через `Icons.forCategory()`:

```javascript
// При выборе категории "Ships"
const defaultIcon = Icons.forCategory('ships');  // 'ship'

// При выборе категории "Resources"
const defaultIcon = Icons.forCategory('resources');  // 'resource'
```
