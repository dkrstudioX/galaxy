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
      subtitle: 'Категория задаёт список свойств кораблей. Категории вкладываются друг в друга: например, «Корабли» → «Линкоры», «Шатлы».',
      empty: 'Пока нет категорий кораблей. Например: «Корабли» → «Линкоры», «Шатлы».',
      placeholder: 'Например: Линкоры'
    },
    goods: {
      title: 'Категории товаров',
      subtitle: 'Категория задаёт список свойств товаров. Категории вкладываются друг в друга: например, «Оборудование» → «Оружие», «Щиты».',
      empty: 'Пока нет категорий товаров. Например: «Ресурсы» → «Материалы», «Топливо».',
      placeholder: 'Например: Материалы'
    }
  };

  /* Свёрнутые ветки дерева: id → true. По умолчанию дерево развёрнуто целиком. */
  var collapsedCats = {};

  /* Селект категорий: вложенные подписаны полным путём («Корабли / Линкоры»). */
  function categoryOptions(type, emptyLabel, excluded) {
    var options = [{ value: '', label: emptyLabel }];
    Store.categoryTree(type).forEach(function (node) {
      if (excluded && excluded[node.cat.id]) return;
      options.push({
        value: node.cat.id,
        label: node.depth ? Store.categoryPath(node.cat.id) : node.cat.name
      });
    });
    return options;
  }

  function treeNameCell(row) {
    var toggle;
    if (row.hasChildren) {
      var isCollapsed = !!collapsedCats[row.cat.id];
      toggle = h('button', {
        class: 'tree-toggle',
        text: isCollapsed ? '\u25B8' : '\u25BE',
        title: isCollapsed ? 'Показать подкатегории' : 'Скрыть подкатегории',
        onclick: function () {
          if (isCollapsed) delete collapsedCats[row.cat.id];
          else collapsedCats[row.cat.id] = true;
          App.refresh();
        }
      });
    } else {
      toggle = h('span', { class: 'tree-toggle tree-toggle-empty' });
    }
    return h('div', { class: 'tree-cell' },
      h('span', { class: 'tree-indent', style: 'width:' + (row.depth * 22) + 'px' }),
      toggle,
      h('span', { class: 'cell-main', text: row.cat.name })
    );
  }

  /* Собственные свойства — обычными метками, унаследованные от родителей — пунктирными. */
  function propsCell(cat) {
    var own = cat.propIds.map(function (id) { return Store.byId('props', id); }).filter(Boolean);
    var inherited = Store.inheritedProps(cat.id);
    if (!own.length && !inherited.length) return h('span', { class: 'muted', text: '—' });
    return h('div', { class: 'prop-chips' },
      own.map(function (p) { return h('span', { class: 'prop-chip', text: p.name }); }),
      inherited.map(function (item) {
        return h('span', {
          class: 'prop-chip prop-chip-inherited',
          text: item.prop.name,
          title: 'Унаследовано от «' + item.from.name + '»'
        });
      })
    );
  }

  function renderCategories(root, type) {
    var meta = CATEGORY_META[type];

    root.appendChild(UI.pageHead({
      title: meta.title,
      subtitle: meta.subtitle,
      addLabel: 'Добавить категорию',
      onAdd: function () { openCategoryModal(type, null, ''); }
    }));

    if (!Store.categoryTree(type).length) {
      root.appendChild(UI.emptyState({
        text: meta.empty,
        addLabel: 'Добавить категорию',
        onAdd: function () { openCategoryModal(type, null, ''); }
      }));
      return;
    }

    /* В таблицу попадают только видимые строки: содержимое свёрнутых веток скрыто. */
    var rows = [];
    (function collect(parentId, depth) {
      Store.childCategories(type, parentId).forEach(function (cat) {
        var kids = Store.childCategories(type, cat.id);
        rows.push({ cat: cat, depth: depth, hasChildren: kids.length > 0, childCount: kids.length });
        if (kids.length && !collapsedCats[cat.id]) collect(cat.id, depth + 1);
      });
    })('', 0);

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: treeNameCell },
        { title: 'Свойства', render: function (row) { return propsCell(row.cat); } },
        {
          title: 'Подкатегории',
          render: function (row) {
            return h('span', { class: row.childCount ? '' : 'muted', text: row.childCount ? String(row.childCount) : '—' });
          }
        }
      ],
      rows: rows,
      actions: function (row) {
        return [
          h('button', {
            class: 'btn btn-sm',
            text: 'Подкатегория',
            title: 'Создать вложенную категорию',
            onclick: function () { openCategoryModal(type, null, row.cat.id); }
          })
        ].concat(UI.editDelete(
          function () { openCategoryModal(type, row.cat, ''); },
          function () { deleteCategory(row.cat); }
        ));
      }
    }));

    root.appendChild(h('div', {
      class: 'hint',
      text: 'Подкатегория наследует свойства родительской категории. Стрелка слева сворачивает ветку, кнопка «Подкатегория» создаёт вложенную категорию внутри строки.'
    }));
  }

  function openCategoryModal(type, existing, parentId) {
    var isEdit = !!existing;
    var meta = CATEGORY_META[type];

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: meta.placeholder });

    /* Родителем может стать любая категория того же типа, кроме самой категории и её подкатегорий. */
    var excluded = {};
    if (isEdit) {
      excluded[existing.id] = true;
      Store.categoryDescendants(existing.id).forEach(function (c) { excluded[c.id] = true; });
    }
    var initialParent = isEdit ? (existing.parentId || '') : (parentId || '');
    var parentSelect = UI.select({
      options: categoryOptions(type, '— корневая категория —', excluded),
      value: excluded[initialParent] ? '' : initialParent
    });
    var parentHint = h('div', { class: 'hint' });

    /* Отметки собственных свойств — единственный источник правды: список
       перерисовывается при смене родителя, а выбор пользователя сохраняется. */
    var ownChecked = {};
    if (isEdit) existing.propIds.forEach(function (id) { ownChecked[id] = true; });

    var listHost = h('div');
    var listHint = h('div', { class: 'hint' });

    function renderList() {
      UI.clear(listHost);
      var parent = parentSelect.value ? Store.byId('categories', parentSelect.value) : null;
      parentHint.textContent = parent
        ? 'Категория станет подкатегорией «' + parent.name + '» и унаследует её свойства.'
        : 'Категория верхнего уровня: свойства родителей не подключаются.';

      var props = Store.props();
      if (!props.length) {
        listHost.appendChild(h('div', { class: 'hint-box', text: 'Свойств пока нет. Сначала создайте их на странице «Свойства».' }));
        listHint.textContent = '';
        return;
      }

      var inherited = parentSelect.value ? Store.chainProps(parentSelect.value) : [];
      var inheritedIds = {};
      inherited.forEach(function (item) { inheritedIds[item.prop.id] = true; });

      var list = h('div', { class: 'check-list' });
      inherited.forEach(function (item) {
        var row = UI.checkRow(item.prop.name, true, h('span', { class: 'check-side muted', text: 'от «' + item.from.name + '»' }));
        row.input.disabled = true;
        list.appendChild(row.el);
      });
      props.forEach(function (p) {
        if (inheritedIds[p.id]) return;
        var row = UI.checkRow(p.name, !!ownChecked[p.id], h('span', { class: 'check-side muted', text: p.value || '—' }));
        row.input.addEventListener('change', function () {
          if (row.input.checked) ownChecked[p.id] = true;
          else delete ownChecked[p.id];
        });
        list.appendChild(row.el);
      });
      listHost.appendChild(list);

      listHint.textContent = inherited.length
        ? 'Свойства родительских категорий отмечены и не правятся здесь: чтобы убрать их, измените родительскую категорию.'
        : 'Отмеченные свойства появляются в форме объекта этой категории.';
    }

    parentSelect.addEventListener('change', renderList);
    renderList();

    var body = h('div', {},
      UI.field('Название', nameInput),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Родительская категория' }),
        parentSelect,
        parentHint
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        listHost,
        listHint
      )
    );

    UI.modal({
      title: isEdit ? 'Изменить категорию' : (initialParent ? 'Новая подкатегория' : 'Новая категория'),
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название категории.';
        if (Store.categoryNameTaken(type, name, parentSelect.value, isEdit ? existing.id : null)) {
          return 'В этой ветке уже есть категория с таким названием.';
        }
        var propIds = Store.props().filter(function (p) { return ownChecked[p.id]; }).map(function (p) { return p.id; });
        if (isEdit) {
          Store.patch('categories', existing.id, { name: name, parentId: parentSelect.value || '', propIds: propIds });
          UI.toast('Категория изменена', 'ok');
        } else {
          Store.createCategory(type, name, propIds, parentSelect.value);
          UI.toast(parentSelect.value ? 'Подкатегория добавлена' : 'Категория добавлена', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  function deleteCategory(c) {
    var kids = Store.childCategories(c.type, c.id);
    if (kids.length) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'У категории «' + c.name + '» есть подкатегории: ' + kids.map(function (k) { return k.name; }).join(', ') +
          '. Сначала удалите их или перенесите в другую ветку.'
      });
      return;
    }
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
