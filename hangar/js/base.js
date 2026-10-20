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

export function icon(name, size) {
  size = size || 18;
  return '<svg aria-hidden="true" fill="none" height="' + size + '" viewBox="0 0 24 24" width="' + size +
    '" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">' +
    (ICONS[name] || ICONS.grid) + '</svg>';
}

export function shipGlyph(compact) {
  return '<svg class="ship-glyph' + (compact ? ' compact' : '') + '" viewBox="0 0 220 100" fill="none">' +
    '<path d="M12 52 56 40 88 14h45l17 24 58 14-58 12-20 24H88L57 65 12 52Z" fill="currentColor" opacity=".16"/>' +
    '<path d="M13 52h195M57 40l31 12-31 13M88 14l14 38-14 36M133 14l-13 38 10 36M150 38l-30 14 30 12" stroke="currentColor"/>' +
    '<path d="M94 42h30l7 10-8 10H94l-8-10 8-10Z" fill="currentColor" opacity=".45"/>' +
    '<path d="m45 45-20 7 20 7m114-16 33 9-33 8" stroke="currentColor" stroke-width="2"/></svg>';
}

/* Иконок в данных админки нет — подбираем по названию категории. */
export function iconForCategory(name) {
  if (window.Icons) return Icons.forCategory(name);
  return 'grid';
}

/* ---------- Хелперы ---------- */

export function fmt(n) { return n.toLocaleString('ru-RU'); }
export function plural(n, forms) {
  var d = n % 10;
  var dd = n % 100;
  if (d === 1 && dd !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
  return forms[2];
}
export function pad2(n) { return (n < 10 ? '0' : '') + n; }

/* «Масса» — свойство корпуса; в панели показываем массу корабля целиком. */
export function isMassName(name) {
  var n = String(name).trim().toLowerCase();
  return n === 'масса' || n === 'вес' || n.indexOf('масса ') === 0 || n.indexOf('вес ') === 0;
}

export function byId(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/* Иконка объекта: из общего каталога data/icons.js, с запасным вариантом. */
export function iconMarkup(name, size) {
  if (window.Icons) return Icons.svg(name, size);
  return icon(name, size);
}

/* Общее окно: содержимое слота и отказ в покупке. */
export function openDialog(eyebrow, title, bodyHTML) {
  var modal = document.getElementById('slotModal');
  if (!modal) return;
  modal.innerHTML = '<div class="slot-dialog" role="dialog" aria-modal="true">' +
    '<div class="slot-dialog-head"><div><span class="eyebrow">' + eyebrow + '</span>' +
    '<h3>' + title + '</h3></div>' +
    '<button class="slot-close" data-action="close-slot" aria-label="Закрыть">×</button></div>' +
    '<div class="dialog-body">' + bodyHTML + '</div></div>';
  modal.hidden = false;
}
