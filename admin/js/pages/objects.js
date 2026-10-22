/* Страница «Объекты»: корабли и предметы в одной коллекции.
   Корабль имеет собственные слоты, предмет вставляется в подходящий слот или в любой. */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* Отдельные страницы каталога: один и тот же редактор объектов,
     но с фиксированной веткой категорий и своим набором колонок. */
  var GROUPS = {
    ships: {
      title: 'Корабли',
      addLabel: 'Добавить корабль',
      newTitle: 'Новый корабль',
      editTitle: 'Изменить корабль',
      allLabel: 'Все корабли',
      empty: 'Пока нет ни одного корабля. Например: «Челнок».',
      subtitle: 'Корабли каталога: крепления, трюмы, масса и цены. Справа — только корабли выбранной ветки.'
    },
    equipment: {
      title: 'Оборудование',
      addLabel: 'Добавить оборудование',
      newTitle: 'Новое оборудование',
      editTitle: 'Изменить оборудование',
      allLabel: 'Всё оборудование',
      empty: 'Пока нет оборудования. Например: «Лазер M-1».',
      subtitle: 'Оборудование каталога: масса, совместимый слот, материалы prop_2 и цены.'
    },
    resources: {
      title: 'Ресурсы',
      addLabel: 'Добавить ресурс',
      newTitle: 'Новый ресурс',
      editTitle: 'Изменить ресурс',
      allLabel: 'Все ресурсы',
      empty: 'Пока нет ресурсов. Например: «Железо».',
      subtitle: 'Ресурсы каталога: цена за килограмм. У ресурсов нет массы, слота и prop_2.'
    }
  };

  function groupMeta(key) { return key ? GROUPS[key] || null : null; }

  function catalogGroup(key) {
    return key ? Store.catalogGroups()[key] || null : null;
  }

  /* ---------- Общие части форм ---------- */

  /* Каждый предмет — отдельная запись: количество разворачивается в строки
     с qty = 1, чтобы одинаковые предметы не хранились стопкой. */
  function spreadContents(rows, idOf, qtyOf) {
    var out = [];
    (rows || []).forEach(function (r) {
      var id = idOf(r);
      if (!id) return;
      var n = Math.max(1, parseInt(qtyOf(r), 10) || 1);
      for (var i = 0; i < n; i++) out.push({ itemId: id, qty: '1' });
    });
    return out;
  }

  /* В объекте выбирается только подкатегория (2-й уровень): она задаёт ветку.
     Для страницы группы показываем только категории этой группы. */
  function categoryOptions(emptyLabel, group) {
    var allowed = null;
    if (group) {
      allowed = {};
      allowed[group.root.id] = true;
      Store.categoryDescendants(group.root.id).forEach(function (c) { allowed[c.id] = true; });
    }
    return [{ value: '', label: emptyLabel }].concat(
      Store.categoryTree()
        .filter(function (node) {
          return node.cat.parentId && (!allowed || allowed[node.cat.id]);
        })
        .map(function (node) { return { value: node.cat.id, label: Store.categoryPath(node.cat.id) }; })
    );
  }

  /* `prop_2` — материалы объекта: у грузового отсека — что принимает,
     у добывающего оборудования — что добывает. «0» — не задано (у ресурсов
     всегда 0). Варианты — названия ресурсов каталога. */
  function prop2Picker(selected) {
    var values = (selected || []).slice();
    var chips = {};
    var el = h('div', { class: 'prop2-picker' });

    function refresh() {
      Object.keys(chips).forEach(function (key) {
        chips[key].classList.toggle('active', key === '0' ? !values.length : values.indexOf(key) > -1);
      });
    }

    function addChip(key, label) {
      var btn = h('button', {
        type: 'button', class: 'prop2-chip', text: label,
        onclick: function () {
          if (key === '0') { values = []; refresh(); return; }
          var i = values.indexOf(key);
          if (i > -1) values.splice(i, 1); else values.push(key);
          refresh();
        }
      });
      chips[key] = btn;
      el.appendChild(btn);
    }

    addChip('0', '0');
    Store.resourceObjects().map(function (o) { return o.name; })
      .filter(function (name, i, list) { return list.indexOf(name) === i; })
      .forEach(function (name) { addChip(name, name); });

    refresh();
    return { el: el, value: function () { return values.slice(); } };
  }

  /* Блок полей «свойства категории»: для каждого свойства категории (своё или
     унаследованное от родительской) — поле значения. Значение подставляется из
     свойства (значение по умолчанию), его можно изменить. */
  function categoryPropsBlock(categoryId, values) {
    var inputs = {};
    var box = h('div');
    var cat = categoryId ? Store.byId('categories', categoryId) : null;

    if (!cat) {
      box.appendChild(h('div', { class: 'hint-box', text: 'Выберите категорию — здесь появятся её свойства.' }));
      return { box: box, inputs: inputs };
    }

    var props = Store.categoryProps(cat.id);
    if (!props.length) {
      box.appendChild(h('div', { class: 'hint-box', text: 'У этой категории нет свойств — ни своих, ни унаследованных. Их можно включить на странице «Категории».' }));
      return { box: box, inputs: inputs };
    }

    props.forEach(function (p) {
      var current = values && values[p.id] !== undefined ? values[p.id] : (p.value || '');
      var inp = UI.input({ value: current, placeholder: 'Значение' });
      inputs[p.id] = inp;
      box.appendChild(UI.field(p.name, inp));
    });

    var inherited = Store.inheritedProps(cat.id);
    if (inherited.length) {
      box.appendChild(h('div', {
        class: 'hint',
        text: 'Часть свойств унаследована: ' + inherited.map(function (it) {
          return '«' + it.prop.name + '» от «' + it.from.name + '»';
        }).join(', ') + '.'
      }));
    }
    if (!Store.massProp() || props.indexOf(Store.massProp()) === -1) {
      box.appendChild(h('div', {
        class: 'hint',
        text: 'В этой категории нет свойства «Масса» — каждая единица объекта займёт одну единицу груза.'
      }));
    }
    return { box: box, inputs: inputs };
  }

  function snapshotInputs(inputs) {
    var out = {};
    Object.keys(inputs).forEach(function (id) { out[id] = inputs[id].value; });
    return out;
  }

  function collectInputs(inputs) {
    var out = {};
    Object.keys(inputs).forEach(function (id) { out[id] = inputs[id].value.trim(); });
    return out;
  }

  function typeChip(isShip) {
    return h('span', {
      class: 'type-chip' + (isShip ? ' type-chip-ship' : ''),
      title: isShip ? 'корабль' : 'предмет'
    }, (function () {
      var mark = document.createElement('span');
      if (window.Icons) mark.innerHTML = Icons.svg(isShip ? 'ship' : 'box', 14);
      return mark;
    })());
  }

  /* ---------- Объекты ---------- */

  /* Слева — категории, справа — объекты выбранной категории (с подкатегориями).
     Выбранная ветка запоминается отдельно для «Все объекты» и каждой группы. */
  var activeGroup = '';
  var selectedByGroup = {};
  var selectedCategory = '';

  function selectCategory(id) {
    selectedCategory = id;
    selectedByGroup[activeGroup] = id;
  }

  function categoryInGroup(categoryId, group) {
    if (!group) return true;
    return Store.categoryChain(categoryId).some(function (c) { return c.id === group.root.id; });
  }

  /* Объекты выбранной категории вместе со всеми вложенными подкатегориями
     на любую глубину (дерево не ограничено двумя уровнями). */
  function objectsIn(categoryId) {
    if (!categoryId) return Store.objects();
    var cat = Store.byId('categories', categoryId);
    if (!cat) return [];
    var ids = {};
    ids[cat.id] = true;
    Store.categoryDescendants(cat.id).forEach(function (c) { ids[c.id] = true; });
    return Store.objects().filter(function (o) { return ids[o.categoryId]; });
  }

  function categoryRow(id, label, depth, iconKey, isShip) {
    var mark = h('span', { class: 'cat-icon' });
    mark.innerHTML = Icons.svg(iconKey, 16);
    return h('button', {
      class: 'cat-item' + (selectedCategory === id ? ' active' : ''),
      title: isShip ? 'Категория кораблей' : label,
      onclick: function () { selectCategory(id); App.refresh(); }
    },
      h('span', { class: 'cat-indent', style: 'width:' + (depth * 14) + 'px' }),
      mark,
      h('span', { class: 'cat-name', text: label })
    );
  }

  function childRows(parentId, depth) {
    var rows = [];
    (function walk(pid, level) {
      Store.childCategories(pid).forEach(function (cat) {
        rows.push({ cat: cat, depth: level });
        walk(cat.id, level + 1);
      });
    })(parentId, depth);
    return rows;
  }

  /* Слева: категории выбранной группы или всё дерево на странице «Все объекты». */
  function categoryPanel(group) {
    var panel = h('aside', { class: 'card cat-panel' },
      h('div', { class: 'cat-panel-title', text: 'Категории' })
    );

    if (group) {
      var meta = groupMeta(group.key);
      panel.appendChild(categoryRow(group.root.id, meta.allLabel, 0,
        group.root.icon || Icons.forCategory(group.root.name), group.root.isShip));

      var groupRows = childRows(group.root.id, 1);
      if (!groupRows.length) {
        panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
        panel.appendChild(h('div', { class: 'cat-panel-empty', text: 'У этой группы нет подкатегорий' }));
        return panel;
      }
      panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
      groupRows.forEach(function (row) {
        panel.appendChild(categoryRow(row.cat.id, row.cat.name, row.depth,
          row.cat.icon || Icons.forCategory(row.cat.name), Store.categoryIsShip(row.cat.id)));
      });
      return panel;
    }

    panel.appendChild(categoryRow('', 'Все объекты', 0, 'grid', false));
    Store.childCategories('').forEach(function (cat) {
      panel.appendChild(categoryRow(cat.id, cat.name, 1, cat.icon || Icons.forCategory(cat.name), Store.categoryIsShip(cat.id)));
    });

    /* Подкатегории выбранной ветки — на всю глубину, с отступом по уровню. */
    var selected = selectedCategory ? Store.byId('categories', selectedCategory) : null;
    var chain = selected ? Store.categoryChain(selected.id) : [];
    var root = chain.length ? chain[0] : null;
    if (!root) return panel;

    var rows = childRows(root.id, 2);
    if (!rows.length) {
      panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
      panel.appendChild(h('div', { class: 'cat-panel-empty', text: 'У этой категории нет подкатегорий' }));
      return panel;
    }

    panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
    rows.forEach(function (row) {
      panel.appendChild(categoryRow(row.cat.id, row.cat.name, row.depth, row.cat.icon || Icons.forCategory(row.cat.name), Store.categoryIsShip(row.cat.id)));
    });
    return panel;
  }

  /* ---------- Сортировка списка ---------- */

  var sortMode = 'category';

  var SORT_OPTIONS = [
    { value: 'category', label: 'по дочерней категории' },
    { value: 'name', label: 'по названию' },
    { value: 'price', label: 'по цене' },
    { value: 'mass', label: 'по массе' }
  ];

  function cmpText(a, b) {
    return String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' });
  }

  function sortObjects(items) {
    var list = items.slice();
    list.sort(function (a, b) {
      if (sortMode === 'name') return cmpText(a.name, b.name);
      if (sortMode === 'price') return Store.priceBuy(b) - Store.priceBuy(a) || cmpText(a.name, b.name);
      if (sortMode === 'mass') return Store.massOf(b) - Store.massOf(a) || cmpText(a.name, b.name);
      /* По дочерней категории: сначала путь «Корабли / Линкоры», внутри — по имени. */
      return cmpText(Store.categoryPath(a.categoryId), Store.categoryPath(b.categoryId)) || cmpText(a.name, b.name);
    });
    return list;
  }

  function sortTools() {
    var sel = UI.select({ options: SORT_OPTIONS, value: sortMode });
    sel.addEventListener('change', function () {
      sortMode = sel.value;
      App.refresh();
    });
    return h('div', { class: 'list-tools' },
      h('span', { class: 'list-tools-label', text: 'сортировка' }),
      sel
    );
  }

  function objectColumns(groupKey) {
    var columns = [
      {
        title: 'Название',
        render: function (o) {
          var cat = Store.byId('categories', o.categoryId);
          var mark = h('span', { class: 'obj-icon' });
          mark.innerHTML = Icons.svg(o.icon || Icons.forCategory(cat ? cat.name : ''), 18);
          return h('div', { class: 'obj-name' }, mark, h('span', { class: 'cell-main', text: o.name }));
        }
      },
      {
        title: 'Категория',
        render: function (o) {
          var c = Store.byId('categories', o.categoryId);
          return h('span', { class: c ? '' : 'muted', text: c ? Store.categoryPath(c.id) : '—' });
        }
      }
    ];

    if (!groupKey) {
      columns.push({ title: 'Тип', render: function (o) { return typeChip(Store.categoryIsShip(o.categoryId)); } });
    }
    if (groupKey !== 'resources') {
      columns.push({
        title: 'Масса',
        render: function (o) {
          var m = Store.massOf(o);
          return h('span', { class: (m ? '' : 'muted') + ' nowrap', text: m ? Store.fmtNum(m) + ' кг' : '—' });
        }
      });
    }
    if (groupKey === 'equipment' || !groupKey) {
      columns.push({
        title: 'prop_2',
        render: function (o) {
          var list = o.prop2 || [];
          if (!list.length) return h('span', { class: 'muted', text: '0' });
          return h('span', { class: 'prop2-cell', text: list.join(', '), title: list.join(', ') });
        }
      });
    }

    columns.push({
      title: 'Покупка',
      render: function (o) {
        var p = Store.priceBuy(o);
        return h('span', { class: (p ? '' : 'muted') + ' nowrap', text: p ? Store.fmtNum(p) + ' ¤' : '—' });
      }
    }, {
      title: 'Продажа',
      render: function (o) {
        var p = Store.priceSale(o);
        return h('span', { class: (p ? '' : 'muted') + ' nowrap', text: p ? Store.fmtNum(p) + ' ¤' : '—' });
      }
    });

    if (groupKey !== 'resources') {
      columns.push({ title: 'Слоты', render: function (o) { return slotsSummary(o); } });
    }
    return columns;
  }

  function renderObjects(root, route) {
    var groupKey = route && route.group ? route.group : '';
    var meta = groupMeta(groupKey);
    var group = catalogGroup(groupKey);
    if (groupKey && !group) groupKey = '';

    if (activeGroup !== groupKey) {
      activeGroup = groupKey;
      selectedCategory = selectedByGroup[groupKey] || (group ? group.root.id : '');
    }

    if (selectedCategory && !Store.byId('categories', selectedCategory)) selectedCategory = '';
    if (group && selectedCategory && !categoryInGroup(selectedCategory, group)) selectedCategory = group.root.id;
    if (group && !selectedCategory) selectedCategory = group.root.id;
    selectedByGroup[groupKey] = selectedCategory;

    var current = selectedCategory ? Store.byId('categories', selectedCategory) : null;
    var addCategory = selectedCategory || (group ? group.root.id : '');
    function addObject() { openObjectModal(null, addCategory, groupKey); }

    root.appendChild(UI.pageHead({
      title: meta ? meta.title : 'Объекты',
      subtitle: meta ? meta.subtitle : 'Слева — категории первого уровня и их подкатегории, справа — объекты выбранной ветки. Объект всегда привязан к подкатегории, а тип (слоты или слот вставки) задаёт её корневая категория.',
      addLabel: meta ? meta.addLabel : 'Добавить объект',
      onAdd: addObject
    }));

    var items = sortObjects(objectsIn(selectedCategory));
    var main = h('div', { class: 'split-main' });
    main.appendChild(sortTools());

    if (!items.length) {
      var emptyText;
      if (current && !(group && current.id === group.root.id)) {
        emptyText = 'В категории «' + current.name + '» пока нет объектов — ни своих, ни в подкатегориях.';
      } else if (meta) {
        emptyText = meta.empty;
      } else if (Store.categories().length) {
        emptyText = 'Пока нет ни одного объекта. Например: корабль «Титан» или предмет «Лазер Mk I».';
      } else {
        emptyText = 'Пока нет ни одного объекта. Сначала создайте категорию — она задаст список свойств.';
      }
      main.appendChild(UI.emptyState({
        text: emptyText,
        addLabel: meta ? meta.addLabel : 'Добавить объект',
        onAdd: addObject
      }));
    } else {
      main.appendChild(UI.table({
        className: 'table-dense',
        columns: objectColumns(groupKey),
        rows: items,
        actions: function (o) {
          return UI.editDelete(
            function () { openObjectModal(o, null, groupKey); },
            function () { deleteObject(o); }
          );
        }
      }));
    }

    root.appendChild(h('div', { class: 'split' }, categoryPanel(group), main));
  }

  /* Для корабля — сводка его слотов с содержимым, для предмета — куда он вставляется. */
  function slotsSummary(o) {
    if (!Store.categoryIsShip(o.categoryId)) {
      var sl = o.slotId ? Store.byId('slots', o.slotId) : null;
      var itemText = sl ? 'слот «' + sl.name + '»' : 'любой слот';
      return h('span', { class: (sl ? '' : 'muted') + ' slots-cell', text: itemText, title: itemText });
    }
    function namesOf(contents) {
      return contents.map(function (c) {
        var it = Store.byId('objects', c.itemId);
        if (!it) return null;
        var n = parseInt(c.qty, 10) || 1;
        return it.name + (n > 1 ? ' ×' + n : '');
      }).filter(Boolean);
    }
    var parts = (o.slots || []).map(function (e) {
      var slot = Store.byId('slots', e.slotId);
      if (!slot) return null;
      var names = namesOf(e.contents);
      return names.length ? slot.name + ' (' + names.join(', ') + ')' : slot.name;
    }).filter(Boolean);
    (o.holds || []).forEach(function (hd) {
      var names = namesOf(hd.contents);
      parts.push('трюм «' + hd.name + '» ' + Store.fmtNum(Store.contentsMass(hd.contents)) + '/' +
        Store.fmtNum(Store.holdCapacity(hd)) + ' кг' + (names.length ? ' (' + names.join(', ') + ')' : ''));
    });
    var text = parts.join(', ');
    return h('span', { class: (parts.length ? '' : 'muted') + ' slots-cell', text: parts.length ? text : '—', title: text });
  }

  function deleteObject(o) {
    var used = Store.objectUsage(o.id);
    if (used.length) {
      UI.alert({
        title: 'Нельзя удалить',
        text: 'Объект «' + o.name + '» лежит в слотах: ' + used.join(', ') + '. Сначала уберите его оттуда.'
      });
      return;
    }
    UI.confirm({
      title: 'Удалить объект?',
      text: '«' + o.name + '» будет удалён без возможности восстановления.',
      danger: true,
      onOk: function () {
        Store.drop('objects', o.id);
        UI.toast('Объект удалён', 'ok');
        App.refresh();
      }
    });
  }

  /* Предметы, подходящие в крепление: оборудование со своим слотом (тот же slotId). */
  function compatibleItems(slotId, excludeId) {
    return Store.objects().filter(function (it) {
      if (it.id === excludeId) return false;
      if (Store.categoryIsShip(it.categoryId)) return false;
      return it.slotId === slotId;
    });
  }

  function itemLabel(it) {
    var m = Store.massOf(it);
    return it.name + (m ? ' (' + Store.fmtNum(m) + ' кг)' : '');
  }

  /* Редактор слотов объекта: одинаковые слоты можно добавлять сколько угодно,
     порядок меняется перетаскиванием за ручку или кнопками ↑ ↓.
     У каждого слота — содержимое по умолчанию; вместимости у крепления нет. */
  function buildSlotsSection(slots, slotEntries, excludeId) {
    if (!slots.length) {
      return {
        el: h('div', { class: 'hint-box', text: 'Слотов пока нет. Создайте их на странице «Слоты».' }),
        collect: function () { return []; }
      };
    }

    var listEl = h('div', { class: 'slot-edit-list' });
    var dragRow = null;
    var rowStates = [];

    function move(row, dir) {
      if (dir < 0 && row.previousElementSibling) {
        listEl.insertBefore(row, row.previousElementSibling);
      } else if (dir > 0 && row.nextElementSibling) {
        listEl.insertBefore(row.nextElementSibling, row);
      }
    }

    function addRow(slotId, contents) {
      var row = h('div', { class: 'slot-item' });
      var contentRows = [];

      var handle = h('span', { class: 'drag-handle', title: 'Перетащить, чтобы изменить порядок' });
      handle.setAttribute('draggable', 'true');
      handle.innerHTML = '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">' +
        '<circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/>' +
        '<circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/>' +
        '<circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';

      var slotSelect = UI.select({
        options: slots.map(function (sl) { return { value: sl.id, label: sl.name }; }),
        value: slotId || slots[0].id
      });
      slotSelect.classList.add('slot-select');

      function removeContentRow(cr) {
        var i = contentRows.indexOf(cr);
        if (i > -1) contentRows.splice(i, 1);
        if (cr.el.parentNode) cr.el.parentNode.removeChild(cr.el);
      }

      function refreshItemOptions(cr) {
        var items = compatibleItems(slotSelect.value, excludeId);
        var current = cr.itemSelect.value || cr.preferredId || '';
        UI.clear(cr.itemSelect);
        cr.itemSelect.appendChild(h('option', { value: '', text: items.length ? '— выберите предмет —' : '— нет подходящих предметов —' }));
        items.forEach(function (it) {
          cr.itemSelect.appendChild(h('option', { value: it.id, text: itemLabel(it) }));
        });
        cr.itemSelect.value = items.some(function (it) { return it.id === current; }) ? current : '';
        cr.preferredId = '';
      }

      function addContentRow(itemId, qty) {
        var cr = {};
        cr.itemSelect = UI.select({ options: [] });
        cr.itemSelect.classList.add('content-item');
        cr.preferredId = itemId || '';
        cr.qtyInput = UI.input({ type: 'number', min: 1, step: 1, value: qty || 1 });
        cr.qtyInput.classList.add('content-qty');
        cr.qtyInput.title = 'Сколько одинаковых добавить: каждый станет отдельной строкой';

        cr.el = h('div', { class: 'content-row' },
          cr.itemSelect, cr.qtyInput,
          h('button', {
            class: 'icon-btn', text: '\u2715', title: 'Убрать содержимое',
            onclick: function () { removeContentRow(cr); }
          })
        );

        refreshItemOptions(cr);

        contentRows.push(cr);
        contentsEl.insertBefore(cr.el, addRowEl);
        return cr;
      }

      var contentsEl = h('div', { class: 'slot-contents' });
      var addItemSel = UI.select({ options: [] });
      addItemSel.classList.add('content-item');
      var addQty = UI.input({ type: 'number', min: 1, step: 1, value: 1 });
      addQty.classList.add('content-qty');
      addQty.title = 'Сколько одинаковых добавить: каждый станет отдельной строкой';
      var addBtn = h('button', { class: 'btn btn-sm content-add-btn', text: '+ Добавить', onclick: tryAdd, disabled: true });

      function refreshAddOptions() {
        var items = compatibleItems(slotSelect.value, excludeId);
        UI.clear(addItemSel);
        addItemSel.appendChild(h('option', { value: '', text: items.length ? '— выберите предмет —' : '— нет подходящих предметов —' }));
        items.forEach(function (it) {
          addItemSel.appendChild(h('option', { value: it.id, text: itemLabel(it) }));
        });
        addItemSel.value = '';
        addBtn.disabled = true;
      }

      addItemSel.addEventListener('change', function () {
        addBtn.disabled = !Store.byId('objects', addItemSel.value);
      });

      function tryAdd() {
        var it = Store.byId('objects', addItemSel.value);
        if (!it) return;
        var q = Math.max(1, parseInt(addQty.value, 10) || 1);
        addContentRow(it.id, String(q));
        addItemSel.value = '';
        addBtn.disabled = true;
        addQty.value = '1';
      }

      var addRowEl = h('div', { class: 'content-row content-new' }, addItemSel, addQty, addBtn);
      contentsEl.appendChild(addRowEl);

      /* При смене слота несовместимое содержимое убирается. */
      slotSelect.addEventListener('change', function () {
        var dropped = 0;
        contentRows.slice().forEach(function (cr) {
          var prev = cr.itemSelect.value;
          refreshItemOptions(cr);
          if (prev && !cr.itemSelect.value) {
            removeContentRow(cr);
            dropped++;
          }
        });
        refreshAddOptions();
        if (dropped) UI.toast('Содержимое, не подходящее к новому слоту, убрано', 'warn');
      });

      var headEl = h('div', { class: 'slot-item-head' },
        handle,
        slotSelect,
        h('button', { class: 'icon-btn', text: '\u2191', title: 'Выше', onclick: function () { move(row, -1); } }),
        h('button', { class: 'icon-btn', text: '\u2193', title: 'Ниже', onclick: function () { move(row, 1); } }),
        h('button', {
          class: 'icon-btn', text: '\u2715', title: 'Убрать слот',
          onclick: function () {
            var i = rowStates.indexOf(state);
            if (i > -1) rowStates.splice(i, 1);
            if (row.parentNode) row.parentNode.removeChild(row);
          }
        })
      );

      row.appendChild(headEl);
      row.appendChild(contentsEl);

      handle.addEventListener('dragstart', function (e) {
        dragRow = row;
        row.classList.add('dragging');
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', 'slot');
          e.dataTransfer.setDragImage(row, 24, 16);
        } catch (err) { /* не критично */ }
      });
      handle.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        dragRow = null;
      });

      (contents || []).forEach(function (c) { addContentRow(c.itemId, c.qty); });

      var state = { row: row, slotSelect: slotSelect, contentRows: contentRows };
      rowStates.push(state);

      refreshAddOptions();

      listEl.appendChild(row);
      return row;
    }

    listEl.addEventListener('dragover', function (e) {
      if (!dragRow) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
      var over = e.target && e.target.closest ? e.target.closest('.slot-item') : null;
      if (!over || over === dragRow || over.parentNode !== listEl) return;
      var rect = over.getBoundingClientRect();
      if ((e.clientY - rect.top) > rect.height / 2) listEl.insertBefore(dragRow, over.nextSibling);
      else listEl.insertBefore(dragRow, over);
    });
    listEl.addEventListener('drop', function (e) { e.preventDefault(); });

    slotEntries.forEach(function (e) {
      if (Store.byId('slots', e.slotId)) addRow(e.slotId, e.contents || []);
    });

    var addSelect = UI.select({
      options: [{ value: '', label: '+ добавить слот…' }].concat(slots.map(function (sl) {
        return { value: sl.id, label: sl.name };
      })),
      value: ''
    });
    addSelect.addEventListener('change', function () {
      if (!addSelect.value) return;
      addRow(addSelect.value, []);
      addSelect.value = '';
    });

    return {
      el: h('div', {},
        listEl,
        h('div', { class: 'slot-add-row' }, addSelect),
        h('div', { class: 'hint', text: 'Одинаковые слоты можно добавлять сколько угодно. Порядок меняется перетаскиванием за ручку слева или кнопками ↑ ↓. Крепление принимает только совместимое оборудование; вместимости у него нет.' })
      ),
      collect: function () {
        return rowStates.map(function (st) {
          return {
            slotId: st.slotSelect.value,
            contents: spreadContents(st.contentRows,
              function (cr) { return cr.itemSelect.value; },
              function (cr) { return cr.qtyInput.value; })
          };
        }).filter(function (e) { return e.slotId; });
      }
    };
  }

  /* Редактор трюмов корабля: название, вместимость (кг) и содержимое.
     В трюм можно положить любое оборудование, кроме кораблей; сумма масс
     не должна превышать вместимость. Груз контейнеров не считается. */
  function buildHoldsSection(holdEntries, excludeId) {
    var listEl = h('div', { class: 'slot-edit-list' });
    var rows = [];

    function itemsForHold() {
      return Store.objects().filter(function (it) {
        return it.id !== excludeId && !Store.categoryIsShip(it.categoryId);
      });
    }

    function addRow(hold) {
      var st = { contentRows: [] };
      st.nameInput = UI.input({ value: hold ? hold.name : 'Трюм', placeholder: 'Название' });
      st.nameInput.classList.add('hold-name');
      st.capInput = UI.input({
        type: 'number', min: 0, step: 'any',
        value: hold ? hold.capacity : '', placeholder: 'Вместимость, кг'
      });
      st.capInput.classList.add('hold-cap');
      st.badge = h('span', { class: 'cap-badge' });

      function capacity() {
        var n = parseFloat(String(st.capInput.value).replace(',', '.'));
        return isFinite(n) && n >= 0 ? n : Infinity;
      }

      function usedNow() {
        var sum = 0;
        st.contentRows.forEach(function (cr) {
          var it = Store.byId('objects', cr.select.value);
          sum += (parseInt(cr.qty.value, 10) || 0) * Store.cargoUnits(it);
        });
        return sum;
      }

      function refreshBadge() {
        var cap = capacity();
        var used = usedNow();
        st.badge.textContent = Store.fmtNum(used) + ' / ' + (isFinite(cap) ? Store.fmtNum(cap) + ' кг' : '∞');
        st.badge.classList.toggle('cap-over', used > cap + 1e-9);
        st.badge.title = used > cap + 1e-9 ? 'Трюм перегружен' : 'Масса оборудования в трюме';
      }

      function addContentRow(itemId, qty) {
        var cr = {};
        cr.select = UI.select({
          options: [{ value: '', label: '— выберите предмет —' }].concat(itemsForHold().map(function (it) {
            return { value: it.id, label: itemLabel(it) };
          })),
          value: itemId || ''
        });
        cr.select.classList.add('content-item');
        cr.qty = UI.input({ type: 'number', min: 1, step: 1, value: qty || 1 });
        cr.qty.classList.add('content-qty');
        cr.qty.title = 'Сколько одинаковых добавить: каждый станет отдельной строкой';
        cr.select.addEventListener('change', refreshBadge);
        cr.qty.addEventListener('change', refreshBadge);
        cr.el = h('div', { class: 'content-row' }, cr.select, cr.qty,
          h('button', {
            class: 'icon-btn', text: '\u2715', title: 'Убрать содержимое',
            onclick: function () {
              var i = st.contentRows.indexOf(cr);
              if (i > -1) st.contentRows.splice(i, 1);
              if (cr.el.parentNode) cr.el.parentNode.removeChild(cr.el);
              refreshBadge();
            }
          })
        );
        st.contentRows.push(cr);
        st.contentsEl.insertBefore(cr.el, st.addRowEl);
        refreshBadge();
      }

      var addSelect = UI.select({
        options: [{ value: '', label: '+ добавить предмет…' }].concat(itemsForHold().map(function (it) {
          return { value: it.id, label: itemLabel(it) };
        })),
        value: ''
      });
      addSelect.classList.add('content-item');
      addSelect.addEventListener('change', function () {
        if (!addSelect.value) return;
        addContentRow(addSelect.value, 1);
        addSelect.value = '';
      });

      st.addRowEl = h('div', { class: 'content-row content-new' }, addSelect);
      st.contentsEl = h('div', { class: 'slot-contents' }, st.addRowEl);

      st.capInput.addEventListener('input', refreshBadge);
      st.el = h('div', { class: 'slot-item' },
        h('div', { class: 'slot-item-head' },
          st.nameInput, st.capInput, st.badge,
          h('button', {
            class: 'icon-btn', text: '\u2715', title: 'Убрать трюм',
            onclick: function () {
              var i = rows.indexOf(st);
              if (i > -1) rows.splice(i, 1);
              if (st.el.parentNode) st.el.parentNode.removeChild(st.el);
            }
          })
        ),
        st.contentsEl
      );
      rows.push(st);
      listEl.appendChild(st.el);

      ((hold && hold.contents) || []).forEach(function (c) { addContentRow(c.itemId, c.qty); });
      refreshBadge();
    }

    (holdEntries || []).forEach(addRow);

    function collect() {
      return rows.map(function (st) {
        return {
          name: st.nameInput.value.trim() || 'Трюм',
          capacity: st.capInput.value.trim(),
          contents: spreadContents(st.contentRows,
            function (cr) { return cr.select.value; },
            function (cr) { return cr.qty.value; })
        };
      });
    }

    return {
      el: h('div', {},
        listEl,
        h('div', { class: 'slot-add-row' },
          h('button', { class: 'btn btn-sm', text: '+ Добавить трюм', onclick: function () { addRow(null); } })
        ),
        h('div', {
          class: 'hint',
          text: 'Трюмы фиксированы у корабля: у каждого своё название и вместимость. В трюм помещается любое оборудование; сумма масс не должна превышать вместимость, груз контейнеров не считается. Одинаковые предметы хранятся отдельными строками.'
        })
      ),
      collect: collect,
      validate: function () {
        var list = collect();
        for (var i = 0; i < list.length; i++) {
          var cap = parseFloat(String(list[i].capacity).replace(',', '.'));
          if (!isFinite(cap) || cap < 0) continue;
          var used = Store.contentsMass(list[i].contents);
          if (used > cap + 1e-9) {
            return 'Трюм «' + list[i].name + '» перегружен: ' + Store.fmtNum(used) + ' кг из ' + Store.fmtNum(cap) + ' кг.';
          }
        }
        return null;
      }
    };
  }

  function openObjectModal(existing, presetCategoryId, groupKey) {
    var isEdit = !!existing;
    var meta = groupMeta(groupKey);
    var group = catalogGroup(groupKey);
    var options = categoryOptions('— выберите подкатегорию —', group);
    var hasLeaf = options.some(function (o) { return o.value; });

    /* Объект привязывается к подкатегории: если пришли из корневой категории,
       подставляем её первую подкатегорию. */
    var presetId = isEdit ? existing.categoryId : (presetCategoryId || '');
    var presetCat = presetId ? Store.byId('categories', presetId) : null;
    if (!isEdit && presetCat && !presetCat.parentId) {
      var firstChild = Store.childCategories(presetCat.id)[0];
      presetId = firstChild ? firstChild.id : '';
    }

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: 'Например: Титан' });
    var catSelect = UI.select({
      options: options,
      value: presetId
    });
    var priceBuyInput = UI.input({
      type: 'number', min: 0, step: 'any',
      value: isEdit ? existing.price_buy : '',
      placeholder: 'Например: 900'
    });
    var priceSaleInput = UI.input({
      type: 'number', min: 0, step: 'any',
      value: isEdit ? existing.price_sale : '',
      placeholder: 'Например: 650'
    });

    /* Иконка: у нового объекта сразу выбрана случайная, можно взять другую. */
    var iconField = UI.iconPicker(isEdit ? existing.icon : '');

    var propsHost = h('div');
    var inputs = {};
    function rebuildProps(categoryId, values) {
      UI.clear(propsHost);
      var block = categoryPropsBlock(categoryId, values);
      propsHost.appendChild(block.box);
      inputs = block.inputs;
    }
    rebuildProps(isEdit ? existing.categoryId : '', isEdit ? (existing.values || {}) : {});
    catSelect.addEventListener('change', function () {
      rebuildProps(catSelect.value, snapshotInputs(inputs));
    });

    /* Тип объекта задаёт категория: флажок «корабль» наследуется по её цепочке. */
    var existingIsShip = isEdit && Store.categoryIsShip(existing.categoryId);

    var slotsSection = buildSlotsSection(
      Store.slots(),
      existingIsShip ? (existing.slots || []) : [],
      isEdit ? existing.id : null
    );

    var holdsSection = buildHoldsSection(
      existingIsShip ? (existing.holds || []) : [],
      isEdit ? existing.id : null
    );

    /* `prop_2` — только у предметов: у корабля его нет. */
    var prop2Field = prop2Picker(isEdit ? (existing.prop2 || []) : []);
    var prop2Block = h('div', { class: 'field' },
      h('label', { class: 'field-label', text: 'prop_2 — материалы' }),
      prop2Field.el,
      h('div', {
        class: 'hint',
        text: 'Для грузового отсека — какие материалы принимает, для добывающего оборудования — что добывает. «0» — не задано; у ресурсов всегда 0.'
      })
    );

    var slots = Store.slots();
    var slotSelect = UI.select({
      options: [{ value: '', label: '— любой слот —' }].concat(slots.map(function (sl) {
        return { value: sl.id, label: sl.name };
      })),
      value: isEdit && !existingIsShip && existing.slotId ? existing.slotId : ''
    });
    var anySlotRow = UI.checkRow('Вставляется в любой слот', isEdit && !existingIsShip ? !existing.slotId : true);

    function syncSlotChoice() {
      slotSelect.disabled = anySlotRow.input.checked;
      if (anySlotRow.input.checked) slotSelect.value = '';
    }
    anySlotRow.input.addEventListener('change', syncSlotChoice);
    if (!slots.length) anySlotRow.input.checked = true;
    syncSlotChoice();

    var shipBlock = h('div', { class: 'field' },
      h('label', { class: 'field-label', text: 'Слоты корабля и их содержимое' }),
      slotsSection.el
    );

    var holdsBlock = h('div', { class: 'field' },
      h('label', { class: 'field-label', text: 'Трюмы корабля' }),
      holdsSection.el
    );

    var itemBlock = h('div', { class: 'field' },
      h('label', { class: 'field-label', text: 'Куда вставляется' }),
      h('div', { class: 'slot-row' }, slotSelect, anySlotRow.el),
      h('div', {
        class: 'hint',
        text: slots.length
          ? 'Если слот выбран — предмет встаёт только в такие слоты кораблей. «Вставляется в любой слот» — подходит к любому.'
          : 'Слоты ещё не созданы — предмет вставится в любой слот.'
      })
    );

    /* Видимость блоков зависит от категории: кораблям — слоты, прочим — слот вставки. */
    var typeHint = h('div', { class: 'hint' });

    function syncType() {
      var known = !!catSelect.value;
      var isShip = known && Store.categoryIsShip(catSelect.value);
      var isResource = known && Store.isResourceObject({ categoryId: catSelect.value });
      shipBlock.hidden = !isShip;
      holdsBlock.hidden = !isShip;
      prop2Block.hidden = isShip || !known || isResource;
      itemBlock.hidden = isShip || !known || isResource;
      if (!known) {
        typeHint.textContent = 'Выберите подкатегорию: у ветки кораблей объект получает слоты, у остальных — слот вставки.';
      } else if (isShip) {
        typeHint.textContent = 'Категория кораблей: у объекта будут собственные слоты, сам он никуда не вставляется.';
      } else if (isResource) {
        typeHint.textContent = 'Категория ресурсов: объект хранится как груз, у него нет слота и prop_2.';
      } else {
        typeHint.textContent = 'Категория не корабль: объект вставляется в выбранный слот или в любой.';
      }
    }
    catSelect.addEventListener('change', syncType);
    syncType();

    var body = h('div', {},
      UI.field('Название', nameInput),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Подкатегория' }),
        catSelect,
        hasLeaf ? null : h('div', {
          class: 'hint',
          text: (group ? 'В этой группе' : '') + ' подкатегорий пока нет — создайте их на странице «Категории»: объект привязывается к подкатегории.'
        }),
        typeHint
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Иконка' }),
        iconField.el
      ),
      shipBlock,
      holdsBlock,
      itemBlock,
      prop2Block,
      UI.field('Цена покупки, ¤', priceBuyInput, 'Сколько объект стоит в магазине. Пусто — цена не задана.'),
      UI.field('Цена продажи, ¤', priceSaleInput, 'Сколько дадут за объект при продаже. Пусто — как цена покупки.'),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        propsHost
      )
    );

    UI.modal({
      title: meta ? (isEdit ? meta.editTitle : meta.newTitle) : (isEdit ? 'Изменить объект' : 'Новый объект'),
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название объекта.';
        if (!catSelect.value) return 'Выберите подкатегорию.';
        var isShip = Store.categoryIsShip(catSelect.value);
        var isResource = Store.isResourceObject({ categoryId: catSelect.value });
        if (!isShip && !isResource && !anySlotRow.input.checked && !slotSelect.value) {
          return 'Выберите слот или отметьте «Вставляется в любой слот».';
        }

        var slotEntries = isShip ? slotsSection.collect() : [];
        for (var i = 0; i < slotEntries.length; i++) {
          if (!Store.byId('slots', slotEntries[i].slotId)) {
            return 'Выберите слот в каждой строке списка слотов.';
          }
        }

        var holdEntries = isShip ? holdsSection.collect() : [];
        if (isShip) {
          var holdError = holdsSection.validate();
          if (holdError) return holdError;
        }

        var chosenCat = Store.byId('categories', catSelect.value);
        var data = {
          name: name,
          categoryId: catSelect.value,
          parentCategoryId: chosenCat ? (chosenCat.parentId || '') : '',
          price_buy: priceBuyInput.value.trim(),
          price_sale: priceSaleInput.value.trim(),
          icon: iconField.value(),
          values: collectInputs(inputs),
          slotId: isShip || isResource || anySlotRow.input.checked ? null : slotSelect.value,
          prop2: isShip || isResource ? [] : prop2Field.value(),
          slots: slotEntries,
          holds: holdEntries
        };
        if (isEdit) {
          Store.patch('objects', existing.id, data);
          UI.toast('Объект изменён', 'ok');
        } else {
          Store.createObject(data);
          UI.toast('Объект добавлен', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  /* ---------- Экспорт страницы ---------- */

  window.Pages.objects = { render: renderObjects };
})();
