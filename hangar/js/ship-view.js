// =============================================================================
// ship-view.js — вкладка «Информация о корабле»: шапка с характеристиками,
// панель оборудования, панель трюмов и панель слотов выбранного корабля.
// =============================================================================

import { fmt, pad2, shipGlyph, isMassName, iconMarkup } from './base.js';
import { activeShipView, holdsListHTML, slotGridHTML } from './ship.js';

export function shipViewHTML() {
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
    var cap = Store.holdCapacity(h);
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
