# Ангар — `hangar/`

## Обзор

Ангар — интерфейс управления кораблями и магазина. Включает каталог товаров,
док кораблей, управление оборудованием и грузом.

### Файлы

```
hangar/
├── index.html              # Главная страница ангара
├── hangar.css              # Все стили (~890 строк)
├── hangar.js               # Сборка из js/*.js
├── build.py                # Сборка 11 модулей
├── ARCHITECTURE.md         # Документация модулей
└── js/
    ├── base.js             # Утилиты, SVG-иконки
    ├── state.js            # UI-состояние
    ├── catalog.js          # catalogGroups, shopItems
    ├── categories.js       # Дерево категорий, фильтрация
    ├── ship.js             # Корабли, слоты, трюмы, модалки
    ├── shop.js             # Магазин: табы, чипсы, список, консоль
    ├── ship-view.js        # Вкладка информации о корабле
    ├── info.js             # Вкладка базовой информации
    ├── hangar-tab.js       # Вкладка перегрузки ресурсов
    ├── dock.js             # Нижний док: карточки кораблей
    └── app.js              # Точка входа
```

## Сборка

`build.py` собирает 11 модулей в `hangar.js`:

```
base → state → catalog → categories → ship → shop → ship-view →
info → hangar-tab → dock → app
```

Каждый модуль оборачивается в IIFE, import/export удаляются.

## Модули

### `base.js` — Утилиты

```javascript
// SVG-иконки (обёртка над data/icons.js)
Base.icons()           // Ключи иконок
Base.svg(name, size)   // SVG-строка иконки

// Форматирование
Base.fmt(n)            // Число → строка с разделителями (1 000 000)
Base.plural(n, forms)  // Склонение: 1 товар, 2 товара, 5 товаров

// Диалоги
Base.openDialog(html)  // Открыть модальное окно
Base.closeDialog()     // Закрыть модальное окно
```

### `state.js` — UI-состояние

```javascript
{
  tab: 'shop',              // Текущая вкладка: shop | ship-view | info | hangar-tab
  category: 'all',          // Выбранная категория: all | equipment | resources | ships
  subcategory: null,        // Подкатегория (фильтр)
  selectedShipId: null,     // Выбранный корабль в доке
  selectedObjectId: null,   // Выбранный в магазине объект
  transfer: { ... },        // Данные перетаскивания (drag & drop)
  consoleItems: [],         // Товары в консоли торговли
  consoleTotal: 0           // Итого в консоли
}
```

### `catalog.js` — Каталог товаров

```javascript
Catalog.shopItems()
// Возвращает плоский список всех товаров для магазина
// Фильтруется по текущей категории из state

Catalog.catalogGroups()
// Обёртка над Store.catalogGroups() — { equipment, resources, ships }
```

### `categories.js` — Дерево категорий

```javascript
Categories.renderTree(container, options)
// Отрисовка дерева категорий в DOM-элемент
// Опции: showIcons, showTypeChips, onSelect

Categories.filterBySubcategory(items, subcategory)
// Фильтрация товаров по подкатегории

Categories.getSubcategories(category)
// Список подкатегорий для выбранной категории
```

### `ship.js` — Управление кораблём

```javascript
Ship.renderDock(container, ships)
// Отрисовка нижнего дока с карточками кораблей

Ship.renderSlots(container, ship)
// Отрисовка сетки слотов: заполненные (иконка) и пустые (пунктир)

Ship.renderHolds(container, ship)
// Отрисовка трюмов: полоса массы + сетка предметов

Ship.renderOnShipColumn(container, ship)
// Колонка "On Ship" для продажи предметов

Ship.showSlotModal(slotIndex, ship)
// Модальное окно содержимого слота

Ship.showSellModal(ship)
// Модальное окно продажи корабля (полная разбивка стоимости)

Ship.showBuyFailModal(reason)
// Модальное окно неудачной покупки (недостаточно места/денег)
```

### `shop.js` — Магазин

**Структура:**
- **Табы категорий**: All, Equipment, Resources, Ships
- **Чипсы подкатегорий**: фильтры внутри категории
- **Список товаров**: карточки с иконкой, названием, ценой
- **Консоль торговли**: выбранные товары, кнопки Buy/Sell, итого

```javascript
Shop.renderTabs(container)
// Вкладки категорий (из Store.catalogGroups())

Shop.renderChips(container, subcategories)
// Чипсы подкатегорий

Shop.renderItemList(container, items)
// Карточки товаров

Shop.renderConsole(container, items, total)
// Консоль торговли

Shop.handleBuy(objectId)
// Обработка покупки: Store.buyForShip() → success toast или modal

Shop.handleSell(objectId)
// Обработка продажи

Shop.updateConsole(objectId, action)
// Обновление консоли: добавление/удаление товара
```

