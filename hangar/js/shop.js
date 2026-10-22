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

/* Центр: объект из админки — информация и кнопка «Купить». */
function shopObjectConsole(item) {
  if (!item) {
    return '<div class="trade-empty">' + (shopItems.length ? 'В этой категории пока нет объектов' : 'В базе админки пока нет объектов') + '</div>';
  }
  var raw = window.Store ? Store.byId('objects', item.id) : null;
  var capacity = raw && window.Store ? Store.capacityOf(raw) : 0;
  var allowed = capacity ? Store.prop2List(raw.prop2) : [];
  var lines = '<span class="trade-preview-stats">' + item.categoryPath + '</span>';
  lines += '<span class="trade-preview-stats">' +
    (item.mass ? 'Масса: ' + fmt(item.mass) + ' кг' : 'Единица груза: 1 кг за единицу') + '</span>';
  item.props.forEach(function (p) {
    if (capacity && isCapacityName(p.name)) return;
    lines += '<span class="trade-preview-stats">' + p.name + ': ' + p.value + '</span>';
  });
  /* Контейнер: те же стили, что у состава купленного, — что можно положить. */
  if (capacity) {
    lines += '<span class="trade-cargo-label">Можно положить</span>';
    if (allowed.length) {
      var byName = {};
      Store.resourceObjects().forEach(function (res) {
        byName[res.name.trim().toLowerCase()] = res;
      });
      lines += '<div class="trade-cargo-list">' + allowed.map(function (name) {
        var res = byName[name.trim().toLowerCase()];
        return '<div class="trade-cargo-row">' +
          '<span class="trade-cargo-icon">' + iconMarkup(res ? res.icon : 'resource', 13) + '</span>' +
          '<span class="trade-cargo-name">' + (res ? res.name : name) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    } else {
      lines += '<span class="trade-cargo-total">Материалы не заданы</span>';
    }
    lines += '<span class="trade-cargo-total">Вместимость: ' + fmt(capacity) + ' кг</span>';
  }
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
export function ownedShipRecord() {
  if (!state.ownedShipId || !window.Store) return null;
  var list = Store.userShips();
  for (var i = 0; i < list.length; i++) if (list[i].id === state.ownedShipId) return list[i];
  return null;
}

/* Разбивка продажи корабля: корпус, оборудование, груз и итого. */
function shipSaleCardHTML(value) {
  if (!value || !value.ok) {
    return '<span class="trade-preview-stats">' +
      ((value && value.error) || 'Цена продажи не задана') + '</span>';
  }
  function row(iconName, label, price) {
    return '<div class="trade-cargo-row">' +
      '<span class="trade-cargo-icon">' + iconMarkup(iconName, 13) + '</span>' +
      '<span class="trade-cargo-name">' + label + '</span>' +
      '<span class="trade-cargo-kg">' + fmt(price) + ' ¤</span>' +
      '</div>';
  }
  return '<span class="trade-cargo-label">Стоимость продажи</span>' +
    '<div class="trade-cargo-list">' +
    row('ship', 'Корабль', value.shipPrice) +
    row('grid', 'Оборудование · ' + value.gearCount + ' шт.', value.gearPrice) +
    row('resource', 'Груз · ' + fmt(value.cargoKg) + ' кг', value.cargoPrice) +
    '</div>' +
    '<div class="trade-sale-total"><span>Итого</span><b>' + fmt(value.total) + ' ¤</b></div>';
}

/* Консоль купленного корабля: разбивка цены и кнопка «Продать корабль». */
function ownedShipConsole(rec) {
  var ship = window.Store ? Store.byId('objects', rec.shipId) : null;
  var cat = ship ? Store.byId('categories', ship.categoryId) : null;
  var value = window.Store ? Store.shipSaleValue(rec) : { ok: false, error: 'Store не загружен' };
  var bought = rec.boughtAt ? new Date(rec.boughtAt).toLocaleDateString('ru-RU') : '';
  var lines = '<span class="trade-preview-stats">' + (cat ? Store.categoryPath(cat.id) : 'корабль') + '</span>';
  if (ship) lines += '<span class="trade-preview-stats">Масса: ' + fmt(Store.massOf(ship)) + ' кг</span>';
  lines += '<span class="trade-preview-stats">в ангаре с ' + bought + '</span>';
  return '<div class="trade-preview">' +
    '<span class="trade-preview-icon">' + iconMarkup(ship ? ship.icon : 'ship', 27) + '</span>' +
    '<strong>' + rec.name + '</strong>' +
    lines + shipSaleCardHTML(value) +
    '</div>' +
    '<button class="trade-button sell" data-action="sell-ship">' +
    icon('arrowLeft') + 'Продать корабль</button>';
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
  var lines = '<span class="trade-preview-stats">' +
    (window.Store ? Store.categoryPath(item.categoryId) : '') + '</span>';
  lines += '<span class="trade-preview-stats">Место: ' + row.place + '</span>';
  if (mass) lines += '<span class="trade-preview-stats">Масса: ' + fmt(mass) + ' кг</span>';
  if (cargoKg) {
    lines += '<span class="trade-cargo-label">Груз в контейнере</span>' +
      '<div class="trade-cargo-list">' + cargoRows + '</div>' +
      '<span class="trade-cargo-total">Итого груз: ' + fmt(cargoKg) + ' кг · ' +
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
