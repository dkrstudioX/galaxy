# Расширенная архитектура hangar/ — Слои, потоки данных

## Обзор

Дополнительная документация к `docs/03-hangar.md`. Здесь — детальные описания
слоёв, потоков данных и ключевых концепций из `hangar/ARCHITECTURE.md`.

## Слои и поток данных

```
data/store.js ──► catalog.js ──► categories.js ──► ship.js
      (база)       (витрина)      (фильтры)        (корабль)
                                                       │
state.js ─────────────────────────────────────────────┤
                                                       ▼
                        shop.js · ship-view.js · info.js · hangar-tab.js · dock.js
                                                       │
                                                       ▼
                                                    DOM (index.html)
                                                       ▲
                                           app.js — рендер, клики, покупка/продажа
```

### Описание слоёв

| Слой | Модули | Ответственность |
|------|--------|----------------|
| **База** | `store.js` | Данные мира: объекты, категории, слоты, корабли, масса, цены |
| **Витрина** | `catalog.js` | Плоский список товаров, табы категорий |
| **Фильтры** | `categories.js` | Дерево категорий, фильтрация, подкатегории |
| **Корабль** | `ship.js` | Запись корабля, слоты, трюмы, модальные окна |
| **UI** | `shop.js`, `ship-view.js`, `info.js`, `hangar-tab.js`, `dock.js` | Рендер панелей |
| **Связка** | `app.js` | Делегирование кликов, покупка/продажа, Store |

## Ключевые понятия

### Витрина (shopItems)

Плоский список всех товаров для магазина:

```javascript
{
  id: 'obj_laser_m1',
  name: 'Лазер M-1',
  categoryId: 'cat_lasers',
  parentCategoryId: 'cat_equipment',
  mass: 50,           // масса в кг
  price: 25000,       // цена покупки
  sale: 17500,        // цена продажи (80% от buy)
  slotId: 'weapon',   // тип крепления, null — в крепление не вставляется
  isShip: false,      // флаг: корабль или нет
  icon: 'weapon',
  prop2: []           // для контейнеров — материалы
}
```

### Группы каталога

Три постоянных корня:

```javascript
{
  equipment: {
    title: 'Оборудование',
    root: { id: 'cat_equipment_root', name: 'Оборудование' },
    items: [
      { id: 'cat_lasers', title: 'Лазеры' },
      { id: 'cat_cannons', title: 'Пулемёты' },
      // ... ещё 8 категорий
    ]
  },
  resources: {
    title: 'Ресурсы',
    root: { id: 'cat_resources_root', name: 'Ресурсы' },
    items: [
      { id: 'cat_materials', title: 'Материалы' },
      { id: 'cat_fuel', title: 'Топливо' }  // пустая
    ]
  },
  ships: {
    title: 'Корабли',
    root: { id: 'cat_ships_root', name: 'Корабли' },
    items: [
      { id: 'cat_battleships', title: 'Линкоры' },
      { id: 'cat_frigates', title: 'Фрегаты' },
      // ... ещё 4 класса
    ]
  }
}
```

### Ветка (branch)

Выбранная категория + необязательный чип подкатегории. Задаёт фильтр витрины.

```javascript
state = {
  category: 'equipment',    // корневая группа
  subcategory: 'cat_lasers' // подкатегория (фильтр)
}
```

### Группы списка

`groupedShopItems` всегда кладёт позиции под фактическую подкатегорию товара,
независимо от выбранного таба/чипа. Заголовок группы показывается всегда,
включая для одной группы.

### Корабль

Запись `Store.userShips()`:

```javascript
{
  id: 'ship_abc123',
  shipId: 'obj_freighter',
  name: 'Freighter X1',
  categoryId: 'cat_frigates',
  price: 500000,
  boughtAt: '2026-10-22T...',
  slots: [
    { slotId: 'weapon', contents: [{ itemId: 'obj_laser_m1', qty: '1' }] },
    { slotId: 'shield', contents: [] },
    { slotId: 'engine', contents: [] }
  ],
  holds: [
    { name: 'Трюм 1', capacity: 2000, contents: [] },
    { name: 'Трюм 2', capacity: 1000, contents: [] }
  ],
  credits: 3500000
}
```

