/* Galaxy Admin — навигация (hash-роутер). */
(function () {
  'use strict';

  var h = UI.h;

  /* Метка сборки: видна в консоли, помогает понять, какая версия открыта. */
  var BUILD = 'v23 · 22.10.2026';
  console.info('Galaxy Admin — сборка ' + BUILD);

  var ROUTES = [
    { hash: '#/home', label: 'Админка', section: null, page: 'home' },
    { hash: '#/props', label: 'Свойства', section: 'Справочники', page: 'props' },
    { hash: '#/slots', label: 'Слоты', section: 'Справочники', page: 'slots' },
    { hash: '#/objects/ships', label: 'Корабли', section: 'Каталог', page: 'objects', group: 'ships' },
    { hash: '#/objects/equipment', label: 'Оборудование', section: 'Каталог', page: 'objects', group: 'equipment' },
    { hash: '#/objects/resources', label: 'Ресурсы', section: 'Каталог', page: 'objects', group: 'resources' },
    { hash: '#/categories/ships', label: 'Категории кораблей', section: 'Категории', page: 'categories', group: 'ships' },
    { hash: '#/categories/resources', label: 'Категории ресурсов', section: 'Категории', page: 'categories', group: 'resources' },
    { hash: '#/categories/equipment', label: 'Категории оборудования', section: 'Категории', page: 'categories', group: 'equipment' }
  ];

  /* Старые адреса: общий список объектов разделён на три страницы. */
  var ALIASES = {
    '#/objects': '#/objects/ships',
    '#/ships': '#/objects/ships',
    '#/equipment': '#/objects/equipment',
    '#/goods': '#/objects/equipment',
    '#/resources': '#/objects/resources',
    '#/categories': '#/categories/ships',
    '#/categories/ship': '#/categories/ships',
    '#/categories/goods': '#/categories/equipment'
  };

  var navLinks = [];

  function buildNav() {
    var nav = document.getElementById('nav');
    UI.clear(nav);
    navLinks = [];
    var lastSection;
    ROUTES.forEach(function (route) {
      if (route.section !== lastSection) {
        lastSection = route.section;
        if (route.section) nav.appendChild(h('div', { class: 'nav-section', text: route.section }));
      }
      var link = h('a', { class: 'nav-link', href: route.hash, text: route.label });
      nav.appendChild(link);
      navLinks.push({ route: route, el: link });
    });
  }

  function currentRoute() {
    var hash = window.location.hash || '#/home';
    if (ALIASES[hash]) {
      hash = ALIASES[hash];
      try { window.history.replaceState(null, '', hash); }
      catch (e) { window.location.hash = hash; }
    }
    var found = null;
    ROUTES.forEach(function (r) { if (r.hash === hash) found = r; });
    return found || ROUTES[0];
  }

  function render() {
    var route = currentRoute();
    navLinks.forEach(function (l) { l.el.classList.toggle('active', l.route === route); });

    var pageEl = document.getElementById('page');
    pageEl.classList.toggle('page-wide', route.page === 'objects');
    UI.clear(pageEl);
    var page = window.Pages[route.page];
    if (page) page.render(pageEl, route);

    document.title = route.label + ' — Galaxy Admin';
  }

  window.App = {
    go: function (hash) {
      if (window.location.hash === hash) render();
      else window.location.hash = hash;
    },
    refresh: render
  };

  window.addEventListener('hashchange', render);

  buildNav();
  if (!window.location.hash) window.location.hash = '#/home';
  render();
})();
