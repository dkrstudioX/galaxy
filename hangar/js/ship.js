// =============================================================================
// ship.js — всё про купленный корабль: запись из Store.userShips(), её
// крепления и трюмы, оборудование (квадраты слотов и трюмов), панель «01
// Корабль» в магазине, колонка «На корабле», модальные окна и подсказки.
// Только читает Store; покупки и продажи — в app.js.
// =============================================================================

import { fmt, plural, iconMarkup, iconForCategory } from './base.js';
import { state } from './state.js';
import { shopItems } from './catalog.js';
import { inCategory, inSubtree, itemSubcategoryId, categoryOrderIndex } from './categories.js';

/* Купленные корабли: записи пользователя и выбранный корабль. */
export function userShipRecords() { return window.Store ? Store.userShips() : []; }

/* Выбранный корабль — по id записи: два одинаковых корабля не путаются. */
export function activeUserShip() {
  var list = userShipRecords();
  for (var i = 0; i < list.length; i++) if (list[i].id === state.userShipId) return list[i];
  return list[0] || null;
}

/* Раскладка выбранного корабля: крепления и трюмы живут в записи. */
export function activeShipView() {
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
export function shipEquipmentRows(view) {
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
export function shipCargoRows(view) {
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
export function shipEquipmentInBranch(view) {
  return shipEquipmentRows(view).concat(shipCargoRows(view)).filter(function (r) {
    if (!inCategory(r.item, state.category)) return false;
    if (state.subcategory && !inSubtree(r.item.categoryId, state.subcategory)) return false;
    return true;
  });
}

/* Выбранная строка «На корабле»: ключ живёт до смены корабля или ветки. */
export function selectedOwnedRow() {
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
export function cargoListHTML() {
  var view = activeShipView();
  if (!view.ship) return '<div class="list-empty">Сначала купите корабль</div>';
  var all = shipEquipmentRows(view);
  if (!all.length) return '<div class="list-empty">На корабле пока ничего нет</div>';
  var rows = shipEquipmentInBranch(view);
  if (!rows.length) return '<div class="list-empty">В этой категории на корабле ничего нет</div>';

  var groups = [], index = {};
  rows.forEach(function (r) {
    var id = itemSubcategoryId(r.item.categoryId);
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

  /* Заголовок группы показываем всегда — он не зависит от выбранной ветки. */
  return groups.map(function (g) {
    var head = '';
    if (g.cat) {
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
export function shipPanelHTML() {
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
export function holdsListHTML(view) {
  if (!view.holds.length) {
    return '<div class="hold-empty">У этого корабля нет трюмов</div>';
  }
  return '<div class="hold-list">' + view.holds.map(function (hold, hi) {
    var cap = Store.holdCapacity(hold);
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

export function slotContentsList(view, index) {
  var rec = slotRecord(view, index);
  return rec && rec.contents ? rec.contents : [];
}

export function slotGridHTML(view) {
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

export function openSlotModal(view, index) {
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
export function openSlotGoods(view, index) {
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

export function closeSlotModal() {
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
export function showSlotTip(tile) {
  var tip = document.getElementById('slotTip');
  if (!tip || !window.Store) return;
  var view = activeShipView();
  if (!view.ship) return;
  tip.innerHTML = slotTipHTML(view, Number(tile.getAttribute('data-index')));
  placeSlotTip(tip, tile);
}

/* Подсказка над предметом в трюме: тот же вид, что у слота. */
export function showHoldTip(tile) {
  var tip = document.getElementById('slotTip');
  if (!tip || !window.Store) return;
  var view = activeShipView();
  if (!view.ship) return;
  tip.innerHTML = holdTipHTML(view, Number(tile.getAttribute('data-hold')), Number(tile.getAttribute('data-item')));
  placeSlotTip(tip, tile);
}

/* Подсказка над значком груза: ресурс, контейнер, килограммы и цена. */
export function showCargoTip(chip) {
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

export function hideSlotTip() {
  var tip = document.getElementById('slotTip');
  if (tip) tip.hidden = true;
}
