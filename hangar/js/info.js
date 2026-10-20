// =============================================================================
// info.js — вкладка «Информация о базе»: карточка HELIOS VII и ресурсы
// корабля (демо-список вкладки «Ангар», пока без данных Store).
// =============================================================================

import { shipGlyph, icon, pad2 } from './base.js';
import { state } from './state.js';
import { hangarResources } from './catalog.js';

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

export function renderInfo() {
  document.getElementById('infoContent').innerHTML = baseInfoHTML();
}
