/* HELIOS // 7 — порт приложения из hangar/src/App.tsx (React) в чистый JS.
   Сохранены разметка классов, стили и вся логика: вкладки, магазин, торговля,
   перегрузка ресурсов между базой и кораблём, инфо-разделы, док кораблей. */
(function () {
  'use strict';

  console.info('HELIOS 7 — сборка v20 · 17.10.2026');

  /* ---------- Иконки ---------- */

  var ICONS = {
    station: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><path d="m8.5 8.5 7 7m0-7-7 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    store: '<path d="M4 9h16l-1-5H5L4 9Z"/><path d="M6 9v11h12V9M9 20v-6h6v6"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    weapon: '<path d="m5 19 4-4m2-2 8-8v5l-8 8H6v-5l8-8h5"/><path d="m14 10 3 3"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/>',
    resource: '<path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path d="m5 7 7 4 7-4M12 11v10"/>',
    ship: '<path d="m12 3 5 7-1 8-4-2-4 2-1-8 5-7Z"/><path d="M10 12h4M12 3v7"/>',
    hangar: '<path d="M3 20V9l9-6 9 6v11M7 20v-8h10v8"/><path d="M9 16h6M9 12h6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    minus: '<path d="M6 12h12"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    arrowRight: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    arrowLeft: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    credits: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.5-1.5-3-1.5-2 0-3 1-3 2.2 0 3.1 6 1 6 4 0 1.2-1 2.3-3 2.3-1.5 0-2.6-.5-3.2-1.5M12 6v2m0 8.5V19"/>'
  };

  function icon(name, size) {
    size = size || 18;
    return '<svg aria-hidden="true" fill="none" height="' + size + '" viewBox="0 0 24 24" width="' + size +
      '" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">' +
      (ICONS[name] || ICONS.grid) + '</svg>';
  }

  function shipGlyph(compact) {
    return '<svg class="ship-glyph' + (compact ? ' compact' : '') + '" viewBox="0 0 220 100" fill="none">' +
      '<path d="M12 52 56 40 88 14h45l17 24 58 14-58 12-20 24H88L57 65 12 52Z" fill="currentColor" opacity=".16"/>' +
      '<path d="M13 52h195M57 40l31 12-31 13M88 14l14 38-14 36M133 14l-13 38 10 36M150 38l-30 14 30 12" stroke="currentColor"/>' +
      '<path d="M94 42h30l7 10-8 10H94l-8-10 8-10Z" fill="currentColor" opacity=".45"/>' +
      '<path d="m45 45-20 7 20 7m114-16 33 9-33 8" stroke="currentColor" stroke-width="2"/></svg>';
  }

  /* ---------- Данные магазина (объекты из базы админки) ---------- */

  /* Объекты админки -> строки витрины: имя, категория, масса и свойства. */
  function buildShopItems() {
    if (!window.Store) return [];
    return Store.objects().map(function (o) {
      var cat = Store.byId('categories', o.categoryId);
      var props = Store.categoryProps(o.categoryId).map(function (p) {
        return { name: p.name, value: (o.values && o.values[p.id]) || p.value || '' };
      }).filter(function (p) { return p.value; });
      return {
        id: o.id,
        name: o.name,
        categoryId: o.categoryId,
        parentCategoryId: o.parentCategoryId || (cat ? cat.parentId : ''),
        categoryName: cat ? cat.name : '—',
        categoryPath: cat ? Store.categoryPath(cat.id) : '—',
        icon: o.icon || (cat ? iconForCategory(cat.name) : 'grid'),
        mass: Store.massOf(o),
        price: Store.priceBuy(o),
        sale: Store.priceSale(o),
        isShip: Store.categoryIsShip(o.categoryId),
        props: props
      };
    });
  }

  var shopItems = buildShopItems();

  var initialCargo = [
    { id: '101', name: 'Лазерный излучатель', category: 'weapon', rarity: 'Улучшенное', stats: 'Урон 34 · 3.1 выстр./с', price: 1220, stock: 2 },
    { id: '102', name: 'Щит «Эгида»', category: 'shield', rarity: 'Редкое', stats: 'Щит 480 · Реген. 15/с', price: 1850, stock: 1 },
    { id: '103', name: 'Плазменные ячейки', category: 'resource', rarity: 'Ресурс', stats: 'Боезапас · 8 ед.', price: 190, stock: 16 }
  ];

  /* ---------- Категории магазина ---------- */

  /* Запасной набор: если в базе админки ещё нет ни одной категории. */
  var FALLBACK_CATEGORIES = [
    { id: 'weapon', label: 'Оружие', icon: 'weapon' },
    { id: 'shield', label: 'Щиты', icon: 'shield' },
    { id: 'resource', label: 'Ресурсы', icon: 'resource' },
    { id: 'ship', label: 'Корабли', icon: 'ship' }
  ];

  /* Иконок в данных админки нет — подбираем по названию категории. */
  function iconForCategory(name) {
    if (window.Icons) return Icons.forCategory(name);
    return 'grid';
  }

  /* Табы: «Все» + категории первого уровня из базы админки (data/store.js). */
  function buildCategories() {
    var roots = [];
    if (window.Store) {
      roots = Store.childCategories('').map(function (cat) {
        return { id: cat.id, label: cat.name, icon: cat.icon || iconForCategory(cat.name) };
      });
    }
    if (!roots.length) roots = FALLBACK_CATEGORIES.slice();
    return [{ id: 'all', label: 'Все', icon: 'grid' }].concat(roots);
  }

  var categories = buildCategories();

  var hangarResources = [
    { id: '201', name: 'Плазменные ячейки', description: 'Стабилизированные энергетические элементы для импульсных систем вооружения.', stats: 'Энергия 80 МДж · Стабильность 96%' },
    { id: '202', name: 'Кристаллы ксенона', description: 'Очищенное топливо для маршевых двигателей и систем сверхсветового перехода.', stats: 'Чистота 99.4% · Класс топлива A' },
    { id: '203', name: 'Сплав «Титан-X»', description: 'Лёгкий композит для ремонта корпуса и усиления внешней брони.', stats: 'Прочность 840 МПа · Масса 12 кг' },
    { id: '204', name: 'Наноремкомплект', description: 'Автономный ремонтный модуль для восстановления обшивки в полевых условиях.', stats: 'Ремонт +320 · Цикл 18 сек.' }
  ];

  var purchasedEquipment = [
    { id: 301, name: 'Импульсный М-4', category: 'weapon', rarity: 'Редкое', stats: 'Урон 48 · 2.4 выстр./с', price: 2450, stock: 2 },
    { id: 302, name: 'Щит «Эгида»', category: 'shield', rarity: 'Редкое', stats: 'Щит 480 · Реген. 15/с', price: 1850, stock: 1 },
    { id: 303, name: 'Фазовый контур', category: 'shield', rarity: 'Обычное', stats: 'Щит 340 · Реген. 12/с', price: 1700, stock: 1 },
    { id: 304, name: 'Лазерный излучатель', category: 'weapon', rarity: 'Улучшенное', stats: 'Урон 34 · 3.1 выстр./с', price: 1220, stock: 2 },
    { id: 305, name: 'Рельсотрон «Копьё»', category: 'weapon', rarity: 'Эпическое', stats: 'Урон 118 · Пробитие +24%', price: 5200, stock: 1 }
  ];

  /* ---------- Состояние (как useState в App.tsx) ---------- */

  var state = {
    tab: 'shop',
    category: 'all',
    subcategory: '',
    selectedShop: '',
    selectedCargo: '',
    amount: 1,
    tradeMode: 'buy',
    notice: 'Торговый терминал подключён',
    infoSection: 'properties',
    userShipId: '',
    ownedShipId: '',
    selectedResource: '201',
    transferMode: 'load',
    transferAmount: 1,
    baseStock: { 201: 42, 202: 64, 203: 28, 204: 9 },
    shipStock: { 201: 16, 202: 8, 203: 4, 204: 2 }
  };

  /* ---------- Хелперы ---------- */

  function fmt(n) { return n.toLocaleString('ru-RU'); }
  function plural(n, forms) {
    var d = n % 10;
    var dd = n % 100;
    if (d === 1 && dd !== 11) return forms[0];
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
    return forms[2];
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* Объект подходит, если выбрана его подкатегория или её родитель (1-й уровень). */
  function inCategory(item, categoryId) {
    if (categoryId === 'all') return true;
    return item.categoryId === categoryId || item.parentCategoryId === categoryId;
  }

  /* Подкатегории выбранной ветки: id, имя и сколько объектов в каждой. */
  function buildSubcategories(rootId) {
    if (!window.Store || !rootId || rootId === 'all') return [];
    return Store.childCategories(rootId).map(function (cat) {
      return {
        id: cat.id,
        label: cat.name,
        icon: cat.icon || iconForCategory(cat.name),
        count: shopItems.filter(function (it) { return it.categoryId === cat.id; }).length
      };
    });
  }

  function filteredItems() {
    return shopItems.filter(function (it) {
      if (!inCategory(it, state.category)) return false;
      if (state.subcategory && it.categoryId !== state.subcategory) return false;
      return true;
    });
  }
  function currentShop() {
    var item = byId(shopItems, state.selectedShop);
    if (item && inCategory(item, state.category)) return item;
    return filteredItems()[0] || null;
  }
  function currentCargo() { return byId(initialCargo, state.selectedCargo) || initialCargo[0]; }
  function activeResource() { return byId(hangarResources, state.selectedResource) || hangarResources[0]; }

  /* ---------- Рендер: шапка и вкладки ---------- */

  function renderTop() {
    var balance = window.Store ? Store.credits() : 0;
    document.getElementById('creditsValue').innerHTML = fmt(balance) + ' <i>¤</i>';
  }

  function renderTabs() {
    var buttons = document.querySelectorAll('.primary-tabs button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === state.tab);
    }
    document.getElementById('view-shop').hidden = state.tab !== 'shop';
    document.getElementById('view-hangar').hidden = state.tab !== 'hangar';
    document.getElementById('view-info').hidden = state.tab !== 'info';
    document.getElementById('view-ship').hidden = state.tab !== 'ship';
  }

  /* ---------- Рендер: магазин ---------- */

  function itemRowHTML(item, selected, action) {
    return '<button class="item-row' + (selected ? ' selected' : '') + '" data-action="' + action + '" data-id="' + item.id + '">' +
      '<span class="item-icon ' + item.category + '">' + icon(item.category === 'resource' ? 'resource' : item.category, 22) + '</span>' +
      '<span class="item-copy"><strong>' + item.name + '</strong><span>' + item.stats + '</span></span>' +
      '<span class="item-meta"><small>' + item.rarity + '</small><b>' + fmt(item.price) + ' ¤</b></span>' +
      '<span class="stock">×' + item.stock + '</span>' +
      '</button>';
  }

  /* Иконка объекта: из общего каталога data/icons.js, с запасным вариантом. */
  function iconMarkup(name, size) {
    if (window.Icons) return Icons.svg(name, size);
    return icon(name, size);
  }

  /* Строка магазина: объект из админки. */
  function shopItemRowHTML(item, selected) {
    return '<button class="item-row' + (selected ? ' selected' : '') + '" data-action="select-shop" data-id="' + item.id + '">' +
      '<span class="item-icon">' + iconMarkup(item.icon, 22) + '</span>' +
      '<span class="item-copy"><strong>' + item.name + '</strong><span>' +
      (item.mass ? 'Масса ' + fmt(item.mass) + ' кг' : 'Масса не задана') + '</span></span>' +
      '<span class="item-meta"><small>' + item.categoryName + '</small>' +
      (item.price ? '<b>' + fmt(item.price) + ' ¤</b>' : '') + '</span>' +
      '</button>';
  }

  function categoryTabsHTML() {
    return categories.map(function (c) {
      return '<button class="' + (state.category === c.id ? 'active' : '') + '" data-action="category" data-cat="' + c.id + '">' +
        iconMarkup(c.icon, 17) + c.label + '</button>';
    }).join('');
  }

  /* Чипы подкатегорий под табами: та же форма, что у категорий.
     Пустой блок не скрывается — он держит высоту, чтобы сетка не прыгала. */
  function renderSubcategories() {
    var title = document.getElementById('subcategoryTitle');
    var tabs = document.getElementById('subcategoryTabs');
    if (!title || !tabs) return;
    var list = buildSubcategories(state.category);
    if (!list.length) {
      title.hidden = true;
      tabs.hidden = true;
      tabs.innerHTML = '';
      return;
    }
    title.hidden = false;
    tabs.hidden = false;
    tabs.innerHTML = list.map(function (s) {
      return '<button class="sub-chip' + (state.subcategory === s.id ? ' active' : '') + '" data-action="subcategory" data-sub="' + s.id + '">' +
        iconMarkup(s.icon, 13) + s.label + '<span class="sub-count">' + s.count + '</span></button>';
    }).join('');
  }

  /* Центр: объект из админки — информация и кнопка «Купить» (оплату подключим позже). */
  function shopObjectConsole(item) {
    if (!item) {
      return '<div class="trade-empty">' + (shopItems.length ? 'В этой категории пока нет объектов' : 'В базе админки пока нет объектов') + '</div>';
    }
    var lines = '<span class="trade-preview-stats">' + item.categoryPath + '</span>';
    if (item.mass) lines += '<span class="trade-preview-stats">Масса: ' + fmt(item.mass) + ' кг</span>';
    item.props.forEach(function (p) {
      lines += '<span class="trade-preview-stats">' + p.name + ': ' + p.value + '</span>';
    });
    var price = item.price
      ? '<span class="trade-preview-price">' + fmt(item.price) + ' ¤<small> / шт.</small></span>' +
        (item.sale ? '<span class="trade-preview-stats">продажа: ' + fmt(item.sale) + ' ¤</span>' : '')
      : '<span class="trade-preview-stats">Цена не задана</span>';
    if (item.isShip) lines += '<span class="trade-preview-stats">корабль · покупка попадёт в ангар</span>';
    return '<div class="trade-preview">' +
      '<span class="trade-preview-icon">' + iconMarkup(item.icon, 27) + '</span>' +
      '<strong>' + item.name + '</strong>' +
      lines + price +
      '</div>' +
      '<button class="trade-button buy" data-action="buy">' + (item.isShip ? 'Купить корабль' : 'Купить') + icon('arrowRight') + '</button>';
  }

  /* Центр: груз на корабле — прежний вид с ценой и продажей. */
  function cargoConsole(item) {
    if (!item) return '<div class="trade-empty">Груз пока пуст</div>';
    var total = Math.round(item.price * state.amount * 0.65);
    return '<div class="trade-preview">' +
      '<span class="trade-preview-icon ' + item.category + '">' + icon(item.category === 'resource' ? 'resource' : item.category, 27) + '</span>' +
      '<strong>' + item.name + '</strong>' +
      '<span class="trade-preview-stats">' + item.stats + '</span>' +
      '<span class="trade-preview-price">' + fmt(item.price) + ' ¤<small> / шт.</small></span>' +
      '</div>' +
      '<div class="amount-control">' +
      '<button aria-label="Уменьшить количество" data-action="amount" data-dir="-1">' + icon('minus') + '</button>' +
      '<div><strong>' + state.amount + '</strong><span>КОЛ-ВО</span></div>' +
      '<button aria-label="Увеличить количество" data-action="amount" data-dir="1">' + icon('plus') + '</button>' +
      '</div>' +
      '<div class="trade-total"><span>К продаже</span><strong>' + fmt(total) + ' ¤</strong></div>' +
      '<button class="trade-button sell" data-action="transact">' + icon('arrowLeft') + 'Продать</button>';
  }

  /* Запись о выбранном в доке корабле: пока она есть, консоль предлагает продать. */
  function ownedShipRecord() {
    if (!state.ownedShipId || !window.Store) return null;
    var list = Store.userShips();
    for (var i = 0; i < list.length; i++) if (list[i].id === state.ownedShipId) return list[i];
    return null;
  }

  /* Консоль купленного корабля: цена продажи и кнопка «Продать». */
  function ownedShipConsole(rec) {
    var ship = window.Store ? Store.byId('objects', rec.shipId) : null;
    var cat = ship ? Store.byId('categories', ship.categoryId) : null;
    var sale = ship ? Store.priceSale(ship) : 0;
    var bought = rec.boughtAt ? new Date(rec.boughtAt).toLocaleDateString('ru-RU') : '';
    var lines = '<span class="trade-preview-stats">' + (cat ? Store.categoryPath(cat.id) : 'корабль') + '</span>';
    if (ship) lines += '<span class="trade-preview-stats">Масса: ' + fmt(Store.massOf(ship)) + ' кг</span>';
    lines += '<span class="trade-preview-stats">в ангаре с ' + bought + '</span>';
    var price = sale
      ? '<span class="trade-preview-price">' + fmt(sale) + ' ¤<small> / шт.</small></span>' +
        '<span class="trade-preview-stats">выкуп по цене продажи</span>'
      : '<span class="trade-preview-stats">Цена продажи не задана</span>';
    return '<div class="trade-preview">' +
      '<span class="trade-preview-icon">' + iconMarkup(ship ? ship.icon : 'ship', 27) + '</span>' +
      '<strong>' + rec.name + '</strong>' +
      lines + price +
      '</div>' +
      '<button class="trade-button sell" data-action="sell-ship">' + icon('arrowLeft') + 'Продать</button>';
  }

  function shopConsoleHTML() {
    if (state.tradeMode !== 'buy') return cargoConsole(currentCargo());
    var owned = ownedShipRecord();
    if (owned) return ownedShipConsole(owned);
    return shopObjectConsole(currentShop());
  }

  /* Колонка 1 магазина: сведения о выбранном корабле (по умолчанию — первый). */
  function shipPanelHTML() {
    if (!window.Store) return '<div class="trade-empty">Данные не загружены</div>';
    var rec = activeUserShip();
    var ship = rec ? Store.byId('objects', rec.shipId) : null;
    if (!ship) return '<div class="trade-empty">Кораблей ещё нет — купите в магазине</div>';

    var cat = Store.byId('categories', ship.categoryId);
    var props = Store.categoryProps(ship.categoryId).map(function (p) {
      var raw = String((ship.values && ship.values[p.id]) || p.value || '').trim();
      return { name: p.name, value: /^\d+([.,]\d+)?$/.test(raw) ? fmt(Number(raw.replace(',', '.'))) : raw };
    }).filter(function (p) { return p.value; });

    var rows = props.map(function (p) {
      return '<div class="ship-row"><span>' + p.name + '</span><b>' + p.value + '</b></div>';
    }).join('');

    var sub = [];
    if (rec.price) sub.push('куплен за ' + fmt(Number(rec.price)) + ' ¤');
    if (rec.boughtAt) sub.push(new Date(rec.boughtAt).toLocaleDateString('ru-RU'));

    return '<span class="ship-sub">' + (cat ? Store.categoryPath(cat.id) : '') + '</span>' +
      '<strong class="ship-title">' + ship.name + '</strong>' +
      '<span class="ship-sub">' + sub.join(' · ') + '</span>' +
      '<div class="ship-rows">' + rows + '</div>' +
      '<span class="ship-sub">Слоты · ' + (ship.slots || []).length + '</span>' + slotGridHTML(ship);
  }

  /* ---------- Слоты квадратами: сетка, подсказка, модальное окно ---------- */

  function slotRecord(ship, index) {
    return ship && ship.slots ? ship.slots[index] : null;
  }

  function slotTitle(ship, index) {
    var rec = slotRecord(ship, index);
    var slot = rec && window.Store ? Store.byId('slots', rec.slotId) : null;
    return slot ? slot.name : 'Слот';
  }

  function slotContentsList(ship, index) {
    var rec = slotRecord(ship, index);
    return rec && rec.contents ? rec.contents : [];
  }

  function slotGridHTML(ship) {
    if (!ship || !ship.slots) return '';
    var shipId = ship.id;
    return '<div class="slot-grid">' + ship.slots.map(function (s, i) {
      var contents = s.contents || [];
      var first = contents.length && window.Store ? Store.byId('objects', contents[0].itemId) : null;
      return '<button class="slot-tile' + (contents.length ? '' : ' empty') + '" data-action="open-slot" ' +
        'data-ship="' + shipId + '" data-index="' + i + '">' +
        (first ? iconMarkup(first.icon, 22) : '') +
        (contents.length > 1 ? '<span class="slot-qty">×' + contents.length + '</span>' : '') +
        '</button>';
    }).join('') + '</div>';
  }
  function slotTipHTML(ship, index) {
    var contents = slotContentsList(ship, index);
    var name = slotTitle(ship, index);
    if (!contents.length) return '<h4>' + name + '</h4><small>Слот пуст</small>';
    var cells = contents.slice(0, 4).map(function (c) {
      var it = window.Store ? Store.byId('objects', c.itemId) : null;
      return '<span class="tip-cell">' + iconMarkup(it ? it.icon : 'grid', 16) + '</span>';
    }).join('');
    return '<h4>' + name + ' · ' + contents.length + ' шт.</h4>' +
      '<div class="tip-grid">' + cells + '</div>' +
      (contents.length > 4 ? '<small>+ ещё ' + (contents.length - 4) + ' — нажмите на слот</small>' : '');
  }

  function slotModalHTML(ship, index) {
    var contents = slotContentsList(ship, index);
    var cells = contents.map(function (c) {
      var it = window.Store ? Store.byId('objects', c.itemId) : null;
      var qty = Number(c.qty) || 0;
      return '<div class="slot-tile" title="' + (it ? it.name : '—') + '">' + iconMarkup(it ? it.icon : 'grid', 22) +
        (qty > 1 ? '<span class="slot-qty">×' + fmt(qty) + '</span>' : '') + '</div>';
    }).join('');
    return '<div class="slot-dialog" role="dialog" aria-modal="true">' +
      '<div class="slot-dialog-head"><div><span class="eyebrow">СОДЕРЖИМОЕ СЛОТА</span>' +
      '<h3>' + slotTitle(ship, index) + '</h3></div>' +
      '<button class="slot-close" data-action="close-slot" aria-label="Закрыть">×</button></div>' +
      '<div class="slot-grid">' + cells + '</div></div>';
  }

  function openSlotModal(shipId, index) {
    var ship = window.Store ? Store.byId('objects', shipId) : null;
    var modal = document.getElementById('slotModal');
    if (!ship || !modal) return;
    if (!slotContentsList(ship, index).length) return;
    modal.innerHTML = slotModalHTML(ship, index);
    modal.hidden = false;
  }

  function closeSlotModal() {
    var modal = document.getElementById('slotModal');
    if (modal) { modal.hidden = true; modal.innerHTML = ''; }
  }

  /* Подсказка над слотом: сетка до четырёх предметов. */
  function showSlotTip(tile) {
    var tip = document.getElementById('slotTip');
    if (!tip || !window.Store) return;
    var ship = Store.byId('objects', tile.getAttribute('data-ship'));
    if (!ship) return;
    tip.innerHTML = slotTipHTML(ship, Number(tile.getAttribute('data-index')));
    var rect = tile.getBoundingClientRect();
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = rect.right + 10;
    if (left + w > window.innerWidth - 8) left = Math.max(8, rect.left - w - 10);
    var top = Math.min(window.innerHeight - h - 8, Math.max(8, rect.top));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function hideSlotTip() {
    var tip = document.getElementById('slotTip');
    if (tip) tip.hidden = true;
  }

  function renderShop() {
    var filtered = filteredItems();
    var selected = currentShop();
    /* У выбранного корабля правый список «На корабле» скрывается. */
    var hideCargo = !!(selected && selected.isShip);
    var cargoPanel = document.getElementById('cargoPanel');
    var marketGrid = document.querySelector('.market-grid');
    if (cargoPanel) cargoPanel.hidden = hideCargo;
    if (marketGrid) marketGrid.classList.toggle('no-cargo', hideCargo);
    document.getElementById('shopCount').textContent = filtered.length + ' ' + plural(filtered.length, ['позиция', 'позиции', 'позиций']);
    document.getElementById('categoryTabs').innerHTML = categoryTabsHTML();
    renderSubcategories();
    document.getElementById('shopList').innerHTML = filtered.length
      ? filtered.map(function (it) {
        return shopItemRowHTML(it, state.selectedShop === it.id);
      }).join('')
      : '<div class="list-empty">' + (shopItems.length ? 'В этой категории пока нет объектов' : 'В базе админки пока нет объектов') + '</div>';
    document.getElementById('shopConsole').innerHTML = shopConsoleHTML();
    var shipInfo = document.getElementById('shipInfo');
    if (shipInfo) shipInfo.innerHTML = shipPanelHTML();
    var shipMeta = document.getElementById('shipPanelMeta');
    if (shipMeta) {
      var shipsTotal = userShipRecords().length;
      shipMeta.textContent = shipsTotal ? shipsTotal + ' в ангаре' : 'нет кораблей';
    }
    document.getElementById('cargoList').innerHTML = initialCargo.map(function (it) {
      return itemRowHTML(it, state.selectedCargo === it.id, 'select-cargo');
    }).join('');
    document.getElementById('noticeShop').textContent = state.notice;
  }

  /* ---------- Рендер: ангар ---------- */

  function resourceRowHTML(resource, quantity, selected, mode) {
    return '<button class="resource-row' + (selected ? ' selected' : '') + '" data-action="select-resource" data-id="' + resource.id + '" data-mode="' + mode + '">' +
      '<span class="item-icon resource">' + icon('resource', 22) + '</span>' +
      '<span class="item-copy"><strong>' + resource.name + '</strong><span>' + resource.stats + '</span></span>' +
      '<span class="resource-quantity"><b>' + quantity + '</b><small>ед.</small></span>' +
      icon('chevron', 15) +
      '</button>';
  }

  function hangarConsoleHTML() {
    var resource = activeResource();
    var load = state.transferMode === 'load';
    return '<div class="trade-preview">' +
      '<span class="trade-preview-icon resource">' + icon('resource', 29) + '</span>' +
      '<strong>' + resource.name + '</strong>' +
      '<p>' + resource.description + '</p>' +
      '<span class="trade-preview-stats">' + resource.stats + '</span>' +
      '</div>' +
      '<div class="transfer-route">' +
      '<span>' + (load ? 'БАЗА' : 'КОРАБЛЬ') + '</span>' +
      icon(load ? 'arrowRight' : 'arrowLeft', 18) +
      '<span>' + (load ? 'КОРАБЛЬ' : 'БАЗА') + '</span>' +
      '</div>' +
      '<div class="amount-control">' +
      '<button aria-label="Уменьшить количество" data-action="transfer-amount" data-dir="-1">' + icon('minus') + '</button>' +
      '<div><strong>' + state.transferAmount + '</strong><span>КОЛ-ВО</span></div>' +
      '<button aria-label="Увеличить количество" data-action="transfer-amount" data-dir="1">' + icon('plus') + '</button>' +
      '</div>' +
      '<button class="trade-button ' + (load ? 'buy' : 'sell') + '" data-action="transfer">' +
      (load ? '' : icon('arrowLeft')) +
      (load ? 'Загрузить' : 'Выгрузить') +
      (load ? icon('arrowRight') : '') +
      '</button>';
  }

  function renderHangar() {
    document.getElementById('baseList').innerHTML = hangarResources.map(function (r) {
      var selected = state.transferMode === 'load' && state.selectedResource === r.id;
      return resourceRowHTML(r, state.baseStock[r.id] || 0, selected, 'load');
    }).join('');
    document.getElementById('shipResList').innerHTML = hangarResources.map(function (r) {
      var selected = state.transferMode === 'unload' && state.selectedResource === r.id;
      return resourceRowHTML(r, state.shipStock[r.id] || 0, selected, 'unload');
    }).join('');
    document.getElementById('hangarConsole').innerHTML = hangarConsoleHTML();
    document.getElementById('noticeHangar').textContent = state.notice;
  }

  /* ---------- Рендер: информация о базе ---------- */

  /* Купленные корабли: записи пользователя и выбранный корабль. */
  function userShipRecords() { return window.Store ? Store.userShips() : []; }

  function activeUserShip() {
    var list = userShipRecords();
    for (var i = 0; i < list.length; i++) if (list[i].shipId === state.userShipId) return list[i];
    return list[0] || null;
  }

  /* Полоска купленных кораблей над свойствами — клик выбирает корабль. */
  function userShipStrip(active) {
    var list = userShipRecords();
    if (!list.length) return '';
    return '<div class="user-ships">' + list.map(function (rec) {
      var on = active && active.shipId === rec.shipId;
      return '<button class="user-ship' + (on ? ' active' : '') + '" data-action="select-user-ship" data-id="' + rec.shipId + '">' +
        '<small>КУПЛЕН</small><strong>' + rec.name + '</strong></button>';
    }).join('') + '</div>';
  }

  function shipViewHTML() {
    var rec = activeUserShip();
    var ship = rec && window.Store ? Store.byId('objects', rec.shipId) : null;
    var strip = userShipStrip(rec);

    if (!ship) {
      return strip + '<div class="collection-panel"><div class="collection-head"><div>' +
        '<span class="eyebrow">АНГАР</span><h2>Купленных кораблей нет</h2></div></div>' +
        '<div class="collection-row"><div class="collection-copy"><strong>Купите корабль в магазине</strong>' +
        '<span>Он появится здесь со своими свойствами и слотами.</span></div></div></div>';
    }

    var cat = Store.byId('categories', ship.categoryId);
    var props = Store.categoryProps(ship.categoryId).map(function (p) {
      return { name: p.name, value: (ship.values && ship.values[p.id]) || p.value || '' };
    }).filter(function (p) { return p.value; });
    var statRows = props.map(function (p) {
      var raw = String(p.value).trim();
      var v = /^\d+([.,]\d+)?$/.test(raw) ? fmt(Number(raw.replace(',', '.'))) : raw;
      return '<div><span>' + p.name + '</span><b>' + v + '</b></div>';
    }).join('');

    var bought = rec.boughtAt ? new Date(rec.boughtAt).toLocaleDateString('ru-RU') : '';
    var subtitle = (cat ? Store.categoryPath(cat.id) : '');
    if (rec.price) subtitle += ' · куплен за ' + fmt(Number(rec.price)) + ' ¤';
    if (bought) subtitle += ' · ' + bought;

    return strip + '<div class="info-grid">' +
      '<div class="hero-ship"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>' +
      shipGlyph(false) +
      '<span class="axis-label left">КОРМA</span><span class="axis-label right">НОС</span></div>' +
      '<div class="ship-data">' +
      '<span class="eyebrow">ИНФОРМАЦИЯ О КОРАБЛЕ</span>' +
      '<h2>' + ship.name + '</h2>' +
      '<p>' + subtitle + '</p>' +
      '<div class="stat-grid">' + (statRows || '<div><span>Свойства</span><b>—</b></div>') + '</div>' +
      '</div></div>' +
      equipmentHTML(ship.name) +
      slotsPanelHTML(ship);
  }

  /* Панель слотов: квадраты, клик — модальное окно с содержимым. */
  function slotsPanelHTML(ship) {
    return '<div class="collection-panel"><div class="collection-head"><div>' +
      '<span class="eyebrow">СЛОТЫ</span><h2>Слоты и содержимое</h2></div>' +
      '<span>' + (ship.slots || []).length + ' слотов</span></div>' +
      '<div class="slots-body">' + slotGridHTML(ship) + '</div></div>';
  }

  /* Вкладка «Информация о базе»: только сама база и ресурсы. */
  function baseInfoHTML() {
    return '<div class="info-grid">' +
      '<div class="hero-ship"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>' +
      shipGlyph(false) +
      '<span class="axis-label left">КОРМA</span><span class="axis-label right">НОС</span></div>' +
      '<div class="ship-data">' +
      '<span class="eyebrow">ОРБИТАЛЬНАЯ БАЗА</span>' +
      '<h2>HELIOS <small>VII</small></h2>' +
      '<p>Станция снабжения и торговый узел. Ангар, терминал и грузовой док в работе.</p>' +
      '<div class="stat-grid">' +
      '<div><span>Уровень базы</span><b>07</b></div>' +
      '<div><span>Репутация</span><b>Доверие</b></div>' +
      '<div><span>Техобслуживание</span><b>Доступно</b></div>' +
      '<div><span>До вылета</span><b>00:12:44</b></div>' +
      '</div></div></div>' +
      resourcesInfoHTML();
  }

  function equipmentHTML(shipName) {
    var rows = purchasedEquipment.map(function (item, index) {
      return '<div class="collection-row">' +
        '<span class="item-icon ' + item.category + '">' + icon(item.category, 22) + '</span>' +
        '<div class="collection-copy"><small>МОДУЛЬ // ' + pad2(index + 1) + '</small>' +
        '<strong>' + item.name + '</strong><span>' + item.stats + '</span></div>' +
        '<span class="equipment-rarity">' + item.rarity + '</span>' +
        '<div class="collection-count"><b>×' + item.stock + '</b><span>Куплено</span></div>' +
        '</div>';
    }).join('');
    var modules = purchasedEquipment.reduce(function (n, it) { return n + it.stock; }, 0);
    return '<div class="collection-panel">' +
      '<div class="collection-head"><div>' +
      '<span class="eyebrow">ИНВЕНТАРЬ' + (shipName ? ' · ' + shipName : '') + '</span><h2>Купленное оборудование</h2></div>' +
      '<span>' + purchasedEquipment.length + ' типов · ' + modules + ' модулей</span></div>' +
      '<div class="collection-list">' + rows + '</div></div>';
  }

  function resourcesInfoHTML() {
    var rows = hangarResources.map(function (resource, index) {
      return '<div class="collection-row">' +
        '<span class="item-icon resource">' + icon('resource', 22) + '</span>' +
        '<div class="collection-copy"><small>РЕСУРС // ' + pad2(index + 1) + '</small>' +
        '<strong>' + resource.name + '</strong><span>' + resource.stats + '</span></div>' +
        '<span class="resource-description">' + resource.description + '</span>' +
        '<div class="collection-count"><b>' + (state.shipStock[resource.id] || 0) + '</b><span>Единиц</span></div>' +
        '</div>';
    }).join('');
    return '<div class="collection-panel">' +
      '<div class="collection-head"><div>' +
      '<span class="eyebrow">ГРУЗОВОЙ ОТСЕК ASTERION</span><h2>Ресурсы корабля</h2></div>' +
      '<span>19 / 24 грузовых слота</span></div>' +
      '<div class="resource-summary">' +
      '<div><span>Заполнение трюма</span><b>79%</b><i><em style="width:79%"></em></i></div>' +
      '<div><span>Общая масса</span><b>4 820 кг</b></div>' +
      '<div><span>Автономность</span><b>18 циклов</b></div>' +
      '</div>' +
      '<div class="collection-list">' + rows + '</div></div>';
  }

  function renderInfo() {
    document.getElementById('infoContent').innerHTML = baseInfoHTML();
  }

  /* ---------- Рендер: информация о корабле ---------- */

  function renderShipView() {
    var rec = activeUserShip();
    var ship = rec && window.Store ? Store.byId('objects', rec.shipId) : null;
    var title = document.getElementById('shipViewTitle');
    if (title) title.textContent = ship ? 'Корабль «' + ship.name + '»' : 'Корабль';
    document.getElementById('shipViewContent').innerHTML = shipViewHTML();
  }

  /* ---------- Рендер: док кораблей ---------- */

  function renderDock() {
    var list = userShipRecords();
    var active = activeUserShip();
    var cards = list.map(function (rec) {
      var ship = window.Store ? Store.byId('objects', rec.shipId) : null;
      var cat = ship ? Store.byId('categories', ship.categoryId) : null;
      var on = !!(active && active.shipId === rec.shipId);
      var sub = cat ? cat.name : '';
      if (rec.price) sub += (sub ? ' · ' : '') + fmt(Number(rec.price)) + ' ¤';
      return '<button class="ship-card' + (on ? ' active' : '') + '" data-action="select-user-ship" data-id="' + rec.shipId + '" data-rec="' + rec.id + '">' +
        '<div class="ship-visual">' + shipGlyph(true) +
        (on ? '<span class="active-tag">Выбран</span>' : '') + '</div>' +
        '<div class="ship-meta"><strong>' + rec.name + '</strong><span>' + sub + '</span></div>' +
        '</button>';
    }).join('');
    document.getElementById('shipDock').innerHTML = '<section class="ship-dock"><div class="ship-list">' +
      (cards || '<div class="list-empty">Купленных кораблей нет</div>') +
      '</div></section>';
  }

  /* ---------- Полный рендер ---------- */

  function render() {
    renderTop();
    renderTabs();
    if (state.tab === 'shop') renderShop();
    else if (state.tab === 'hangar') renderHangar();
    else if (state.tab === 'ship') renderShipView();
    else renderInfo();
  }

  /* ---------- Действия (аналоги обработчиков из App.tsx) ---------- */

  function changeCategory(next) {
    state.category = next;
    /* Смена ветки сбрасывает выбранную подкатегорию. */
    state.subcategory = '';
    var list = filteredItems();
    if (list.length) state.selectedShop = list[0].id;
    state.tradeMode = 'buy';
    state.amount = 1;
  }

  /* Клик по чипу: повторный клик снимает фильтр подкатегории. */
  function changeSubcategory(next) {
    state.subcategory = state.subcategory === next ? '' : next;
    var list = filteredItems();
    if (list.length) state.selectedShop = list[0].id;
    state.tradeMode = 'buy';
    state.amount = 1;
  }

  /* Продажа груза: цены живут в статичном списке «На корабле». */
  function transact() {
    var item = currentCargo();
    if (!item) return;
    Store.addCredits(Math.round(item.price * state.amount * 0.65));
    state.notice = item.name + ': продано ×' + state.amount;
  }

  function transferResource() {
    var from = state.transferMode === 'load' ? state.baseStock : state.shipStock;
    var to = state.transferMode === 'load' ? state.shipStock : state.baseStock;
    var available = from[state.selectedResource] || 0;
    var moved = Math.min(state.transferAmount, available);
    if (moved === 0) {
      state.notice = 'Недостаточно ресурса для перемещения';
      return;
    }
    from[state.selectedResource] = available - moved;
    to[state.selectedResource] = (to[state.selectedResource] || 0) + moved;
    state.notice = activeResource().name + ': ' + (state.transferMode === 'load' ? 'загружено' : 'выгружено') + ' ×' + moved;
  }

  /* ---------- Обработчик кликов (делегирование) ---------- */

  document.addEventListener('click', function (e) {
    var modal = document.getElementById('slotModal');
    if (modal && !modal.hidden && e.target === modal) { closeSlotModal(); return; }
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id') || '';
    var dir = parseInt(el.getAttribute('data-dir'), 10);

    if (action === 'tab') state.tab = el.getAttribute('data-tab');
    else if (action === 'category') changeCategory(el.getAttribute('data-cat'));
    else if (action === 'subcategory') changeSubcategory(el.getAttribute('data-sub'));
    else if (action === 'select-shop') { state.selectedShop = id; state.tradeMode = 'buy'; state.amount = 1; state.ownedShipId = ''; }
    else if (action === 'select-cargo') { state.selectedCargo = id; state.tradeMode = 'sell'; state.amount = 1; }
    else if (action === 'amount') state.amount = Math.min(99, Math.max(1, state.amount + dir));
    else if (action === 'add-credits') {
      var total = Store.addCredits(1000);
      state.notice = 'Баланс пополнен на 1 000 ¤ — теперь ' + fmt(total) + ' ¤';
    }
    else if (action === 'buy') {
      var buyItem = currentShop();
      if (buyItem && buyItem.isShip) {
        var res = Store.buyShip(buyItem.id);
        state.notice = res.ok
          ? 'Корабль «' + buyItem.name + '» куплен за ' + fmt(res.price) + ' ¤'
          : (res.error === 'Недостаточно кредитов'
            ? 'Не хватает кредитов: нужно ' + fmt(res.price) + ' ¤'
            : 'Не удалось купить: ' + res.error);
      } else {
        state.notice = buyItem ? 'Покупка «' + buyItem.name + '» появится позже' : 'Покупка пока не настроена';
      }
    }
    else if (action === 'transact') transact();
    else if (action === 'select-resource') {
      state.selectedResource = id;
      state.transferMode = el.getAttribute('data-mode');
      state.transferAmount = 1;
    }
    else if (action === 'transfer-amount') state.transferAmount = Math.min(99, Math.max(1, state.transferAmount + dir));
    else if (action === 'transfer') transferResource();
    else if (action === 'info-section') state.infoSection = el.getAttribute('data-sec');
    else if (action === 'select-user-ship') {
      state.userShipId = el.getAttribute('data-id');
      state.ownedShipId = el.getAttribute('data-rec') || '';
      state.tradeMode = 'buy';
    }
    else if (action === 'sell-ship') {
      var rec = ownedShipRecord();
      var res = rec ? Store.sellShip(rec.id) : { ok: false, error: 'Корабль не выбран' };
      state.notice = res.ok
        ? 'Корабль «' + res.name + '» продан за ' + fmt(res.price) + ' ¤'
        : 'Не удалось продать: ' + (res.error || 'ошибка');
      if (res.ok) {
        state.ownedShipId = '';
        state.userShipId = '';
      }
    }
    else if (action === 'open-slot') {
      var tile = el;
      openSlotModal(tile.getAttribute('data-ship'), Number(tile.getAttribute('data-index')));
      return;
    }
    else if (action === 'close-slot') {
      closeSlotModal();
      return;
    }
    else return;

    render();
    renderDock();
  });

  /* ---------- Подсказки и закрытие модального окна ---------- */

  document.addEventListener('mouseover', function (e) {
    var tile = e.target.closest ? e.target.closest('.slot-tile') : null;
    if (tile && tile.getAttribute('data-action') === 'open-slot') showSlotTip(tile);
    else hideSlotTip();
  });

  document.addEventListener('mouseout', function (e) {
    var tile = e.target.closest ? e.target.closest('.slot-tile') : null;
    if (tile) hideSlotTip();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSlotModal();
  });

  /* ---------- Старт ---------- */

  renderDock();
  render();})();
