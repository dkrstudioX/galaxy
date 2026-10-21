/* Страницы-справочники: «Свойства», «Слоты» и «Категории» (три группы). */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* ================= Свойства ================= */

  function renderProps(root) {
    root.appendChild(UI.pageHead({
      title: 'Свойства',
      subtitle: 'Справочник свойств: название и значение по умолчанию. Свойство «Масса» (или «Вес») используется для расчёта вместимости слотов.',
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
      subtitle: 'Справочник креплений: слот принимает только совместимое оборудование (тот же тип крепления). Вместимость — в килограммах. Трюмы задаются у корабля, а не здесь.',
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
      UI.field('Вместимость, кг', capInput, 'Сколько массы содержимого помещается в слот корабля. Пусто — без ограничения.'),
      h('div', {
        class: 'hint',
        text: 'Крепление принимает только оборудование, у которого выбран этот же слот. Трюмы задаются у корабля на странице «Объекты».'
      })
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
          Store.patch('slots', existing.id, { name: name, capacity: capacity, kind: 'mount' });
          UI.toast('Слот изменён', 'ok');
        } else {
          Store.createSlot(name, capacity, 'mount');
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
    u.contains.forEach(function (n) { used.push('у объекта «' + n + '» есть такой слот'); });
    u.fits.forEach(function (n) { used.push('объект «' + n + '» вставляется в него'); });
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
    ships: {
      title: 'Категории кораблей',
      subtitle: 'Классы кораблей и их свойства. Корень «Корабли» — постоянная группа каталога.',
      empty: 'Пока нет категорий кораблей. Например: «Линкоры», «Фрегаты».',
      placeholder: 'Например: Линкоры'
    },
    resources: {
      title: 'Категории ресурсов',
      subtitle: 'Материалы и топливо. Корень «Ресурсы» — постоянная группа каталога.',
      empty: 'Пока нет категорий ресурсов. Например: «Материалы», «Топливо».',
      placeholder: 'Например: Материалы'
    },
    equipment: {
      title: 'Категории оборудования',
      subtitle: 'Категории оборудования и их свойства. Корень «Оборудование» — постоянная группа каталога.',
      empty: 'Пока нет категорий оборудования. Например: «Лазеры», «Щиты».',
      placeholder: 'Например: Лазеры'
    }
  };

  /* Свёрнутые ветки дерева: id → true. По умолчанию дерево развёрнуто целиком. */
  var collapsedCats = {};

  /* Селект родителей внутри одной группы: корень и его поддерево.
     Вложенные подписаны полным путём («Корабли / Линкоры»). */
  function groupCategoryOptions(group, excluded) {
    var options = [];
    (function walk(cat, depth) {
      if (excluded && excluded[cat.id]) return;
      options.push({ value: cat.id, label: depth ? Store.categoryPath(cat.id) : cat.name });
      Store.childCategories(cat.id).forEach(function (c) { walk(c, depth + 1); });
    })(group.root, 0);
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
    var chips = [];
    if (row.cat.isShip) {
      chips.push(h('span', { class: 'type-chip type-chip-ship', text: 'корабль' }));
    } else if (Store.categoryIsShip(row.cat.id)) {
      var from = Store.categoryChain(row.cat.id).filter(function (c) { return c.isShip; })[0];
      chips.push(h('span', { class: 'type-chip', text: 'корабль', title: 'Унаследовано от «' + from.name + '»' }));
    }
    var mark = h('span', { class: 'obj-icon' });
    mark.innerHTML = Icons.svg(row.cat.icon || Icons.forCategory(row.cat.name), 18);
    return h('div', { class: 'tree-cell' },
      h('span', { class: 'tree-indent', style: 'width:' + (row.depth * 22) + 'px' }),
      toggle,
      mark,
      h('span', { class: 'cell-main', text: row.cat.name }),
      chips
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

  function renderCategories(root, route) {
    var key = route && route.group ? route.group : 'ships';
    var meta = CATEGORY_META[key] || CATEGORY_META.ships;
    var groups = Store.catalogGroups();
    var group = groups[key] || null;

    root.appendChild(UI.pageHead({
      title: meta.title,
      subtitle: meta.subtitle,
      addLabel: 'Добавить категорию',
      onAdd: function () {
        if (group) openCategoryModal(null, group.root.id, key);
      }
    }));

    if (!group) {
      root.appendChild(UI.emptyState({
        text: meta.empty
      }));
      return;
    }

    /* В таблицу попадают только видимые строки выбранной группы:
       корень и его поддерево, содержимое свёрнутых веток скрыто. */
    var rows = [];
    (function collect(cat, depth) {
      var kids = Store.childCategories(cat.id);
      rows.push({ cat: cat, depth: depth, hasChildren: kids.length > 0, childCount: kids.length });
      if (kids.length && !collapsedCats[cat.id]) {
        kids.forEach(function (kid) { collect(kid, depth + 1); });
      }
    })(group.root, 0);

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
            onclick: function () { openCategoryModal(null, row.cat.id, group.key); }
          })
        ].concat(UI.editDelete(
          function () { openCategoryModal(row.cat, '', group.key); },
          function () { deleteCategory(row.cat, group); }
        ));
      }
    }));

    root.appendChild(h('div', {
      class: 'hint',
      text: 'Подкатегория наследует свойства и тип своей группы. Стрелка слева сворачивает ветку, кнопка «Подкатегория» создаёт вложенную категорию внутри строки.'
    }));
  }

  function openCategoryModal(existing, parentId, groupKey) {
    var isEdit = !!existing;
    var groups = Store.catalogGroups();
    var key = groups[groupKey] ? groupKey : 'ships';
    var meta = CATEGORY_META[key] || CATEGORY_META.ships;
    var group = groups[key];
    if (!group) {
      UI.alert({ title: 'Нет группы', text: 'Не удалось определить группу категории. Обновите страницу.' });
      return;
    }
    var isRoot = isEdit && existing.id === group.root.id;

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: meta.placeholder });
    if (isRoot) nameInput.disabled = true;

    /* Родителем может стать категория внутри этой же группы, кроме самой
       категории и её подкатегорий. Корень группы не переносится. */
    var excluded = {};
    if (isEdit) {
      excluded[existing.id] = true;
      Store.categoryDescendants(existing.id).forEach(function (c) { excluded[c.id] = true; });
    }
    var initialParent = isEdit ? (existing.parentId || '') : (parentId || group.root.id);
    var parentSelect;
    if (isRoot) {
      parentSelect = UI.select({ options: [{ value: '', label: '— корневая категория —' }], value: '' });
      parentSelect.disabled = true;
    } else {
      var options = groupCategoryOptions(group, excluded);
      var valid = options.some(function (o) { return o.value === initialParent; });
      parentSelect = UI.select({ options: options, value: valid ? initialParent : group.root.id });
    }
    var parentHint = h('div', { class: 'hint' });
    var typeHint = h('div', {
      class: 'hint',
      text: key === 'ships'
        ? 'Тип «корабль» задаётся группой «Корабли»; подкатегории наследуют его.'
        : 'Тип категории задаётся группой «' + group.title + '»; подкатегории наследуют его.'
    });

    /* Иконка категории — из того же каталога, что и у объектов. */
    var iconField = UI.iconPicker(isEdit ? existing.icon : '');

    /* Отметки собственных свойств — единственный источник правды: список
       перерисовывается при смене родителя, а выбор пользователя сохраняется. */
    var ownChecked = {};
    if (isEdit) existing.propIds.forEach(function (id) { ownChecked[id] = true; });

    var listHost = h('div');
    var listHint = h('div', { class: 'hint' });

    function renderList() {
      UI.clear(listHost);
      var parent = parentSelect.value ? Store.byId('categories', parentSelect.value) : null;
      parentHint.textContent = isRoot
        ? 'Корневая категория группы «' + group.title + '»: имя и родитель фиксированы.'
        : (parent
          ? 'Категория станет подкатегорией «' + parent.name + '» и унаследует её свойства.'
          : 'Выберите родительскую категорию внутри группы.');

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
        h('label', { class: 'field-label', text: 'Иконка' }),
        iconField.el
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Родительская категория' }),
        parentSelect,
        parentHint,
        typeHint
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
        var name = isRoot ? existing.name : nameInput.value.trim();
        if (!name) return 'Укажите название категории.';
        var parentValue = isRoot ? '' : (parentSelect.value || '');
        if (!isRoot && !parentValue) return 'Выберите родительскую категорию.';
        if (Store.categoryNameTaken(name, parentValue, isEdit ? existing.id : null)) {
          return 'В этой ветке уже есть категория с таким названием.';
        }
        var propIds = Store.props().filter(function (p) { return ownChecked[p.id]; }).map(function (p) { return p.id; });
        var isShip = isRoot ? key === 'ships' : false;
        if (isEdit) {
          Store.patch('categories', existing.id, {
            name: name,
            parentId: parentValue,
            propIds: propIds,
            isShip: isShip,
            icon: iconField.value()
          });
          UI.toast('Категория изменена', 'ok');
        } else {
          Store.createCategory(name, propIds, parentValue, isShip, iconField.value());
          UI.toast('Подкатегория добавлена', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  function deleteCategory(c, group) {
    if (group && c.id === group.root.id) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'Корневую категорию «' + c.name + '» удалить нельзя: это постоянная группа каталога.'
      });
      return;
    }
    var kids = Store.childCategories(c.id);
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
  window.Pages.categories = { render: renderCategories };
})();
