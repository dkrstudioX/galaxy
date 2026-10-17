/* Каталог иконок объектов — общий для админки и ангара.
   Иконка хранится в объекте ключом (например, 'rocket'), а рисуется SVG,
   чтобы не зависеть от внешних файлов и шрифтов. */
(function () {
  'use strict';

  /* 24×24, обводка — в том же стиле, что остальная графика проекта. */
  var ICONS = {
    ship: '<path d="m12 3 5 7-1 8-4-2-4 2-1-8 5-7Z"/><path d="M10 12h4M12 3v7"/>',
    weapon: '<path d="m5 19 4-4m2-2 8-8v5l-8 8H6v-5l8-8h5"/><path d="m14 10 3 3"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/>',
    resource: '<path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path d="m5 7 7 4 7-4M12 11v10"/>',
    rocket: '<path d="M12 3c3 3 4.5 6 4.5 9L12 16l-4.5-4C7.5 9 9 6 12 3Z"/><path d="M9 17l-2 4 4-2M15 17l2 4-4-2"/>',
    engine: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    fuel: '<path d="M7 21V4h7v17M7 9h7"/><path d="M14 7h3l2 3v6a2 2 0 0 1-4 0v-3"/>',
    crate: '<rect x="3" y="7" width="18" height="13" rx="1"/><path d="M3 11h18M9 7v13"/>',
    gem: '<path d="m6 4 12 0 3 5-9 11L3 9l3-5Z"/><path d="M3 9h18M9 4l-1 5 4 11 4-11-1-5"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    tool: '<path d="M14 6a4 4 0 1 0 4 4l-3-3 3-3-4 2Z"/><path d="m11 10-7 7v3h3l7-7"/>',
    box: '<path d="M4 8h16v11H4z"/><path d="M8 8V5h8v3"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 6-6"/>',
    store: '<path d="M4 9h16l-1-5H5L4 9Z"/><path d="M6 9v11h12V9M9 20v-6h6v6"/>',
    hangar: '<path d="M3 20V9l9-6 9 6v11M7 20v-8h10v8"/><path d="M9 16h6M9 12h6"/>',
    station: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5"/><path d="m8.5 8.5 7 7m0-7-7 7"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
  };

  /* Порядок кнопок в выборе иконки и в «случайной». */
  var ORDER = [
    'ship', 'weapon', 'shield', 'resource', 'rocket', 'engine', 'fuel', 'crate', 'gem',
    'bolt', 'tool', 'box', 'radar', 'store', 'hangar', 'station', 'grid'
  ];

  function keys() { return ORDER.slice(); }

  function svg(name, size) {
    var path = ICONS[name] || ICONS.grid;
    size = size || 22;
    return '<svg aria-hidden="true" fill="none" height="' + size + '" viewBox="0 0 24 24" width="' + size +
      '" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">' +
      path + '</svg>';
  }

  /* Случайная иконка — для нового объекта. */
  function random() {
    return ORDER[Math.floor(Math.random() * ORDER.length)];
  }

  /* Иконка по названию категории: в данных админки иконок нет. */
  function forCategory(name) {
    var n = String(name).toLowerCase();
    if (n.indexOf('кораб') === 0) return 'ship';
    if (n.indexOf('оруж') === 0) return 'weapon';
    if (n.indexOf('щит') > -1) return 'shield';
    if (n.indexOf('ресурс') > -1 || n.indexOf('матери') > -1 || n.indexOf('топл') > -1) return 'resource';
    if (n.indexOf('двигат') > -1) return 'engine';
    if (n.indexOf('расход') > -1) return 'tool';
    return 'grid';
  }

  window.Icons = { keys: keys, svg: svg, random: random, forCategory: forCategory };
})();
