/* СГЕНЕРИРОВАНО build.py — не редактировать вручную: править js/*.js и пересобрать.
   Без ES-модулей, чтобы страница открывалась без сервера. */
(function () {
  'use strict';

// ===== base.js =====
// =============================================================================
// base.js — общие утилиты ангара: SVG-иконки (локальный набор и каталог
// data/icons.js), форматирование чисел и склонений, поиск по id и общее
// модальное окно. Ничего не знает о магазине и кораблях.
// =============================================================================

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

/* Иконок в данных админки нет — подбираем по названию категории. */
function iconForCategory(name) {
  if (window.Icons) return Icons.forCategory(name);
  return 'grid';
}

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

/* «Масса» — свойство корпуса; в панели показываем массу корабля целиком. */
function isMassName(name) {
  var n = String(name).trim().toLowerCase();
  return n === 'масса' || n === 'вес' || n.indexOf('масса ') === 0 || n.indexOf('вес ') === 0;
}

function byId(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/* Иконка объекта: из общего каталога data/icons.js, с запасным вариантом. */
function iconMarkup(name, size) {
  if (window.Icons) return Icons.svg(name, size);
  return icon(name, size);
}

/* Общее окно: содержимое слота и отказ в покупке. */
function openDialog(eyebrow, title, bodyHTML) {
  var modal = document.getElementById('slotModal');
  if (!modal) return;
  modal.innerHTML = '<div class="slot-dialog" role="dialog" aria-modal="true">' +
    '<div class="slot-dialog-head"><div><span class="eyebrow">' + eyebrow + '</span>' +
    '<h3>' + title + '</h3></div>' +
    '<button class="slot-close" data-action="close-slot" aria-label="Закрыть">×</button></div>' +
    '<div class="dialog-body">' + bodyHTML + '</div></div>';
  modal.hidden = false;
}

// ===== state.js =====
// =============================================================================
// state.js — единственное изменяемое состояние интерфейса: активная вкладка,
// выбранные категория/подкатегория, выбранные корабль и предмет, режим
// перегрузки ресурсов и временный демо-запас вкладки «Ангар».
// Данные мира живут в data/store.js, здесь только то, что видит пользователь.
// =============================================================================

/* ---------- Состояние (как useState в App.tsx) ---------- */

var state = {
  tab: 'shop',
  category: 'all',
  subcategory: '',
  selectedShop: '',
  selectedCargo: '',
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

// ===== catalog.js =====
// =============================================================================
// catalog.js — данные витрины из data/store.js: строки объектов для магазина,
// табы категорий первого уровня и демо-список ресурсов вкладки «Ангар».
// Модуль только читает базу; состояние и рендер — в других файлах.
// =============================================================================



/* ---------- Данные магазина (объекты из базы админки) ---------- */

/* Объекты админки -> строки витрины: имя, категория, масса и свойства. */
function buildShopItems() {
  if (!window.Store) return [];
  return Store.objects().map(function (o) {
    var cat = Store.byId('categories', o.categoryId);
    var slot = o.slotId ? Store.byId('slots', o.slotId) : null;
    var props = Store.categoryProps(o.categoryId).map(function (p) {
      return { name: p.name, value: (o.values && o.values[p.id]) || p.value || '' };
    }).filter(function (p) { return p.value && !isMassName(p.name); });
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
      isResource: Store.isResourceObject(o),
      slotId: o.slotId || '',
      slotName: slot ? slot.name : '',
      props: props
    };
  });
}

var shopItems = buildShopItems();

/* ---------- Категории магазина ---------- */

/* Запасной набор: если в базе админки ещё нет ни одной категории. */
var FALLBACK_CATEGORIES = [
  { id: 'weapon', label: 'Оружие', icon: 'weapon' },
  { id: 'shield', label: 'Щиты', icon: 'shield' },
  { id: 'resource', label: 'Ресурсы', icon: 'resource' },
  { id: 'ship', label: 'Корабли', icon: 'ship' }
];


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

// ===== categories.js =====
// =============================================================================
// categories.js — дерево категорий и фильтры витрины: подкатегории выбранной
// ветки, отбор объектов, группировка списка и выбор текущей позиции.
// Читает shopItems/categories из catalog.js и state.js, базу — через Store.
// =============================================================================





/* Категория подходит объекту, если он в ней самой или в любой её подкатегории
   на любую глубину: дерево категорий не ограничено двумя уровнями
   («Ресурсы» → «Топливо» → «Топливные баки»). */
var subtreeCache = {};
function subtreeIds(categoryId) {
  if (!subtreeCache[categoryId]) {
    var set = {};
    if (window.Store) Store.categoryDescendants(categoryId).forEach(function (c) { set[c.id] = true; });
    subtreeCache[categoryId] = set;
  }
  return subtreeCache[categoryId];
}
function inSubtree(itemCategoryId, categoryId) {
  if (categoryId === 'all') return true;
  if (!itemCategoryId) return false;
  return itemCategoryId === categoryId || !!subtreeIds(categoryId)[itemCategoryId];
}
function inCategory(item, categoryId) { return inSubtree(item.categoryId, categoryId); }

/* Подкатегории выбранной ветки: id, имя и сколько объектов в каждой (с вложенными). */
function buildSubcategories(rootId) {
  if (!window.Store || !rootId || rootId === 'all') return [];
  return Store.childCategories(rootId).map(function (cat) {
    return {
      id: cat.id,
      label: cat.name,
      icon: cat.icon || iconForCategory(cat.name),
      count: shopItems.filter(function (it) { return inSubtree(it.categoryId, cat.id); }).length
    };
  });
}

function filteredItems() {
  return shopItems.filter(function (it) {
    if (!inCategory(it, state.category)) return false;
    if (state.subcategory && !inSubtree(it.categoryId, state.subcategory)) return false;
    return true;
  });
}

/* Ветка, по которой сейчас собран список: выбранный чип или таб. */
function activeBranch() {
  return state.category === 'all' ? 'all' : (state.subcategory || state.category);
}
/* Категория-группа объекта: ближайшая подкатегория выбранной ветки. */
function groupCategoryId(itemCategoryId, branch) {
  var chain = window.Store ? Store.categoryChain(itemCategoryId) : [];
  if (!chain.length) return '';
  if (branch === 'all') return chain[0].id;
  for (var i = 0; i < chain.length; i++) {
    if (chain[i].id === branch) return chain[i + 1] ? chain[i + 1].id : chain[i].id;
  }
  return chain[0].id;
}
/* Порядок категорий в дереве — группы идут как в админке. */
var categoryOrder = null;
function categoryOrderIndex() {
  if (categoryOrder) return categoryOrder;
  categoryOrder = {};
  var i = 0;
  if (window.Store) (function walk(parentId) {
    Store.childCategories(parentId).forEach(function (cat) {
      categoryOrder[cat.id] = i++;
      walk(cat.id);
    });
  })('');
  return categoryOrder;
}
/* Список магазина блоками: позиции собираются под заголовком своей подкатегории. */
function groupedShopItems(list) {
  var branch = activeBranch();
  var groups = [], index = {};
  list.forEach(function (it) {
    var id = groupCategoryId(it.categoryId, branch);
    if (!index[id]) {
      index[id] = { cat: window.Store && id ? Store.byId('categories', id) : null, items: [] };
      groups.push(index[id]);
    }
    index[id].items.push(it);
  });
  var order = categoryOrderIndex();
  groups.sort(function (a, b) {
    var oa = a.cat ? (order[a.cat.id] || 0) : 0;
    var ob = b.cat ? (order[b.cat.id] || 0) : 0;
    return oa - ob;
  });
  return groups;
}

function currentShop() {
  var item = byId(shopItems, state.selectedShop);
  var inBranch = item && inCategory(item, state.category) &&
    (!state.subcategory || inSubtree(item.categoryId, state.subcategory));
  if (inBranch) return item;
  return filteredItems()[0] || null;
}
function activeResource() { return byId(hangarResources, state.selectedResource) || hangarResources[0]; }

// ===== ship.js =====
// =============================================================================
// ship.js — всё про купленный корабль: запись из Store.userShips(), её
// крепления и трюмы, оборудование (квадраты слотов и трюмов), панель «01
// Корабль» в магазине, колонка «На корабле», модальные окна и подсказки.
// Только читает Store; покупки и продажи — в app.js.
// =============================================================================






/* Купленные корабли: записи пользователя и выбранный корабль. */
function userShipRecords() { return window.Store ? Store.userShips() : []; }

/* Выбранный корабль — по id записи: два одинаковых корабля не путаются. */
function activeUserShip() {
  var list = userShipRecords();
  for (var i = 0; i < list.length; i++) if (list[i].id === state.userShipId) return list[i];
  return list[0] || null;
}

/* Раскладка выбранного корабля: крепления и трюмы живут в записи. */
function activeShipView() {
  var rec = activeUserShip();
  var ship = rec && window.Store ? Store.byId('objects', rec.shipId) : null;
  return {
    rec: rec,
    ship: ship,
    slots: (rec && rec.slots) || [],
    holds: (rec && rec.holds) || []
  };
}


/* Оборудование выбранного корабля: каждая установленная единица отдельно,
   с ключом (место + позиция) и местом — крепление или трюм. */
function shipEquipmentRows(view) {
  var rows = [];
  function add(contents, place, kind, placeIndex) {
    (contents || []).forEach(function (c, i) {
      var item = window.Store ? Store.byId('objects', c.itemId) : null;
      if (!item) return;
      rows.push({
        key: kind + ':' + placeIndex + ':' + i,
        item: item, place: place,
        kind: kind, placeIndex: placeIndex, entryIndex: i, entry: c
      });
    });
  }
  (view.slots || []).forEach(function (s, i) {
    var slot = window.Store ? Store.byId('slots', s.slotId) : null;
    add(s.contents, slot ? slot.name : 'крепление', 'slot', i);
  });
  (view.holds || []).forEach(function (h, i) {
    add(h.contents, h.name, 'hold', i);
  });
  return rows;
}

/* Груз контейнеров — отдельными строками «На корабле»: ресурс, кг и место.
   Ключ строки — cargo:<kind>:<место>:<предмет>:<строка груза>. */
function shipCargoRows(view) {
  var rows = [];
  function add(contents, kind, placeIndex, placeName) {
    (contents || []).forEach(function (c, ci) {
      var box = window.Store ? Store.byId('objects', c.itemId) : null;
      (c.cargo || []).forEach(function (g, gi) {
        var res = window.Store ? Store.byId('objects', g.itemId) : null;
        var kg = parseInt(g.qty, 10) || 0;
        if (!box || !res || !kg) return;
        rows.push({
          key: 'cargo:' + kind + ':' + placeIndex + ':' + ci + ':' + gi,
          item: res, place: placeName, boxName: box.name,
          kind: kind, placeIndex: placeIndex, entryIndex: ci,
          cargoIndex: gi, amount: kg, isCargo: true
        });
      });
    });
  }
  (view.slots || []).forEach(function (s, i) {
    var slot = window.Store ? Store.byId('slots', s.slotId) : null;
    add(s.contents, 'slot', i, slot ? slot.name : 'крепление');
  });
  (view.holds || []).forEach(function (h, i) {
    add(h.contents, 'hold', i, h.name);
  });
  return rows;
}

/* Оборудование корабля в текущей ветке магазина — тот же фильтр, что у витрины. */
function shipEquipmentInBranch(view) {
  return shipEquipmentRows(view).concat(shipCargoRows(view)).filter(function (r) {
    if (!inCategory(r.item, state.category)) return false;
    if (state.subcategory && !inSubtree(r.item.categoryId, state.subcategory)) return false;
    return true;
  });
}

/* Выбранная строка «На корабле»: ключ живёт до смены корабля или ветки. */
function selectedOwnedRow() {
  if (!state.selectedCargo) return null;
  var rows = shipEquipmentInBranch(activeShipView());
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === state.selectedCargo) return rows[i];
  }
  return null;
}

/* Строка «На корабле» — как строка витрины: иконка, имя, масса/груз, место и цена. */
function cargoRowHTML(row, selected) {
  var item = row.item;
  var cat = window.Store ? Store.byId('categories', item.categoryId) : null;
  var mass = window.Store ? Store.massOf(item) : 0;
  var sale = window.Store ? Store.priceSale(item) : 0;
  var sub = row.isCargo
    ? 'В контейнере «' + row.boxName + '» · ' + fmt(row.amount) + ' кг'
    : (mass ? 'Масса ' + fmt(mass) + ' кг · ' : '') + row.place;
  return '<button class="item-row' + (selected ? ' selected' : '') +
    '" data-action="select-cargo" data-id="' + row.key + '">' +
    '<span class="item-icon">' + iconMarkup(item.icon, 22) + '</span>' +
    '<span class="item-copy"><strong>' + item.name + '</strong><span>' + sub + '</span></span>' +
    '<span class="item-meta"><small>' + (cat ? cat.name : '') + '</small>' +
    (sale ? '<b>' + fmt(sale) + ' ¤</b>' : '') + '</span>' +
    '</button>';
}

/* Колонка 03 «На корабле»: оборудование блоками, как список «В продаже». */
function cargoListHTML() {
  var view = activeShipView();
  if (!view.ship) return '<div class="list-empty">Сначала купите корабль</div>';
  var all = shipEquipmentRows(view);
  if (!all.length) return '<div class="list-empty">На корабле пока ничего нет</div>';
  var rows = shipEquipmentInBranch(view);
  if (!rows.length) return '<div class="list-empty">В этой категории на корабле ничего нет</div>';

  var branch = activeBranch();
  var groups = [], index = {};
  rows.forEach(function (r) {
    var id = groupCategoryId(r.item.categoryId, branch);
    if (!index[id]) {
      index[id] = { cat: window.Store && id ? Store.byId('categories', id) : null, rows: [] };
      groups.push(index[id]);
    }
    index[id].rows.push(r);
  });
  var order = categoryOrderIndex();
  groups.sort(function (a, b) {
    return (a.cat ? (order[a.cat.id] || 0) : 0) - (b.cat ? (order[b.cat.id] || 0) : 0);
  });

  /* Заголовок группы, как в витрине: он не нужен, если ветка — одна категория. */
  var showHeads = groups.length > 1 ||
    (groups.length === 1 && groups[0].cat && groups[0].cat.id !== branch);
  return groups.map(function (g) {
    var head = '';
    if (showHeads && g.cat) {
      head = '<div class="list-group-head">' +
        '<span class="list-group-icon">' + iconMarkup(g.cat.icon || iconForCategory(g.cat.name), 13) + '</span>' +
        '<strong>' + g.cat.name + '</strong>' +
        '<small>' + g.rows.length + '</small></div>';
    }
    return '<div class="list-group">' + head +
      g.rows.map(function (r) {
        return cargoRowHTML(r, state.selectedCargo === r.key);
      }).join('') + '</div>';
  }).join('');
}

/* Колонка 1 магазина: сведения о выбранном корабле (по умолчанию — первый). */
function shipPanelHTML() {
  if (!window.Store) return '<div class="trade-empty">Данные не загружены</div>';
  var view = activeShipView();
  var rec = view.rec;
  var ship = view.ship;
  if (!ship) return '<div class="trade-empty">Кораблей ещё нет — купите в магазине</div>';

  var cat = Store.byId('categories', ship.categoryId);
  var props = Store.categoryProps(ship.categoryId).map(function (p) {
    var raw = String((ship.values && ship.values[p.id]) || p.value || '').trim();
    return { name: p.name, value: /^\d+([.,]\d+)?$/.test(raw) ? fmt(Number(raw.replace(',', '.'))) : raw };
  }).filter(function (p) { return p.value && !isMassName(p.name); });

  var rows = props.map(function (p) {
    return '<div class="ship-row"><span>' + p.name + '</span><b>' + p.value + '</b></div>';
  }).join('');

  var sub = [];
  if (rec.price) sub.push('куплен за ' + fmt(Number(rec.price)) + ' ¤');
  if (rec.boughtAt) sub.push(new Date(rec.boughtAt).toLocaleDateString('ru-RU'));

  var mass = Store.shipMass(rec);
  return '<span class="ship-sub">' + (cat ? Store.categoryPath(cat.id) : '') + '</span>' +
    '<strong class="ship-title">' + ship.name + '</strong>' +
    '<span class="ship-sub">' + sub.join(' · ') + '</span>' +
    '<div class="ship-rows">' + rows +
    '<div class="ship-row"><span>Масса</span><b>' + fmt(Math.round(mass)) + ' кг</b></div>' +
    '</div>' +
    '<span class="ship-sub">Трюмы · ' + view.holds.length + '</span>' + holdsListHTML(view) +
    '<span class="ship-sub">Слоты · ' + view.slots.length + '</span>' + slotGridHTML(view);
}

/* Значки груза контейнера в квадрате: по одному на ресурс. Наведение даёт
   подсказку, клик выбирает этот груз в «На корабле» (продажа 1 кг). */
function cargoChipsHTML(c, keyPrefix, boxName) {
  var chips = ((c && c.cargo) || []).map(function (g, gi) {
    var res = window.Store ? Store.byId('objects', g.itemId) : null;
    var kg = parseInt(g.qty, 10) || 0;
    if (!res || !kg) return '';
    var sale = window.Store ? Store.priceSale(res) : 0;
    return '<span class="slot-cargo-chip" data-cargo-key="' + keyPrefix + ':' + gi + '"' +
      ' data-cargo-id="' + res.id + '" data-cargo-name="' + res.name + '"' +
      ' data-cargo-box="' + boxName + '" data-cargo-kg="' + kg + '"' +
      ' data-cargo-sale="' + sale + '" data-cargo-icon="' + (res.icon || 'resource') + '">' +
      iconMarkup(res.icon || 'resource', 11) + '</span>';
  }).filter(Boolean);
  if (!chips.length) return '';
  if (chips.length > 3) {
    var rest = chips.length - 2;
    chips = chips.slice(0, 2).concat('<span class="slot-cargo-more">+' + rest + '</span>');
  }
  return '<span class="slot-cargo-chips">' + chips.join('') + '</span>';
}

/* Трюмы: название, загрузка по массе и содержимое квадратами — как слоты. */
function holdsListHTML(view) {
  if (!view.holds.length) {
    return '<div class="hold-empty">У этого корабля нет трюмов</div>';
  }
  return '<div class="hold-list">' + view.holds.map(function (hold, hi) {
    var cap = Store.slotCapacity(hold);
    /* Вместимость трюма занимает оборудование; груз в контейнерах — только масса. */
    var gear = Store.contentsMass(hold.contents);
    var cargo = Store.cargoMass(hold.contents);
    var pct = isFinite(cap) && cap > 0 ? Math.min(100, Math.round(gear / cap * 100)) : 0;
    var tiles = (hold.contents || []).map(function (c, ci) {
      var it = Store.byId('objects', c.itemId);
      if (!it) return '';
      var load = Store.cargoMass([c]);
      return '<button type="button" class="slot-tile hold-tile" data-action="select-hold-item" data-hold="' + hi +
        '" data-item="' + ci + '">' +
        iconMarkup(it.icon, 22) +
        cargoChipsHTML(c, 'cargo:hold:' + hi + ':' + ci, it.name) +
        (load ? '<span class="slot-qty">' + fmt(Math.round(load)) + ' кг</span>' : '') +
        '</button>';
    }).filter(Boolean);
    return '<div class="hold-row">' +
      '<div class="hold-head"><strong>' + hold.name + '</strong><span>' +
      fmt(Math.round(gear)) + ' / ' + (isFinite(cap) ? fmt(cap) + ' кг' : '∞') +
      (cargo ? ' · груз ' + fmt(Math.round(cargo)) + ' кг' : '') + '</span></div>' +
      '<i class="hold-bar"><em style="width:' + pct + '%"></em></i>' +
      (tiles.length
        ? '<div class="slot-grid hold-grid">' + tiles.join('') + '</div>'
        : '<span class="hold-empty">Пусто</span>') +
      '</div>';
  }).join('') + '</div>';
}

/* Подсказка над предметом в трюме: что это, сколько весит, что внутри. */
function holdTipHTML(view, hi, ii) {
  var hold = view.holds[hi];
  var c = hold && hold.contents ? hold.contents[ii] : null;
  var it = c && window.Store ? Store.byId('objects', c.itemId) : null;
  if (!it) return '';
  var cat = Store.byId('categories', it.categoryId);
  var meta = [];
  if (cat) meta.push(cat.name);
  var mass = Store.massOf(it);
  if (mass) meta.push(fmt(mass) + ' кг');
  var loads = (c.cargo || []).map(function (g) {
    var res = Store.byId('objects', g.itemId);
    return res ? res.name + ' ' + fmt(Number(g.qty) || 0) + ' кг' : '';
  }).filter(Boolean);
  var box = Store.capacityOf(it);
  return '<h4>' + it.name + '</h4>' +
    '<div class="tip-item">' +
    '<span class="tip-icon">' + iconMarkup(it.icon, 16) + '</span>' +
    '<span class="tip-copy"><strong>' + hold.name + '</strong>' +
    (meta.length ? '<small>' + meta.join(' · ') + '</small>' : '') +
    (loads.length ? '<small>груз: ' + loads.join(', ') + '</small>' : '') +
    (isFinite(box) && box > 0
      ? '<small>' + fmt(Math.round(Store.cargoMass([c]))) + ' / ' + fmt(box) + ' кг</small>'
      : '') +
    '</span></div>';
}

/* ---------- Слоты квадратами: сетка, подсказка, модальное окно ---------- */

function slotRecord(view, index) {
  return view && view.slots ? view.slots[index] : null;
}

function slotTitle(view, index) {
  var rec = slotRecord(view, index);
  var slot = rec && window.Store ? Store.byId('slots', rec.slotId) : null;
  return slot ? slot.name : 'Слот';
}

function slotContentsList(view, index) {
  var rec = slotRecord(view, index);
  return rec && rec.contents ? rec.contents : [];
}

function slotGridHTML(view) {
  if (!view || !view.slots) return '';
  return '<div class="slot-grid">' + view.slots.map(function (s, i) {
    var contents = s.contents || [];
    var first = contents.length && window.Store ? Store.byId('objects', contents[0].itemId) : null;
    /* Пустой слот с подходящими товарами ведёт в магазин на их категорию. */
    var goods = contents.length ? 0 : slotGoods(s.slotId).length;
    var cls = 'slot-tile' + (contents.length ? '' : ' empty') + (goods ? ' has-goods' : '');
    var hint = goods ? ' title="Открыть совместимые товары: ' + goods + '"' : '';
    return '<button class="' + cls + '" data-action="open-slot" ' + hint +
      'data-index="' + i + '">' +
      (first ? iconMarkup(first.icon, 22) : '') +
      (first ? cargoChipsHTML(contents[0], 'cargo:slot:' + i + ':0', first.name) : '') +
      (contents.length > 1 ? '<span class="slot-qty">×' + contents.length + '</span>' : '') +
      '</button>';
  }).join('') + '</div>';
}
/* Подсказка над слотом: что установлено — название, масса, груз контейнера. */
function slotTipHTML(view, index) {
  var contents = slotContentsList(view, index);
  var name = slotTitle(view, index);
  if (!contents.length) {
    var rec = slotRecord(view, index);
    var goods = rec ? slotGoods(rec.slotId).length : 0;
    return '<h4>' + name + '</h4><small>' +
      (goods ? 'Слот пуст · нажмите — откроются совместимые товары' : 'Слот пуст') + '</small>';
  }

  var rows = contents.slice(0, 3).map(function (c) {
    var it = window.Store ? Store.byId('objects', c.itemId) : null;
    if (!it) return '';
    var cat = window.Store ? Store.byId('categories', it.categoryId) : null;
    var meta = [];
    if (cat) meta.push(cat.name);
    var mass = Store.massOf(it);
    if (mass) meta.push(fmt(mass) + ' кг');
    var loads = (c.cargo || []).map(function (g) {
      var res = Store.byId('objects', g.itemId);
      return res ? res.name + ' ' + fmt(Number(g.qty) || 0) + ' кг' : '';
    }).filter(Boolean);
    var box = Store.capacityOf(it);
    return '<div class="tip-item">' +
      '<span class="tip-icon">' + iconMarkup(it.icon, 16) + '</span>' +
      '<span class="tip-copy"><strong>' + it.name + '</strong>' +
      (meta.length ? '<small>' + meta.join(' · ') + '</small>' : '') +
      (loads.length ? '<small>груз: ' + loads.join(', ') + '</small>' : '') +
      (isFinite(box) && box > 0
        ? '<small>' + fmt(Math.round(Store.cargoMass([c]))) + ' / ' + fmt(box) + ' кг</small>'
        : '') +
      '</span></div>';
  }).filter(Boolean);

  return '<h4>' + name + (contents.length > 1 ? ' · ' + contents.length + ' шт.' : '') + '</h4>' +
    '<div class="tip-list">' + rows.join('') + '</div>' +
    (contents.length > 3 ? '<small>+ ещё ' + (contents.length - 3) + ' — нажмите на слот</small>' : '');
}

function slotModalHTML(view, index) {
  var contents = slotContentsList(view, index);
  var cells = contents.map(function (c) {
    var it = window.Store ? Store.byId('objects', c.itemId) : null;
    var qty = Number(c.qty) || 0;
    return '<div class="slot-tile" title="' + (it ? it.name : '—') + '">' + iconMarkup(it ? it.icon : 'grid', 22) +
      (qty > 1 ? '<span class="slot-qty">×' + fmt(qty) + '</span>' : '') + '</div>';
  }).join('');

  /* У контейнера — его собственный груз: он не занимает место в трюме. */
  var cargo = contents.filter(function (c) { return c.cargo && c.cargo.length; }).map(function (c) {
    var box = window.Store ? Store.byId('objects', c.itemId) : null;
    if (!box) return '';
    var lines = c.cargo.map(function (g) {
      var res = window.Store ? Store.byId('objects', g.itemId) : null;
      return res ? '<span>' + res.name + ' — ' + fmt(Number(g.qty) || 0) + ' кг</span>' : '';
    }).filter(Boolean).join('');
    var cap = Store.capacityOf(box);
    return '<div class="slot-cargo">' +
      '<div class="slot-cargo-head"><strong>' + box.name + '</strong>' +
      '<span>груз ' + fmt(Math.round(Store.cargoMass([c]))) + ' / ' +
      (isFinite(cap) ? fmt(cap) : '∞') + ' кг</span></div>' +
      '<div class="slot-cargo-list">' + lines + '</div></div>';
  }).filter(Boolean).join('');

  return '<div class="slot-dialog" role="dialog" aria-modal="true">' +
    '<div class="slot-dialog-head"><div><span class="eyebrow">СОДЕРЖИМОЕ СЛОТА</span>' +
    '<h3>' + slotTitle(view, index) + '</h3></div>' +
    '<button class="slot-close" data-action="close-slot" aria-label="Закрыть">×</button></div>' +
    '<div class="slot-grid">' + cells + '</div>' +
    (cargo ? '<div class="slot-cargo-wrap">' + cargo + '</div>' : '') +
    '</div>';
}

function openSlotModal(view, index) {
  if (!view || !slotContentsList(view, index).length) return;
  var modal = document.getElementById('slotModal');
  if (!modal) return;
  modal.innerHTML = slotModalHTML(view, index);
  modal.hidden = false;
}

/* Товары, которые вставляются в слот этого шаблона. */
function slotGoods(slotId) {
  if (!slotId) return [];
  return shopItems.filter(function (it) { return !it.isShip && it.slotId === slotId; });
}

/* Самая глубокая категория, общая для всех позиций: её и открываем в магазине. */
function commonCategoryId(items) {
  var chains = [];
  items.forEach(function (it) {
    var chain = window.Store ? Store.categoryChain(it.categoryId) : [];
    if (chain.length) chains.push(chain);
  });
  if (!chains.length) return '';
  var common = chains[0];
  for (var i = 1; i < chains.length && common.length; i++) {
    var n = 0;
    while (n < common.length && n < chains[i].length && common[n].id === chains[i][n].id) n++;
    common = common.slice(0, n);
  }
  return common.length ? common[common.length - 1].id : '';
}

/* Пустой слот: открываем в магазине товары под него — категорию и её подкатегорию. */
function openSlotGoods(view, index) {
  var rec = slotRecord(view, index);
  var items = rec ? slotGoods(rec.slotId) : [];
  if (!items.length) return false;
  var chain = window.Store ? Store.categoryChain(commonCategoryId(items)) : [];
  if (!chain.length) return false;
  state.tab = 'shop';
  state.category = chain[0].id;
  state.subcategory = chain.length > 1 ? chain[chain.length - 1].id : '';
  state.selectedShop = items[0].id;
  state.ownedShipId = '';
  state.notice = slotTitle(view, index) + ': ' + items.length + ' ' +
    plural(items.length, ['совместимый товар', 'совместимых товара', 'совместимых товаров']);
  return true;
}

function closeSlotModal() {
  var modal = document.getElementById('slotModal');
  if (modal) { modal.hidden = true; modal.innerHTML = ''; }
}

/* Подсказка рядом с квадратом: справа, а если не влезает — слева. */
function placeSlotTip(tip, tile) {
  var rect = tile.getBoundingClientRect();
  tip.hidden = false;
  var w = tip.offsetWidth, h = tip.offsetHeight;
  var left = rect.right + 10;
  if (left + w > window.innerWidth - 8) left = Math.max(8, rect.left - w - 10);
  var top = Math.min(window.innerHeight - h - 8, Math.max(8, rect.top));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

/* Подсказка над слотом: сетка до четырёх предметов. */
function showSlotTip(tile) {
  var tip = document.getElementById('slotTip');
  if (!tip || !window.Store) return;
  var view = activeShipView();
  if (!view.ship) return;
  tip.innerHTML = slotTipHTML(view, Number(tile.getAttribute('data-index')));
  placeSlotTip(tip, tile);
}

/* Подсказка над предметом в трюме: тот же вид, что у слота. */
function showHoldTip(tile) {
  var tip = document.getElementById('slotTip');
  if (!tip || !window.Store) return;
  var view = activeShipView();
  if (!view.ship) return;
  tip.innerHTML = holdTipHTML(view, Number(tile.getAttribute('data-hold')), Number(tile.getAttribute('data-item')));
  placeSlotTip(tip, tile);
}

/* Подсказка над значком груза: ресурс, контейнер, килограммы и цена. */
function showCargoTip(chip) {
  var tip = document.getElementById('slotTip');
  if (!tip) return;
  var name = chip.getAttribute('data-cargo-name') || 'Груз';
  var box = chip.getAttribute('data-cargo-box') || '';
  var kg = Number(chip.getAttribute('data-cargo-kg')) || 0;
  var sale = Number(chip.getAttribute('data-cargo-sale')) || 0;
  var iconName = chip.getAttribute('data-cargo-icon') || 'resource';
  tip.innerHTML = '<h4>' + name + '</h4>' +
    '<div class="tip-item"><span class="tip-icon">' + iconMarkup(iconName, 16) + '</span>' +
    '<span class="tip-copy"><strong>' + (box ? 'Контейнер «' + box + '»' : 'Груз') + '</strong>' +
    '<small>' + fmt(kg) + ' кг' + (sale ? ' · ' + fmt(sale) + ' ¤/кг' : ' · цена не задана') + '</small>' +
    '<small>нажмите, чтобы продать 1 кг</small></span></div>';
  placeSlotTip(tip, chip);
}

function hideSlotTip() {
  var tip = document.getElementById('slotTip');
  if (tip) tip.hidden = true;
}

// ===== shop.js =====
// =============================================================================
// shop.js — вкладка «Магазин»: табы категорий и чипы подкатегорий, список
// «В продаже» блоками, центральная консоль (купить / сведения о корабле /
// выбранный предмет) и колонка «На корабле» с оборудованием корабля.
// =============================================================================







/* ---------- Рендер: магазин ---------- */

/* Строка магазина: объект из админки. */
function shopItemRowHTML(item, selected) {
  return '<button class="item-row' + (selected ? ' selected' : '') + '" data-action="select-shop" data-id="' + item.id + '">' +
    '<span class="item-icon">' + iconMarkup(item.icon, 22) + '</span>' +
    '<span class="item-copy"><strong>' + item.name + '</strong><span>' +
    (item.mass ? 'Масса ' + fmt(item.mass) + ' кг' : 'Единица груза') + '</span></span>' +
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

/* Центр: объект из админки — информация и кнопка «Купить». */
function shopObjectConsole(item) {
  if (!item) {
    return '<div class="trade-empty">' + (shopItems.length ? 'В этой категории пока нет объектов' : 'В базе админки пока нет объектов') + '</div>';
  }
  var lines = '<span class="trade-preview-stats">' + item.categoryPath + '</span>';
  lines += '<span class="trade-preview-stats">' +
    (item.mass ? 'Масса: ' + fmt(item.mass) + ' кг' : 'Единица груза: 1 кг за единицу') + '</span>';
  item.props.forEach(function (p) {
    lines += '<span class="trade-preview-stats">' + p.name + ': ' + p.value + '</span>';
  });
  var price = item.price
    ? '<span class="trade-preview-price">' + fmt(item.price) + ' ¤<small> / ' + (item.isResource ? 'кг' : 'шт.') + '</small></span>' +
      (item.sale ? '<span class="trade-preview-stats">продажа: ' + fmt(item.sale) + ' ¤</span>' : '')
    : '<span class="trade-preview-stats">Цена не задана</span>';
  if (item.isShip) lines += '<span class="trade-preview-stats">корабль · покупка попадёт в ангар</span>';
  else {
    var target = activeUserShip();
    lines += '<span class="trade-preview-stats">' +
      (target ? 'покупка на корабль «' + target.name + '»' : 'нужен корабль — купите его первым') + '</span>';
  }
  return '<div class="trade-preview">' +
    '<span class="trade-preview-icon">' + iconMarkup(item.icon, 27) + '</span>' +
    '<strong>' + item.name + '</strong>' +
    lines + price +
    '</div>' +
    '<button class="trade-button buy" data-action="buy">' + (item.isShip ? 'Купить корабль' : 'Купить') + icon('arrowRight') + '</button>';
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

/* Карточка груза контейнера: ресурс, где лежит, сколько и продажа 1 кг. */
function ownedCargoConsole(row) {
  var item = row.item;
  var sale = window.Store ? Store.priceSale(item) : 0;
  var total = sale * row.amount;
  var lines = '<span class="trade-preview-stats">' +
    (window.Store ? Store.categoryPath(item.categoryId) : '') + '</span>';
  lines += '<span class="trade-preview-stats">Контейнер: «' + row.boxName + '»</span>';
  lines += '<span class="trade-preview-stats">Место: ' + row.place + '</span>';
  lines += '<span class="trade-preview-stats">В наличии: ' + fmt(row.amount) + ' кг · ' +
    fmt(total) + ' ¤</span>';
  var price = sale
    ? '<span class="trade-preview-price">' + fmt(sale) + ' ¤<small> / кг</small></span>'
    : '<span class="trade-preview-stats">Цена продажи не задана</span>';
  var sell = sale
    ? '<button class="trade-button sell" data-action="sell-cargo-unit">' +
      icon('arrowLeft') + 'Продать 1 кг</button>'
    : '';
  return '<div class="trade-preview">' +
    '<span class="trade-preview-icon resource">' + iconMarkup(item.icon || 'resource', 27) + '</span>' +
    '<strong>' + item.name + '</strong>' + lines + price +
    '</div>' + sell;
}

/* Консоль выбранного предмета на корабле: где стоит, масса, груз и продажа. */
function ownedItemConsole(row) {
  if (row.isCargo) return ownedCargoConsole(row);
  var item = row.item;
  var mass = window.Store ? Store.massOf(item) : 0;
  var sale = window.Store ? Store.priceSale(item) : 0;
  var cargoKg = 0;
  var cargoValue = 0;
  ((row.entry && row.entry.cargo) || []).forEach(function (g) {
    var res = window.Store ? Store.byId('objects', g.itemId) : null;
    var kg = parseInt(g.qty, 10) || 0;
    if (!res || !kg) return;
    cargoKg += kg;
    cargoValue += Store.priceSale(res) * kg;
  });
  var lines = '<span class="trade-preview-stats">' +
    (window.Store ? Store.categoryPath(item.categoryId) : '') + '</span>';
  lines += '<span class="trade-preview-stats">Место: ' + row.place + '</span>';
  if (mass) lines += '<span class="trade-preview-stats">Масса: ' + fmt(mass) + ' кг</span>';
  if (cargoKg) {
    lines += '<span class="trade-preview-stats">Груз: ' + fmt(cargoKg) + ' кг · ' +
      fmt(cargoValue) + ' ¤</span>';
  }
  var price = sale
    ? '<span class="trade-preview-price">' + fmt(cargoKg ? sale + cargoValue : sale) + ' ¤' +
      '<small>' + (cargoKg ? ' вместе с грузом' : ' / шт.') + '</small></span>'
    : '<span class="trade-preview-stats">Цена продажи не задана</span>';
  var sell = sale
    ? '<button class="trade-button sell" data-action="' +
      (cargoKg ? 'sell-cargo-with' : 'sell-cargo') + '">' + icon('arrowLeft') +
      (cargoKg ? 'Продать вместе с грузом' : 'Продать') + '</button>'
    : '';
  return '<div class="trade-preview">' +
    '<span class="trade-preview-icon">' + iconMarkup(item.icon, 27) + '</span>' +
    '<strong>' + item.name + '</strong>' + lines + price +
    '</div>' + sell;
}

function shopConsoleHTML() {
  var cargo = selectedOwnedRow();
  if (cargo) return ownedItemConsole(cargo);
  var owned = ownedShipRecord();
  if (owned) return ownedShipConsole(owned);
  return shopObjectConsole(currentShop());
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
  /* Список блоками по подкатегориям: заголовок = ближайшая подкатегория ветки.
     Если вся ветка — одна категория, заголовок не нужен, его заменяет чип. */
  var groups = groupedShopItems(filtered);
  var showHeads = groups.length > 1 ||
    (groups.length === 1 && groups[0].cat && groups[0].cat.id !== activeBranch());
  document.getElementById('shopList').innerHTML = filtered.length
    ? groups.map(function (g) {
      var head = '';
      if (showHeads && g.cat) {
        head = '<div class="list-group-head">' +
          '<span class="list-group-icon">' + iconMarkup(g.cat.icon || iconForCategory(g.cat.name), 13) + '</span>' +
          '<strong>' + g.cat.name + '</strong>' +
          '<small>' + g.items.length + '</small></div>';
      }
      return '<div class="list-group">' + head +
        g.items.map(function (it) {
          return shopItemRowHTML(it, state.selectedShop === it.id);
        }).join('') + '</div>';
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
  document.getElementById('cargoList').innerHTML = cargoListHTML();
  var cargoCount = document.getElementById('cargoCount');
  if (cargoCount) {
    var positions = shipEquipmentInBranch(activeShipView()).length;
    cargoCount.textContent = positions
      ? positions + ' ' + plural(positions, ['позиция', 'позиции', 'позиций'])
      : 'пусто';
  }
  document.getElementById('noticeShop').textContent = state.notice;
}

// ===== ship-view.js =====
// =============================================================================
// ship-view.js — вкладка «Информация о корабле»: шапка с характеристиками,
// панель оборудования, панель трюмов и панель слотов выбранного корабля.
// =============================================================================




function shipViewHTML() {
  var view = activeShipView();
  var rec = view.rec;
  var ship = view.ship;

  if (!ship) {
    return '<div class="collection-panel"><div class="collection-head"><div>' +
      '<span class="eyebrow">АНГАР</span><h2>Купленных кораблей нет</h2></div></div>' +
      '<div class="collection-row"><div class="collection-copy"><strong>Купите корабль в магазине</strong>' +
      '<span>Он появится здесь со своими свойствами и слотами.</span></div></div></div>';
  }

  var cat = Store.byId('categories', ship.categoryId);
  var props = Store.categoryProps(ship.categoryId).map(function (p) {
    return { name: p.name, value: (ship.values && ship.values[p.id]) || p.value || '' };
  }).filter(function (p) { return p.value && !isMassName(p.name); });
  var statRows = props.map(function (p) {
    var raw = String(p.value).trim();
    var v = /^\d+([.,]\d+)?$/.test(raw) ? fmt(Number(raw.replace(',', '.'))) : raw;
    return '<div><span>' + p.name + '</span><b>' + v + '</b></div>';
  }).join('') + '<div><span>Масса</span><b>' + fmt(Math.round(Store.shipMass(rec))) + ' кг</b></div>';

  var bought = rec.boughtAt ? new Date(rec.boughtAt).toLocaleDateString('ru-RU') : '';
  var subtitle = (cat ? Store.categoryPath(cat.id) : '');
  if (rec.price) subtitle += ' · куплен за ' + fmt(Number(rec.price)) + ' ¤';
  if (bought) subtitle += ' · ' + bought;

  return '<div class="info-grid">' +
    '<div class="hero-ship"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>' +
    shipGlyph(false) +
    '<span class="axis-label left">КОРМA</span><span class="axis-label right">НОС</span></div>' +
    '<div class="ship-data">' +
    '<span class="eyebrow">ИНФОРМАЦИЯ О КОРАБЛЕ</span>' +
    '<h2>' + ship.name + '</h2>' +
    '<p>' + subtitle + '</p>' +
    '<div class="stat-grid">' + (statRows || '<div><span>Свойства</span><b>—</b></div>') + '</div>' +
    '</div></div>' +
    equipmentHTML(view) +
    holdsPanelHTML(view) +
    slotsPanelHTML(view);
}

/* Панель слотов: квадраты, клик — модальное окно с содержимым. */
function slotsPanelHTML(view) {
  return '<div class="collection-panel"><div class="collection-head"><div>' +
    '<span class="eyebrow">СЛОТЫ</span><h2>Слоты и содержимое</h2></div>' +
    '<span>' + view.slots.length + ' слотов</span></div>' +
    '<div class="slots-body">' + (view.slots.length ? slotGridHTML(view) : '<div class="hold-empty">У этого корабля нет креплений</div>') +
    '</div></div>';
}

/* Панель трюмов: загрузка по массе и состав. */
function holdsPanelHTML(view) {
  if (!view.holds.length) return '';
  var total = view.holds.reduce(function (n, h) {
    var cap = Store.slotCapacity(h);
    return n + (isFinite(cap) ? cap : 0);
  }, 0);
  var mass = Store.shipMass(view.rec);
  return '<div class="collection-panel"><div class="collection-head"><div>' +
    '<span class="eyebrow">ТРЮМЫ</span><h2>Грузовые трюмы</h2></div>' +
    '<span>' + view.holds.length + ' · ' + fmt(Math.round(total)) + ' кг · масса корабля ' +
    fmt(Math.round(mass)) + ' кг</span></div>' +
    '<div class="slots-body">' + holdsListHTML(view) + '</div></div>';
}

/* Оборудование на корабле — из креплений и трюмов записи, без выдуманных данных. */
function equipmentHTML(view) {
  var map = {}, order = [];

  function add(list, where) {
    (list || []).forEach(function (c) {
      var it = window.Store ? Store.byId('objects', c.itemId) : null;
      if (!it) return;
      if (!map[it.id]) {
        map[it.id] = { item: it, count: 0, places: [] };
        order.push(it.id);
      }
      map[it.id].count += parseInt(c.qty, 10) || 1;
      if (where && map[it.id].places.indexOf(where) < 0) map[it.id].places.push(where);
    });
  }

  view.slots.forEach(function (s) {
    var slot = window.Store ? Store.byId('slots', s.slotId) : null;
    add(s.contents, slot ? slot.name : '');
  });
  view.holds.forEach(function (h) { add(h.contents, h.name); });

  var rows = order.map(function (id, index) {
    var line = map[id];
    var it = line.item;
    var cat = window.Store ? Store.byId('categories', it.categoryId) : null;
    var details = [];
    if (cat) details.push(cat.name);
    var mass = Store.massOf(it);
    if (mass) details.push(fmt(mass) + ' кг');
    if (line.places.length) details.push(line.places.join(', '));
    return '<div class="collection-row">' +
      '<span class="item-icon">' + iconMarkup(it.icon, 22) + '</span>' +
      '<div class="collection-copy"><small>МОДУЛЬ // ' + pad2(index + 1) + '</small>' +
      '<strong>' + it.name + '</strong><span>' + details.join(' · ') + '</span></div>' +
      '<div class="collection-count"><b>×' + line.count + '</b><span>На корабле</span></div>' +
      '</div>';
  }).join('');

  var modules = order.reduce(function (n, id) { return n + map[id].count; }, 0);
  var shipName = view.ship ? view.ship.name : '';
  return '<div class="collection-panel">' +
    '<div class="collection-head"><div>' +
    '<span class="eyebrow">ИНВЕНТАРЬ' + (shipName ? ' · ' + shipName : '') + '</span><h2>Оборудование корабля</h2></div>' +
    '<span>' + order.length + ' типов · ' + modules + ' модулей</span></div>' +
    '<div class="collection-list">' + (rows || '<div class="hold-empty">Пока ничего не куплено</div>') + '</div></div>';
}

// ===== info.js =====
// =============================================================================
// info.js — вкладка «Информация о базе»: карточка HELIOS VII и ресурсы
// корабля (демо-список вкладки «Ангар», пока без данных Store).
// =============================================================================





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

// ===== hangar-tab.js =====
// =============================================================================
// hangar-tab.js — вкладка «Ангар»: перегрузка ресурсов между базой и
// кораблём. Пока демо-запас в state, к Store не подключён (см. PLAN).
// =============================================================================






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

// ===== dock.js =====
// =============================================================================
// dock.js — нижний док: карточки купленных кораблей и выбор активного.
// =============================================================================




/* ---------- Рендер: док кораблей ---------- */

function renderDock() {
  var list = userShipRecords();
  var active = activeUserShip();
  var cards = list.map(function (rec) {
    var ship = window.Store ? Store.byId('objects', rec.shipId) : null;
    var cat = ship ? Store.byId('categories', ship.categoryId) : null;
    var on = !!(active && active.id === rec.id);
    var sub = cat ? cat.name : '';
    if (rec.price) sub += (sub ? ' · ' : '') + fmt(Number(rec.price)) + ' ¤';
    return '<button class="ship-card' + (on ? ' active' : '') + '" data-action="select-user-ship" data-id="' + rec.id + '" data-rec="' + rec.id + '">' +
      '<div class="ship-visual">' + shipGlyph(true) +
      (on ? '<span class="active-tag">Выбран</span>' : '') + '</div>' +
      '<div class="ship-meta"><strong>' + rec.name + '</strong><span>' + sub + '</span></div>' +
      '</button>';
  }).join('');
  document.getElementById('shipDock').innerHTML = '<section class="ship-dock"><div class="ship-list">' +
    (cards || '<div class="list-empty">Купленных кораблей нет</div>') +
    '</div></section>';
}

// ===== app.js =====
// =============================================================================
// app.js — точка входа и каркас: шапка, вкладки, полный рендер, делегирование
// кликов, подсказки и старт. Здесь же покупка/продажа — единственные действия,
// которые меняют Store.
// =============================================================================











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

/* ---------- Рендер: информация о корабле ---------- */

function renderShipView() {
  var rec = activeUserShip();
  var ship = rec && window.Store ? Store.byId('objects', rec.shipId) : null;
  var title = document.getElementById('shipViewTitle');
  if (title) title.textContent = ship ? 'Корабль «' + ship.name + '»' : 'Корабль';
  document.getElementById('shipViewContent').innerHTML = shipViewHTML();
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
  state.selectedCargo = '';
  var list = filteredItems();
  if (list.length) state.selectedShop = list[0].id;
}

/* Клик по чипу: повторный клик снимает фильтр подкатегории. */
function changeSubcategory(next) {
  state.subcategory = state.subcategory === next ? '' : next;
  state.selectedCargo = '';
  var list = filteredItems();
  if (list.length) state.selectedShop = list[0].id;
}

/* ---------- Продажа с корабля ---------- */

/* Клик по квадрату слота или трюма = выбор этого предмета в «На корабле».
   Открываем магазин на верхней категории предмета, чтобы строка точно была
   видна. В витрине ничего не выделяем: выбранная строка — только «На корабле»,
   справа показываем карточку этого предмета с продажей. */
function selectCargoItem(item, key) {
  var chain = window.Store ? Store.categoryChain(item.categoryId) : [];
  state.tab = 'shop';
  state.category = chain.length ? chain[0].id : 'all';
  state.subcategory = '';
  state.selectedShop = '';
  state.selectedCargo = key;
  state.ownedShipId = '';
  closeSlotModal();
  hideSlotTip();
  render();
  renderDock();
  var row = document.querySelector('#cargoList .item-row.selected');
  if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
}

/* Состав контейнера в подтверждении: ресурс, килограммы и цена продажи. */
function confirmSellCargo(row) {
  var cargoTotal = 0;
  var lines = ((row.entry && row.entry.cargo) || []).map(function (g) {
    var res = window.Store ? Store.byId('objects', g.itemId) : null;
    var kg = parseInt(g.qty, 10) || 0;
    if (!res || !kg) return '';
    var value = Store.priceSale(res) * kg;
    cargoTotal += value;
    return '<div class="dialog-line"><span>' + res.name + '</span>' +
      '<b>' + fmt(kg) + ' кг</b><small>' + fmt(value) + ' ¤</small></div>';
  }).filter(Boolean).join('');
  var total = (window.Store ? Store.priceSale(row.item) : 0) + cargoTotal;
  openDialog('ПРОДАЖА', row.item.name + ' — вместе с грузом',
    '<p class="dialog-text">Контейнер продаётся только вместе с грузом. Внутри:</p>' +
    '<div class="dialog-lines">' + lines + '</div>' +
    '<p class="dialog-text">Итого: <strong>' + fmt(total) + ' ¤</strong></p>' +
    '<div class="dialog-actions">' +
    '<button class="trade-button sell" data-action="sell-cargo-confirm">Продать вместе с грузом</button>' +
    '<button class="trade-button ghost" data-action="close-slot">Отмена</button>' +
    '</div>');
}

/* Продать выбранную строку «На корабле». Возвращает false, если продажа не прошла. */
function sellOwnedRow(withCargo) {
  var rec = activeUserShip();
  var row = selectedOwnedRow();
  if (!rec || !row) return false;
  var res = Store.sellEntry(rec.id, { kind: row.kind, index: row.placeIndex }, row.entryIndex, withCargo);
  if (!res.ok) {
    openDialog('ПРОДАЖА', row.item.name + ' — не продано',
      '<p class="dialog-text">' + res.error + '</p>');
    return false;
  }
  state.notice = row.item.name + (res.cargoKg ? ' с грузом' : '') + ' → ' + fmt(res.price) + ' ¤';
  state.selectedCargo = '';
  closeSlotModal();
  return true;
}

/* Продать 1 кг груза из контейнера, выбранного в «На корабле». */
function sellCargoUnit() {
  var rec = activeUserShip();
  var row = selectedOwnedRow();
  if (!rec || !row || !row.isCargo) return false;
  var res = Store.sellCargo(rec.id, { kind: row.kind, index: row.placeIndex },
    row.entryIndex, row.cargoIndex, 1);
  if (!res.ok) {
    openDialog('ПРОДАЖА', row.item.name + ' — не продано',
      '<p class="dialog-text">' + res.error + '</p>');
    return false;
  }
  state.notice = row.item.name + ' 1 кг → ' + fmt(res.price) + ' ¤';
  if (!res.remaining) state.selectedCargo = '';
  return true;
}

/* ---------- Обработчик кликов (делегирование) ---------- */

document.addEventListener('click', function (e) {
  var modal = document.getElementById('slotModal');
  if (modal && !modal.hidden && e.target === modal) { closeSlotModal(); return; }
  /* Значок груза внутри контейнера: выбираем ресурс, а не весь контейнер. */
  var cargoChip = e.target.closest ? e.target.closest('.slot-cargo-chip') : null;
  if (cargoChip) {
    var chipItem = window.Store ? Store.byId('objects', cargoChip.getAttribute('data-cargo-id')) : null;
    if (chipItem) selectCargoItem(chipItem, cargoChip.getAttribute('data-cargo-key'));
    return;
  }
  var el = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  var id = el.getAttribute('data-id') || '';
  var dir = parseInt(el.getAttribute('data-dir'), 10);

  if (action === 'tab') state.tab = el.getAttribute('data-tab');
  else if (action === 'category') changeCategory(el.getAttribute('data-cat'));
  else if (action === 'subcategory') changeSubcategory(el.getAttribute('data-sub'));
  else if (action === 'select-shop') { state.selectedShop = id; state.selectedCargo = ''; state.ownedShipId = ''; }
  else if (action === 'add-credits') {
    var total = Store.addCredits(1000);
    state.notice = 'Баланс пополнен на 1 000 ¤ — теперь ' + fmt(total) + ' ¤';
  }
  else if (action === 'buy') {
    var buyItem = currentShop();
    if (!buyItem) return;
    if (buyItem.isShip) {
      var boughtShip = Store.buyShip(buyItem.id);
      state.notice = boughtShip.ok
        ? 'Корабль «' + buyItem.name + '» куплен за ' + fmt(boughtShip.price) + ' ¤'
        : (boughtShip.error === 'Недостаточно кредитов'
          ? 'Не хватает кредитов: нужно ' + fmt(boughtShip.price) + ' ¤'
          : 'Не удалось купить: ' + boughtShip.error);
    } else {
      var target = activeUserShip();
      if (!target) {
        openDialog('ПОКУПКА', 'Нет корабля',
          '<p class="dialog-text">Сначала купите корабль: покупка идёт на конкретный корабль, а не на склад.</p>');
        return;
      }
      var boughtItem = Store.buyForShip(target.id, buyItem.id, 1);
      if (!boughtItem.ok) {
        openDialog('ПОКУПКА', buyItem.name + ' — не куплено',
          '<p class="dialog-text">' + boughtItem.error + '</p>');
        return;
      }
      state.notice = buyItem.name + ' ×' + boughtItem.qty + ' → ' + boughtItem.where +
        ' · ' + fmt(boughtItem.price) + ' ¤';
    }
  }
  else if (action === 'select-cargo') { state.selectedCargo = id; state.ownedShipId = ''; }
  else if (action === 'select-hold-item') {
    var holdView = activeShipView();
    var hi = Number(el.getAttribute('data-hold'));
    var ii = Number(el.getAttribute('data-item'));
    var hold = holdView.holds[hi];
    var entry = hold && hold.contents ? hold.contents[ii] : null;
    var held = entry && window.Store ? Store.byId('objects', entry.itemId) : null;
    if (!held) return;
    selectCargoItem(held, 'hold:' + hi + ':' + ii);
    return;
  }
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
    state.selectedCargo = '';
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
  else if (action === 'sell-cargo') { if (!sellOwnedRow(false)) return; }
  else if (action === 'sell-cargo-with') {
    var sellRow = selectedOwnedRow();
    if (!sellRow) return;
    confirmSellCargo(sellRow);
    return;
  }
  else if (action === 'sell-cargo-confirm') { if (!sellOwnedRow(true)) return; }
  else if (action === 'sell-cargo-unit') { if (!sellCargoUnit()) return; }
  else if (action === 'open-slot') {
    var tile = el;
    var slotView = activeShipView();
    var slotIndex = Number(tile.getAttribute('data-index'));
    if (!slotView.ship) return;
    /* Заполненный слот — это клик по оборудованию: выбираем его в «На корабле».
       Пустой — по-прежнему открывает подходящие товары. */
    var contents = slotContentsList(slotView, slotIndex);
    if (contents.length) {
      var owned = window.Store ? Store.byId('objects', contents[0].itemId) : null;
      if (!owned) return;
      selectCargoItem(owned, 'slot:' + slotIndex + ':0');
      return;
    }
    if (!openSlotGoods(slotView, slotIndex)) return;
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
  var cargoChip = e.target.closest ? e.target.closest('.slot-cargo-chip') : null;
  if (cargoChip) { showCargoTip(cargoChip); return; }
  var holdTile = e.target.closest ? e.target.closest('.hold-tile') : null;
  if (holdTile) { showHoldTip(holdTile); return; }
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

console.info('HELIOS 7 — сборка v21 · 20.10.2026');
renderDock();
render();

})();