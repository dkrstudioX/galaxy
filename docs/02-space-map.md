# Карта Солнечной системы — `space/`

## Обзор

Интерактивная 2D-карта Солнечной системы, отрисованная на Canvas.
Пользователь может масштабировать, перемещать, выбирать небесные тела,
создавать звёздные базы и управлять временем.

### Файлы

```
space/
├── index.html              # Загрузка store.js, icons.js, app.js
├── css/style.css           # Стили боковой панели, HUD, модалок
├── build.py                # Сборка 17 модулей в app.js
└── js/
    ├── config.js           # Константы
    ├── math.js             # Математика орбит
    ├── data.js             # Астрономические данные
    ├── state.js            # Глобальное состояние
    ├── iso.js              # Изометрическая проекция
    ├── paint.js            # Canvas-примитивы
    ├── scene.js            # Фон: звёзды, лейблы
    ├── smallbodies.js      # Малые тела
    ├── sky.js              # Глубокий космос
    ├── render.js           # Рендер мира
    ├── hover.js            # Hit-testing, тултипы
    ├── input.js            # Ввод (мышь, тач)
    ├── ui.js               # Боковая панель, модалки
    └── main.js             # Точка входа, game loop
```

## Сборка

`build.py` читает `js/*.js` в строгом порядке и собирает один файл `app.js`:

```
config → math → data → state → iso → paint → scene → smallbodies →
bases_name → bases_removed → bases → sky → render → hover → input → ui → main
```

Порядок важен: каждый модуль зависит от предыдущих. `build.py` strips
import/export statements и оборачивает каждый модуль в IIFE.

## Модули

### `config.js` — Константы

```javascript
{
  EPOCH_J2000: 2451545.0,     // Начало отсчёта времени
  ZOOM_MIN: 0.3,              // Минимальный зум
  ZOOM_MAX: 20,               // Максимальный зум
  TIME_SPEED: 1,              // Базовая скорость времени
  ISO_SCALE_X: 0.5,           // Пропорция изометрии (2:1)
  ISO_SCALE_Y: 0.866,         // cos(30°)
  COLORS: { ... },            // Палитра: планеты, орбиты, фон
  STROKE_WIDTH: 1,            // Толщина линий орбит
  SHADOW_PARAMS: { ... }      // Параметры теней планет
}
```

### `math.js` — Математика

**Орбиты:**
- `orbitAngle(t)` — угол на круговой орбите
- `orbitPoint(t)` — 2D-позиция на круговой орбите
- `keplerPos(M, e)` — позиция на эллиптической орбите (метод Ньютона, 8 итераций)
- `keplerPos3(M, e, inc, node)` — 3D-позиция с учётом наклона и восходящего узла
- `keplerPoly(M, e, steps)` — полилайн орбиты для отрисовки
- `periodFromA(semiMajorAxis)` — период по третьему закону Кеплера

**Проекции:**
- `auToDist(au)` — астрономические единицы → пиксели на карте
  (piecewise-linear anchors для нелинейного масштаба)
- `project3(x, y, z)` — 3D → 2D изометрическая проекция
- `view(point)` — эквивалент project3
- `orbitPoint(a, e, l0, peri, inc, node, simDays)` — позиция тела в момент simDays
- `orbitEllipsePath(a, e, peri, steps)` — путь орбиты как SVG-подобный path
- `rawDist(angle)` — сырое расстояние для проекции
- `rawAngle(dx, dy)` — сырой угол для проекции

**Даты:**
- `formatSimDate(simDays)` — J2000 days → читаемая строка даты

### `data.js` — Астрономические данные

**Планеты (8):** Меркурий, Венера, Земля, Марс, Юпитер, Сатурн, Уран, Нептун
Каждая с реальными орбитальными элементами:
- `a` — большая полуось (AU)
- `e` — эксцентриситет
- `l0` — средняя аномалия при эпохе J2000
- `peri` — аргумент перигелия
- `inc` — наклонение
- `node` — долгота восходящего узла

**Луны:**
- Марс: Phobos, Deimos
- Юпитер: Io, Europa, Ganymede, Callisto + ещё 4
- Сатурн: Titan, Rhea, Enceladus, Dione, Tethys, Mimas
- Уран: Titania, Oberon, Umbriel, Ariel, Miranda
- Нептун: Triton, Nereid, Proteus

**Малые тела:**
- **Пояс астероидов**: 400 частиц + Kirkwood gaps + 4 заметных (Ceres, Vesta, Pallas, Hygiea)
- **NEA** (Near-Earth Asteroids): 14 именованных + 6 сгенерированных (Amor/Apollo/Aten)
- **Троянцы**: облака L4/L5 с libration
- **Кометы**: Halley, Encke, Swift-Tuttle, Hale-Bopp (с реальными inc/node)
- **Пояс Койпера**: 600 пылевых частиц
- **Облако Оорта**: 350 частиц

### `state.js` — Глобальное состояние

```javascript
{
  camX: 0, camY: 0, zoom: 1,    // Камера
  simDays: 0, timeScale: 1,       // Время симуляции
  mouse: { x: 0, y: 0, down: false, button: 0 },  // Мышь
  selected: null,                 // Выбранное тело (id)
  baseMode: false,                // Режим создания базы
  flyTo: null,                    // Камера перелёта {target, progress}
  bodies: []                      // Текущий список тел (генерируется каждый кадр)
}
```

### `iso.js` — Изометрическая проекция

