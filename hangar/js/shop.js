// =============================================================================
// shop.js — вкладка «Магазин»: табы категорий и чипы подкатегорий, список
// «В продаже» блоками, центральная консоль (купить / сведения о корабле /
// выбранный предмет) и колонка «На корабле» с оборудованием корабля.
// =============================================================================

import { fmt, plural, icon, iconMarkup, iconForCategory } from './base.js';
import { state } from './state.js';
import { shopItems, categories } from './catalog.js';
import { filteredItems, currentShop, activeBranch, groupedShopItems, buildSubcategories } from './categories.js';
import { activeUserShip, activeShipView, shipEquipmentInBranch, selectedOwnedRow, shipPanelHTML, cargoListHTML, userShipRecords } from './ship.js';

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
export function ownedShipRecord() {
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

/* Консоль выбранного предмета на корабле: где стоит, масса, груз и продажа. */
function ownedItemConsole(row) {
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

export function renderShop() {
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
    var modules = shipEquipmentInBranch(activeShipView()).length;
    cargoCount.textContent = modules
      ? modules + ' ' + plural(modules, ['модуль', 'модуля', 'модулей'])
      : 'пусто';
  }
  document.getElementById('noticeShop').textContent = state.notice;
}
