// =============================================================================
// shop.js — вкладка «Магазин»: табы категорий и чипы подкатегорий, список
// «В продаже» блоками, колонки «Корабль» и «На корабле», правая консоль
// (купить / сведения о корабле / выбранный предмет).
// =============================================================================

import { fmt, icon, iconMarkup, iconForCategory } from './base.js';
import { state } from './state.js';
import { shopItems, categories } from './catalog.js';
import { filteredItems, currentShop, groupedShopItems, buildSubcategories } from './categories.js';
import { activeUserShip, selectedOwnedRow, shipPanelHTML, cargoListHTML } from './ship.js';

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

/* Свойство вместимости показываем в блоке «Можно положить», а не строкой. */
function isCapacityName(name) {
  var n = String(name || '').trim().toLowerCase();
  return n === 'вместимость' || n === 'ёмкость' || n === 'емкость';
}

/* Строка характеристик в четвёртой колонке — как в карточке корабля. */
function shopRowHTML(label, value) {
  return '<div class="ship-row"><span>' + label + '</span><b>' + value + '</b></div>';
}

/* Центр: объект из админки — информация и кнопка «Купить». */
function shopObjectConsole(item) {
  if (!item) {
    return '<div class="trade-empty">' + (shopItems.length ? 'В этой категории пока нет объектов' : 'В базе админки пока нет объектов') + '</div>';
  }
  var raw = window.Store ? Store.byId('objects', item.id) : null;
  var capacity = raw && window.Store ? Store.capacityOf(raw) : 0;
  var allowed = capacity ? Store.prop2List(raw.prop2) : [];

  var rows = item.mass
    ? shopRowHTML('Масса', fmt(item.mass) + ' кг')
    : shopRowHTML('Единица груза', '1 кг за единицу');
  item.props.forEach(function (p) {
    if (capacity && isCapacityName(p.name)) return;
    rows += shopRowHTML(p.name, p.value);
  });
  if (capacity) rows += shopRowHTML('Вместимость', fmt(capacity) + ' кг');

  /* Контейнер: что можно положить внутрь. */
  var container = '';
  if (capacity) {
    container += '<span class="ship-sub">Можно положить</span>';
    if (allowed.length) {
      var byName = {};
      Store.resourceObjects().forEach(function (res) {
        byName[res.name.trim().toLowerCase()] = res;
      });
      container += '<div class="trade-cargo-list shop-cargo-list">' + allowed.map(function (name) {
        var res = byName[name.trim().toLowerCase()];
        return '<div class="trade-cargo-row">' +
          '<span class="trade-cargo-icon">' + iconMarkup(res ? res.icon : 'resource', 13) + '</span>' +
          '<span class="trade-cargo-name">' + (res ? res.name : name) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    } else {
      container += '<span class="ship-sub shop-note">Материалы не заданы</span>';
    }
  }

  var priceRows = item.price
    ? shopRowHTML('Цена', fmt(item.price) + ' ¤ <small>/ ' + (item.isResource ? 'кг' : 'шт.') + '</small>') +
      (item.sale ? shopRowHTML('Продажа', fmt(item.sale) + ' ¤') : '')
    : shopRowHTML('Цена', 'не задана');

  var note = '';
  if (item.isShip) note = '<span class="ship-sub shop-note">корабль · покупка попадёт в ангар</span>';
  else {
    var target = activeUserShip();
    note = '<span class="ship-sub shop-note">' +
      (target ? 'покупка на корабль «' + target.name + '»' : 'нужен корабль — купите его первым') + '</span>';
  }

  return '<span class="ship-sub">' + item.categoryPath + '</span>' +
    '<strong class="ship-title">' + item.name + '</strong>' +
    '<div class="ship-rows">' + rows + '</div>' +
    container +
    '<div class="ship-rows shop-price-rows">' + priceRows + '</div>' +
    note +
    '<div class="shop-actions"><button class="trade-button buy" data-action="buy">' +
    (item.isShip ? 'Купить корабль' : 'Купить') + icon('arrowRight') + '</button></div>';
}

/* Запись о выбранном в доке корабле: пока она есть, консоль предлагает продать. */
export function ownedShipRecord() {
  if (!state.ownedShipId || !window.Store) return null;
  var list = Store.userShips();
  for (var i = 0; i < list.length; i++) if (list[i].id === state.ownedShipId) return list[i];
  return null;
}

/* Разбивка продажи корабля: корпус, оборудование, груз и итого. */
function shipSaleCardHTML(value) {
  if (!value || !value.ok) {
    return '<span class="ship-sub shop-note">' +
      ((value && value.error) || 'Цена продажи не задана') + '</span>';
  }
  return '<span class="ship-sub">Стоимость продажи</span>' +
    '<div class="ship-rows shop-price-rows">' +
    shopRowHTML('Корабль', fmt(value.shipPrice) + ' ¤') +
    shopRowHTML('Оборудование', value.gearCount + ' шт. · ' + fmt(value.gearPrice) + ' ¤') +
    shopRowHTML('Груз', fmt(value.cargoKg) + ' кг · ' + fmt(value.cargoPrice) + ' ¤') +
    '</div>' +
    '<div class="trade-sale-total"><span>Итого</span><b>' + fmt(value.total) + ' ¤</b></div>';
}

/* Консоль купленного корабля: разбивка цены и кнопка «Продать корабль». */
function ownedShipConsole(rec) {
  var ship = window.Store ? Store.byId('objects', rec.shipId) : null;
  var cat = ship ? Store.byId('categories', ship.categoryId) : null;
  var value = window.Store ? Store.shipSaleValue(rec) : { ok: false, error: 'Store не загружен' };
  var bought = rec.boughtAt ? new Date(rec.boughtAt).toLocaleDateString('ru-RU') : '';
  var rows = '';
  if (ship) rows += shopRowHTML('Масса', fmt(Store.massOf(ship)) + ' кг');
  if (bought) rows += shopRowHTML('В ангаре с', bought);
  return '<span class="ship-sub">' + (cat ? Store.categoryPath(cat.id) : 'корабль') + '</span>' +
    '<strong class="ship-title">' + rec.name + '</strong>' +
    (rows ? '<div class="ship-rows">' + rows + '</div>' : '') +
    shipSaleCardHTML(value) +
    '<div class="shop-actions"><button class="trade-button sell" data-action="sell-ship">' +
    icon('arrowLeft') + 'Продать корабль</button></div>';
}

/* Карточка груза контейнера: ресурс, где лежит, сколько и продажа 1 кг. */
function ownedCargoConsole(row) {
  var item = row.item;
  var sale = window.Store ? Store.priceSale(item) : 0;
  var total = sale * row.amount;
  var rows = shopRowHTML('Контейнер', '«' + row.boxName + '»') +
    shopRowHTML('Место', row.place) +
    shopRowHTML('В наличии', fmt(row.amount) + ' кг · ' + fmt(total) + ' ¤');
  var priceRows = sale
    ? shopRowHTML('Цена продажи', fmt(sale) + ' ¤ <small>/ кг</small>')
    : shopRowHTML('Цена продажи', 'не задана');
  var sell = sale
    ? '<div class="shop-actions"><button class="trade-button sell" data-action="sell-cargo-unit">' +
      icon('arrowLeft') + 'Продать 1 кг</button></div>'
    : '';
  return '<span class="ship-sub">' + (window.Store ? Store.categoryPath(item.categoryId) : '') + '</span>' +
    '<strong class="ship-title">' + item.name + '</strong>' +
    '<div class="ship-rows">' + rows + '</div>' +
    '<div class="ship-rows shop-price-rows">' + priceRows + '</div>' +
    sell;
}

/* Консоль выбранного предмета на корабле: где стоит, масса, груз и продажа. */
function ownedItemConsole(row) {
  if (row.isCargo) return ownedCargoConsole(row);
  var item = row.item;
  var mass = window.Store ? Store.massOf(item) : 0;
  var sale = window.Store ? Store.priceSale(item) : 0;
  var cargoKg = 0;
  var cargoValue = 0;
  var cargoRows = '';
  ((row.entry && row.entry.cargo) || []).forEach(function (g) {
    var res = window.Store ? Store.byId('objects', g.itemId) : null;
    var kg = parseInt(g.qty, 10) || 0;
    if (!res || !kg) return;
    cargoKg += kg;
    cargoValue += Store.priceSale(res) * kg;
    cargoRows += '<div class="trade-cargo-row">' +
      '<span class="trade-cargo-icon">' + iconMarkup(res.icon || 'resource', 13) + '</span>' +
      '<span class="trade-cargo-name">' + res.name + '</span>' +
      '<span class="trade-cargo-kg">' + fmt(kg) + ' кг</span>' +
      '</div>';
  });
  var rows = shopRowHTML('Место', row.place);
  if (mass) rows += shopRowHTML('Масса', fmt(mass) + ' кг');
  var cargoBlock = '';
  if (cargoKg) {
    cargoBlock = '<span class="ship-sub">Груз в контейнере</span>' +
      '<div class="trade-cargo-list shop-cargo-list">' + cargoRows + '</div>' +
      '<div class="ship-rows shop-price-rows">' +
      shopRowHTML('Итого груз', fmt(cargoKg) + ' кг · ' + fmt(cargoValue) + ' ¤') +
      '</div>';
  }
  var priceRows = sale
    ? '<div class="ship-rows shop-price-rows">' +
      shopRowHTML('Цена продажи', fmt(cargoKg ? sale + cargoValue : sale) + ' ¤' +
        '<small>' + (cargoKg ? ' вместе с грузом' : ' / шт.') + '</small>') +
      '</div>'
    : '<span class="ship-sub shop-note">Цена продажи не задана</span>';
  var sell = sale
    ? '<div class="shop-actions"><button class="trade-button sell" data-action="' +
      (cargoKg ? 'sell-cargo-with' : 'sell-cargo') + '">' + icon('arrowLeft') +
      (cargoKg ? 'Продать вместе с грузом' : 'Продать') + '</button></div>'
    : '';
  return '<span class="ship-sub">' + (window.Store ? Store.categoryPath(item.categoryId) : '') + '</span>' +
    '<strong class="ship-title">' + item.name + '</strong>' +
    '<div class="ship-rows">' + rows + '</div>' +
    cargoBlock +
    priceRows +
    sell;
}

function shopConsoleHTML() {
  var cargo = selectedOwnedRow();
  if (cargo) return ownedItemConsole(cargo);
  var owned = ownedShipRecord();
  if (owned) return ownedShipConsole(owned);
  return shopObjectConsole(currentShop());
}

export function renderShop() {
  var filtered = filteredItems();
  var selected = currentShop();
  /* У выбранного корабля правый список «На корабле» скрывается. */
  var hideCargo = !!(selected && selected.isShip);
  var cargoPanel = document.getElementById('cargoPanel');
  var marketGrid = document.querySelector('.market-grid');
  if (cargoPanel) cargoPanel.hidden = hideCargo;
  if (marketGrid) marketGrid.classList.toggle('no-cargo', hideCargo);
  document.getElementById('categoryTabs').innerHTML = categoryTabsHTML();
  renderSubcategories();
  /* Список блоками по фактическим подкатегориям: заголовок группы виден всегда,
     даже если после фильтра осталась одна подкатегория. */
  var groups = groupedShopItems(filtered);
  document.getElementById('shopList').innerHTML = filtered.length
    ? groups.map(function (g) {
      var head = '';
      if (g.cat) {
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
  document.getElementById('cargoList').innerHTML = cargoListHTML();
  document.getElementById('noticeShop').textContent = state.notice;
}
