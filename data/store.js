/* Galaxy Admin — слой данных, общий для админки и ангара.
   Всё хранится только локально, в localStorage браузера. Никаких серверов и Node.js.

   Потребители:
   - admin/admin.html — полный доступ (чтение и запись);
   - hangar/index.html — только чтение: категории, слоты, объекты.

   Публичный API — window.Store, см. в конце файла. */
(function () {
  'use strict';

  var KEY = 'galaxy_admin_db_v1';

  /* Стартовый баланс: он же в демо-наборе. */
  var DEFAULT_CREDITS = 3500000;

  var db = null;

  function blank() {
    return { credits: DEFAULT_CREDITS, props: [], slots: [], categories: [], objects: [], users_ships: [] };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)); }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* `prop_2` — материалы, с которыми работает объект: у ресурсов пусто,
     у грузовых отсеков и добывающего оборудования — список материалов.
     Пусто и «0» — «не задано». */
  function prop2List(v) {
    var list = Array.isArray(v) ? v : str(v).split(',');
    return list.map(function (x) { return str(x).trim(); })
      .filter(function (x) { return x && x !== '0'; });
  }

  /* Груз контейнера: ресурс и количество в кг. Строки не разделяются. */
  function makeCargo(list) {
    return arr(list).filter(isObj).map(function (g) {
      var qty = Math.floor(Number(str(g.qty).replace(',', '.')));
      if (!isFinite(qty) || qty < 1) qty = 1;
      return { itemId: str(g.itemId), qty: String(qty) };
    }).filter(function (g) { return g.itemId; });
  }

  /* Содержимое крепления или трюма: каждый предмет — отдельная запись,
     поэтому количество больше единицы разворачивается в несколько записей. */
  function makeContents(list) {
    var out = [];
    arr(list).filter(isObj).forEach(function (c) {
      var itemId = str(c.itemId);
      if (!itemId) return;
      var qty = Math.floor(Number(str(c.qty).replace(',', '.')));
      if (!isFinite(qty) || qty < 1) qty = 1;
      var cargo = makeCargo(c.cargo);
      /* Контейнер с грузом неделим: иначе груз размножился бы вместе с ним. */
      var copies = cargo.length ? 1 : qty;
      for (var i = 0; i < copies; i++) {
        out.push({ itemId: itemId, qty: '1', cargo: i === 0 ? cargo : [] });
      }
    });
    return out;
  }

  /* Крепления корабля: [{slotId, contents}]. Старый формат (slotIds: [id])
     мигрирует — содержимое остаётся пустым. */
  function makeSlots(o) {
    var entries = arr(o.slots);
    if (!entries.length && Array.isArray(o.slotIds)) {
      entries = o.slotIds.map(function (id) { return { slotId: str(id), contents: [] }; });
    }
    return entries.filter(isObj).map(function (e) {
      return { slotId: str(e.slotId), contents: makeContents(e.contents) };
    }).filter(function (e) { return e.slotId; });
  }

  /* Трюмы корабля: [{name, capacity, contents}]. У каждого своя вместимость в кг. */
  function makeHolds(o) {
    return arr(o.holds).filter(isObj).map(function (h) {
      var cap = Number(str(h.capacity).replace(',', '.'));
      return {
        name: str(h.name).trim() || 'Трюм',
        capacity: isFinite(cap) && cap >= 0 ? String(Math.floor(cap)) : '0',
        contents: makeContents(h.contents)
      };
    });
  }

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

    /* Баланс хранится вместе с базой; пусто/мусор — стартовые 3 500 000 ¤. */
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

    /* Купленные корабли — записи пользователя, независимые от каталога:
       у каждой свой набор креплений и трюмов. Старая запись без раскладки
       получает пустую копию раскладки корабля. */
    /* Раскладка записи, которой ещё нет, копируется позже — после того как
       у корабля-каталога «грузовые слоты» станут трюмами (pruneRefs). */
    out.users_ships = arr(data.users_ships).filter(isObj).map(function (u) {
      return {
        id: str(u.id) || uid(),
        shipId: str(u.shipId),
        name: str(u.name).trim(),
        categoryId: str(u.categoryId),
        price: str(u.price).trim(),
        boughtAt: str(u.boughtAt),
        slots: Array.isArray(u.slots) ? makeSlots(u) : null,
        holds: Array.isArray(u.holds) ? makeHolds(u) : null
      };
    }).filter(function (u) { return u.shipId || u.name; });

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
        /* Цены: покупка и продажа. Старое одиночное price мигрирует в оба поля. */
        price_buy: str(o.price_buy).trim() || str(o.price).trim(),
        price_sale: str(o.price_sale).trim() || str(o.price).trim(),
        icon: str(o.icon),
        slotId: o.slotId ? str(o.slotId) : null,
        prop2: prop2List(o.prop2),
        slots: makeSlots(o),
        holds: makeHolds(o)
      };
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
    var propIds = {}, catById = {}, slotIds = {}, objIds = {}, slotById = {};
    out.props.forEach(function (p) { propIds[p.id] = true; });
    out.categories.forEach(function (c) { catById[c.id] = c; });
    out.slots.forEach(function (s) { slotIds[s.id] = true; slotById[s.id] = s; });
    out.objects.forEach(function (o) { objIds[o.id] = true; });

    /* Содержимое без ссылок на существующие предметы (и без самого корабля).
       Одинаковые предметы — разные записи: qty > 1 разворачивается. */
    function cleanCargo(list) {
      return arr(list).filter(isObj).map(function (g) {
        return { itemId: str(g.itemId), qty: str(Math.max(1, parseInt(str(g.qty), 10) || 1)) };
      }).filter(function (g) { return objIds[g.itemId]; });
    }
    function cleanContents(list, owner) {
      var out = [];
      arr(list).filter(isObj).forEach(function (c) {
        var itemId = str(c.itemId);
        if (!objIds[itemId] || (owner && itemId === owner.id)) return;
        var qty = Math.max(1, parseInt(str(c.qty), 10) || 1);
        var cargo = cleanCargo(c.cargo);
        /* Контейнер с грузом неделим: груз остаётся у одной записи. */
        var copies = cargo.length ? 1 : qty;
        for (var i = 0; i < copies; i++) {
          out.push({ itemId: itemId, qty: '1', cargo: i === 0 ? cargo : [] });
        }
      });
      return out;
    }

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
        /* Корабль никуда не вставляется, у него свои крепления и трюмы. */
        o.slotId = null;
        /* Прежние «грузовые слоты» стали трюмами корабля. */
        var kept = [];
        o.slots.forEach(function (e) {
          if (!slotIds[e.slotId]) return;
          var tpl = slotById[e.slotId];
          if (tpl && tpl.kind === 'cargo') {
            o.holds.push({ name: tpl.name, capacity: tpl.capacity, contents: cleanContents(e.contents, o) });
            return;
          }
          e.contents = cleanContents(e.contents, o);
          kept.push(e);
        });
        o.slots = kept;
        o.holds.forEach(function (h) { h.contents = cleanContents(h.contents, o); });
      } else {
        o.slots = [];
        o.holds = [];
        if (o.slotId && !slotIds[o.slotId]) o.slotId = null;
      }
    });

    /* У купленных кораблей — своя раскладка. Старой записи без неё копируем
       пустую раскладку корабля-каталога (уже с трюмами вместо грузовых слотов). */
    var objById = {};
    out.objects.forEach(function (o) { objById[o.id] = o; });

    out.users_ships.forEach(function (r) {
      var ship = objById[r.shipId] || null;
      if (!r.slots) {
        r.slots = ship ? arr(ship.slots).map(function (e) {
          return { slotId: str(e.slotId), contents: [] };
        }) : [];
      }
      if (!r.holds) {
        r.holds = ship ? arr(ship.holds).map(function (h) {
          return { name: h.name, capacity: h.capacity, contents: [] };
        }) : [];
      }
      r.slots = arr(r.slots).filter(function (e) { return slotIds[e.slotId]; });
      r.slots.forEach(function (e) { e.contents = cleanContents(e.contents, r); });
      r.holds = arr(r.holds).map(function (h) {
        h.contents = cleanContents(h.contents, r);
        return h;
      });
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

  /* ---------- Масса и содержимое ---------- */

  /* Масса одной единицы: значение свойства «Масса»/«Вес» из категории объекта.
     Старое поле mass читается как запасной вариант. */
  function massValue(item) {
    if (!item) return 0;
    var prop = null;
    all('props').forEach(function (p) { if (!prop && isMassPropName(p.name)) prop = p; });
    var raw = prop && item.values ? item.values[prop.id] : '';
    if (raw === undefined || raw === '') raw = item.mass;
    var n = parseFloat(str(raw).replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* Единица груза: у оборудования — масса в кг; у ресурсов массы нет,
     поэтому одна единица ресурса занимает один килограмм груза. */
  function cargoUnitsOf(item) {
    var m = massValue(item);
    return m > 0 ? m : 1;
  }

  function fmtNum(n) {
    if (!isFinite(n)) return '∞';
    return (Math.round(n * 100) / 100).toLocaleString('ru-RU');
  }

  /* Масса оборудования в содержимом: предмет × количество, без груза контейнеров. */
  function contentsMass(contents) {
    var sum = 0;
    arr(contents).forEach(function (c) {
      var it = byId('objects', c.itemId);
      sum += (parseInt(c.qty, 10) || 0) * cargoUnitsOf(it);
    });
    return sum;
  }

  /* Масса груза внутри контейнеров: ресурс меряется килограммами (1 ед. = 1 кг). */
  function cargoMass(contents) {
    var sum = 0;
    arr(contents).forEach(function (c) {
      arr(c.cargo).forEach(function (g) {
        var it = byId('objects', g.itemId);
        sum += (parseInt(g.qty, 10) || 0) * cargoUnitsOf(it);
      });
    });
    return sum;
  }

  /* Масса корабля: корпус + всё в креплениях и трюмах. Один рекурсивный обход,
     поэтому каждый объект учитывается ровно один раз. */
  function shipMass(ship) {
    if (!ship) return 0;
    var total = massValue(ship);
    /* У записи купленного корабля своей массы нет — берём корпус из каталога. */
    if (!total && ship.shipId) total = massValue(byId('objects', ship.shipId));
    arr(ship.slots).concat(arr(ship.holds)).forEach(function (e) {
      total += contentsMass(e.contents) + cargoMass(e.contents);
    });
    return total;
  }

  /* Свободная вместимость трюма по массе оборудования (груз контейнеров не в счёт). */
  function holdFree(hold) {
    var cap = parseFloat(str(hold && hold.capacity).replace(',', '.'));
    if (!isFinite(cap) || cap < 0) return Infinity;
    return Math.max(0, cap - contentsMass(hold && hold.contents));
  }

  /* Свободная вместимость контейнера: «Вместимость» минус его груз. */
  function containerFree(entry) {
    if (!entry) return 0;
    return Math.max(0, capacityOf(byId('objects', entry.itemId)) - cargoMass([entry]));
  }

  /* Свойство «Вместимость»/«Ёмкость» — им задаётся вместимость контейнера. */
  function capacityProp() {
    var found = null;
    all('props').forEach(function (p) {
      var n = str(p.name).trim().toLowerCase();
      if (!found && (n === 'вместимость' || n === 'ёмкость' || n === 'емкость')) found = p;
    });
    return found;
  }

  function capacityOf(item) {
    var prop = capacityProp();
    var raw = prop && item && item.values ? item.values[prop.id] : '';
    var n = parseFloat(str(raw).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : 0;
  }

  /* Есть ли материал в `prop_2` объекта (сравнение без регистра). */
  function prop2Has(item, name) {
    var n = str(name).trim().toLowerCase();
    if (!n) return false;
    return arr(item && item.prop2).some(function (x) { return str(x).trim().toLowerCase() === n; });
  }

  /* Корень «Ресурсы»: по нему отличаем ресурсы от оборудования. */
  function resourceRoot() {
    var found = null;
    all('categories').forEach(function (c) {
      if (!found && !c.parentId && str(c.name).trim().toLowerCase() === 'ресурсы') found = c;
    });
    return found;
  }

  /* Все ресурсы каталога: объекты во всём поддереве «Ресурсы». */
  function resourceObjects() {
    var root = resourceRoot();
    if (!root) return [];
    var ids = {};
    ids[root.id] = true;
    categoryDescendants(root.id).forEach(function (c) { ids[c.id] = true; });
    return all('objects').filter(function (o) { return ids[o.categoryId]; });
  }

  function isResourceObject(item) {
    var root = resourceRoot();
    if (!root || !item) return false;
    return categoryChain(item.categoryId).some(function (c) { return c.id === root.id; });
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

  /* Где используется объект: корабли каталога и купленные, в чьих креплениях,
     трюмах или контейнерах он лежит. */
  function objectUsage(id) {
    function hasItem(entries) {
      return arr(entries).some(function (e) {
        return arr(e.contents).some(function (c) {
          return c.itemId === id || arr(c.cargo).some(function (g) { return g.itemId === id; });
        });
      });
    }
    var names = all('objects').filter(function (o) {
      return hasItem(arr(o.slots).concat(arr(o.holds)));
    }).map(function (o) { return o.name; });
    all('users_ships').forEach(function (r) {
      if (hasItem(arr(r.slots).concat(arr(r.holds)))) names.push('корабль «' + r.name + '»');
    });
    return names;
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

  /* ---------- Купленные корабли ---------- */

  /* Цена покупки объекта: пусто или не число — 0. */
  function priceBuy(item) {
    if (!item) return 0;
    var n = parseFloat(str(item.price_buy).replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* Цена продажи: если не задана, считаем равной цене покупки. */
  function priceSale(item) {
    if (!item) return 0;
    var raw = str(item.price_sale).trim() || str(item.price_buy);
    var n = parseFloat(raw.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* Продать купленный корабль: запись удаляется, цена продажи идёт на баланс. */
  function sellShip(recordId) {
    var d = ensure();
    var list = all('users_ships');
    var rec = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === recordId) rec = list[i];
    if (!rec) return { ok: false, error: 'Запись не найдена' };
    var ship = byId('objects', rec.shipId);
    var price = ship ? priceSale(ship) : 0;
    if (!price) return { ok: false, error: 'Цена продажи не задана' };

    d.users_ships = list.filter(function (r) { return r.id !== recordId; });
    var left = addCredits(price);
    return { ok: true, name: rec.name, price: price, credits: left };
  }

  function userShips() { return all('users_ships'); }

  /* Продать предмет с корабля: крепление или трюм, одна запись содержимого.
     Контейнер с грузом продаётся только вместе с грузом (withCargo): цена
     складывается из цены предмета и цены ресурсов внутри. */
  function sellEntry(recordId, place, entryIndex, withCargo) {
    var d = ensure();
    var rec = byId('users_ships', recordId);
    if (!rec) return { ok: false, error: 'Корабль не найден' };
    var kind = place && place.kind === 'slot' ? 'slot' : 'hold';
    var list = arr(kind === 'slot' ? rec.slots : rec.holds);
    var box = list[place && place.index];
    if (!box) return { ok: false, error: 'Место не найдено' };
    var contents = arr(box.contents);
    var pos = Math.floor(Number(entryIndex));
    var entry = pos >= 0 ? contents[pos] : null;
    if (!entry) return { ok: false, error: 'Предмет не найден' };
    var item = byId('objects', entry.itemId);
    if (!item) return { ok: false, error: 'Объект не найден' };

    /* Реальный груз: пустые строки не считаются и не мешают продаже. */
    var cargo = arr(entry.cargo).map(function (g) {
      return { entry: g, res: byId('objects', g.itemId), kg: parseInt(g.qty, 10) || 0 };
    }).filter(function (g) { return g.res && g.kg > 0; });
    if (cargo.length && !withCargo) {
      return { ok: false, error: 'В контейнере есть груз', needsCargo: true };
    }
    var amount = Math.max(1, parseInt(entry.qty, 10) || 1);
    var itemPrice = priceSale(item) * amount;
    if (!itemPrice) return { ok: false, error: 'Цена продажи не задана' };
    var cargoPrice = 0;
    var cargoKg = 0;
    var noPrice = null;
    cargo.forEach(function (g) {
      var p = priceSale(g.res);
      if (!p) { if (!noPrice) noPrice = g.res; return; }
      cargoKg += g.kg;
      cargoPrice += p * g.kg;
    });
    if (noPrice) {
      return { ok: false, error: 'У груза «' + noPrice.name + '» не задана цена продажи' };
    }
    var total = itemPrice + cargoPrice;

    contents.splice(pos, 1);
    d.credits = Math.max(0, d.credits + total);
    persist();
    return {
      ok: true, name: item.name, price: total, itemPrice: itemPrice,
      cargoPrice: cargoPrice, cargoKg: cargoKg, credits: d.credits
    };
  }

  /* Купить корабль: списывает цену покупки и пишет запись в users_ships. */
  function buyShip(objectId) {
    var ship = byId('objects', objectId);
    if (!ship) return { ok: false, error: 'Объект не найден' };
    if (!categoryIsShip(ship.categoryId)) return { ok: false, error: 'Это не корабль' };
    var price = priceBuy(ship);
    if (!price) return { ok: false, error: 'Цена не задана' };
    if (price > credits()) return { ok: false, error: 'Недостаточно кредитов', price: price, credits: credits() };

    addCredits(-price);
    /* Своя раскладка на каждый купленный корабль: крепления и трюмы пустые. */
    var record = insert('users_ships', {
      shipId: ship.id,
      name: ship.name,
      categoryId: ship.categoryId,
      price: String(price),
      boughtAt: new Date().toISOString(),
      slots: arr(ship.slots).map(function (e) { return { slotId: e.slotId, contents: [] }; }),
      holds: arr(ship.holds).map(function (h) {
        return { name: h.name, capacity: h.capacity, contents: [] };
      })
    });
    return { ok: true, record: record, price: price, credits: credits() };
  }

  /* ---------- Покупка на корабль ---------- */

  /* Все экземпляры в креплениях и трюмах записи: у контейнера свой груз. */
  function shipEntries(record) {
    var out = [];
    arr(record && record.slots).forEach(function (s) {
      arr(s.contents).forEach(function (e) { out.push(e); });
    });
    arr(record && record.holds).forEach(function (h) {
      arr(h.contents).forEach(function (e) { out.push(e); });
    });
    return out;
  }

  function objectName(id) {
    var it = byId('objects', id);
    return it ? it.name : '—';
  }

  /* Первое свободное крепление нужного типа (в креплении — ровно один предмет). */
  function freeMountFor(record, item) {
    if (!item || !item.slotId) return null;
    var list = arr(record && record.slots);
    for (var i = 0; i < list.length; i++) {
      if (list[i].slotId === item.slotId && !arr(list[i].contents).length) return list[i];
    }
    return null;
  }

  /* Первый трюм, где хватает места по массе оборудования. */
  function holdFor(record, item, amount) {
    var need = massValue(item) * amount;
    var list = arr(record && record.holds);
    for (var i = 0; i < list.length; i++) {
      if (holdFree(list[i]) + 1e-9 >= need) return list[i];
    }
    return null;
  }

  /* Первый контейнер, который принимает материал и где есть место. */
  function containerFor(record, resource, amount) {
    var list = shipEntries(record);
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var it = byId('objects', entry.itemId);
      if (!it || !(capacityOf(it) > 0)) continue;
      if (!prop2Has(it, resource.name)) continue;
      if (containerFree(entry) + 1e-9 < amount) continue;
      return entry;
    }
    return null;
  }

  /* Каждый купленный предмет — отдельная запись: одинаковые не складываются.
     У контейнера тоже своя запись: у каждого свой груз. */
  function addToHold(hold, item, amount) {
    if (!Array.isArray(hold.contents)) hold.contents = [];
    var entry = null;
    for (var i = 0; i < amount; i++) {
      entry = { itemId: item.id, qty: '1', cargo: [] };
      hold.contents.push(entry);
    }
    return entry;
  }

  function addCargo(entry, resource, amount) {
    if (!Array.isArray(entry.cargo)) entry.cargo = [];
    for (var i = 0; i < entry.cargo.length; i++) {
      if (entry.cargo[i].itemId === resource.id) {
        entry.cargo[i].qty = String((parseInt(entry.cargo[i].qty, 10) || 0) + amount);
        return entry.cargo[i];
      }
    }
    var line = { itemId: resource.id, qty: String(amount) };
    entry.cargo.push(line);
    return line;
  }

  /* Купить предмет на конкретный корабль.
     Ресурс — в первый подходящий контейнер; оборудование — в свободное
     крепление, иначе в трюм; если никуда — отказ с причиной. */
  function buyForShip(recordId, objectId, qty) {
    var d = ensure();
    var record = byId('users_ships', recordId);
    if (!record) return { ok: false, error: 'Корабль не найден' };
    var item = byId('objects', objectId);
    if (!item) return { ok: false, error: 'Объект не найден' };
    if (categoryIsShip(item.categoryId)) return { ok: false, error: 'Корабли покупаются отдельно' };

    /* Одна покупка = одна штука; количество позже — только для ресурсов (кг). */
    var amount = Math.max(1, Math.floor(Number(qty) || 1));
    if (!isResourceObject(item)) amount = 1;
    var price = priceBuy(item) * amount;
    if (!price) return { ok: false, error: 'Цена не задана' };
    if (price > d.credits + 1e-9) {
      return {
        ok: false, error: 'Не хватает кредитов: нужно ' + fmtNum(price) + ' ¤, на счету ' + fmtNum(d.credits) + ' ¤',
        price: price, credits: d.credits
      };
    }

    var where = '';
    if (isResourceObject(item)) {
      var box = containerFor(record, item, amount);
      if (!box) {
        return {
          ok: false,
          error: 'Нет подходящего грузового отсека: «' + item.name + '» некуда положить. ' +
            'Нужен отсек, у которого в prop_2 есть этот материал, и в нём должно хватить места.',
          price: price
        };
      }
      addCargo(box, item, amount);
      where = 'контейнер «' + objectName(box.itemId) + '»';
    } else {
      var mount = freeMountFor(record, item);
      if (mount) {
        mount.contents.push({ itemId: item.id, qty: '1', cargo: [] });
        var slot = byId('slots', mount.slotId);
        where = 'крепление «' + (slot ? slot.name : '—') + '»';
      } else {
        var hold = holdFor(record, item, amount);
        if (!hold) {
          return {
            ok: false,
            error: 'Нет свободного крепления и нет места в трюме для «' + item.name + '»: ' +
              (item.slotId ? 'все крепления этого типа заняты, ' : '') + 'а трюмы заполнены.',
            price: price
          };
        }
        addToHold(hold, item, amount);
        where = 'трюм «' + hold.name + '»';
      }
    }

    d.credits = Math.max(0, d.credits - price);
    persist();
    return { ok: true, price: price, credits: d.credits, where: where, qty: amount };
  }

  /* ---------- Демонстрационный набор ---------- */

  /* Набор для быстрого старта. Масса — обычное свойство категорий («Масса»),
     у каждого объекта своё значение. У ресурсов массы нет: их количество
     измеряется в килограммах, и килограмм — это и есть груз.
     Три корневые категории: «Оборудование», «Ресурсы», «Корабли».
     Ресурсы — четыре материала без подкатегорий; «Топливо» оставлено пустым
     на будущее. Баки, грузовые отсеки и добывающее оборудование — оборудование
     с заполненным `prop_2`.
     У кораблей свои крепления и трюмы: трюмы больше не шаблоны слотов,
     у каждого своя вместимость.
     Свойство «Редкость» намеренно не используется. */
  function demoData() {
    var d = blank();
    d.credits = DEFAULT_CREDITS;

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
    /* Цена покупки до 1000 ¤, продажа на 150–350 меньше. */
    var priceStep = 0;
    function prices(buy) {
      var offsets = [150, 250, 350];
      var b = Math.min(1000, Math.max(351, Math.round(Number(buy) || 0)));
      var sale = Math.max(0, b - offsets[priceStep % offsets.length]);
      priceStep++;
      return { buy: String(b), sale: String(sale) };
    }
    /* Предмет: масса — значение свойства «Масса», плюс свойства категории.
       `prop2` — материалы объекта (грузовые отсеки, добывающее оборудование).
       `rawPrices` — готовые цены: ресурсы продаются за килограмм и в общий
       диапазон оборудования не попадают. */
    function addItem(name, cat, mass, valuePairs, slot, buy, icon, prop2, rawPrices) {
      var p = rawPrices || prices(buy);
      var values = (valuePairs || []).slice();
      if (mass) values.unshift([massProp, String(mass)]);
      var item = {
        id: uid(), name: name, categoryId: cat.id, parentCategoryId: cat.parentId || '',
        values: vals(values),
        price_buy: p.buy, price_sale: p.sale, icon: icon || '',
        slotId: slot ? slot.id : null,
        prop2: prop2List(prop2),
        slots: [], holds: []
      };
      d.objects.push(item);
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

    /* Крепления под оборудование (вместимость — в кг).
       Трюмы больше не шаблоны слотов: они задаются у корабля. */
    var slotTurret = addSlot('Орудийная башня', '120');
    var slotGun = addSlot('Пулемётная точка', '60');
    var slotShield = addSlot('Щитовой генератор', '150');
    var slotEngine = addSlot('Двигатель', '300');
    var slotRadar = addSlot('Радар', '80');
    var slotMining = addSlot('Добывающий модуль', '400');
    var slotRefinery = addSlot('Перерабатывающий модуль', '600');
    /* Отдельное крепление под грузовой отсек: контейнер встаёт сюда,
       а если оно занято — в трюм. */
    var slotCargoBay = addSlot('Грузовой отсек', '');

    /* ---------- Категории: три корня — оборудование, ресурсы, корабли ---------- */

    var catEquipment = addCat('Оборудование', [massProp.id], null, false, 'tool');
    var catLasers = addCat('Лазеры', [damage.id, power.id], catEquipment, false, 'bolt');
    var catGuns = addCat('Пулемёты', [damage.id, fireRate.id], catEquipment, false, 'weapon');
    var catShields = addCat('Щиты', [defense.id, regen.id], catEquipment, false, 'shield');
    var catEngines = addCat('Двигатели', [thrust.id, fuelUse.id], catEquipment, false, 'engine');
    var catMining = addCat('Добывающее', [mineSpeed.id], catEquipment, false, 'tool');
    var catRefining = addCat('Переработка', [refineSpeed.id], catEquipment, false, 'tool');
    var catSensors = addCat('Радары и сканеры', [scanRange.id], catEquipment, false, 'radar');
    var catHolds = addCat('Грузовые отсеки', [holdCapacity.id], catEquipment, false, 'crate');
    var catConsumables = addCat('Расходники', [], catEquipment, false, 'tool');

    /* У ресурсов свойства «Масса» нет: количество ресурса и есть масса груза. */
    var catResources = addCat('Ресурсы', [], null, false, 'gem');
    /* «Топливо» пока пустое: бак — оборудование, его `prop_2` разрешает топливо. */
    var catFuel = addCat('Топливо', [], catResources, false, 'fuel');

    /* Бак — контейнер: своя масса и своя вместимость, `prop_2` = топливо. */
    var catFuelTanks = addCat('Топливные баки', [massProp.id, holdCapacity.id], catEquipment, false, 'fuel');

    var catShips = addCat('Корабли', [durability.id, speed.id, massProp.id], null, true, 'ship');
    var catLiners = addCat('Линкоры', [], catShips, false, 'ship');
    var catFrigates = addCat('Фрегаты', [], catShips, false, 'ship');
    var catCorvettes = addCat('Корветы', [], catShips, false, 'rocket');
    var catInterceptors = addCat('Перехватчики', [], catShips, false, 'rocket');
    var catShuttles = addCat('Шаттлы', [], catShips, false, 'rocket');
    var catFreighters = addCat('Грузовозы', [], catShips, false, 'hangar');

    /* ---------- Ресурсы: четыре материала, цена за килограмм ---------- */

    var materials = [
      { name: 'Железо', buy: '6', sale: '4', icon: 'crate' },
      { name: 'Медь', buy: '9', sale: '6', icon: 'crate' },
      { name: 'Золото', buy: '25', sale: '18', icon: 'gem' },
      { name: 'Камень', buy: '3', sale: '2', icon: 'gem' }
    ];
    materials.forEach(function (m) {
      addItem(m.name, catResources, '', [], null, m.buy, m.icon, null, { buy: m.buy, sale: m.sale });
    });
    var materialNames = materials.map(function (m) { return m.name; });

    /* ---------- Топливо: баки на 1, 5 и 10 тонн; вместимость — в кг ---------- */

    addItem('Топливный бак, 1 т', catFuelTanks, '120', [[holdCapacity, '1000']], null, '400', 'fuel', ['Топливо']);
    addItem('Топливный бак, 5 т', catFuelTanks, '350', [[holdCapacity, '5000']], null, '800', 'fuel', ['Топливо']);
    addItem('Топливный бак, 10 т', catFuelTanks, '600', [[holdCapacity, '10000']], null, '1000', 'fuel', ['Топливо']);

    /* ---------- Оружие и защита: по десять позиций ---------- */

    var i;
    for (i = 1; i <= 10; i++) {
      addItem('Лазер M-' + i, catLasers, 4 + i,
        [[damage, String(20 + i * 15)], [power, String(80 + i * 42)]],
        slotTurret, String(300 + i * 70), 'bolt');
    }
    for (i = 1; i <= 10; i++) {
      addItem('Пулемёт P-' + i, catGuns, 6 + i * 2,
        [[damage, String(6 + i * 4)], [fireRate, String(2 + i * 2)]],
        slotGun, String(310 + i * 45), 'weapon');
    }
    for (i = 1; i <= 10; i++) {
      addItem('Щит S-' + i, catShields, 25 + i * 8,
        [[defense, String(150 + i * 130)], [regen, String(4 + i * 3)]],
        slotShield, String(300 + i * 65), 'shield');
    }

    /* ---------- Двигатели ---------- */

    addItem('Двигатель E-1', catEngines, '80', [[thrust, '120'], [fuelUse, '2']], slotEngine, '550', 'engine');
    addItem('Двигатель E-2', catEngines, '120', [[thrust, '200'], [fuelUse, '3']], slotEngine, '700', 'engine');
    addItem('Двигатель E-3', catEngines, '190', [[thrust, '340'], [fuelUse, '5']], slotEngine, '850', 'engine');
    addItem('Двигатель E-4', catEngines, '280', [[thrust, '520'], [fuelUse, '8']], slotEngine, '1000', 'engine');

    /* ---------- Добыча и переработка ---------- */

    /* Добывающее оборудование: `prop_2` — какие материалы оно добывает. */
    for (i = 1; i <= 5; i++) {
      addItem('Бур D-' + i, catMining, 120 + i * 50, [[mineSpeed, String(4 + i * 4)]],
        slotMining, String(400 + i * 100), 'tool', materialNames);
    }
    for (i = 1; i <= 5; i++) {
      addItem('Переработчик R-' + i, catRefining, 200 + i * 70, [[refineSpeed, String(1 + i * 2)]],
        slotRefinery, String(450 + i * 100), 'tool');
    }

    /* ---------- Радары и сканеры ---------- */

    for (i = 1; i <= 4; i++) {
      addItem('Радар R-' + i, catSensors, 20 + i * 6, [[scanRange, String(20 + i * 15)]],
        slotRadar, String(300 + i * 90), 'radar');
    }
    for (i = 1; i <= 4; i++) {
      addItem('Сканер C-' + i, catSensors, 12 + i * 5, [[scanRange, String(8 + i * 4)]],
        slotRadar, String(290 + i * 80), 'radar');
    }

    /* ---------- Грузовые отсеки: оборудование-контейнер ----------
       `prop_2` — какие материалы отсек принимает; вместимость — своя. */

    addItem('Грузовой отсек 500 кг', catHolds, '60', [[holdCapacity, '500']], slotCargoBay, '350', 'crate', ['Камень']);
    addItem('Грузовой отсек 2 т', catHolds, '140', [[holdCapacity, '2000']], slotCargoBay, '500', 'crate', ['Железо', 'Медь']);
    addItem('Грузовой отсек 5 т', catHolds, '260', [[holdCapacity, '5000']], slotCargoBay, '700', 'crate', ['Медь', 'Золото']);
    addItem('Грузовой отсек 10 т', catHolds, '450', [[holdCapacity, '10000']], slotCargoBay, '900', 'crate', materialNames);

    /* ---------- Расходники ---------- */

    addItem('Ремкомплект', catConsumables, '2', [], null, '350', 'tool');
    addItem('Набор запчастей', catConsumables, '6', [], null, '380', 'tool');
    addItem('Аптечка', catConsumables, '3', [], null, '420', 'tool');

    /* ---------- Корабли: шесть классов — по одному стартовому кораблю ---------- */

    /* Раскладка креплений: [шаблон, сколько таких]. У стартового корабля
       на месте все крепления класса — они просто пустые. */
    function layout(parts) {
      var out = [];
      parts.forEach(function (pair) {
        for (var n = 0; n < pair[1]; n++) out.push({ slotId: pair[0].id, contents: [] });
      });
      return out;
    }

    /* Трюмы корабля: у каждого своя вместимость в кг. */
    function holds(list) {
      return list.map(function (h) { return { name: h[0], capacity: String(h[1]), contents: [] }; });
    }

    /* Стартовые корабли: слабые характеристики и низкая цена — первые машины
       в своей категории, но с полным набором слотов класса.
       Цена растёт от шаттла к линкору: 350 → 600, продажа — на 110–180 меньше. */
    var shipSpecs = [
      /* Линкор: четыре орудийные башни, два пулемёта, два щита, трюм 5 т */
      { name: 'Гром', cat: catLiners, hp: '2200', sp: '10', mass: '12000', buy: '600', sale: '420',
        layout: [[slotTurret, 4], [slotGun, 2], [slotShield, 2], [slotEngine, 1],
          [slotRadar, 1], [slotCargoBay, 1]],
        holds: [['Трюм', 5000]] },

      /* Фрегат: универсал — башни, пулемёты, щит, радар, два трюма по 1 т */
      { name: 'Сокол', cat: catFrigates, hp: '900', sp: '22', mass: '3200', buy: '450', sale: '320',
        layout: [[slotTurret, 2], [slotGun, 2], [slotShield, 1], [slotEngine, 1],
          [slotRadar, 1]],
        holds: [['Трюм 1', 1000], ['Трюм 2', 1000]] },

      /* Корвет: быстрый — две башни, пулемёт, щит, радар и трюм 1 т */
      { name: 'Оса', cat: catCorvettes, hp: '620', sp: '30', mass: '1700', buy: '410', sale: '290',
        layout: [[slotTurret, 2], [slotGun, 1], [slotShield, 1], [slotEngine, 1],
          [slotRadar, 1]],
        holds: [['Трюм', 1000]] },

      /* Перехватчик: две башни, пулемёт, двигатель и радар, без трюма и щита */
      { name: 'Стриж', cat: catInterceptors, hp: '380', sp: '48', mass: '460', buy: '380', sale: '260',
        layout: [[slotTurret, 2], [slotGun, 1], [slotEngine, 1], [slotRadar, 1]],
        holds: [] },

      /* Шаттл: лёгкий возчик — пулемёт, щит, радар и два трюма по 1 т */
      { name: 'Челнок', cat: catShuttles, hp: '260', sp: '26', mass: '320', buy: '350', sale: '240',
        layout: [[slotGun, 1], [slotShield, 1], [slotEngine, 1], [slotRadar, 1]],
        holds: [['Трюм 1', 1000], ['Трюм 2', 1000]] },

      /* Грузовоз: два двигателя, добыча с переработкой, трюмы 10 и 5 т */
      { name: 'Баржа', cat: catFreighters, hp: '1400', sp: '8', mass: '7000', buy: '520', sale: '380',
        layout: [[slotGun, 1], [slotShield, 1], [slotEngine, 2], [slotRadar, 1],
          [slotMining, 1], [slotRefinery, 1]],
        holds: [['Трюм 1', 10000], ['Трюм 2', 5000]] }
    ];

    var shipRefs = {};
    shipSpecs.forEach(function (spec) {
      var ship = {
        id: uid(), name: spec.name, categoryId: spec.cat.id, parentCategoryId: spec.cat.parentId || '',
        values: vals([[durability, spec.hp], [speed, spec.sp], [massProp, spec.mass]]),
        price_buy: spec.buy, price_sale: spec.sale, icon: 'ship', slotId: null,
        prop2: [],
        slots: layout(spec.layout),
        holds: holds(spec.holds || [])
      };
      d.objects.push(ship);
      shipRefs[spec.name] = ship;
    });

    /* Один корабль уже куплен — стартовый ангар пользователя: самый дешёвый шаттл. */
    var boughtShips = ['Челнок'];
    boughtShips.forEach(function (name, index) {
      var ship = shipRefs[name];
      if (!ship) return;
      var day = new Date(Date.UTC(2026, 8, 20 + index));
      d.users_ships.push({
        id: uid(), shipId: ship.id, name: ship.name, categoryId: ship.categoryId,
        price: ship.price_buy, boughtAt: day.toISOString(),
        slots: ship.slots.map(function (e) { return { slotId: e.slotId, contents: [] }; }),
        holds: ship.holds.map(function (h) { return { name: h.name, capacity: h.capacity, contents: [] }; })
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
        price_buy: data.price_buy || '',
        price_sale: data.price_sale || '',
        icon: data.icon || '',
        slotId: isShip ? null : (data.slotId || null),
        prop2: prop2List(data.prop2),
        slots: isShip ? makeSlots(data) : [],
        holds: isShip ? makeHolds(data) : []
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
    massOf: massValue,
    cargoUnits: cargoUnitsOf,
    /* Свойство, которым задаётся масса (для форм и подсказок). */
    massProp: function () {
      var found = null;
      all('props').forEach(function (p) { if (!found && isMassPropName(p.name)) found = p; });
      return found;
    },
    /* Цена объекта: пусто или не число — 0. */
    priceBuy: priceBuy,
    /* Цена продажи: если не задана, считаем равной цене покупки. */
    priceSale: priceSale,
    /* Суммарная масса содержимого слота/трюма: единиц груза × количество. */
    usedMass: contentsMass,
    contentsMass: contentsMass,
    cargoMass: cargoMass,
    shipMass: shipMass,
    holdFree: holdFree,
    containerFree: containerFree,
    capacityOf: capacityOf,
    prop2Has: prop2Has,
    prop2List: prop2List,
    resourceObjects: resourceObjects,
    isResourceObject: isResourceObject,
    fmtNum: fmtNum,

    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAll: clearAll,
    credits: credits,
    addCredits: addCredits,
    userShips: userShips,
    buyShip: buyShip,
    buyForShip: buyForShip,
    sellEntry: sellEntry,
    sellShip: sellShip,
    loadDemo: function () { db = demoData(); persist(); },
    counts: counts
  };
})();
