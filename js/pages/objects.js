/* Страница «Объекты»: корабли и предметы в одной коллекции.
   Корабль имеет собственные слоты, предмет вставляется в подходящий слот или в любой. */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* ---------- Общие части форм ---------- */

  /* В объекте выбирается только подкатегория (2-й уровень): она задаёт ветку. */
  function categoryOptions(emptyLabel) {
    return [{ value: '', label: emptyLabel }].concat(
      Store.categoryTree()
        .filter(function (node) { return node.cat.parentId; })
        .map(function (node) { return { value: node.cat.id, label: Store.categoryPath(node.cat.id) }; })
    );
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
      text: isShip ? 'корабль' : 'предмет'
    });
  }

  /* ---------- Объекты ---------- */

  /* Слева — категории, справа — объекты выбранной категории (с подкатегориями). */
  var selectedCategory = '';

  /* Объекты выбранной категории: корневая — вместе с подкатегориями, подкатегория — точное совпадение. */
  function objectsIn(categoryId) {
    if (!categoryId) return Store.objects();
    var cat = Store.byId('categories', categoryId);
    if (!cat) return [];
    if (!cat.parentId) {
      return Store.objects().filter(function (o) {
        return o.categoryId === cat.id || o.parentCategoryId === cat.id;
      });
    }
    return Store.objects().filter(function (o) { return o.categoryId === cat.id; });
  }

  function categoryRow(id, label, depth, count, isShip) {
    return h('button', {
      class: 'cat-item' + (selectedCategory === id ? ' active' : ''),
      title: isShip ? 'Категория кораблей' : label,
      onclick: function () { selectedCategory = id; App.refresh(); }
    },
      h('span', { class: 'cat-indent', style: 'width:' + (depth * 14) + 'px' }),
      h('span', { class: 'cat-name', text: label }),
      h('span', { class: 'cat-count', text: String(count) })
    );
  }

  /* Слева: «Все объекты», категории первого уровня и подкатегории выбранной ветки. */
  function categoryPanel() {
    var panel = h('aside', { class: 'card cat-panel' },
      h('div', { class: 'cat-panel-title', text: 'Категории' })
    );
    panel.appendChild(categoryRow('', 'Все объекты', 0, Store.objects().length, false));
    Store.childCategories('').forEach(function (cat) {
      panel.appendChild(categoryRow(cat.id, cat.name, 1, objectsIn(cat.id).length, Store.categoryIsShip(cat.id)));
    });

    /* Подкатегории: для выбранной категории (или родителя выбранной подкатегории). */
    var selected = selectedCategory ? Store.byId('categories', selectedCategory) : null;
    var rootId = selected ? (selected.parentId || selected.id) : '';
    if (!rootId) return panel;

    var kids = Store.childCategories(rootId);
    if (!kids.length) {
      panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
      panel.appendChild(h('div', { class: 'cat-panel-empty', text: 'У этой категории нет подкатегорий' }));
      return panel;
    }

    panel.appendChild(h('div', { class: 'cat-panel-title cat-panel-sub', text: 'Подкатегории' }));
    kids.forEach(function (cat) {
      panel.appendChild(categoryRow(cat.id, cat.name, 2, objectsIn(cat.id).length, Store.categoryIsShip(cat.id)));
    });
    return panel;
  }

  function renderObjects(root) {
    var current = selectedCategory ? Store.byId('categories', selectedCategory) : null;
    if (!current) selectedCategory = '';

    root.appendChild(UI.pageHead({
      title: 'Объекты',
      subtitle: 'Слева — категории первого уровня и их подкатегории, справа — объекты выбранной ветки. Объект всегда привязан к подкатегории, а тип (слоты или слот вставки) задаёт её корневая категория.',
      addLabel: 'Добавить объект',
      onAdd: function () { openObjectModal(null, selectedCategory); }
    }));

    var items = objectsIn(selectedCategory);
    var main = h('div', { class: 'split-main' });

    if (!items.length) {
      main.appendChild(UI.emptyState({
        text: current
          ? 'В категории «' + current.name + '» пока нет объектов — ни своих, ни в подкатегориях.'
          : (Store.categories().length
            ? 'Пока нет ни одного объекта. Например: корабль «Титан» или предмет «Лазер Mk I».'
            : 'Пока нет ни одного объекта. Сначала создайте категорию — она задаст список свойств.'),
        addLabel: 'Добавить объект',
        onAdd: function () { openObjectModal(null, selectedCategory); }
      }));
    } else {
      main.appendChild(UI.table({
        columns: [
          { title: 'Название', render: function (o) { return h('span', { class: 'cell-main', text: o.name }); } },
          {
            title: 'Категория',
            render: function (o) {
              var c = Store.byId('categories', o.categoryId);
              return h('span', { class: c ? '' : 'muted', text: c ? Store.categoryPath(c.id) : '—' });
            }
          },
          { title: 'Тип', render: function (o) { return typeChip(Store.categoryIsShip(o.categoryId)); } },
          {
            title: 'Масса',
            render: function (o) {
              var m = Store.massOf(o);
              return h('span', { class: m ? '' : 'muted', text: m ? Store.fmtNum(m) + ' кг' : '—' });
            }
          },
          { title: 'Слоты', render: function (o) { return slotsSummary(o); } }
        ],
        rows: items,
        actions: function (o) {
          return UI.editDelete(
            function () { openObjectModal(o); },
            function () { deleteObject(o); }
          );
        }
      }));
    }

    root.appendChild(h('div', { class: 'split' }, categoryPanel(), main));
  }

  /* Для корабля — сводка его слотов с содержимым, для предмета — куда он вставляется. */
  function slotsSummary(o) {
    if (!Store.categoryIsShip(o.categoryId)) {
      var sl = o.slotId ? Store.byId('slots', o.slotId) : null;
      return h('span', { class: sl ? '' : 'muted', text: sl ? 'в слот «' + sl.name + '»' : 'в любой слот' });
    }
    var parts = (o.slots || []).map(function (e) {
      var slot = Store.byId('slots', e.slotId);
      if (!slot) return null;
      var names = e.contents.map(function (c) {
        var it = Store.byId('objects', c.itemId);
        return it ? it.name + ' ×' + c.qty : null;
      }).filter(Boolean);
      return names.length ? slot.name + ' (' + names.join(', ') + ')' : slot.name;
    }).filter(Boolean);
    return h('span', { class: parts.length ? '' : 'muted', text: parts.length ? parts.join(', ') : '—' });
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

  /* Предметы, подходящие в слот: без «своего» слота или с таким же слотом.
     Корабли в чужие слоты не вставляются. */
  function compatibleItems(slotId, excludeId) {
    return Store.objects().filter(function (it) {
      if (it.id === excludeId) return false;
      if (Store.categoryIsShip(it.categoryId)) return false;
      return !it.slotId || it.slotId === slotId;
    });
  }

  function itemLabel(it) {
    var m = Store.massOf(it);
    return it.name + (m ? ' (' + Store.fmtNum(m) + ' кг)' : '');
  }

  /* Редактор слотов объекта: одинаковые слоты можно добавлять сколько угодно,
     порядок меняется перетаскиванием за ручку или кнопками ↑ ↓.
     У каждого слота — содержимое по умолчанию; сумма масс (масса × количество)
     не должна превышать вместимость слота. */
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

      var capBadge = h('span', { class: 'cap-badge' });

      function currentSlot() { return Store.byId('slots', slotSelect.value); }

      function usedNow() {
        var sum = 0;
        contentRows.forEach(function (cr) {
          var it = Store.byId('objects', cr.itemSelect.value);
          sum += (parseInt(cr.qtyInput.value, 10) || 0) * Store.massOf(it);
        });
        return sum;
      }

      function refreshBadge() {
        var cap = Store.slotCapacity(currentSlot());
        var used = usedNow();
        var over = used > cap + 1e-9;
        capBadge.textContent = Store.fmtNum(used) + ' / ' + (isFinite(cap) ? Store.fmtNum(cap) + ' кг' : '∞');
        capBadge.classList.toggle('cap-over', over);
        capBadge.title = over ? 'Слот перегружен' : 'Занято массы в слоте';
      }

      /* Сколько единиц предмета ещё помещается в слот. */
      function maxQtyFor(item) {
        var cap = Store.slotCapacity(currentSlot());
        if (!isFinite(cap)) return Infinity;
        var m = Store.massOf(item);
        if (m <= 0) return Infinity;
        return Math.max(0, Math.floor((cap - usedNow()) / m));
      }

      function removeContentRow(cr) {
        var i = contentRows.indexOf(cr);
        if (i > -1) contentRows.splice(i, 1);
        if (cr.el.parentNode) cr.el.parentNode.removeChild(cr.el);
        refreshBadge();
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
        cr.qtyInput.title = 'Количество единиц';

        /* Количество не должно превышать остаток вместимости. */
        function syncQty() {
          var it = Store.byId('objects', cr.itemSelect.value);
          if (!it) { refreshBadge(); return; }
          var q = parseInt(cr.qtyInput.value, 10);
          if (!q || q < 1) q = 1;
          var cap = Store.slotCapacity(currentSlot());
          if (isFinite(cap) && Store.massOf(it) > 0) {
            var own = q * Store.massOf(it);
            var limit = Math.max(0, Math.floor((cap - (usedNow() - own)) / Store.massOf(it)));
            if (q > limit) {
              q = Math.max(1, limit);
              UI.toast('В слоте хватает места только на ' + q + ' шт.', 'warn');
            }
          }
          cr.qtyInput.value = String(q);
          refreshBadge();
        }

        cr.itemSelect.addEventListener('change', syncQty);
        cr.qtyInput.addEventListener('change', syncQty);

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
      addQty.title = 'Количество единиц';
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
        var it = Store.byId('objects', addItemSel.value);
        addBtn.disabled = !it;
        if (!it) return;
        var maxQ = maxQtyFor(it);
        if (maxQ < 1) {
          UI.toast('В слоте нет места для «' + it.name + '»', 'warn');
          addBtn.disabled = true;
          return;
        }
        if (maxQ < (parseInt(addQty.value, 10) || 1)) addQty.value = String(maxQ);
      });

      function tryAdd() {
        var it = Store.byId('objects', addItemSel.value);
        if (!it) return;
        var maxQ = maxQtyFor(it);
        if (maxQ < 1) {
          UI.toast('В слоте нет места для «' + it.name + '»', 'warn');
          return;
        }
        var q = parseInt(addQty.value, 10) || 1;
        if (q > maxQ) {
          q = maxQ;
          UI.toast('В слоте хватает места только на ' + q + ' шт.', 'warn');
        }
        addContentRow(it.id, String(q));
        addItemSel.value = '';
        addBtn.disabled = true;
        addQty.value = '1';
        refreshBadge();
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
        refreshBadge();
        if (dropped) UI.toast('Содержимое, не подходящее к новому слоту, убрано', 'warn');
      });

      var headEl = h('div', { class: 'slot-item-head' },
        handle,
        slotSelect,
        capBadge,
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
      refreshBadge();

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
        h('div', { class: 'hint', text: 'Одинаковые слоты можно добавлять сколько угодно. Порядок меняется перетаскиванием за ручку слева или кнопками ↑ ↓. Сумма масс содержимого не должна превышать вместимость слота.' })
      ),
      collect: function () {
        return rowStates.map(function (st) {
          return {
            slotId: st.slotSelect.value,
            contents: st.contentRows.map(function (cr) {
              return {
                itemId: cr.itemSelect.value,
                qty: String(parseInt(cr.qtyInput.value, 10) || 1)
              };
            }).filter(function (c) { return c.itemId; })
          };
        }).filter(function (e) { return e.slotId; });
      }
    };
  }

  function openObjectModal(existing, presetCategoryId) {
    var isEdit = !!existing;
    var categories = Store.categoryTree();
    var hasLeaf = categories.some(function (node) { return node.cat.parentId; });

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
      options: categoryOptions('— выберите подкатегорию —'),
      value: presetId
    });
    var massInput = UI.input({
      type: 'number', min: 0, step: 'any',
      value: isEdit ? existing.mass : '',
      placeholder: 'Например: 10'
    });

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
      shipBlock.hidden = !isShip;
      itemBlock.hidden = isShip || !known;
      if (!known) {
        typeHint.textContent = 'Выберите подкатегорию: у ветки кораблей объект получает слоты, у остальных — слот вставки.';
      } else if (isShip) {
        typeHint.textContent = 'Категория кораблей: у объекта будут собственные слоты, сам он никуда не вставляется.';
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
        hasLeaf ? null : h('div', { class: 'hint', text: 'Подкатегорий пока нет — создайте их на странице «Категории»: объект привязывается к подкатегории.' }),
        typeHint
      ),
      shipBlock,
      itemBlock,
      UI.field('Масса, кг', massInput, 'Масса одной единицы: учитывается при наполнении слотов кораблей.'),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        propsHost
      )
    );

    UI.modal({
      title: isEdit ? 'Изменить объект' : 'Новый объект',
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название объекта.';
        if (!catSelect.value) return 'Выберите подкатегорию.';
        var isShip = Store.categoryIsShip(catSelect.value);
        if (!isShip && !anySlotRow.input.checked && !slotSelect.value) {
          return 'Выберите слот или отметьте «Вставляется в любой слот».';
        }

        var slotEntries = isShip ? slotsSection.collect() : [];
        for (var i = 0; i < slotEntries.length; i++) {
          var sl = Store.byId('slots', slotEntries[i].slotId);
          if (!sl) return 'Выберите слот в каждой строке списка слотов.';
          var used = Store.usedMass(slotEntries[i].contents);
          var cap = Store.slotCapacity(sl);
          if (used > cap + 1e-9) {
            return 'Слот «' + sl.name + '» перегружен: ' + Store.fmtNum(used) + ' кг из ' + Store.fmtNum(cap) + ' кг.';
          }
        }

        var chosenCat = Store.byId('categories', catSelect.value);
        var data = {
          name: name,
          categoryId: catSelect.value,
          parentCategoryId: chosenCat ? (chosenCat.parentId || '') : '',
          mass: massInput.value.trim(),
          values: collectInputs(inputs),
          slotId: isShip || anySlotRow.input.checked ? null : slotSelect.value,
          slots: slotEntries
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
