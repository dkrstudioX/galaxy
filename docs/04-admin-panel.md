# Админ-панель — `admin/`

## Обзор

CRUD-панель для управления данными проекта: props, slots, categories, objects.
Использует hash-роутер для навигации между разделами.

### Файлы

```
admin/
├── admin.html              # Sidebar + main content
├── css/styles.css          # Тёмная тема (~662 строки)
└── js/
    ├── app.js              # Hash-роутер, навигация
    ├── ui.js               # DOM-хелперы, модалки, тосты, формы, таблицы
    └── pages/
        ├── home.js         # Дашборд, статистика, экспорт/импорт
        ├── catalogs.js     # Props, Slots, Categories
        └── objects.js      # Objects editor
```

## Hash-роутер

`js/app.js` — простой hash-роутер:

```javascript
// Маршруты:
// #/home          — Дашборд
// #/props         — Props CRUD
// #/slots         — Slots CRUD
// #/categories/ships   — Категории кораблей
// #/categories/resources — Категории ресурсов
// #/categories/equipment — Категории оборудования
// #/objects       — Редактор объектов

App.routes = {
  'home': Pages.home,
  'props': Pages.catalogs_props,
  'slots': Pages.catalogs_slots,
  'categories/ships': Pages.catalogs_categories,
  'categories/resources': Pages.catalogs_categories,
  'categories/equipment': Pages.catalogs_categories,
  'objects': Pages.objects
};

App.init() {
  // Слушает hashchange
  // Рендерит sidebar
  // Делегирует навигацию
}
```

## Sidebar

Группировка по разделам:

```
┌─────────────────────┐
│ 🌌 Galaxy Admin     │
├─────────────────────┤
│ 📊 Dashboard        │
├─────────────────────┤
│ Справочники         │
│   ├── Props         │
│   └── Slots         │
├─────────────────────┤
│ Каталог             │
│   ├── Ships         │
│   ├── Resources     │
│   └── Equipment     │
├─────────────────────┤
│ 📦 Objects          │
└─────────────────────┘
```

Активный пункт подсвечивается. Клик меняет hash.

## Страницы

### `home.js` — Дашборд

**Карточки статистики:**
- Количество props
- Количество slots
- Количество categories
- Количество objects
- Количество ships

**Гайд "Начало работы":**
1. Создать категории
2. Добавить props
3. Добавить slots
4. Создать объекты

**Управление данными:**
- `Export JSON` — скачивание бэкапа
- `Import JSON` — загрузка из файла
- `Load Demo` — демо-данные

### `catalogs.js` — Props, Slots, Categories

**Props:**
- Таблица: ID, Name, Value, Unit
- Кнопка "Add Prop" → модалка с формой
- Форма: name, value, unit
- Edit/Drop в каждой строке

**Slots:**
- Таблица: ID, Name, slotId, Icon
- Кнопка "Add Slot" → модалка с формой
- Форма: name, slotId, icon (picker из 17 иконок)

**Categories:**
- Дерево категорий (3 корня: Ships, Resources, Equipment)
- Collapsible/expandable узлы
- Indentация по глубине
- Type chips (ships/resources/equipment)
- Icon для каждой категории
- Add/Edit/Drop для каждого узла
- Форма: name, parent (select), type, icon

### `objects.js` — Objects Editor

**Split-layout:**
```
┌──────────────────┬──────────────────────────┐
│ Category Tree    │ Objects Table            │
│ (левая панель)   │ (правая панель)          │
│                  │                          │
│ • Ships          │ Name  | Cat | Price | ...│
│   └─ Freighters  │ ---------+-----+------- │
│ • Resources      │ [Filter/Search]          │
│   └─ Metals      │ [Sort] [Add] [Import]   │
│ • Equipment      │                          │
│   └─ Weapons     │                          │
└──────────────────┴──────────────────────────┘
```

**Таблица объектов:**
- Сортировка: по category, name, price, mass
- Фильтрация: поиск по названию
- Колонки: Name, Category, Price, Mass, Icon
- Actions: Edit, Drop

**Форма объекта (модалка):**

```
┌─────────────────────────────────────┐
│ Object Form                         │
├─────────────────────────────────────┤
│ Name: [________________]            │
│ Category: [▼ Select]                │
│ Price: [________]                   │
│                                     │
│ ── Category Props ──                │
│ mass: [1000] kg                     │
│ speed: [250] km/h                   │
│ (динамически из inheritedProps)     │
│                                     │
│ ── Slots ──                          │
│ [Weapon 01] [Shield 01] [Engine 01] │
│ ↑↓ ↑↓ ↑↓  (drag reorder)           │
│ [+ Add Slot]                        │
│                                     │
│ ── Holds ──                          │
│ Cargo Hold: 5000 kg                 │
│ [Name: [Cargo] Cap: [5000]]         │
│ [+ Add Hold]                        │
│                                     │
│ ── prop_2 ──                         │
│ [iron] [gold] [platinum] [0]        │
│ (material buttons)                  │
│                                     │
│ [Cancel] [Save]                     │
└─────────────────────────────────────┘
```

