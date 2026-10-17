/* Galaxy Admin — слой данных, общий для админки и ангара.
   Всё хранится только локально, в localStorage браузера. Никаких серверов и Node.js.

   Потребители:
   - admin.html      — полный доступ (чтение и запись);
   - hangar/index.html — только чтение: категории, слоты, объекты.

   Публичный API — window.Store, см. в конце файла. */
(function () {
  'use strict';

  var KEY = 'galaxy_admin_db_v1';

  /* Стартовый баланс: он же в демо-наборе. */
  var DEFAULT_CREDITS = 1000;

  var db = null;

  function blank() {
    return { credits: DEFAULT_CREDITS, props: [], slots: [], categories: [], objects: [] };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)); }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function obj(v) {
    var out = {};
    if (isObj(v)) Object.keys(v).forEach(function (k) { out[k] = str(v[k]); });
    return out;
  }

  /* Имя свойства, которым задаётся масса: «Масса» или «Вес», регистр не важен
     (допускаются «Масса корпуса», «Вес груза»). */
  function isMassPropName(name) {
    var n = str(name).trim().toLowerCase();
    return n === 'масса' || n === 'вес' || n.indexOf('масса ') === 0 || n.indexOf('вес ') === 0;
  }

  function sanitize(data) {
    var out = blank();
    if (!isObj(data)) return out;

    /* Баланс хранится вместе с базой; пусто/мусор — стартовые 1000 ¤. */
    var rawCredits = str(data.credits).trim();
    var credits = rawCredits ? Math.floor(Number(rawCredits.replace(',', '.'))) : DEFAULT_CREDITS;
    out.credits = isFinite(credits) && credits >= 0 ? credits : DEFAULT_CREDITS;

    out.props = arr(data.props).filter(isObj).map(function (p) {
      return { id: str(p.id) || uid(), name: str(p.name).trim(), value: str(p.value) };
    }).filter(function (p) { return p.name; });

    /* Слоты: capacity — вместимость в кг, kind — 'cargo' (принимает любой
       груз, кроме кораблей) или 'mount' (только совместимые предметы). */
    out.slots = arr(data.slots).filter(isObj).map(function (s) {
      return {
        id: str(s.id) || uid(), name: str(s.name).trim(), capacity: str(s.capacity).trim(),
        kind: s.kind === 'cargo' ? 'cargo' : 'mount'
      };
    }).filter(function (s) { return s.name; });

    /* Категории — одно дерево: прежние типы 'ship' и 'goods' больше не различаются,
       parentId сохраняется ('' — корневая). isShip — категория корабля:
       флаг наследуется по цепочке до корня; icon — ключ иконки из data/icons.js. */
    out.categories = arr(data.categories).filter(isObj).map(function (c) {
      return {
        id: str(c.id) || uid(), name: str(c.name).trim(),
        propIds: arr(c.propIds).map(str), parentId: str(c.parentId),
        isShip: c.isShip === true || c.isShip === 'true',
        icon: str(c.icon)
      };
    }).filter(function (c) { return c.name; });

    /* Совместимость со старой моделью: «кораблём» был объект, теперь — категория.
       Помечаем категории старых кораблей, чтобы их слоты не потерялись. */
    function markShipCategory(categoryId) {
      var id = str(categoryId);
      out.categories.forEach(function (c) { if (c.id === id) c.isShip = true; });
    }
    arr(data.objects).filter(isObj).forEach(function (o) {
      if (o.isShip === true || o.isShip === 'true') markShipCategory(o.categoryId);
    });
    arr(data.ships).filter(isObj).forEach(function (o) { markShipCategory(o.categoryId); });

    /* Объекты: корабли и предметы — одна коллекция.
       Старые выгрузки читаются из objects, ships, goods, resources и equipments. */
    function collect(list) {
      return arr(list).filter(isObj).map(makeObject);
    }
    out.objects = collect(data.objects)
      .concat(collect(data.ships))
      .concat(collect(data.goods))
      .concat(collect(data.resources))
      .concat(collect(data.equipments))
      .filter(function (o) { return o.name; });

    pruneRefs(out);
    return out;

    function makeObject(o) {
      return {
        id: str(o.id) || uid(),
        name: str(o.name).trim(),
        categoryId: str(o.categoryId),
        parentCategoryId: str(o.parentCategoryId),
        values: obj(o.values),
        /* Старое поле массы: перенесём в свойство при санитизации. */
        mass: str(o.mass).trim(),
        price: str(o.price).trim(),
        icon: str(o.icon),
        slotId: o.slotId ? str(o.slotId) : null,
        slots: makeSlots(o)
      };
    }

    /* Слоты корабля: [{slotId, contents:[{itemId, qty}]}].
       Старый формат (slotIds: [id]) мигрирует — содержимое остаётся пустым;
       поле kind из прежних выгрузок отбрасывается (id объектов уникальны). */
    function makeSlots(o) {
      var entries = arr(o.slots);
      if (!entries.length && Array.isArray(o.slotIds)) {
        entries = o.slotIds.map(function (id) { return { slotId: str(id), contents: [] }; });
      }
      return entries.filter(isObj).map(function (e) {
        return {
          slotId: str(e.slotId),
          contents: arr(e.contents).filter(isObj).map(function (c) {
            var qty = Math.floor(Number(str(c.qty).replace(',', '.')));
            if (!isFinite(qty) || qty < 1) qty = 1;
            return { itemId: str(c.itemId), qty: String(qty) };
          }).filter(function (c) { return c.itemId; })
        };
      });
    }
  }

  /* Корабль ли категория: флаг наследуется по цепочке до корня (parentId = ''). */
  function isShipIn(map, categoryId) {
    var seen = {};
    var cat = categoryId ? map[categoryId] : null;
    while (cat && !seen[cat.id]) {
      if (cat.isShip) return true;
      seen[cat.id] = true;
      cat = cat.parentId ? map[cat.parentId] : null;
    }
    return false;
  }

  function categoryIsShip(categoryId) {
    var map = {};
    all('categories').forEach(function (c) { map[c.id] = c; });
    return isShipIn(map, categoryId);
  }

  /* Убираем ссылки на несуществующие записи, чтобы база всегда была согласованной. */
  function pruneRefs(out) {
    var propIds = {}, catById = {}, slotIds = {}, objIds = {};
    out.props.forEach(function (p) { propIds[p.id] = true; });
    out.categories.forEach(function (c) { catById[c.id] = c; });
    out.slots.forEach(function (s) { slotIds[s.id] = true; });
    out.objects.forEach(function (o) { objIds[o.id] = true; });

    out.categories.forEach(function (c) {
      c.propIds = c.propIds.filter(function (id) { return propIds[id]; });
    });
    fixParents(out.categories);

    /* Масса — обычное свойство; старые данные переносим из поля в значения. */
    var massProp = null;
    out.props.forEach(function (p) { if (!massProp && isMassPropName(p.name)) massProp = p; });

    out.objects.forEach(function (o) {
      var cat = catById[o.categoryId];
      if (!cat) o.categoryId = '';
      /* Родительская категория хранится в объекте для быстрой фильтрации
         (ангар, списки) — пересчитываем её из категории. */
      o.parentCategoryId = cat ? str(cat.parentId) : '';
      if (massProp && !str(o.values[massProp.id]) && o.mass) o.values[massProp.id] = o.mass;
      delete o.mass;
      if (isShipIn(catById, o.categoryId)) {
        /* Корабль никуда не вставляется, у него только свои слоты. */
        o.slotId = null;
        o.slots = o.slots.filter(function (e) { return slotIds[e.slotId]; });
        o.slots.forEach(function (e) {
          e.contents = e.contents.filter(function (c) { return objIds[c.itemId] && c.itemId !== o.id; });
        });
      } else {
        o.slots = [];
        if (o.slotId && !slotIds[o.slotId]) o.slotId = null;
      }
    });
  }

  /* Родитель категории должен существовать, а цепочка — не зацикливаться.
     Иначе категория становится корневой, а не пропадает. */
  function fixParents(categories) {
    var byId = {};
    categories.forEach(function (c) { byId[c.id] = c; });
    categories.forEach(function (c) {
      var seen = {};
      seen[c.id] = true;
      var parentId = c.parentId;
      while (parentId) {
        var parent = byId[parentId];
        if (!parent || seen[parent.id]) { c.parentId = ''; break; }
        seen[parent.id] = true;
        parentId = parent.parentId;
      }
    });
  }

  function ensure() {
    if (db) return db;
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try { db = sanitize(JSON.parse(raw)); } catch (e) { db = blank(); }
    } else {
      db = blank();
    }
    return db;
  }

  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn('Не удалось сохранить данные:', e); }
  }

  /* ---------- Базовые операции ---------- */

  function all(coll) { return ensure()[coll]; }
  function byId(coll, id) {
    var list = all(coll);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function insert(coll, item) {
    ensure();
    item.id = item.id || uid();
    db[coll].push(item);
    persist();
    return item;
  }
  function patch(coll, id, changes) {
    var item = byId(coll, id);
    if (!item) return null;
    Object.keys(changes).forEach(function (k) { item[k] = changes[k]; });
    persist();
    return item;
  }
  function drop(coll, id) {
    ensure();
    db[coll] = db[coll].filter(function (x) { return x.id !== id; });
    persist();
  }
  function nameTaken(coll, name, excludeId) {
    var n = str(name).trim().toLowerCase();
    if (!n) return false;
    return all(coll).some(function (x) {
      if (excludeId && x.id === excludeId) return false;
      return str(x.name).trim().toLowerCase() === n;
    });
  }

  /* ---------- Дерево категорий ---------- */

  /* Категории, непосредственно вложенные в parentId ('' — корневые). */
  function childrenOf(parentId) {
    var pid = str(parentId);
    return all('categories').filter(function (c) { return str(c.parentId) === pid; });
  }

  /* Плоский список дерева для таблиц и селектов: [{cat, depth, hasChildren, childCount}]. */
  function categoryTree() {
    var out = [];
    (function walk(parentId, depth) {
      childrenOf(parentId).forEach(function (c) {
        var kids = childrenOf(c.id);
        out.push({ cat: c, depth: depth, hasChildren: kids.length > 0, childCount: kids.length });
        walk(c.id, depth + 1);
      });
    })('', 0);
    return out;
  }

  /* Цепочка от корня до самой категории: [корень, …, категория]. */
  function categoryChain(id) {
    var chain = [];
    var seen = {};
    var cat = id ? byId('categories', id) : null;
    while (cat && !seen[cat.id]) {
      seen[cat.id] = true;
      chain.unshift(cat);
      cat = cat.parentId ? byId('categories', cat.parentId) : null;
    }
    return chain;
  }

  /* Все подкатегории на любую глубину, сверху вниз. */
  function categoryDescendants(id) {
    var out = [];
    var root = id ? byId('categories', id) : null;
    if (!root) return out;
    var seen = {};
    seen[root.id] = true;
    (function walk(parentId) {
      childrenOf(parentId).forEach(function (c) {
        if (seen[c.id]) return;
        seen[c.id] = true;
        out.push(c);
        walk(c.id);
      });
    })(root.id);
    return out;
  }

  function categoryDepth(id) { return Math.max(0, categoryChain(id).length - 1); }

  /* Подпись пути категории: «Корабли / Линкоры». */
  function categoryPath(id) {
    return categoryChain(id).map(function (c) { return c.name; }).join(' / ');
  }

  /* Свойства цепочки категорий (вместе с самой категорией) с источником каждого. */
  function chainProps(categoryId) {
    var out = [];
    var seen = {};
    categoryChain(categoryId).forEach(function (c) {
      c.propIds.forEach(function (id) {
        if (seen[id]) return;
        var prop = byId('props', id);
        if (!prop) return;
        seen[id] = true;
        out.push({ prop: prop, from: c });
      });
    });
    return out;
  }

  /* Свойства, унаследованные от родительских категорий (без собственных). */
  function inheritedProps(categoryId) {
    var cat = byId('categories', categoryId);
    if (!cat) return [];
    var own = {};
    cat.propIds.forEach(function (id) { own[id] = true; });
    return chainProps(cat.parentId).filter(function (item) { return !own[item.prop.id]; });
  }

  /* Свойства категории с наследованием: сначала родительские, затем собственные. */
  function categoryProps(categoryId) {
    return chainProps(categoryId).map(function (item) { return item.prop; });
  }

  /* Названия уникальны среди соседей: под одним родителем двух «Оружий» быть не может. */
  function categoryNameTaken(name, parentId, excludeId) {
    var n = str(name).trim().toLowerCase();
    if (!n) return false;
    return childrenOf(parentId).some(function (c) {
      if (excludeId && c.id === excludeId) return false;
      return str(c.name).trim().toLowerCase() === n;
    });
  }

  /* ---------- Проверки использования ---------- */

  function propUsage(propId) {
    return all('categories').filter(function (c) { return c.propIds.indexOf(propId) > -1; })
      .map(function (c) { return c.name; });
  }

  /* Слот занят: contains — у этих объектов есть такой слот,
     fits — эти предметы вставляются именно в него. */
  function slotUsage(slotId) {
    return {
      contains: all('objects').filter(function (o) {
        return o.slots.some(function (e) { return e.slotId === slotId; });
      }).map(function (o) { return o.name; }),
      fits: all('objects').filter(function (o) {
        return !categoryIsShip(o.categoryId) && o.slotId === slotId;
      }).map(function (o) { return o.name; })
    };
  }

  /* Где используется объект: имена объектов, в чьих слотах он лежит. */
  function objectUsage(id) {
    return all('objects').filter(function (o) {
      return o.slots.some(function (e) {
        return e.contents.some(function (c) { return c.itemId === id; });
      });
    }).map(function (o) { return o.name; });
  }

  function categoryUsage(categoryId) {
    return all('objects').filter(function (o) { return o.categoryId === categoryId; })
      .map(function (o) { return o.name; });
  }

  /* ---------- Экспорт / импорт ---------- */

  function exportJSON() { return JSON.stringify(ensure(), null, 2); }

  function importJSON(text) {
    var data = JSON.parse(text);
    if (!isObj(data)) throw new Error('Неверный формат файла: ожидался объект с данными.');
    db = sanitize(data);
    persist();
    return db;
  }

  function clearAll() { db = blank(); persist(); }

  function counts() {
    var d = ensure();
    return {
      props: d.props.length,
      slots: d.slots.length,
      categories: d.categories.length,
      objects: d.objects.length
    };
  }

  /* ---------- Баланс ---------- */

  /* Сколько кредитов у игрока. */
  function credits() { return ensure().credits; }

  /* Начислить кредиты: возвращает новое значение. */
  function addCredits(delta) {
    var d = ensure();
    var add = Math.round(Number(delta));
    if (!isFinite(add) || add === 0) return d.credits;
    d.credits = Math.max(0, d.credits + add);
    persist();
    return d.credits;
  }

  /* ---------- Демонстрационный набор ---------- */

  /* Набор для быстрого старта: всё держится на массе.
     Масса — обычное свойство категорий («Масса»), у каждого объекта своё значение.
     Шесть классов кораблей по три, двадцать добытых ресурсов, топливо в баках
     на 1/5/10 тонн, по десять лазеров, пулемётов и щитов, добывающее и
     перерабатывающее оборудование, радары со сканерами и грузовые отсеки.
     Свойство «Редкость» намеренно не используется. */
  function demoData() {
    var d = blank();
    d.credits = DEFAULT_CREDITS;
    var byName = {};

    function addProp(name, value) { var p = { id: uid(), name: name, value: value }; d.props.push(p); return p; }
    function addSlot(name, capacity, kind) {
      var s = { id: uid(), name: name, capacity: capacity || '', kind: kind === 'cargo' ? 'cargo' : 'mount' };
      d.slots.push(s);
      return s;
    }
    function addCat(name, propIds, parent, isShip, icon) {
      var c = {
        id: uid(), name: name, propIds: propIds, parentId: parent ? parent.id : '',
        isShip: !!isShip, icon: icon || ''
      };
      d.categories.push(c);
      return c;
    }
    function vals(pairs) {
      var out = {};
      for (var i = 0; i < pairs.length; i++) out[pairs[i][0].id] = pairs[i][1];
      return out;
    }
    /* Предмет: масса — значение свойства «Масса», плюс свойства категории. */
    function addItem(name, cat, mass, valuePairs, slot, price, icon) {
      var item = {
        id: uid(), name: name, categoryId: cat.id, parentCategoryId: cat.parentId || '',
        values: vals([[massProp, String(mass)]].concat(valuePairs || [])),
        price: price || '', icon: icon || '',
        slotId: slot ? slot.id : null, slots: []
      };
      d.objects.push(item);
      byName[name] = item;
      return item;
    }

    var durability = addProp('Прочность', '100');
    var speed = addProp('Скорость', '20');
    var massProp = addProp('Масса', '10');
    var damage = addProp('Урон', '25');
    var power = addProp('Мощность', '150');
    var fireRate = addProp('Скорострельность', '6');
    var defense = addProp('Защита', '400');
    var regen = addProp('Регенерация', '10');
    var mineSpeed = addProp('Скорость добычи', '5');
    var refineSpeed = addProp('Скорость переработки', '3');
    var scanRange = addProp('Дальность', '10');
    var holdCapacity = addProp('Вместимость', '500');
    var thrust = addProp('Тяга', '100');
    var fuelUse = addProp('Расход топлива', '2');

    /* Крепления под оборудование и грузовые слоты (вместимость — в кг). */
    var slotTurret = addSlot('Орудийная башня', '120');
    var slotGun = addSlot('Пулемётная точка', '60');
    var slotShield = addSlot('Щитовой генератор', '150');
    var slotEngine = addSlot('Двигатель', '300');
    var slotRadar = addSlot('Радар', '80');
    var slotMining = addSlot('Добывающий модуль', '400');
    var slotRefinery = addSlot('Перерабатывающий модуль', '600');
    var slotHold1 = addSlot('Трюм 1 т', '1000', 'cargo');
    var slotHold5 = addSlot('Трюм 5 т', '5000', 'cargo');
    var slotHold10 = addSlot('Трюм 10 т', '10000', 'cargo');

    /* ---------- Категории ---------- */

    var catShips = addCat('Корабли', [durability.id, speed.id, massProp.id], null, true, 'ship');
    var catLiners = addCat('Линкоры', [], catShips, false, 'ship');
    var catFrigates = addCat('Фрегаты', [], catShips, false, 'ship');
    var catCorvettes = addCat('Корветы', [], catShips, false, 'rocket');
    var catInterceptors = addCat('Перехватчики', [], catShips, false, 'rocket');
    var catShuttles = addCat('Шаттлы', [], catShips, false, 'rocket');
    var catFreighters = addCat('Грузовозы', [], catShips, false, 'hangar');

    var catResources = addCat('Ресурсы', [massProp.id], null, false, 'gem');
    var catOres = addCat('Руды', [], catResources, false, 'crate');
    var catMinerals = addCat('Минералы', [], catResources, false, 'gem');

    var catFuel = addCat('Топливо', [massProp.id], null, false, 'fuel');
    var catFuelTanks = addCat('Топливные баки', [], catFuel, false, 'fuel');

    var catEquipment = addCat('Оборудование', [massProp.id], null, false, 'tool');
    var catLasers = addCat('Лазеры', [damage.id, power.id], catEquipment, false, 'bolt');
    var catGuns = addCat('Пулемёты', [damage.id, fireRate.id], catEquipment, false, 'weapon');
    var catShields = addCat('Щиты', [defense.id, regen.id], catEquipment, false, 'shield');
    var catEngines = addCat('Двигатели', [thrust.id, fuelUse.id], catEquipment, false, 'engine');
    var catMining = addCat('Добывающее', [mineSpeed.id], catEquipment, false, 'tool');
    var catRefining = addCat('Переработка', [refineSpeed.id], catEquipment, false, 'tool');
    var catSensors = addCat('Радары и сканеры', [scanRange.id], catEquipment, false, 'radar');
    var catHolds = addCat('Грузовые отсеки', [holdCapacity.id], catEquipment, false, 'crate');

    var catOther = addCat('Прочее', [massProp.id], null, false, 'box');
    var catConsumables = addCat('Расходники', [], catOther, false, 'tool');

    /* ---------- Ресурсы: двадцать добытых позиций ---------- */

    var ores = [
      ['Железная руда', '12', '60'], ['Медная руда', '10', '75'], ['Титановая руда', '15', '120'],
      ['Вольфрамовая руда', '18', '160'], ['Урановая руда', '22', '340'], ['Кобальтовая руда', '14', '190'],
      ['Никелевая руда', '11', '95'], ['Хромовая руда', '13', '140'], ['Боксит', '9', '55'],
      ['Кварцевая руда', '7', '45']
    ];
    var minerals = [
      ['Иридий', '12', '480'], ['Платина', '16', '620'], ['Золото', '14', '700'], ['Серебро', '11', '310'],
      ['Литий', '4', '220'], ['Магний', '6', '130'], ['Цинк', '8', '110'], ['Олово', '9', '90'],
      ['Графит', '5', '70'], ['Кремний', '6', '85']
    ];
    ores.forEach(function (r) { addItem(r[0], catOres, r[1], [], null, r[2], 'crate'); });
    minerals.forEach(function (r) { addItem(r[0], catMinerals, r[1], [], null, r[2], 'gem'); });

    /* ---------- Топливо: баки на 1, 5 и 10 тонн; чем больше объём, тем дешевле тонна ---------- */

    addItem('Топливный бак, 1 т', catFuelTanks, '1000', [], null, '1000', 'fuel');
    addItem('Топливный бак, 5 т', catFuelTanks, '5000', [], null, '4500', 'fuel');
    addItem('Топливный бак, 10 т', catFuelTanks, '10000', [], null, '8000', 'fuel');

    /* ---------- Оружие и защита: по десять позиций ---------- */

    var i;
    for (i = 1; i <= 10; i++) {
      addItem('Лазер M-' + i, catLasers, 4 + i,
        [[damage, String(20 + i * 15)], [power, String(80 + i * 42)]],
        slotTurret, String(900 + i * 430), 'bolt');
    }
    for (i = 1; i <= 10; i++) {
      addItem('Пулемёт P-' + i, catGuns, 6 + i * 2,
        [[damage, String(6 + i * 4)], [fireRate, String(2 + i * 2)]],
        slotGun, String(600 + i * 280), 'weapon');
    }
    for (i = 1; i <= 10; i++) {
      addItem('Щит S-' + i, catShields, 25 + i * 8,
        [[defense, String(150 + i * 130)], [regen, String(4 + i * 3)]],
        slotShield, String(1500 + i * 700), 'shield');
    }

    /* ---------- Двигатели ---------- */

    addItem('Двигатель E-1', catEngines, '80', [[thrust, '120'], [fuelUse, '2']], slotEngine, '2400', 'engine');
    addItem('Двигатель E-2', catEngines, '120', [[thrust, '200'], [fuelUse, '3']], slotEngine, '4200', 'engine');
    addItem('Двигатель E-3', catEngines, '190', [[thrust, '340'], [fuelUse, '5']], slotEngine, '7600', 'engine');
    addItem('Двигатель E-4', catEngines, '280', [[thrust, '520'], [fuelUse, '8']], slotEngine, '12400', 'engine');

    /* ---------- Добыча и переработка ---------- */

    for (i = 1; i <= 5; i++) {
      addItem('Бур D-' + i, catMining, 120 + i * 50, [[mineSpeed, String(4 + i * 4)]],
        slotMining, String(2600 + i * 1800), 'tool');
    }
    for (i = 1; i <= 5; i++) {
      addItem('Переработчик R-' + i, catRefining, 200 + i * 70, [[refineSpeed, String(1 + i * 2)]],
        slotRefinery, String(3800 + i * 2400), 'tool');
    }

    /* ---------- Радары и сканеры ---------- */

    for (i = 1; i <= 4; i++) {
      addItem('Радар R-' + i, catSensors, 20 + i * 6, [[scanRange, String(20 + i * 15)]],
        slotRadar, String(1200 + i * 600), 'radar');
    }
    for (i = 1; i <= 4; i++) {
      addItem('Сканер C-' + i, catSensors, 12 + i * 5, [[scanRange, String(8 + i * 4)]],
        slotRadar, String(900 + i * 500), 'radar');
    }

    /* ---------- Грузовые отсеки: продаются как модули ---------- */

    addItem('Грузовой отсек 500 кг', catHolds, '60', [[holdCapacity, '500']], null, '1200', 'crate');
    addItem('Грузовой отсек 2 т', catHolds, '140', [[holdCapacity, '2000']], null, '3400', 'crate');
    addItem('Грузовой отсек 5 т', catHolds, '260', [[holdCapacity, '5000']], null, '6800', 'crate');
    addItem('Грузовой отсек 10 т', catHolds, '450', [[holdCapacity, '10000']], null, '11000', 'crate');

    /* ---------- Расходники ---------- */

    addItem('Ремкомплект', catConsumables, '2', [], null, '180', 'tool');
    addItem('Набор запчастей', catConsumables, '6', [], null, '420', 'tool');
    addItem('Аптечка', catConsumables, '3', [], null, '260', 'tool');

    /* ---------- Корабли: шесть классов по три ---------- */

    var shipSpecs = [
      /* Линкоры: тяжёлые, медленные, дорогие */
      { name: 'Гром', cat: catLiners, hp: '5200', sp: '11', mass: '18000', price: '184000',
        slots: [[slotTurret], [slotTurret], [slotTurret], [slotTurret], [slotGun],
          [slotShield], [slotShield], [slotEngine], [slotRadar],
          [slotHold5, [['Железная руда', 100], ['Медная руда', 50]]]] },
      { name: 'Молот', cat: catLiners, hp: '6100', sp: '9', mass: '22000', price: '214000',
        slots: [[slotTurret], [slotTurret], [slotTurret], [slotTurret], [slotTurret], [slotGun],
          [slotShield], [slotShield], [slotShield], [slotEngine], [slotRadar], [slotHold5]] },
      { name: 'Цитадель', cat: catLiners, hp: '4800', sp: '12', mass: '16000', price: '158000',
        slots: [[slotTurret], [slotTurret], [slotTurret], [slotGun], [slotGun],
          [slotShield], [slotShield], [slotEngine], [slotRadar], [slotHold5]] },

      /* Фрегаты: универсалы */
      { name: 'Сокол', cat: catFrigates, hp: '2100', sp: '22', mass: '4200', price: '64000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotShield], [slotEngine], [slotRadar], [slotHold1]] },
      { name: 'Клинок', cat: catFrigates, hp: '1900', sp: '25', mass: '3600', price: '58000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotShield], [slotEngine], [slotRadar], [slotHold1]] },
      { name: 'Страж', cat: catFrigates, hp: '2400', sp: '19', mass: '5100', price: '71000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotGun], [slotShield], [slotEngine], [slotRadar], [slotHold1]] },

      /* Корветы: быстрые и маневренные */
      { name: 'Оса', cat: catCorvettes, hp: '1200', sp: '30', mass: '1800', price: '32000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotGun], [slotShield], [slotEngine], [slotHold1]] },
      { name: 'Шершень', cat: catCorvettes, hp: '980', sp: '34', mass: '1400', price: '28000',
        slots: [[slotTurret], [slotGun], [slotGun], [slotGun], [slotShield], [slotEngine], [slotHold1]] },
      { name: 'Вихрь', cat: catCorvettes, hp: '1100', sp: '32', mass: '1600', price: '30000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotGun], [slotShield], [slotEngine], [slotHold1]] },

      /* Перехватчики: максимум скорости */
      { name: 'Стриж', cat: catInterceptors, hp: '620', sp: '52', mass: '420', price: '21000',
        slots: [[slotTurret], [slotTurret], [slotGun], [slotEngine], [slotRadar]] },
      { name: 'Комета', cat: catInterceptors, hp: '540', sp: '58', mass: '360', price: '19000',
        slots: [[slotTurret], [slotGun], [slotGun], [slotEngine], [slotRadar]] },
      { name: 'Игла', cat: catInterceptors, hp: '480', sp: '62', mass: '300', price: '17000',
        slots: [[slotGun], [slotGun], [slotEngine], [slotRadar]] },

      /* Шаттлы: лёгкие грузовики */
      { name: 'Челнок', cat: catShuttles, hp: '380', sp: '28', mass: '240', price: '9800',
        slots: [[slotGun], [slotEngine], [slotHold1]] },
      { name: 'Курьер', cat: catShuttles, hp: '420', sp: '34', mass: '300', price: '12400',
        slots: [[slotGun], [slotEngine], [slotHold1]] },
      { name: 'Паром', cat: catShuttles, hp: '520', sp: '20', mass: '600', price: '15600',
        slots: [[slotGun], [slotShield], [slotEngine], [slotHold1]] },

      /* Грузовозы: промышленники с добычей и переработкой */
      { name: 'Баржа', cat: catFreighters, hp: '2600', sp: '8', mass: '12000', price: '96000',
        slots: [[slotGun], [slotShield], [slotEngine], [slotEngine],
          [slotHold10, [['Титановая руда', 200], ['Вольфрамовая руда', 100]]],
          [slotHold5, [['Железная руда', 100]]]] },
      { name: 'Мамонт', cat: catFreighters, hp: '3400', sp: '6', mass: '16000', price: '138000',
        slots: [[slotGun], [slotGun], [slotShield], [slotEngine], [slotEngine],
          [slotHold10, [['Кварцевая руда', 300]]], [slotHold10]] },
      { name: 'Тягач', cat: catFreighters, hp: '2200', sp: '10', mass: '9000', price: '74000',
        slots: [[slotGun], [slotShield], [slotEngine], [slotMining], [slotRefinery], [slotHold5]] }
    ];

    shipSpecs.forEach(function (spec) {
      d.objects.push({
        id: uid(), name: spec.name, categoryId: spec.cat.id, parentCategoryId: spec.cat.parentId || '',
        values: vals([[durability, spec.hp], [speed, spec.sp], [massProp, spec.mass]]),
        price: spec.price, icon: 'ship', slotId: null,
        slots: spec.slots.map(function (e) {
          return {
            slotId: e[0].id,
            contents: (e[1] || []).map(function (ci) {
              return { itemId: byName[ci[0]].id, qty: String(ci[1]) };
            })
          };
        })
      });
    });

    return d;
  }

  /* ---------- Публичный API ---------- */

  window.Store = {
    load: ensure,

    props: function () { return all('props'); },
    slots: function () { return all('slots'); },
    categories: function () { return all('categories'); },
    objects: function () { return all('objects'); },

    byId: byId,
    nameTaken: nameTaken,
    patch: patch,
    drop: drop,

    createProp: function (name, value) { return insert('props', { name: name, value: value }); },
    createSlot: function (name, capacity, kind) {
      return insert('slots', { name: name, capacity: capacity || '', kind: kind === 'cargo' ? 'cargo' : 'mount' });
    },
    createCategory: function (name, propIds, parentId, isShip, icon) {
      return insert('categories', {
        name: name, propIds: (propIds || []).slice(), parentId: parentId || '', isShip: !!isShip, icon: icon || ''
      });
    },
    createObject: function (data) {
      /* Тип объекта определяет категория: у корабля слоты, у остальных — слот вставки. */
      var isShip = categoryIsShip(data.categoryId);
      var cat = data.categoryId ? byId('categories', data.categoryId) : null;
      return insert('objects', {
        name: data.name,
        categoryId: data.categoryId,
        parentCategoryId: cat ? str(cat.parentId) : '',
        values: data.values || {},
        price: data.price || '',
        icon: data.icon || '',
        slotId: isShip ? null : (data.slotId || null),
        slots: isShip ? (data.slots || []).map(function (e) {
          return {
            slotId: e.slotId,
            contents: (e.contents || []).map(function (c) { return { itemId: c.itemId, qty: String(c.qty) }; })
          };
        }) : []
      });
    },

    propUsage: propUsage,
    slotUsage: slotUsage,
    objectUsage: objectUsage,
    categoryUsage: categoryUsage,

    childCategories: childrenOf,
    categoryIsShip: categoryIsShip,
    categoryTree: categoryTree,
    categoryChain: categoryChain,
    categoryDescendants: categoryDescendants,
    categoryDepth: categoryDepth,
    categoryPath: categoryPath,
    chainProps: chainProps,
    inheritedProps: inheritedProps,
    categoryProps: categoryProps,
    categoryNameTaken: categoryNameTaken,

    /* Вместимость слота: пусто или не число — без ограничения. */
    slotCapacity: function (slot) {
      if (!slot) return Infinity;
      var n = parseFloat(str(slot.capacity).replace(',', '.'));
      return isFinite(n) && n >= 0 ? n : Infinity;
    },
    /* Масса одной единицы: значение свойства «Масса»/«Вес» из категории объекта.
       Старое поле mass читается как запасной вариант. */
    massOf: function (item) {
      if (!item) return 0;
      var prop = null;
      all('props').forEach(function (p) { if (!prop && isMassPropName(p.name)) prop = p; });
      var raw = prop && item.values ? item.values[prop.id] : '';
      if (raw === undefined || raw === '') raw = item.mass;
      var n = parseFloat(str(raw).replace(',', '.'));
      return isFinite(n) && n > 0 ? n : 0;
    },
    /* Свойство, которым задаётся масса (для форм и подсказок). */
    massProp: function () {
      var found = null;
      all('props').forEach(function (p) { if (!found && isMassPropName(p.name)) found = p; });
      return found;
    },
    /* Цена объекта: пусто или не число — 0. */
    priceOf: function (item) {
      if (!item) return 0;
      var n = parseFloat(str(item.price).replace(',', '.'));
      return isFinite(n) && n > 0 ? n : 0;
    },
    /* Суммарная масса содержимого слота: масса объекта × количество. */
    usedMass: function (contents) {
      var sum = 0;
      (contents || []).forEach(function (c) {
        sum += (parseInt(c.qty, 10) || 0) * Store.massOf(byId('objects', c.itemId));
      });
      return sum;
    },
    fmtNum: function (n) {
      if (!isFinite(n)) return '∞';
      return String(Math.round(n * 100) / 100);
    },

    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAll: clearAll,
    credits: credits,
    addCredits: addCredits,
    loadDemo: function () { db = demoData(); persist(); },
    counts: counts
  };
})();