Проекция 2:1 (dimetric):
- `project3(x, y, z)` → `{x, y}` на canvas
- `orbitPoint(...)` — вычисляет позицию на орбите с учётом всех элементов
- `orbitEllipsePath(...)` — строит path string для отрисовки орбиты
- `viewPoly(points)` — полилайн в проекции
- `rawDist(angle)` / `rawAngle(dx, dy)` — вспомогательные функции проекции

### `paint.js` — Canvas-примитивы

- `sphere(ctx, cx, cy, r, color, highlight)` — сфера с 3D-тенью и бликом
- `shadow(ctx, cx, cy, r, color)` — тень под объектом
- `glow(ctx, cx, cy, r, color, intensity)` — свечение вокруг объекта
- `sunSphere(ctx, cx, cy, r)` — специальная отрисовка Солнца
- `diamond(ctx, cx, cy, size)` — маркер базы (ромб)
- `rock(ctx, cx, cy, r, seed)` — детерминированная форма астероида (seed для repeatable shape)

### `scene.js` — Фон и лейблы

- `renderBackgroundStars(ctx, width, height)` — 400 фоновых звёзд
- `clusterBodies(bodies, threshold)` — кластеризация тел по расстоянию до экрана (50px)
  для оптимизации отрисовки
- `placeLabel(ctx, text, x, y, constraints)` — размещение лейбла без перекрытий

### `smallbodies.js` — Малые тела

- `smallBodyList()` — возвращает массив всех малых тел как hover-таргеты каждый кадр
- Включает: пояс, NEA, троянцы, кометы, Койпер, Оорт

### `bases.js` — Звёздные базы

- **Хранение**: `localStorage` ключ `galaxy_space_bases_v1`
- **Архив**: `galaxy_space_bases_removed_v1` (удалённые базы, 4s таймер)
- **Функции:**
  - `baseList()` — список баз
  - `baseAdd(name, orbitRadius)` — создание базы на орбите
  - `baseMove(id, newOrbitRadius)` — перемещение на другую орбиту
  - `baseRemove(id)` — отметка на удаление
  - `baseArchiveRemoved()` — очистка архива (старше 4s)
  - `baseRegistry()` — реестр имён баз
  - `baseOrbitCorridor(radius)` — визуальная зона орбиты для создания

### `sky.js` — Глубокий космос

- **Млечный Путь**: полоса ~60 градусов, параллакс с камерой (сдвиг 4%)
- **Андромеда**, **Магеллановы облака** — фоновые объекты
- **Параллакс**: 4% сдвига при движении камеры + saturation
- **Масштабирование**: элементы неба масштабируются при зуме
- **2 слоя звёзд**: бесконечные тайлы с k=0.10 и k=0.35

### `render.js` — Рендер мира

Порядок отрисовки (back to front):
1. Фон (звёзды)
2. Млечный Путь + глубокий космос
3. Солнце (glow + sphere)
4. Орбиты планет (lines)
5. Тени объектов
6. Сферы планет и лун
7. Астероиды и малые тела
8. Звёздные базы
9. Лейблы (labels)

**Возврат:** массив `hoverTargets` — объекты для hit-testing в следующем кадре.

### `hover.js` — Hit-testing

- Определяет тело под курсором мыши
- Рисует орбиту выбранного тела
- Показывает тултип без рамки (белый текст с тенью)
- Следует за курсором

### `input.js` — Ввод

- **Колесо мыши**: зум (0.3x — 20x)
- **Правая кнопка**: панорамирование
- **Левая кнопка**: выбор тела
- **Тач**: pinch-to-zoom, drag-to-pan, tap-to-select
- **Режим базы**: предпросмотр орбиты, клик для размещения, Esc для отмены
- **Клавиши**: Esc — отмена режима базы

### `ui.js` — Боковая панель

**Блоки:**
1. **01 Solar System** — дерево тел (планеты → луны)
2. **02 Object Info** — информация о выбранном объекте
3. **03 Small Bodies** — список малых тел

**Компоненты:**
- `.panel-head` — заголовок панели (клик для сворачивания)
- `.tree` — дерево навигации
- `.obj-title` — заголовок объекта
- `.base-row` — строка базы с прогрессом удаления
- `confirmDialog(title, message, onConfirm)` — модальное окно
- `flyToCamera(target, duration)` — плавный перелёт камеры (easeInOutCubic)

### `main.js` — Точка входа

- Инициализация canvas, обработка resize
- Game loop: update → render → requestAnimationFrame
- Обновление времени: `simDays += deltaTime * timeScale / dt`
- Синхронизация state с данными из render/hover

## CSS

```css
/* Стеклянные панели */
.glass {
  background: linear-gradient(...);
  backdrop-filter: blur(...) saturate(...);
  border: 1px solid rgba(150, 190, 255, .17);
}

/* Боковая панель */
.side-panel { ... }
.panel-head { cursor: pointer; }
.panel-body { /* скрывается/показывается */ }

/* Дерево */
.tree { ... }
.tree-item { ... }
.tree-children { margin-left: 16px; }

/* Тултип */
.tooltip {
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,.8);
  /* без рамки */
}

/* Модальное окно */
.dlg-overlay { /* тёмный оверлей с blur */ }
.dlg { /* панель с eyebrow, заголовком, × */ }
.dlg-title { ... }
.dlg-body { ... }

/* Малые тела */
.sb-row { ... }

/* Прогресс удаления базы */
.rm-bar { ... }
```

## Управление временем

3 кнопки: медленнее / нормально / быстрее
- x1 → x2 → x4 → x8 → x16 → x32 (умножение)
- x32 → x16 → ... → x1 (деление)
- Реальная скорость: `simDays += deltaTime * timeScale / 86400`
