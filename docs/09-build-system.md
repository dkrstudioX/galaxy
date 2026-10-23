# Система сборки — `build.py`

## Обзор

Python-скрипт `build.py` собирает отдельные JS-модули в один бандл.
Используется в модулях `space/` и `hangar/`.

### Принцип работы

1. Читает все `.js` файлы из директории `js/`
2. Определяет порядок файлов (зависимости)
3. Для каждого файла:
   - Считывает содержимое
   - Удаляет `import` и `export` statements
   - Оборачивает в IIFE (Immediately Invoked Function Expression)
4. Конкатенирует все обработанные модули в один файл
5. Записывает результат в `app.js` (space) или `hangar.js` (hangar)

## Space: `space/build.py`

### Порядок модулей (17 файлов)

```python
ORDER = [
    'config',       # Константы
    'math',         # Математика орбит
    'data',         # Астрономические данные
    'state',        # Глобальное состояние
    'iso',          # Изометрическая проекция
    'paint',        # Canvas-примитивы
    'scene',        # Фон: звёзды, лейблы
    'smallbodies',  # Малые тела
    'bases_name',   # Имена баз (вспомогательный)
    'bases_removed',# Архив удалённых баз
    'bases',        # Звёздные базы
    'sky',          # Глубокий космос
    'render',       # Рендер мира
    'hover',        # Hit-testing, тултипы
    'input',        # Ввод (мышь, тач)
    'ui',           # Боковая панель, модалки
    'main',         # Точка входа, game loop
]
```

### Результат

```
space/js/*.js  →  space/app.js
```

### Загрузка

```html
<!-- index.html -->
<script src="data/store.js"></script>
<script src="data/icons.js"></script>
<script src="js/app.js?v=123"></script>
```

Кэш-бастинг через `?v=` — при каждом запуске build.py генерирует
новый timestamp, чтобы браузер загружал обновлённый app.js.

## Hangar: `hangar/build.py`

### Порядок модулей (11 файлов)

```python
ORDER = [
    'base',         # Утилиты, SVG-иконки
    'state',        # UI-состояние
    'catalog',      # catalogGroups, shopItems
    'categories',   # Дерево категорий
    'ship',         # Корабли, слоты, трюмы
    'shop',         # Магазин
    'ship-view',    # Информация о корабле
    'info',         # Базовая информация
    'hangar-tab',   # Перегрузка ресурсов
    'dock',         # Нижний док
    'app',          # Точка входа
]
```

### Результат

```
hangar/js/*.js  →  hangar/hangar.js
```

### Загрузка

```html
<!-- index.html -->
<script src="data/store.js"></script>
<script src="data/icons.js"></script>
<script src="hangar.js?v=123"></script>
```

## Детали обработки

### Удаление import/export

```javascript
// Исходный модуль (data.js)
import { state } from './state.js';
export function renderBodies() { ... }

// После обработки
(function() {
  // содержимое функции, state доступен из глобального scope
  function renderBodies() { ... }
  window.renderBodies = renderBodies;  // экспортируем в window
})();
```

### IIFE обёртка

```javascript
(function() {
  // Все переменные модуля — локальные
  // Глобальные функции присваиваются window
  window.ModuleName = {
    func1: function() { ... },
    func2: function() { ... }
  };
})();
```

### Генерация timestamp

```python
import time
timestamp = int(time.time())
# 1729600000

# В index.html:
# <script src="js/app.js?v=1729600000"></script>
```

## Запуск сборки

```bash
# Space
cd space
python build.py

# Hangar
cd hangar
python build.py
```

## Структура бандла

После сборки `app.js` содержит все модули в порядке ORDER:

```javascript
// config.js
(function() {
  window.Config = {
    EPOCH_J2000: 2451545.0,
    ZOOM_MIN: 0.3,
    // ...
  };
})();

// math.js
(function() {
  window.MathModule = {
    orbitAngle: function(t) { ... },
    keplerPos: function(M, e) { ... },
    // ...
  };
})();

// ... остальные модули ...

// main.js
(function() {
  window.Main = {
    init: function() { ... },
    // ...
  };
  window.Main.init();  // автозапуск
})();
```

## Зависимости между модулями

### Space

Каждый модуль зависит от всех предыдущих в ORDER:

```
config     — нет зависимостей
math       — config
data       — config, math
state      — config
iso        — config, math
paint      — config
scene      — config, paint
smallbodies— config, math, data, state, iso, scene
bases_name — state
bases_removed — state
bases      — state, bases_name, bases_removed
sky        — state, config
render     — state, config, iso, paint, scene, smallbodies, bases, sky
hover      — state, render
input      — state, render, hover
ui         — state, ui
main       — state, render, hover, input, ui
```

### Hangar

```
base       — нет
state      — base
catalog    — state
categories — state, catalog
ship       — state, base
shop       — state, catalog, categories, ship
ship-view  — state, ship
info       — state
hangar-tab — state
dock       — state, ship
app        — state, catalog, categories, shop, ship-view, dock, info, hangar-tab
```

## Преимущества

1. **Модульность** — код разбит на логические модули
2. **Читаемость** — каждый модуль отвечает за одну задачу
3. **Переиспользование** — `data/store.js` и `data/icons.js` общие для всех модулей
4. **Кэш-бастинг** — timestamp в URL предотвращает кэширование
5. **Простота** — нет зависимости от npm/webpack, только Python

## Недостатки и ограничения

1. **Глобальный scope** — после сборки все модули живут в `window`
2. **Нет tree-shaking** — загружается весь бандл
3. **Жёсткий порядок** — ORDER должен быть правильным
4. **Нет типизации** — ошибки runtime вместо compile-time
