/* Страницы объектов: «Корабли», «Ресурсы», «Оборудование». */
(function () {
  'use strict';
  var h = UI.h;
  window.Pages = window.Pages || {};

  /* ---------- Общие части форм объектов ---------- */

  /* Блок полей «свойства категории»: для каждого свойства категории — поле значения.
     Значение подставляется из свойства (значение по умолчанию), его можно изменить. */
  function categoryPropsBlock(categoryId, values) {
    var inputs = {};
    var box = h('div');
    var cat = categoryId ? Store.byId('categories', categoryId) : null;

    if (!cat) {
      box.appendChild(h('div', { class: 'hint-box', text: 'Выберите категорию — здесь появятся её свойства.' }));
      return { box: box, inputs: inputs };
    }

    var props = cat.propIds.map(function (id) { return Store.byId('props', id); }).filter(Boolean);
    if (!props.length) {
      box.appendChild(h('div', { class: 'hint-box', text: 'В этой категории нет свойств. Их можно включить на странице категорий.' }));
      return { box: box, inputs: inputs };
    }

    props.forEach(function (p) {
      var current = values && values[p.id] !== undefined ? values[p.id] : (p.value || '');
      var inp = UI.input({ value: current, placeholder: 'Значение' });
      inputs[p.id] = inp;
      box.appendChild(UI.field(p.name, inp));
    });
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
      subtitle: 'Корабли: категория, значения свойств и набор слотов.',
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
            return h('span', { class: c ? '' : 'muted', text: c ? c.name : '—' });
          }
        },
        {
          title: 'Слоты',
          render: function (s) {
            var names = (s.slotIds || []).map(function (id) {
              var sl = Store.byId('slots', id);
              return sl ? sl.name : null;
            }).filter(Boolean);
            return h('span', { class: names.length ? '' : 'muted', text: names.length ? names.join(', ') : '—' });
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

  /* Редактор слотов корабля: одинаковые слоты можно добавлять сколько угодно,
     порядок меняется перетаскиванием за ручку или кнопками ↑ ↓. */
  function buildSlotsSection(slots, selectedIds) {
    if (!slots.length) {
      return {
        el: h('div', { class: 'hint-box', text: 'Слотов пока нет. Создайте их на странице «Слоты».' }),
        collect: function () { return []; }
      };
    }

    var listEl = h('div', { class: 'slot-edit-list' });
    var dragRow = null;

    function move(row, dir) {
      if (dir < 0 && row.previousElementSibling) {
        listEl.insertBefore(row, row.previousElementSibling);
      } else if (dir > 0 && row.nextElementSibling) {
        listEl.insertBefore(row.nextElementSibling, row);
      }
    }

    function addRow(slotId) {
      var row = h('div', { class: 'slot-item' });

      var handle = h('span', { class: 'drag-handle', title: 'Перетащить, чтобы изменить порядок' });
      handle.setAttribute('draggable', 'true');
      handle.innerHTML = '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">' +
        '<circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/>' +
        '<circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/>' +
        '<circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';

      var sel = UI.select({
        options: slots.map(function (sl) { return { value: sl.id, label: sl.name }; }),
        value: slotId || slots[0].id
      });

      row.appendChild(handle);
      row.appendChild(sel);
      row.appendChild(h('button', { class: 'icon-btn', text: '\u2191', title: 'Выше', onclick: function () { move(row, -1); } }));
      row.appendChild(h('button', { class: 'icon-btn', text: '\u2193', title: 'Ниже', onclick: function () { move(row, 1); } }));
      row.appendChild(h('button', { class: 'icon-btn', text: '\u2715', title: 'Убрать слот', onclick: function () { listEl.removeChild(row); } }));

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

    selectedIds.forEach(function (id) {
      if (Store.byId('slots', id)) addRow(id);
    });

    var addSelect = UI.select({
      options: [{ value: '', label: '+ добавить слот…' }].concat(slots.map(function (sl) {
        return { value: sl.id, label: sl.name };
      })),
      value: ''
    });
    addSelect.addEventListener('change', function () {
      if (!addSelect.value) return;
      addRow(addSelect.value);
      addSelect.value = '';
    });

    return {
      el: h('div', {},
        listEl,
        h('div', { class: 'slot-add-row' }, addSelect),
        h('div', { class: 'hint', text: 'Одинаковые слоты можно добавлять сколько угодно. Порядок меняется перетаскиванием за ручку слева или кнопками ↑ ↓.' })
      ),
      collect: function () {
        var ids = [];
        var rows = listEl.querySelectorAll('.slot-item');
        for (var i = 0; i < rows.length; i++) {
          var sel = rows[i].querySelector('select');
          if (sel && sel.value) ids.push(sel.value);
        }
        return ids;
      }
    };
  }

  function openShipModal(existing) {
    var isEdit = !!existing;
    var categories = Store.categories('ship');

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: 'Например: Сокол' });
    var catSelect = UI.select({
      options: [{ value: '', label: '— выберите категорию —' }].concat(categories.map(function (c) {
        return { value: c.id, label: c.name };
      })),
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

    var slotsSection = buildSlotsSection(Store.slots(), isEdit ? (existing.slotIds || []) : []);

    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Категория', catSelect, categories.length ? null : 'Категорий кораблей пока нет — создайте их на странице «Категории кораблей».'),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Свойства категории' }),
        propsHost
      ),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'Слоты корабля' }),
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
        var slotIds = slotsSection.collect();
        var data = { name: name, categoryId: catSelect.value, values: collectInputs(inputs), slotIds: slotIds };
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

  /* ---------- Ресурсы и оборудование ---------- */

  var RES_META = {
    listTitle: 'Ресурсы',
    listSub: 'Ресурсы: категория, значения свойств и слот (если задан).',
    addLabel: 'Добавить ресурс',
    emptyText: 'Ресурсы пока не добавлены.',
    newTitle: 'Новый ресурс',
    editTitle: 'Изменить ресурс',
    namePlaceholder: 'Например: Железо',
    savedNew: 'Ресурс добавлен',
    savedEdit: 'Ресурс изменён',
    delTitle: 'Удалить ресурс?',
    delDone: 'Ресурс удалён'
  };

  var EQ_META = {
    listTitle: 'Оборудование',
    listSub: 'Оборудование: категория, значения свойств и слот (если задан).',
    addLabel: 'Добавить оборудование',
    emptyText: 'Оборудование пока не добавлено.',
    newTitle: 'Новое оборудование',
    editTitle: 'Изменить оборудование',
    namePlaceholder: 'Например: Лазер Mk I',
    savedNew: 'Оборудование добавлено',
    savedEdit: 'Оборудование изменено',
    delTitle: 'Удалить оборудование?',
    delDone: 'Оборудование удалено'
  };

  function renderItems(root, coll, type, meta) {
    root.appendChild(UI.pageHead({
      title: meta.listTitle,
      subtitle: meta.listSub,
      addLabel: meta.addLabel,
      onAdd: function () { openItemModal(coll, type, null, meta); }
    }));

    var items = Store[coll]();
    if (!items.length) {
      root.appendChild(UI.emptyState({
        text: meta.emptyText,
        addLabel: meta.addLabel,
        onAdd: function () { openItemModal(coll, type, null, meta); }
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
            return h('span', { class: c ? '' : 'muted', text: c ? c.name : '—' });
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
          function () { openItemModal(coll, type, it, meta); },
          function () { deleteObject(coll, it, { title: meta.delTitle, done: meta.delDone }); }
        );
      }
    }));
  }

  function openItemModal(coll, type, existing, meta) {
    var isEdit = !!existing;
    var categories = Store.categories(type);

    var nameInput = UI.input({ value: isEdit ? existing.name : '', placeholder: meta.namePlaceholder });
    var catSelect = UI.select({
      options: [{ value: '', label: '— выберите категорию —' }].concat(categories.map(function (c) {
        return { value: c.id, label: c.name };
      })),
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
      ? 'Если слот задан — предмет устанавливается только в такой же слот корабля. «Без слота» — в любой слот.'
      : 'Слоты ещё не созданы — предмет установится в любой слот.';

    var body = h('div', {},
      UI.field('Название', nameInput),
      UI.field('Категория', catSelect, categories.length ? null : 'Категорий пока нет — создайте их на странице категорий.'),
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
      title: isEdit ? meta.editTitle : meta.newTitle,
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
          values: collectInputs(inputs),
          slotId: noSlotRow.input.checked ? null : slotSelect.value
        };
        if (isEdit) {
          Store.patch(coll, existing.id, data);
          UI.toast(meta.savedEdit, 'ok');
        } else {
          Store.createObject(coll, data);
          UI.toast(meta.savedNew, 'ok');
        }
        App.refresh();
        return null;
      }
    });
  }

  /* ---------- Экспорт страниц ---------- */

  window.Pages.ships = { render: renderShips };
  window.Pages.resources = { render: function (root) { renderItems(root, 'resources', 'resource', RES_META); } };
  window.Pages.equipment = { render: function (root) { renderItems(root, 'equipments', 'equipment', EQ_META); } };
})();
