/* Galaxy Admin — UI-инструменты: DOM-хелперы, модальные окна, формы, тосты, таблицы. */
(function () {
  'use strict';

  /* ---------- DOM ---------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') { el.className = value; return; }
        if (key === 'text') { el.textContent = value; return; }
        if (key === 'dataset') {
          Object.keys(value).forEach(function (d) { el.dataset[d] = value[d]; });
          return;
        }
        if (key.slice(0, 2) === 'on' && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
          return;
        }
        if (value === true) { el.setAttribute(key, ''); return; }
        el.setAttribute(key, value);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    if (child.nodeType) { parent.appendChild(child); return; }
    parent.appendChild(document.createTextNode(String(child)));
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- Модальные окна ---------- */

  var overlayEl = null;

  function keyHandler(e) { if (e.key === 'Escape') closeOverlay(); }

  function openOverlay(inner) {
    closeOverlay();
    overlayEl = h('div', { class: 'overlay' });
    overlayEl.addEventListener('mousedown', function (e) { if (e.target === overlayEl) closeOverlay(); });
    overlayEl.appendChild(inner);
    document.getElementById('modal-root').appendChild(overlayEl);
    document.addEventListener('keydown', keyHandler);
    document.body.classList.add('modal-open');
  }

  function closeOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    document.removeEventListener('keydown', keyHandler);
    document.body.classList.remove('modal-open');
  }

  function modal(opts) {
    var errorEl = h('div', { class: 'form-error' });
    errorEl.hidden = true;

    var saveBtn = h('button', {
      class: 'btn btn-primary',
      text: opts.saveLabel || 'Сохранить',
      onclick: function () {
        var message = opts.onSave ? opts.onSave() : null;
        if (typeof message === 'string' && message) {
          errorEl.textContent = message;
          errorEl.hidden = false;
          return;
        }
        closeOverlay();
      }
    });

    var box = h('div', { class: 'modal' + (opts.wide ? ' modal-wide' : '') },
      h('div', { class: 'modal-head' },
        h('div', { class: 'modal-titles' },
          h('h3', { text: opts.title || '' }),
          opts.subtitle ? h('p', { class: 'modal-sub', text: opts.subtitle }) : null
        ),
        h('button', { class: 'icon-btn', text: '\u2715', title: 'Закрыть', onclick: closeOverlay })
      ),
      h('div', { class: 'modal-body' }, opts.body || null, errorEl),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', text: 'Отмена', onclick: closeOverlay }),
        saveBtn
      )
    );

    openOverlay(box);
    var first = box.querySelector('input, select');
    if (first) setTimeout(function () { first.focus(); }, 30);
  }

  function alertBox(opts) {
    var box = h('div', { class: 'modal modal-sm' },
      h('div', { class: 'modal-head' },
        h('div', { class: 'modal-titles' }, h('h3', { text: opts.title || 'Внимание' })),
        null
      ),
      h('div', { class: 'modal-body' }, h('p', { class: 'alert-text', text: opts.text || '' })),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn btn-primary', text: opts.okLabel || 'Понятно', onclick: closeOverlay })
      )
    );
    openOverlay(box);
  }

  function confirmBox(opts) {
    var okBtn = h('button', {
      class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
      text: opts.okLabel || (opts.danger ? 'Удалить' : 'Продолжить'),
      onclick: function () { closeOverlay(); if (opts.onOk) opts.onOk(); }
    });
    var box = h('div', { class: 'modal modal-sm' },
      h('div', { class: 'modal-head' },
        h('div', { class: 'modal-titles' }, h('h3', { text: opts.title || 'Подтверждение' })),
        null
      ),
      h('div', { class: 'modal-body' }, h('p', { class: 'alert-text', text: opts.text || '' })),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', text: 'Отмена', onclick: closeOverlay }),
        okBtn
      )
    );
    openOverlay(box);
  }

  /* ---------- Тосты ---------- */

  function toast(text, kind) {
    var root = document.getElementById('toast-root');
    var item = h('div', { class: 'toast' + (kind ? ' toast-' + kind : ''), text: text });
    root.appendChild(item);
    setTimeout(function () { item.classList.add('toast-out'); }, 2600);
    setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 3100);
  }

  /* ---------- Формы ---------- */

  function field(label, control, hint) {
    return h('div', { class: 'field' },
      h('label', { class: 'field-label', text: label }),
      control,
      hint ? h('div', { class: 'hint', text: hint }) : null
    );
  }

  function input(opts) {
    opts = opts || {};
    var el = h('input', { class: 'input', type: opts.type || 'text', placeholder: opts.placeholder || '', value: opts.value || '' });
    if (opts.min !== undefined) el.setAttribute('min', opts.min);
    if (opts.max !== undefined) el.setAttribute('max', opts.max);
    if (opts.step !== undefined) el.setAttribute('step', opts.step);
    return el;
  }

  function select(opts) {
    opts = opts || {};
    var el = h('select', { class: 'input' });
    (opts.options || []).forEach(function (o) {
      el.appendChild(h('option', { value: o.value, text: o.label }));
    });
    el.value = opts.value || '';
    return el;
  }

  function checkRow(text, checked, sideNode) {
    var box = h('input', { type: 'checkbox' });
    box.checked = !!checked;
    var row = h('label', { class: 'check-row' }, box, h('span', { class: 'check-text', text: text }), sideNode || null);
    return { el: row, input: box };
  }

  /* Выбор иконки из общего каталога (data/icons.js): сетка кнопок + «случайная».
     Возвращает { el, value() }; у нового объекта/категории сразу выбрана случайная. */
  function iconPicker(initial) {
    var hasLib = !!window.Icons;
    var current = initial || (hasLib ? Icons.random() : '');
    var buttons = {};
    var grid = h('div', { class: 'icon-picker' });

    function set(key) {
      current = key;
      Object.keys(buttons).forEach(function (k) {
        buttons[k].classList.toggle('active', k === key);
      });
    }

    if (hasLib) {
      Icons.keys().forEach(function (key) {
        var btn = h('button', { class: 'icon-pick', title: key, onclick: function () { set(key); } });
        btn.innerHTML = Icons.svg(key, 20);
        buttons[key] = btn;
        grid.appendChild(btn);
      });
      set(current);
    }

    return {
      el: h('div', {},
        grid,
        hasLib ? h('button', { class: 'btn btn-sm icon-random', text: 'Случайная иконка', onclick: function () { set(Icons.random()); } }) : null,
        h('div', { class: 'hint', text: 'Одна библиотека иконок для объектов и категорий.' })
      ),
      value: function () { return current; }
    };
  }

  /* ---------- Каркас страниц ---------- */

  function pageHead(opts) {
    return h('div', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: opts.title }),
        opts.subtitle ? h('p', { class: 'page-sub', text: opts.subtitle }) : null
      ),
      opts.addLabel ? h('button', { class: 'btn btn-primary', text: opts.addLabel, onclick: opts.onAdd || function () {} }) : null
    );
  }

  /* opts: { columns: [{ title, render(row) }], rows: [...], actions(row) -> node[], className } */
  function table(opts) {
    var head = h('tr', {}, opts.columns.map(function (c) { return h('th', { text: c.title }); }), h('th', { class: 'th-actions' }));
    var body = h('tbody', {}, opts.rows.map(function (row) {
      var tr = h('tr', {}, opts.columns.map(function (c) { return h('td', {}, c.render(row)); }));
      tr.appendChild(h('td', { class: 'td-actions' }, opts.actions ? opts.actions(row) : null));
      return tr;
    }));
    return h('div', { class: 'card table-card' + (opts.className ? ' ' + opts.className : '') }, h('table', { class: 'table' }, h('thead', {}, head), body));
  }

  function emptyState(opts) {
    return h('div', { class: 'card empty' },
      h('p', { class: 'empty-text', text: opts.text }),
      opts.addLabel ? h('button', { class: 'btn btn-primary', text: opts.addLabel, onclick: opts.onAdd || function () {} }) : null
    );
  }

  function editDelete(onEdit, onDelete) {
    return [
      h('button', { class: 'btn btn-sm', text: 'Изменить', onclick: onEdit }),
      h('button', { class: 'btn btn-sm btn-danger-ghost', text: 'Удалить', onclick: onDelete })
    ];
  }

  /* ---------- Экспорт ---------- */

  window.UI = {
    h: h,
    clear: clear,
    modal: modal,
    alert: alertBox,
    confirm: confirmBox,
    toast: toast,
    field: field,
    input: input,
    select: select,
    checkRow: checkRow,
    iconPicker: iconPicker,
    pageHead: pageHead,
    table: table,
    emptyState: emptyState,
    editDelete: editDelete
  };
})();
