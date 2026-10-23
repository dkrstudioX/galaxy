# Демо добычи астероидов — `demo/`

## Обзор

Симулятор добычи астероидов в виде cockpit view. Программный 3D-рендерер
на Canvas 2D (без WebGL). Физическая модель с фиксированным шагом.

### Файлы

```
demo/
├── index.html              # Cockpit view с HUD-панелями
├── css/style.css           # Стили HUD
├── js/
│   ├── sim.js              # Физическая модель
│   ├── view.js             # 3D-рендерер (Canvas 2D)
│   └── app.js              # Ввод, HUD, game loop
└── README.md               # Управление и документация
```

## `sim.js` — Физическая модель

### World

```javascript
class World {
  constructor() {
    this.ships = [];          // Корабли
    this.asteroids = [];      // Астероиды
    this.time = 0;            // Время симуляции
  }

  update(dt) { ... }         // Обновление всех объектов
  addShip(ship) { ... }      // Добавить корабль
  addAsteroid(asteroid) { ... }
}
```

### Ship

```javascript
class Ship {
  constructor() {
    this.position = [0, 0, 0];     // 3D-позиция
    this.velocity = [0, 0, 0];     // 3D-скорость
    this.rotation = [0, 0, 0];     // Кватернион / углы Эйлера
    this.mass = 1000;              // Масса (кг)
    this.cargoHold = 5000;         // Ёмкость трюма (кг)
    this.cargo = 0;                // Текущий груз (кг)
    this.credits = 3500000;        // Кредиты
  }

  // Двигатели
  mainEngine(thrust) { ... }      // Главный двигатель: 5.8 m/s²
  rcs(thrust) { ... }             // RCS (reaction control): 1.8 m/s²

  // Автопилот
  autopilot(target, phase) { ... }
  // Фазы: intercept → hold → final_approach
}
```

### Asteroid

```javascript
class Asteroid {
  constructor(position, size, rotationSpeed) {
    this.position = position;   // [x, y, z]
    this.size = size;           // Радиус
    this.rotationSpeed = rotationSpeed;
    this.composition = [...];   // Состав ресурсов
    this.port = { ... };        // Точка стыковки
  }

  update(dt) { ... }           // Вращение
}
```

### Автопилот

3 фазы подхода к астероиду:

1. **Intercept** — выход на курс к астероиду
2. **Hold** — удержание дистанции
3. **Final Approach** — медленный подход к порту

Управление: `Space` — активировать/деактивировать.

## `view.js` — 3D-рендерер

Программный рендерер на Canvas 2D (без WebGL).

### Perspective Projection

```javascript
View.project(point3D, camera, viewport)
// point3D → screenX, screenY
// perspective divide: x' = x / (z * fov)

View.transform(point3D, matrix)
// Применение матрицы трансформации
```

### Depth Sorting

```javascript
View.depthSort(objects)
// Сортировка по Z для painter's algorithm
// Дальние объекты рисуются первыми
```

### Mesh Rendering

```javascript
View.drawAsteroid(ctx, asteroid, camera)
// Отрисовка астероида как полигона
// Текстура/цвет зависит от состава

View.drawShip(ctx, ship, camera)
// Отрисовка корабля (wireframe / filled)

View.drawHUD(ctx, hudData)
// HUD-элементы: прицел, линии, цифры
```

### Камера

```javascript
View.cameraFromShip(ship)
// Камера следует за кораблём (cockpit view)

View.lookAt(eye, target, up)
// Матрица вида
```

## `app.js` — Ввод, HUD, Game Loop

### Управление

| Клавиша | Действие |
|---------|----------|
| `W` | Главный двигатель (вперёд) |
| `S` | Главный двигатель (назад) |
| `A` | RCS влево |
| `D` | RCS вправо |
| `Q` | RCS вверх |
| `E` | RCS вниз |
| `Mouse` | Поворот камеры (pointer lock) |
| `H` | Вкл/выкл фары |
| `U` | Отстыковка от астероида |
| `Space` | Автопилот |

### Pointer Lock

```javascript
// Запрос pointer lock при клике на canvas
canvas.requestPointerLock();

// Обработка движения мыши
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    ship.rotateCamera(e.movementX, e.movementY);
  }
});
```

### HUD-панели

```
┌─────────────┬─────────────┐
│ Flight Info │ Target Info │
│ (полёт)     │ (цель)      │
├─────────────┼─────────────┤
│ Advice      │ Orbit Map   │
│ (советы)    │ (карта орб.)│
├─────────────┴─────────────┤
│ Log         │ Time Scale  │
│ (журнал)    │ (x1/x2/x4)  │
└───────────────────────────┘
```

**Flight Info:**
- Скорость (m/s)
- Высота над поверхностью
- Угол атаки

**Target Info:**
- Расстояние до астероида
- Состав ресурсов
- Статус стыковки

**Maneuver Advice:**
- Рекомендации по манёврам
- "Dock to asteroid port"
- "Fill cargo hold"

**Orbit Map:**
- Мини-карта орбиты
- Позиция корабля и астероида

**Log:**
- Журнал событий
- "Docked", "Undocked", "Cargo filled"

**Time Scale:**
- x1 / x2 / x4

### Game Loop

```javascript
let lastTime = performance.now();
const FIXED_DT = 1 / 120;  // 120 Hz физика
let accumulator = 0;

function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  accumulator += dt;

  // Фиксированный шаг физики
  while (accumulator >= FIXED_DT) {
    world.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  // Рендер с интерполяцией
  view.render(world, camera);

  // Обновление HUD
  updateHUD();

  requestAnimationFrame(gameLoop);
}
```

## CSS

```css
/* HUD-панели */
.hud-panel {
  background: rgba(0, 10, 30, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(127, 232, 255, 0.2);
  border-radius: 4px;
  padding: 12px;
}

/* Чипсы ресурсов */
.resource-chip {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  background: rgba(127, 232, 255, 0.1);
  border: 1px solid rgba(127, 232, 255, 0.3);
}
```

## Поток добычи

1. **Подлёт** — WASD + мышь к астероиду
2. **Стыковка** — подход к порту, автоматическая стыковка
3. **Загрузка** — трюм заполняется ресурсами
4. **Отстыковка** — `U` для отстыковки
5. **Возврат** — полёт к станции для продажи