### Слот

- Крепление ровно под один предмет.
- Ограничение — только тип (`slotId`), нет вместимости.
- Клик по заполненному слоту → выбор предмета в «На корабле».
- Клик по пустому слоту → подбор совместимых товаров.

### Трюм

- Место под любое число предметов в пределах массы.
- Предметы показываются квадратами.
- Клик по квадрату → выбор предмета в «На корабле».

### Груз контейнера

- Значки ресурсов в углу квадрата контейнера.
- Наведение → подсказка (ресурс, контейнер, кг, цена).
- Клик по значку → выбор груза в «На корабле» → продажа 1 кг.
- Клик по остальной части → выбор самого контейнера → продажа целиком.

### «На корабле»

Реальное оборудование и груз записи:
- Каждая единица отдельно, строки как в витрине.
- Фильтр по текущей ветке (категория + подкатегория).
- Клик → карточка предмета (место, масса/кг, цена) + кнопка продажи.
- У контейнера с грузом → список ресурсов с кг и итог.

### Продажа корабля

```javascript
Store.shipSaleValue(shipId)
// Возвращает:
// {
//   shipPrice: 500000,
//   gearPrice: 125000,
//   cargoPrice: 5000,
//   total: 630000
// }

Store.sellShip(shipId)
// Удаляет запись, начисляет total на баланс
// Возвращает: { ok: true, value: 630000 }
```

## Модули (детали)

### catalog.js

```javascript
// Один раз при загрузке:
Catalog.init() {
  Store.ensureCatalogGroups()  // миграция старых баз в 3 группы
  this.categories = Store.catalogGroups()  // { equipment, resources, ships }
  this.shopItems = shopItems()  // плоский список товаров
}

// shopItems() — фильтрует Store.objects() и добавляет computed поля:
// - price, sale, mass, slotId, isShip
```

### categories.js

```javascript
// Дерево категорий:
Categories.inSubtree(catId, targetId)    // targetId в поддереве catId
Categories.inCategory(catId, targetId)   // targetId прямо в catId
Categories.buildSubcategories(rootKey)   // чипсы подкатегорий для таба
Categories.filteredItems(items, branch)  // фильтрация по ветке
Categories.itemSubcategoryId(item)       // подкатегория товара
Categories.groupedShopItems(items)       // группировка по фактической подкатегории
Categories.currentShop()                 // текущий фильтр из state
Categories.activeResource()              // активный ресурс для prop_2
```

### ship.js

```javascript
// Записи кораблей:
Ship.userShipRecords()                   // Store.userShips()
Ship.activeUserShip()                    // текущий выбранный корабль
Ship.activeShipView()                    // { ship, obj, slots, holds }

// Рендер:
Ship.renderSlots(container, ship)        // квадраты слотов
Ship.renderHolds(container, ship)        // квадраты трюмов
Ship.renderOnShipColumn(container, ship) // колонка «На корабле»
Ship.renderSellButton(container, ship)   // кнопка продажи корабля

// Модальные окна:
Ship.showSlotModal(slotIndex, ship)      // содержимое слота
Ship.showSellModal(ship)                 // продажа корабля
Ship.showBuyFailModal(reason)            // неудачная покупка
```

### shop.js

```javascript
// Вкладка «Магазин»:
Shop.renderTabs(container)               // табы категорий
Shop.renderChips(container, subs)        // чипсы подкатегорий
Shop.renderItemList(container, items)    // карточки товаров
Shop.renderConsole(container, items, total) // консоль торговли

// Действия:
Shop.handleBuy(objectId)                 // Store.buyForShip()
Shop.handleSell(objectId)                // Store.sellEntry()
Shop.updateConsole(objectId, action)     // добавление/удаление в консоль
```

