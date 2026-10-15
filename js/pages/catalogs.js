/* Страницы-справочники: «Свойства», «Слоты» и «Категории» (корабли/товары). */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* ================= Свойства ================= */

  function renderProps(root) {
    root.appendChild(UI.pageHead({
      title: 'Свойства',
      subtitle: 'Справочник свойств: название и значение по умолчанию.',
      addLabel: 'Добавить свойство',
      onAdd: function () { openPropModal(null); }
    }));

    var items = Store.props();
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: 'Пока нет ни одного свойства. Свойства включаются в категории, а затем заполняются у объектов.',
        addLabel: 'Добавить свойство',
        onAdd: function () { openPropModal(null); }
      }));
      return;
    }

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: function (p) { return h('span', { class: 'cell-main', text: p.name }); } },
        { title: 'Значение', render: function (p) { return h('span', { class: p.value ? '' : 'muted', text: p.value || '—' }); } }
      ],
      rows: items,
      actions: function (p) {
        return UI.editDelete(
          function () { openPropModal(p); },
          function () { deleteProp(p); }
        );
      }
    }));
  }

  function openPropModal(existing) {
    var nameInput = UI.input({ value: existing ? existing.name : '', placeholder: 'Например: Прочность' });
    var valueInput = UI.input({ value: existing ? existing.value : '', placeholder: 'Например: 100' });

    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Значение', valueInput, 'Значение по умолчанию: подставляется в объекты, где его можно изменить.')
    );

    UI.modal({
      title: existing ? 'Изменить свойство' : 'Новое свойство',
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название свойства.';
        if (Store.nameTaken('props', name, existing ? existing.id : null)) return 'Свойство с таким названием уже есть.';
        var value = valueInput.value.trim();
        if (existing) {
          Store.patch('props', existing.id, { name: name, value: value });
          UI.toast('Свойство изменено', 'ok');
        } else {
          Store.createProp(name, value);
          UI.toast('Свойство добавлено', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  function deleteProp(p) {
    var used = Store.propUsage(p.id);
    if (used.length) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'Свойство «' + p.name + '» используется в категориях: ' + used.join(', ') + '. Сначала уберите его из этих категорий.'
      });
      return;
    }
    UI.confirm({
      title: 'Удалить свойство?',
      text: '«' + p.name + '» будет удалено без возможности восстановления.',
      danger: true,
      onOk: function () {
        Store.drop('props', p.id);
        UI.toast('Свойство удалено', 'ok');
        App.refresh();
      }
    });
  }

  /* ================= Слоты ================= */

  function renderSlots(root) {
    root.appendChild(UI.pageHead({
      title: 'Слоты',
      subtitle: 'Справочник слотов: слоты назначаются кораблям, вместимость ограничивает массу их содержимого.',
      addLabel: 'Добавить слот',
      onAdd: function () { openSlotModal(null); }
    }));

    var items = Store.slots();
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: 'Пока нет ни одного слота. Например: «Оружие», «Двигатель», «Щит».',
        addLabel: 'Добавить слот',
        onAdd: function () { openSlotModal(null); }
      }));
      return;
    }

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: function (s) { return h('span', { class: 'cell-main', text: s.name }); } },
        {
          title: 'Вместимость',
          render: function (s) {
            var cap = Store.slotCapacity(s);
            return h('span', { class: isFinite(cap) ? '' : 'muted', text: isFinite(cap) ? Store.fmtNum(cap) + ' кг' : '∞' });
          }
        }
      ],
      rows: items,
      actions: function (s) {
        return UI.editDelete(
          function () { openSlotModal(s); },
          function () { deleteSlot(s); }
        );
      }
    }));
  }

  function openSlotModal(existing) {
    var nameInput = UI.input({ value: existing ? existing.name : '', placeholder: 'Например: Оружие' });
    var capInput = UI.input({
      type: 'number', min: 0, step: 'any',
      value: existing ? existing.capacity : '',
      placeholder: 'Без ограничения'
    });
    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Вместимость, кг', capInput, 'Сколько массы содержимого помещается в слот корабля. Пусто — без ограничения.')
    );

    UI.modal({
      title: existing ? 'Изменить слот' : 'Новый слот',
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название слота.';
        if (Store.nameTaken('slots', name, existing ? existing.id : null)) return 'Слот с таким названием уже есть.';
        var capacity = capInput.value.trim();
        if (existing) {
          Store.patch('slots', existing.id, { name: name, capacity: capacity });
          UI.toast('Слот изменён', 'ok');
        } else {
          Store.createSlot(name, capacity);
          UI.toast('Слот добавлен', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  function deleteSlot(s) {
    var u = Store.slotUsage(s.id);
    var used = [];
    u.ships.forEach(function (n) { used.push('корабль «' + n + '»'); });
    u.goods.forEach(function (n) { used.push('товар «' + n + '»'); });
    if (used.length) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'Слот «' + s.name + '» используется: ' + used.join(', ') + '. Сначала уберите его у этих записей.'
      });
      return;
    }
    UI.confirm({
      title: 'Удалить слот?',
      text: '«' + s.name + '» будет удалён без возможности восстановления.',
      danger: true,
      onOk: function () {
        Store.drop('slots', s.id);
        UI.toast('Слот удалён', 'ok');
        App.refresh();
      }
    });
  }

  /* ================= Категории ================= */

  var CATEGORY_META = {
    ship: {
      title: 'Категории кораблей',
      subtitle: 'Категория задаёт список свойств, которые заполняются у кораблей.',
      empty: 'Пока нет категорий кораблей. Например: «Фрегат», «Крейсер».',
      placeholder: 'Например: Фрегат'
    },
    goods: {
      title: 'Категории товаров',
      subtitle: 'Категория задаёт список свойств, которые заполняются у товаров.',
      empty: 'Пока нет категорий товаров. Например: «Металлы», «Оружие», «Двигатели».',
      placeholder: 'Например: Металлы'
    }
  };

  function renderCategories(root, type) {
    var meta = CATEGORY_META[type];

    root.appendChild(UI.pageHead({
      title: meta.title,
      subtitle: meta.subtitle,
      addLabel: 'Добавить категорию',
      onAdd: function () { openCategoryModal(type, null); }
    }));

    var items = Store.categories(type);
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: meta.empty,
        addLabel: 'Добавить категорию',
        onAdd: function () { openCategoryModal(type, null); }
      }));
      return;
    }

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: function (c) { return h('span', { class: 'cell-main', text: c.name }); } },
        {
          title: 'Свойства',
          render: function (c) {
            var names = c.propIds.map(function (id) {
              var p = Store.byId('props', id);
              return p ? p.name : null;
            }).filter(Boolean);
            return h('span', { class: names.length ? '' : 'muted', text: names.length ? names.join(', ') : '—' });
          }
        }
      ],
      rows: items,
      actions: function (c) {
        return UI.editDelete(
          function () { openCategoryModal(type, c); },
          function () { deleteCategory(c); }
        );
      }
    }));
  }

  function openCategoryModal(type, existing) {
    var props = Store.props();
    var meta = CATEGORY_META[type];
    var nameInput = UI.input({ value: existing ? existing.name : '', placeholder: meta.placeholder });

    var checks = [];
    var listBox;
    if (props.length) {
      listBox = h('div', { class: 'check-list' }, props.map(function (p) {
        var row = UI.checkRow(
          p.name,
          existing ? existing.propIds.indexOf(p.id) > -1 : false,
          h('span', { class: 'check-side muted', text: p.value || '—' })
        );
        checks.push({ id: p.id, input: row.input });
        return row.el;
      }));
    } else {
      listBox = h('div', { class: 'hint-box', text: 'Свойств пока нет. Сначала создайте их на странице «Свойства».' });
    }

    var body = h('div', {},
      UI.field('Название', nameInput),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        listBox,
        h('div', { class: 'hint', text: 'Отмеченные свойства появляются в форме объекта этой категории.' })
      )
    );

    UI.modal({
      title: existing ? 'Изменить категорию' : 'Новая категория',
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название категории.';
        if (Store.nameTaken('categories', name, existing ? existing.id : null, type)) return 'Категория с таким названием уже есть.';
        var propIds = checks.filter(function (c) { return c.input.checked; }).map(function (c) { return c.id; });
        if (existing) {
          Store.patch('categories', existing.id, { name: name, propIds: propIds });
          UI.toast('Категория изменена', 'ok');
        } else {
          Store.createCategory(type, name, propIds);
          UI.toast('Категория добавлена', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  function deleteCategory(c) {
    var used = Store.categoryUsage(c.id);
    if (used.length) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'Категория «' + c.name + '» используется в объектах: ' + used.join(', ') + '. Сначала удалите или переназначьте их.'
      });
      return;
    }
    UI.confirm({
      title: 'Удалить категорию?',
      text: '«' + c.name + '» будет удалена без возможности восстановления.',
      danger: true,
      onOk: function () {
        Store.drop('categories', c.id);
        UI.toast('Категория удалена', 'ok');
        App.refresh();
      }
    });
  }

  /* ================= Экспорт страниц ================= */

  window.Pages.props = { render: renderProps };
  window.Pages.slots = { render: renderSlots };
  window.Pages.catShip = { render: function (root) { renderCategories(root, 'ship'); } };
  window.Pages.catGoods = { render: function (root) { renderCategories(root, 'goods'); } };
})();