**Элементы формы:**
- **Category Props block** — динамически генерируется из `Store.inheritedProps()`
- **Slot editor** — drag-and-drop reorder, add/remove
- **Hold editor** — name + capacity + mass validation
- **prop_2 picker** — button chips для каждого ресурса, "0" для пустого
- **Icon picker** — сетка 17 иконок + кнопка "Random"

## `ui.js` — DOM-хелперы и компоненты

### Модальные окна

```javascript
UI.openOverlay(title, bodyHTML, buttons)
// .overlay (backdrop blur) + .modal (панель)
// Анимация появления
// Кнопки: primary + optional secondary

UI.closeOverlay()
// Закрытие текущего overlay
```

### Тосты

```javascript
UI.toast(message, type)
// type: 'ok' | 'err' | 'warn'
// .toast с цветной полосой слева
// Автозакрытие через 3s
```

### Формы

```javascript
UI.createForm(fields, onSubmit)
// fields: [{ name, label, type, options, iconPicker }]
// Генерирует HTML-форму с валидацией

UI.createSelect(options, selected, onChange)
// Select с опциями

UI.createIconPicker(selected, onChange)
// Сетка 17 иконок + кнопка Random
```

### Таблицы

```javascript
UI.createTable(headers, rows, actions)
// headers: ['Name', 'Value', 'Actions']
// rows: [['name', 'value', [editBtn, deleteBtn]]]
// Сортировка по клику на заголовок

UI.createSortableTable(headers, data, sortKey, onSort, actions)
// Таблица с сортировкой
```

### Формы объектов

```javascript
UI.createObjectForm(initialData, categories, onSave, onCancel)
// Полная форма объекта со всеми блоками
// Category Props, Slots, Holds, prop_2, Icon

UI.createSlotEditor(slots, onChange)
// Drag-and-drop reorder слотов

UI.createHoldEditor(holds, onChange)
// Name + capacity для каждого трюма

UI.createProp2Picker(prop2, onChange)
// Button chips для prop_2

UI.createObjectTable(objects, categories, sortConfig, onEdit, onDrop)
// Split-layout таблица объектов
```

## CSS

```css
/* Тема */
:root {
  --bg: #06040e;           /* Тёмно-фиолетовый фон */
  --bg-panel: rgba(20, 15, 40, 0.8);
  --accent-purple: #a855f7;
  --accent-cyan: #37c9ee;
  --text: #e0e0e8;
  --text-muted: #8888a0;
  --danger: #ff5f7a;
  --success: #5fe8a0;
}

/* Sidebar */
.sidebar {
  width: 240px;
  background: var(--bg-panel);
  backdrop-filter: blur(12px);
  border-right: 1px solid rgba(168, 85, 247, 0.15);
}

/* Карточки статистики */
.stat-card {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(55, 201, 238, 0.05));
  border: 1px solid rgba(168, 85, 247, 0.2);
  transition: transform 0.2s;
  /* hover: transform: translateY(-2px) */
}

/* Таблицы */
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  cursor: pointer;
  border-bottom: 2px solid var(--accent-purple);
}
td:hover {
  background: rgba(168, 85, 247, 0.05);
}

/* Формы */
input, select, textarea {
  background: rgba(10, 8, 20, 0.6);
  border: 1px solid rgba(168, 85, 247, 0.2);
  color: var(--text);
  /* focus: border-color: var(--accent-purple), box-shadow: glow */
}

/* Кнопки */
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-primary {
  background: var(--accent-purple);
  color: white;
}
.btn-danger {
  background: var(--danger);
  color: white;
}

/* Модалки */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s;
}
.modal {
  background: var(--bg-panel);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 8px;
  animation: slideUp 0.3s;
}
```

## Поток CRUD

### Props
1. Клик "Add Prop" → модалка
2. Заполнение: name, value, unit
3. Save → `Store.insert('props', obj)` → `Store.persist()`
4. Обновление таблицы

### Slots
1. Клик "Add Slot" → модалка
2. Заполнение: name, slotId, icon
3. Save → `Store.insert('slots', obj)` → `Store.persist()`

### Categories
1. Клик на "+" у узла → модалка
2. Заполнение: name, parent, type, icon
3. Save → `Store.insert('categories', obj)` → `Store.persist()`
4. Перерисовка дерева

### Objects
1. Клик "Add Object" → полная модалка
2. Выбор категории → автогенерация props block
3. Настройка slots, holds, prop_2
4. Save → `Store.insert('objects', obj)` → `Store.persist()`

## Импорт / Экспорт

**Экспорт:**
```javascript
// admin.html → кнопка Export
const json = Store.exportJSON();
const blob = new Blob([json], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'galaxy_backup.json';
a.click();
```

**Импорт:**
```javascript
// admin.html → кнопка Import → file input
const file = input.files[0];
const text = await file.text();
Store.importJSON(text);
location.hash = '#home';  // Перезагрузка
```

**Демо-данные:**
```javascript
// admin.html → кнопка Load Demo
Store.loadDemo();
location.hash = '#home';
```
