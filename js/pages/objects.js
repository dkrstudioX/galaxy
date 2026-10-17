/* Страницы объектов: «Корабли», «Товары». */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* ---------- Общие части форм объектов ---------- */

  /* Селект категорий: подкатегории подписаны полным путём («Корабли / Линкоры»). */
  function categoryOptions(type, emptyLabel) {
    return [{ value: '', label: emptyLabel }].concat(Store.categoryTree(type).map(function (node) {
      return { value: node.cat.id, label: node.depth ? Store.categoryPath(node.cat.id) : node.cat.name };
    }));
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
      box.appendChild(h('div', { class: 'hint-box', text: 'У этой категории нет свойств — ни своих, ни унаследованных. Их можно включить на странице категорий.' }));
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
      box.appendChild(h('div', { class: 'hint', text: 'Часть свойств унаследована: ' + inherited.map(function (it) { return '«' + it.prop.name + '» от «' + it.from.name + '»'; }).join(', ') + '.' }));
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

  function deleteObject(coll, item, opts) {
    UI.confirm({
      title: opts.title,
      text: '«' + item.name + '» будет удалён без возможности восстановления.',
      danger: true,
      onOk: function () {
        Store.drop(coll, item.id);
        UI.toast(opts.done, 'ok');
        App.refresh();
      }
    });
  }

  /* ---------- Корабли ---------- */

  function renderShips(root) {
    root.appendChild(UI.pageHead({
      title: 'Корабли',
      subtitle: 'Корабли: категория, значения свойств и слоты с содержимым по умолчанию.',
      addLabel: 'Добавить корабль',
      onAdd: function () { openShipModal(null); }
    }));

    var items = Store.ships();
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: Store.categories('ship').length
          ? 'Пока нет ни одного корабля.'
          : 'Пока нет ни одного корабля. Сначала создайте категорию корабля — она задаст список свойств.',
        addLabel: 'Добавить корабль',
        onAdd: function () { openShipModal(null); }
      }));
      return;
    }

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: function (s) { return h('span', { class: 'cell-main', text: s.name }); } },
        {
          title: 'Категория',
          render: function (s) {
            var c = Store.byId('categories', s.categoryId);
            return h('span', { class: c ? '' : 'muted', text: c ? Store.categoryPath(c.id) : '—' });
          }
        },
        {
          title: 'Слоты',
          render: function (s) {
            var parts = (s.slots || []).map(function (e) {
              var sl = Store.byId('slots', e.slotId);
              if (!sl) return null;
              var names = e.contents.map(function (c) {
                var it = Store.byId('goods', c.itemId);
                return it ? it.name + ' ×' + c.qty : null;
              }).filter(Boolean);
              return names.length ? sl.name + ' (' + names.join(', ') + ')' : sl.name;
            }).filter(Boolean);
            return h('span', { class: parts.length ? '' : 'muted', text: parts.length ? parts.join(', ') : '—' });
          }
        }
      ],
      rows: items,
      actions: function (s) {
        return UI.editDelete(
          function () { openShipModal(s); },
          function () { deleteObject('ships', s, { title: 'Удалить корабль?', done: 'Корабль удалён' }); }
        );
      }
    }));
  }

  /* Товары, подходящие в слот: привязанные к такому же слоту или «Без слота». */
  function compatibleItems(slotId) {
    return Store.goods().filter(function (it) { return !it.slotId || it.slotId === slotId; });
  }

  function itemLabel(it) {
    var m = Store.massOf(it);
    return it.name + (m ? ' (' + Store.fmtNum(m) + ' кг)' : '');
  }

  /* Редактор слотов корабля: одинаковые слоты можно добавлять сколько угодно,
     порядок меняется перетаскиванием за ручку или кнопками ↑ ↓.
     У каждого слота — содержимое по умолчанию; сумма масс (масса × количество)
     не должна превышать вместимость слота. */
  function buildSlotsSection(slots, slotEntries) {
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
          var it = Store.byId('goods', cr.itemSelect.value);
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
        var items = compatibleItems(slotSelect.value);
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
          var it = Store.byId('goods', cr.itemSelect.value);
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
        var items = compatibleItems(slotSelect.value);
        UI.clear(addItemSel);
        addItemSel.appendChild(h('option', { value: '', text: items.length ? '— выберите предмет —' : '— нет подходящих предметов —' }));
        items.forEach(function (it) {
          addItemSel.appendChild(h('option', { value: it.id, text: itemLabel(it) }));
        });
        addItemSel.value = '';
        addBtn.disabled = true;
      }

      addItemSel.addEventListener('change', function () {
        var it = Store.byId('goods', addItemSel.value);
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
        var it = Store.byId('goods', addItemSel.value);
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

      /* При смене типа слота несовместимое содержимое убирается. */
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

  function openShipModal(existing) {
    var isEdit = !!existing;
    var categories = Store.categories('ship');

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: 'Например: Сокол' });
    var catSelect = UI.select({
      options: categoryOptions('ship', '— выберите категорию —'),
      value: isEdit ? existing.categoryId : ''
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

    var slotsSection = buildSlotsSection(Store.slots(), isEdit ? (existing.slots || []) : []);

    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Категория', catSelect, categories.length ? null : 'Категорий кораблей пока нет — создайте их на странице «Категории кораблей».'),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        propsHost
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Слоты корабля и их содержимое по умолчанию' }),
        slotsSection.el
      )
    );

    UI.modal({
      title: isEdit ? 'Изменить корабль' : 'Новый корабль',
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название корабля.';
        if (!catSelect.value) return 'Выберите категорию.';
        var slotEntries = slotsSection.collect();

        for (var i = 0; i < slotEntries.length; i++) {
          var sl = Store.byId('slots', slotEntries[i].slotId);
          if (!sl) return 'Выберите слот в каждой строке списка слотов.';
          var used = Store.usedMass(slotEntries[i].contents);
          var cap = Store.slotCapacity(sl);
          if (used > cap + 1e-9) {
            return 'Слот «' + sl.name + '» перегружен: ' + Store.fmtNum(used) + ' кг из ' + Store.fmtNum(cap) + ' кг.';
          }
        }

        var data = { name: name, categoryId: catSelect.value, values: collectInputs(inputs), slots: slotEntries };
        if (isEdit) {
          Store.patch('ships', existing.id, data);
          UI.toast('Корабль изменён', 'ok');
        } else {
          Store.createObject('ships', data);
          UI.toast('Корабль добавлен', 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  /* ---------- Товары ---------- */

  var GOODS_META = {
    listTitle: 'Товары',
    listSub: 'Товары: категория, масса, значения свойств и слот (если задан).',
    addLabel: 'Добавить товар',
    emptyText: 'Товары пока не добавлены.',
    newTitle: 'Новый товар',
    editTitle: 'Изменить товар',
    namePlaceholder: 'Например: Лазер Mk I',
    savedNew: 'Товар добавлен',
    savedEdit: 'Товар изменён',
    delTitle: 'Удалить товар?',
    delDone: 'Товар удалён'
  };

  function renderGoods(root) {
    root.appendChild(UI.pageHead({
      title: GOODS_META.listTitle,
      subtitle: GOODS_META.listSub,
      addLabel: GOODS_META.addLabel,
      onAdd: function () { openGoodsModal(null); }
    }));

    var items = Store.goods();
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: GOODS_META.emptyText,
        addLabel: GOODS_META.addLabel,
        onAdd: function () { openGoodsModal(null); }
      }));
      return;
    }

    root.appendChild(UI.table({
      columns: [
        { title: 'Название', render: function (it) { return h('span', { class: 'cell-main', text: it.name }); } },
        {
          title: 'Категория',
          render: function (it) {
            var c = Store.byId('categories', it.categoryId);
            return h('span', { class: c ? '' : 'muted', text: c ? Store.categoryPath(c.id) : '—' });
          }
        },
        {
          title: 'Масса',
          render: function (it) {
            var m = Store.massOf(it);
            return h('span', { class: m ? '' : 'muted', text: m ? Store.fmtNum(m) + ' кг' : '—' });
          }
        },
        {
          title: 'Слот',
          render: function (it) {
            var sl = it.slotId ? Store.byId('slots', it.slotId) : null;
            return h('span', { class: sl ? '' : 'muted', text: sl ? sl.name : 'без слота' });
          }
        }
      ],
      rows: items,
      actions: function (it) {
        return UI.editDelete(
          function () { openGoodsModal(it); },
          function () { deleteObject('goods', it, { title: GOODS_META.delTitle, done: GOODS_META.delDone }); }
        );
      }
    }));
  }

  function openGoodsModal(existing) {
    var isEdit = !!existing;
    var categories = Store.categories('goods');

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: GOODS_META.namePlaceholder });
    var massInput = UI.input({
      type: 'number', min: 0, step: 'any',
      value: isEdit ? existing.mass : '',
      placeholder: 'Например: 10'
    });
    var catSelect = UI.select({
      options: categoryOptions('goods', '— выберите категорию —'),
      value: isEdit ? existing.categoryId : ''
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

    var slots = Store.slots();
    var slotSelect = UI.select({
      options: [{ value: '', label: '— выберите слот —' }].concat(slots.map(function (sl) {
        return { value: sl.id, label: sl.name };
      })),
      value: isEdit && existing.slotId ? existing.slotId : ''
    });
    var noSlotRow = UI.checkRow('Без слота', isEdit ? !existing.slotId : false);
    function syncSlot() {
      slotSelect.disabled = noSlotRow.input.checked;
      if (noSlotRow.input.checked) slotSelect.value = '';
    }
    noSlotRow.input.addEventListener('change', syncSlot);
    if (!slots.length) noSlotRow.input.checked = true;
    syncSlot();

    var slotHint = slots.length
      ? 'Если слот задан — товар устанавливается только в такой же слот корабля. «Без слота» — в любой слот.'
      : 'Слоты ещё не созданы — товар установится в любой слот.';

    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Категория', catSelect, categories.length ? null : 'Категорий пока нет — создайте их на странице «Категории товаров».'),
      UI.field('Масса, кг', massInput, 'Масса одной единицы товара. Учитывается при наполнении слотов корабля.'),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        propsHost
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Слот' }),
        h('div', { class: 'slot-row' }, slotSelect, noSlotRow.el),
        h('div', { class: 'hint', text: slotHint })
      )
    );

    UI.modal({
      title: isEdit ? GOODS_META.editTitle : GOODS_META.newTitle,
      wide: true,
      body: body,
      onSave: function () {
        var name = nameInput.value.trim();
        if (!name) return 'Укажите название.';
        if (!catSelect.value) return 'Выберите категорию.';
        if (!noSlotRow.input.checked && !slotSelect.value) return 'Выберите слот или отметьте «Без слота».';
        var data = {
          name: name,
          categoryId: catSelect.value,
          mass: massInput.value.trim(),
          values: collectInputs(inputs),
          slotId: noSlotRow.input.checked ? null : slotSelect.value
        };
        if (isEdit) {
          Store.patch('goods', existing.id, data);
          UI.toast(GOODS_META.savedEdit, 'ok');
        } else {
          Store.createObject('goods', data);
          UI.toast(GOODS_META.savedNew, 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  /* ---------- Экспорт страниц ---------- */

  window.Pages.ships = { render: renderShips };
  window.Pages.goods = { render: renderGoods };
})();
