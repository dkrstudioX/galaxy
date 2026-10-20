// =============================================================================
// app.js — точка входа и каркас: шапка, вкладки, полный рендер, делегирование
// кликов, подсказки и старт. Здесь же покупка/продажа — единственные действия,
// которые меняют Store.
// =============================================================================

import { fmt, openDialog } from './base.js';
import { state } from './state.js';
import { filteredItems, currentShop } from './categories.js';
import { renderShop, ownedShipRecord } from './shop.js';
import { renderHangar, transferResource } from './hangar-tab.js';
import { renderInfo } from './info.js';
import { shipViewHTML } from './ship-view.js';
import { activeUserShip, activeShipView, slotContentsList, openSlotGoods, closeSlotModal, showSlotTip, showHoldTip, hideSlotTip } from './ship.js';
import { renderDock } from './dock.js';

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
   видна, и подсвечиваем её в списке. */
function selectCargoItem(item, key) {
  var chain = window.Store ? Store.categoryChain(item.categoryId) : [];
  state.tab = 'shop';
  state.category = chain.length ? chain[0].id : 'all';
  state.subcategory = '';
  state.selectedShop = item.id || '';
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
