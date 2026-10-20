// =============================================================================
// hangar-tab.js — вкладка «Ангар»: перегрузка ресурсов между базой и
// кораблём. Пока демо-запас в state, к Store не подключён (см. PLAN).
// =============================================================================

import { icon } from './base.js';
import { state } from './state.js';
import { hangarResources } from './catalog.js';
import { activeResource } from './categories.js';

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

export function renderHangar() {
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

export function transferResource() {
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