### `ship-view.js` — Информация о корабле

```javascript
ShipView.renderHeader(container, ship)
// Заголовок: название, масса, баланс

ShipView.renderEquipment(container, ship)
// Блок оборудования: слоты с иконками

ShipView.renderHolds(container, ship)
// Блок трюмов: масса, содержимое

ShipView.renderSellButton(container, ship)
// Кнопка продажи корабля с модальным окном подтверждения
```

### `info.js` — Базовая информация

```javascript
Info.render(container)
// Карточка станции HELIOS VII
// Информация о ресурсах
```

### `hangar-tab.js` — Перегрузка ресурсов

```javascript
HangarTab.render(container, ship)
// Вкладка для перемещения ресурсов между трюмами
// Демо-функционал
```

### `dock.js` — Нижний док

```javascript
Dock.render(container, ships, selectedShipId)
// Карточки кораблей в нижней панели
// Выбранный корабль подсвечивается
// Клик — выбор корабля
```

### `app.js` — Точка входа

```javascript
App.init()
// Инициализация: рендер всех панелей
// Навешивание обработчиков через делегирование кликов

// Делегирование кликов:
// - .shop-item → выбор товара в консоли
// - .dock-card → выбор корабля
// - .slot-tile → показ содержимого слота
// - .hold-tile → показ содержимого трюма
// - .btn-buy → покупка
// - .btn-sell → продажа
// - .btn-sell-ship → продажа корабля
```

## UI-паттерны

### 4-колоночная сетка

```
┌──────────┬──────────┬──────────┬──────────┐
│ Ship     │ Shop     │ Cargo    │ Console  │
│ Panel    │ List     │ List     │          │
│ (выбор)  │ (товары) │ (On Ship)│ (торговля)│
└──────────┴──────────┴──────────┴──────────┘
```

### Модальные окна

```html
<div class="slot-modal">
  <div class="slot-dialog">
    <span class="eyebrow">...</span>
    <h2 class="dialog-title">...</h2>
    <div class="dialog-body">...</div>
    <button class="dialog-close">×</button>
  </div>
</div>
```

- Тёмный оверлей с blur
- Панель с eyebrow (подзаголовок), заголовком
- Квадратная кнопка "×"
- Адаптивные размеры

### Тултипы слотов

```html
<div class="slot-tip">...</div>
```

Всплывающая подсказка при наведении на слот: показывает название и описание.

### Уведомления

- **Success toast**: зелёная полоса слева, автозакрытие
- **Error toast**: красная полоса слева
- **Warn toast**: жёлтая полоса слева

## Стили

```css
/* Фон станции */
body {
  background: #0a0e1a;
  /* window, beams, floor grid — декорации станции */
  /* scanline overlay — эффект сканлайнов */
}

/* Акцент */
--accent: #7fe8ff;  /* голографический голубой */

/* Стеклянные панели */
.panel {
  background: rgba(15, 20, 40, 0.7);
  backdrop-filter: blur(12px) saturate(1.5);
  border: 1px solid rgba(127, 232, 255, 0.15);
}

/* Слоты */
.slot-tile {
  width: 48px;
  height: 48px;
  border: 1px dashed rgba(127, 232, 255, 0.3);
  /* заполненный: border-solid, background с иконкой */
}

/* Трюмы */
.hold-tile {
  /* полоса массы, сетка предметов */
}

/* Адаптивность */
@media (max-width: 1200px) { /* 2 колонки */ }
@media (max-width: 800px)  { /* 1 колонка */ }
```

## Поток покупки

1. Пользователь кликает "Buy" на товаре
2. `Store.buyForShip(shipId, objectId, qty)` — попытка покупки
3. Если успешно:
   - Оборудование → первый свободный слот → первый свободный трюм
   - Ресурсы → первый совместимый контейнер (prop_2)
   - Toast-уведомление "Purchased"
4. Если неудачно:
   - Модальное окно с причиной: "No slot available", "No hold space",
     "Not enough credits"

## Поток продажи

1. Клик на заполненный слот → предмет появляется в колонке "On Ship"
2. Клик на предмет в "On Ship" → выбор для продажи
3. Кнопка "Sell" → `Store.sellEntry()` → обновление UI
4. Продажа корабля: полная разбивка (ship + gear + cargo) → подтверждение
