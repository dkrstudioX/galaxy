/* Страница «Главная»: сводка, с чего начать, экспорт/импорт. */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  function link(hash, text) {
    return h('a', { class: 'text-link', href: hash, text: text });
  }

  function statCard(label, value, hash) {
    return h('div', { class: 'stat-card', onclick: function () { App.go(hash); } },
      h('div', { class: 'stat-value', text: String(value) }),
      h('div', { class: 'stat-label', text: label })
    );
  }

  function groupCount(key) {
    var group = Store.catalogGroups()[key];
    if (!group) return 0;
    var ids = {};
    ids[group.root.id] = true;
    Store.categoryDescendants(group.root.id).forEach(function (c) { ids[c.id] = true; });
    return Store.objects().filter(function (o) { return ids[o.categoryId]; }).length;
  }

  function exportData() {
    var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: 'galaxy-admin-data.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
    UI.toast('Файл экспортирован', 'ok');
  }

  function demoLoad() {
    var c = Store.counts();
    var hasData = Object.keys(c).some(function (k) { return c[k] > 0; });
    var apply = function () {
      Store.loadDemo();
      UI.toast('Демо-данные загружены', 'ok');
      App.refresh();
    };
    if (hasData) {
      UI.confirm({
        title: 'Загрузить демо-данные?',
        text: 'Текущие данные будут заменены демонстрационным набором: категории, крепления, объекты с массой, трюмы кораблей, баланс 3 500 000 ¤ и один купленный корабль «Челнок».',
        okLabel: 'Загрузить',
        onOk: apply
      });
    } else {
      apply();
    }
  }

  function clearAll() {
    UI.confirm({
      title: 'Очистить все данные?',
      text: 'Будут удалены все объекты, категории, свойства и слоты. Действие необратимо.',
      danger: true,
      okLabel: 'Удалить всё',
      onOk: function () {
        Store.clearAll();
        UI.toast('Все данные удалены', 'ok');
        App.refresh();
      }
    });
  }

  function render(root) {
    var c = Store.counts();

    root.appendChild(UI.pageHead({
      title: 'Админка',
      subtitle: 'Обзор базы Galaxy Admin. Все данные хранятся локально, в этом браузере.'
    }));

    root.appendChild(h('div', { class: 'stats' },
      statCard('Корабли', groupCount('ships'), '#/objects/ships'),
      statCard('Оборудование', groupCount('equipment'), '#/objects/equipment'),
      statCard('Ресурсы', groupCount('resources'), '#/objects/resources'),
      statCard('Категории', c.categories, '#/categories'),
      statCard('Свойства', c.props, '#/props'),
      statCard('Слоты', c.slots, '#/slots')
    ));

    root.appendChild(h('div', { class: 'card panel' },
      h('h2', { class: 'panel-title', text: 'С чего начать' }),
      h('ol', { class: 'steps' },
        h('li', {}, 'Создайте ', link('#/props', 'свойства'), ' — они понадобятся категориям.'),
        h('li', {}, 'Создайте ', link('#/slots', 'слоты'), ' — кораблям они назначаются как собственные, а предметы в них вставляются.'),
        h('li', {}, 'Опишите ', link('#/categories', 'категории'), ' — дерево категорий задаёт наборы свойств.'),
        h('li', {}, 'Добавьте ', link('#/objects/ships', 'корабли'), ', ', link('#/objects/equipment', 'оборудование'), ' или ', link('#/objects/resources', 'ресурсы'), ' — каждая группа редактируется на своей странице.')
      )
    ));

    var fileInput = h('input', { type: 'file', accept: '.json,application/json' });
    fileInput.hidden = true;
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.importJSON(String(reader.result));
          UI.toast('Данные импортированы', 'ok');
          App.refresh();
        } catch (e) {
          UI.toast('Не удалось импортировать: ' + e.message, 'err');
        }
        fileInput.value = '';
      };
      reader.onerror = function () {
        UI.toast('Не удалось прочитать файл', 'err');
        fileInput.value = '';
      };
      reader.readAsText(f);
    });

    root.appendChild(h('div', { class: 'card panel' },
      h('h2', { class: 'panel-title', text: 'Данные' }),
      h('p', { class: 'panel-sub', text: 'Экспорт и импорт сохраняют всю базу одним JSON-файлом. Демо-набор — быстрый способ посмотреть категории, слоты с вместимостью и объекты с массой: баланс 3 500 000 ¤ и один купленный корабль.' }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-primary', text: 'Экспорт JSON', onclick: exportData }),
        h('button', {
          class: 'btn',
          text: 'Импорт JSON',
          onclick: function () {
            UI.confirm({
              title: 'Импорт данных',
              text: 'Импорт заменит все текущие данные содержимым выбранного файла. Продолжить?',
              okLabel: 'Выбрать файл',
              onOk: function () { fileInput.click(); }
            });
          }
        }),
        h('button', { class: 'btn', text: 'Загрузить демо-данные', onclick: demoLoad }),
        h('button', { class: 'btn btn-danger', text: 'Очистить всё', onclick: clearAll })
      ),
      fileInput
    ));
  }

  window.Pages.home = { render: render };
})();
