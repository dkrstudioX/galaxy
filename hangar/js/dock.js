// =============================================================================
// dock.js — нижний док: карточки купленных кораблей и выбор активного.
// =============================================================================

import { fmt, shipGlyph } from './base.js';
import { userShipRecords, activeUserShip } from './ship.js';

/* ---------- Рендер: док кораблей ---------- */

export function renderDock() {
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
