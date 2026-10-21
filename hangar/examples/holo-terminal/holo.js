/* HOLO-9 — интерактив демо-макета.
   Только интерфейс: данные демонстрационные, Store и hangar.js не затрагиваются. */
(function () {
  'use strict';

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  var credits = 18400;
  var creditsEl = $('#credits');
  var replyEl = $('#assistantReply');
  var buyButton = $('#buyButton');
  var consoleBar = $('#consoleBar');
  var toastEl = $('#toast');
  var toastTimer = 0;

  var REPLIES = {
    cargo: 'В трюмах «Сокола» 2 000 кг. Сейчас занято 640 кг — войдёт ещё 1 360 кг груза. Тяжёлое оборудование сверх этого — не в трюм, а в грузовой отсек.',
    kit: 'До 3 000 ¤: Лазер M-7 (790), Щит S-3 (495), Радар R-2 (480) и Ремкомплект (350) — итого 2 115 ¤. Останется 885 ¤ на топливо.',
    shield: 'Щит S-3 встаёт только в гнездо S1. В башню S2 его не поставить: крепление не совпадает по классу. Свободное гнездо S1 есть у кормы.'
  };

  function fmt(value) { return value.toLocaleString('ru-RU'); }

  function plural(count, one, few, many) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function say(text) {
    replyEl.classList.remove('is-in');
    void replyEl.offsetWidth;
    replyEl.textContent = text;
    replyEl.classList.add('is-in');
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function flashConsole() {
    consoleBar.classList.remove('is-flash');
    void consoleBar.offsetWidth;
    consoleBar.classList.add('is-flash');
  }

  /* ---------- выбор предмета ---------- */

  function selectedRow() { return $('.item-row.selected'); }

  function selectRow(row) {
    if (!row) return;
    $$('.item-row').forEach(function (item) {
      var active = item === row;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    $('#consoleName').textContent = row.dataset.name;
    $('#consoleMeta').textContent = row.dataset.meta;
    $('#consolePrice').textContent = fmt(Number(row.dataset.price));
    $('#consoleIcon use').setAttribute('href', '#i-' + row.dataset.icon);

    var stock = Number(row.dataset.stock);
    buyButton.disabled = stock <= 0 || credits < Number(row.dataset.price);
    buyButton.firstChild.textContent = stock <= 0 ? 'Нет в наличии ' : 'Купить ';
    flashConsole();
  }

  $$('.item-row').forEach(function (row) {
    row.addEventListener('click', function () { selectRow(row); });
  });

  /* ---------- покупка ---------- */

  buyButton.addEventListener('click', function () {
    var row = selectedRow();
    if (!row) return;

    var price = Number(row.dataset.price);
    var stock = Number(row.dataset.stock);

    if (stock <= 0) {
      say('«' + row.dataset.name + '» закончился на складе. Ближайшая поставка — через 6 часов по станционному времени.');
      return;
    }
    if (credits < price) {
      say('Недостаточно кредитов: нужно ' + fmt(price) + ' ¤, на счёте ' + fmt(credits) + ' ¤. Могу подобрать аналог дешевле.');
      toast('Покупка отклонена · недостаточно кредитов');
      return;
    }

    credits -= price;
    stock -= 1;
    row.dataset.stock = String(stock);
    row.querySelector('.stock b').textContent = String(stock);
    row.classList.toggle('sold-out', stock <= 0);
    creditsEl.textContent = fmt(credits);

    buyButton.disabled = stock <= 0;
    if (stock <= 0) buyButton.firstChild.textContent = 'Нет в наличии ';

    say('«' + row.dataset.name + '» оформлен. Списано ' + fmt(price) + ' ¤, остаток ' + fmt(credits) + ' ¤. Доставка в ангар — 12 минут.');
    toast('Покупка подтверждена · ' + row.dataset.name);
    flashConsole();
  });

  /* ---------- подсказки ассистента ---------- */

  $$('#suggestions button').forEach(function (button) {
    button.addEventListener('click', function () {
      var reply = REPLIES[button.dataset.prompt];
      if (reply) say(reply);
    });
  });

  /* ---------- категории ---------- */

  $$('#categoryTabs button').forEach(function (button) {
    button.addEventListener('click', function () {
      $$('#categoryTabs button').forEach(function (item) {
        var active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      var category = button.dataset.cat;
      var visible = 0;
      $$('.item-row').forEach(function (row) {
        var show = category === 'all' || row.dataset.cat === category;
        row.hidden = !show;
        if (show) visible += 1;
      });

      $('#shopCount').textContent = visible + ' ' + plural(visible, 'позиция', 'позиции', 'позиций');
      say('Категория «' + button.dataset.label + '»: ' + visible + ' ' + plural(visible, 'позиция', 'позиции', 'позиций') + '. Выберите строку — покажу массу, крепление и цену.');
    });
  });

  /* ---------- док ---------- */

  $$('.dock-card').forEach(function (card) {
    card.addEventListener('click', function () {
      $$('.dock-card').forEach(function (item) {
        var active = item === card;
        item.classList.toggle('active', active);
        item.querySelector('.dock-state').lastChild.textContent = active ? 'Активен' : 'В доке';
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      var name = card.dataset.ship;
      var shipClass = card.dataset.class;
      $('#shipPanelMeta').textContent = name + ' · ' + shipClass.toLowerCase();
      $('#activeShipName').textContent = name.toUpperCase() + ' // ' + shipClass.toUpperCase();
      say('Активный корабль — «' + name + '», ' + shipClass.toLowerCase() + '. Масса ' + card.dataset.mass + ' кг. Дальше можно ставить оборудование в крепления.');
      toast('Активный корабль · ' + name);
    });
  });

  /* ---------- остальные вкладки ---------- */

  $$('.primary-tabs button').forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.classList.contains('active')) return;
      toast('В макете раскрыт раздел «Магазин» · вкладка «' + button.textContent.trim() + '» без изменений');
    });
  });

  /* ---------- лёгкий параллакс голограммы ---------- */

  var stage = $('.assistant-stage');
  var frame = $('#holoFrame');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (stage && frame && !reduced) {
    stage.addEventListener('pointermove', function (event) {
      var box = stage.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width - 0.5;
      var y = (event.clientY - box.top) / box.height - 0.5;
      frame.style.transform = 'translate3d(' + (x * 4).toFixed(1) + 'px,' + (y * 3).toFixed(1) + 'px,0) rotateX(' + (-y * 1.2).toFixed(2) + 'deg) rotateY(' + (x * 1.4).toFixed(2) + 'deg)';
    });
    stage.addEventListener('pointerleave', function () {
      frame.style.transform = '';
    });
  }

  /* Начальное состояние консоли и кнопки */
  selectRow(selectedRow());
})();
