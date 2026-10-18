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

  var ships = [
    { name: 'Asterion', className: 'Фрегат', level: 'MK.IV', active: true },
    { name: 'Kestrel', className: 'Перехватчик', level: 'MK.II', active: false },
    { name: 'Nomad', className: 'Грузовой', level: 'MK.I', active: false }
  ];

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

  function shopConsoleHTML() {
    return state.tradeMode === 'buy' ? shopObjectConsole(currentShop()) : cargoConsole(currentCargo());
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

  function propertiesHTML() {
    return '<div class="info-grid">' +
      '<div class="hero-ship">' +
      '<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>' +
      shipGlyph(false) +
      '<span class="axis-label left">КОРМA</span><span class="axis-label right">НОС</span>' +
      '</div>' +
      '<div class="ship-data">' +
      '<span class="eyebrow">ВЫБРАННЫЙ КОРАБЛЬ</span>' +
      '<h2>ASTERION <small>MK.IV</small></h2>' +
      '<p>Многоцелевой фрегат дальнего радиуса действия. Готов к вылету.</p>' +
      '<div class="stat-grid">' +
      '<div><span>Целостность</span><b>2 480</b><i><em style="width:88%"></em></i></div>' +
      '<div><span>Щиты</span><b>1 260</b><i><em style="width:72%"></em></i></div>' +
      '<div><span>Огневая мощь</span><b>786</b><i><em style="width:64%"></em></i></div>' +
      '<div><span>Манёвренность</span><b>82</b><i><em style="width:82%"></em></i></div>' +
      '</div></div>' +
      '<div class="base-data">' +
      '<div><span>Уровень базы</span><strong>07</strong></div>' +
      '<div><span>Репутация</span><strong>Доверие</strong></div>' +
      '<div><span>Техобслуживание</span><strong class="accent">Доступно</strong></div>' +
      '<div><span>До вылета</span><strong>00:12:44</strong></div>' +
      '</div></div>';
  }

  function equipmentHTML() {
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
      '<span class="eyebrow">ИНВЕНТАРЬ ASTERION</span><h2>Купленное оборудование</h2></div>' +
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
    var tabs = document.querySelectorAll('#infoTabs button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-sec') === state.infoSection);
    }
    var html = state.infoSection === 'properties' ? propertiesHTML()
      : state.infoSection === 'equipment' ? equipmentHTML()
        : resourcesInfoHTML();
    document.getElementById('infoContent').innerHTML = html;
  }

  /* ---------- Рендер: док кораблей ---------- */

  function renderDock() {
    document.getElementById('shipDock').innerHTML = '<section class="ship-dock"><div class="ship-list">' +
      ships.map(function (ship) {
        return '<button class="ship-card' + (ship.active ? ' active' : '') + '">' +
          '<div class="ship-visual">' + shipGlyph(true) +
          (ship.active ? '<span class="active-tag">Выбран</span>' : '') + '</div>' +
          '<div class="ship-meta"><strong>' + ship.name + '</strong><span>' + ship.className + ' · ' + ship.level + '</span></div>' +
          '</button>';
      }).join('') +
      '</div></section>';
  }

  /* ---------- Полный рендер ---------- */

  function render() {
    renderTop();
    renderTabs();
    if (state.tab === 'shop') renderShop();
    else if (state.tab === 'hangar') renderHangar();
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
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id') || '';
    var dir = parseInt(el.getAttribute('data-dir'), 10);

    if (action === 'tab') state.tab = el.getAttribute('data-tab');
    else if (action === 'category') changeCategory(el.getAttribute('data-cat'));
    else if (action === 'subcategory') changeSubcategory(el.getAttribute('data-sub'));
    else if (action === 'select-shop') { state.selectedShop = id; state.tradeMode = 'buy'; state.amount = 1; }
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
    else return;

    render();
  });

  /* ---------- Старт ---------- */

  renderDock();
  render();
})();