### app.js — делегирование кликов

```javascript
// Делегирование на body:
body.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]')
  if (!target) return

  const action = target.dataset.action

  switch (action) {
    case 'buy':           // покупка из магазина
    case 'sell':          // продажа из «На корабле»
    case 'sell-ship':     // продажа корабля
    case 'select-ship':   // выбор корабля в доке
    case 'select-item':   // выбор товара в консоли
    case 'sell-cargo':    // продажа 1 кг из контейнера
    case 'sell-cargo-all': // продажа контейнера с грузом
    case 'transfer-resource': // перегрузка ресурсов (hangar-tab)
  }
})
```

## Поток покупки (детально)

```
1. Клик «Купить» на товаре
   ↓
2. app.js: Store.buyForShip(activeShipId, objectId, 1)
   ↓
3. Store.buyForShip:
   a. Проверка кредитов
   b. Определение типа (ресурс/оборудование)
   c. Поиск места (крепление→трюм или контейнер)
   d. Списание кредитов, запись в slots/holds
   ↓
4. Store.persist() → localStorage
   ↓
5. app.js:
   - Успех: toast «Куплено»
   - Отказ: modal с причиной
   ↓
6. render() + renderDock()
```

## Поток продажи (детально)

```
1. Клик по заполненному слоту/квадрату трюма
   ↓
2. app.js: выбор предмета в «На корабле»
   ↓
3. Консоль: карточка предмета + кнопка «Продать»
   ↓
4. Клик «Продать»:
   a. Store.sellEntry(shipId, place, entryIndex, withCargo)
   b. Расчёт цены: priceSale(item) + cargoValue(entry)
   c. Кредиты += цена
   d. Удаление entry из contents
   ↓
5. Store.persist() → localStorage
   ↓
6. render() + renderDock()
```

## Продажа контейнера с грузом

```
1. Клик по контейнеру в «На корабле»
   ↓
2. Карточка: список груза (ресурс, кг) + итог
   ↓
3. Кнопка «Продать вместе с грузом»
   ↓
4. confirmDialog: состав + сумма + «Продать» / «Отмена»
   ↓
5. Store.sellEntry(shipId, place, entryIndex, withCargo=true)
   ↓
6. Удаление контейнера + всего груза
   Кредиты += priceSale(container) + cargoValue(entry)
```

## Состояние (state.js)

```javascript
state = {
  tab: 'shop',                // 'shop' | 'ship-view' | 'info' | 'hangar-tab'
  category: 'all',            // 'all' | 'equipment' | 'resources' | 'ships'
  subcategory: null,          // id подкатегории или null
  selectedShipId: null,       // id записи корабля
  selectedObjectId: null,     // id товара в консоли
  transfer: { fromHold: null, toHold: null, resourceId: null, kg: 0 },
  consoleItems: [],           // [{ itemId, action: 'buy'|'sell', qty }]
  consoleTotal: 0             // итого сумма
}
```

## События и ререндер

После любого изменения Store:

```javascript
app.js:
  Store.persist()
  render()       // перерисовка всех панелей
  renderDock()   // перерисовка дока (если изменились корабли)
```

## Порядок сборки

```
base → state → catalog → categories → ship → shop →
ship-view → info → hangar-tab → dock → app
```

Зависимости идут только вперёд. Циклических импортов нет.

## Как менять код

| Задача | Что править |
|--------|-------------|
| Новая панель/вкладка | Добавить модуль в `js/`, внести в `ORDER`, вызвать из `render()` |
| Новое действие | `data-action="..."` в HTML, ветка в делегированном обработчике |
| Новое поле интерфейса | Добавить в `state.js`, сбрасывать при смене корабля/ветки |
| Новая цена/масса/свойство | Считать через `Store`, не дублировать в рендере |
| Стили | Только `hangar.css`, по образцу соседних панелей |

После правок: `py build.py` → проверить в браузере.
