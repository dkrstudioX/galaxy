/* Galaxy Admin — навигация (hash-роутер). */
(function () {
  'use strict';

  var h = UI.h;

  var ROUTES = [
    { hash: '#/home', label: 'Главная', section: null, page: 'home' },
    { hash: '#/props', label: 'Свойства', section: 'Справочники', page: 'props' },
    { hash: '#/slots', label: 'Слоты', section: 'Справочники', page: 'slots' },
    { hash: '#/categories/ship', label: 'Категории кораблей', section: 'Категории', page: 'catShip' },
    { hash: '#/categories/resource', label: 'Категории ресурсов', section: 'Категории', page: 'catResource' },
    { hash: '#/categories/equipment', label: 'Категории оборудования', section: 'Категории', page: 'catEquipment' },
    { hash: '#/ships', label: 'Корабли', section: 'Объекты', page: 'ships' },
    { hash: '#/resources', label: 'Ресурсы', section: 'Объекты', page: 'resources' },
    { hash: '#/equipment', label: 'Оборудование', section: 'Объекты', page: 'equipment' }
  ];

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
    var found = null;
    ROUTES.forEach(function (r) { if (r.hash === hash) found = r; });
    return found || ROUTES[0];
  }

  function render() {
    var route = currentRoute();
    navLinks.forEach(function (l) { l.el.classList.toggle('active', l.route === route); });

    var pageEl = document.getElementById('page');
    UI.clear(pageEl);
    var page = window.Pages[route.page];
    if (page) page.render(pageEl);

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
