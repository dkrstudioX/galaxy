/* Galaxy Admin — слой данных.
   Всё хранится только локально, в localStorage браузера. Никаких серверов и Node.js. */
(function () {
  'use strict';

  var KEY = 'galaxy_admin_db_v1';
  var TYPE_LABEL = { ship: 'корабли', goods: 'товары' };

  var db = null;

  function blank() {
    return { props: [], slots: [], categories: [], ships: [], goods: [] };
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

  function sanitize(data) {
    var out = blank();
    if (!isObj(data)) return out;

    out.props = arr(data.props).filter(isObj).map(function (p) {
      return { id: str(p.id) || uid(), name: str(p.name).trim(), value: str(p.value) };
    }).filter(function (p) { return p.name; });

    out.slots = arr(data.slots).filter(isObj).map(function (s) {
      return { id: str(s.id) || uid(), name: str(s.name).trim(), capacity: str(s.capacity).trim() };
    }).filter(function (s) { return s.name; });

    out.categories = arr(data.categories).filter(isObj).map(function (c) {
      /* Ресурсы и оборудование объединены в товары: старые типы мигрируют. */
      var type = c.type === 'ship' ? 'ship' : 'goods';
      return { id: str(c.id) || uid(), type: type, name: str(c.name).trim(), propIds: arr(c.propIds).map(str) };
    }).filter(function (c) { return c.name; });

    out.ships = arr(data.ships).filter(isObj).map(function (s) {
      return { id: str(s.id) || uid(), name: str(s.name).trim(), categoryId: str(s.categoryId), values: obj(s.values), slots: makeShipSlots(s) };
    }).filter(function (s) { return s.name; });

    /* Товары: единая коллекция; старые выгрузки с resources/equipments склеиваются. */
    out.goods = arr(data.goods).concat(arr(data.resources), arr(data.equipments))
      .filter(isObj).map(makeItem).filter(function (g) { return g.name; });

    pruneRefs(out);
    return out;

    function makeItem(o) {
      return { id: str(o.id) || uid(), name: str(o.name).trim(), categoryId: str(o.categoryId), values: obj(o.values), mass: str(o.mass).trim(), slotId: o.slotId ? str(o.slotId) : null };
    }

    /* Слоты корабля: [{slotId, contents:[{itemId, qty}]}].
       Старый формат (slotIds: [id]) мигрирует — содержимое остаётся пустым;
       поле kind из прежних выгрузок отбрасывается (id товаров уникальны). */
    function makeShipSlots(s) {
      var entries = arr(s.slots);
      if (!entries.length && Array.isArray(s.slotIds)) {
        entries = s.slotIds.map(function (id) { return { slotId: str(id), contents: [] }; });
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

  /* Убираем ссылки на несуществующие записи, чтобы база всегда была согласованной. */
  function pruneRefs(out) {
    var propIds = {}, catIds = {}, slotIds = {}, goodsIds = {};
    out.props.forEach(function (p) { propIds[p.id] = true; });
    out.categories.forEach(function (c) { catIds[c.id] = true; });
    out.slots.forEach(function (s) { slotIds[s.id] = true; });
    out.goods.forEach(function (g) { goodsIds[g.id] = true; });

    out.categories.forEach(function (c) {
      c.propIds = c.propIds.filter(function (id) { return propIds[id]; });
    });
    out.ships.forEach(function (s) {
      if (!catIds[s.categoryId]) s.categoryId = '';
      s.slots = s.slots.filter(function (e) { return slotIds[e.slotId]; });
      s.slots.forEach(function (e) {
        e.contents = e.contents.filter(function (c) { return goodsIds[c.itemId]; });
      });
    });
    out.goods.forEach(function (g) {
      if (!catIds[g.categoryId]) g.categoryId = '';
      if (g.slotId && !slotIds[g.slotId]) g.slotId = null;
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
  function nameTaken(coll, name, excludeId, type) {
    var n = str(name).trim().toLowerCase();
    if (!n) return false;
    return all(coll).some(function (x) {
      if (excludeId && x.id === excludeId) return false;
      if (type && x.type !== type) return false;
      return str(x.name).trim().toLowerCase() === n;
    });
  }

  /* ---------- Проверки использования ---------- */

  function propUsage(propId) {
    var out = [];
    all('categories').forEach(function (c) {
      if (c.propIds.indexOf(propId) > -1) out.push(c.name + ' (' + TYPE_LABEL[c.type] + ')');
    });
    return out;
  }

  function slotUsage(slotId) {
    return {
      ships: all('ships').filter(function (s) {
        return s.slots.some(function (e) { return e.slotId === slotId; });
      }).map(function (s) { return s.name; }),
      goods: all('goods').filter(function (g) { return g.slotId === slotId; }).map(function (g) { return g.name; })
    };
  }

  function categoryUsage(categoryId) {
    var cat = byId('categories', categoryId);
    if (!cat) return [];
    var coll = cat.type === 'ship' ? 'ships' : 'goods';
    return all(coll).filter(function (o) { return o.categoryId === categoryId; }).map(function (o) { return o.name; });
  }

  /* ---------- Экспорт / импорт / демо ---------- */

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
      ships: d.ships.length,
      resources: d.resources.length,
      equipments: d.equipments.length
    };
  }

  /* ---------- Демонстрационный набор ---------- */

  function demoData() {
    var d = blank();

    function addProp(name, value) { var p = { id: uid(), name: name, value: value }; d.props.push(p); return p; }
    function addSlot(name, capacity) { var s = { id: uid(), name: name, capacity: capacity || '' }; d.slots.push(s); return s; }
    function addCat(type, name, propIds) { var c = { id: uid(), type: type, name: name, propIds: propIds }; d.categories.push(c); return c; }
    function vals(pairs) {
      var out = {};
      for (var i = 0; i < pairs.length; i++) out[pairs[i][0].id] = pairs[i][1];
      return out;
    }
    /* Слоты корабля с содержимым по умолчанию: [{ slot, contents: [{ kind, item, qty }] }] */
    function addShip(name, cat, valuePairs, slotEntries) {
      d.ships.push({
        id: uid(), name: name, categoryId: cat.id, values: vals(valuePairs),
        slots: slotEntries.map(function (e) {
          return {
            slotId: e.slot.id,
            contents: (e.contents || []).map(function (c) { return { kind: c.kind, itemId: c.item.id, qty: String(c.qty) }; })
          };
        })
      });
    }
    function addItem(coll, name, cat, valuePairs, mass, slot) {
      var item = { id: uid(), name: name, categoryId: cat.id, values: vals(valuePairs), mass: mass, slotId: slot ? slot.id : null };
      d[coll].push(item);
      return item;
    }

    var durability = addProp('Прочность', '100');
    var speed = addProp('Скорость', '20');
    var mass = addProp('Масса', '10');
    var cargo = addProp('Вместимость', '200');
    var damage = addProp('Урон', '25');
    var defense = addProp('Защита', '10');
    var fuel = addProp('Расход топлива', '2');
    var rarity = addProp('Редкость', 'Обычный');

    var slotWeapon = addSlot('Оружие', '30');
    var slotEngine = addSlot('Двигатель', '40');
    var slotShield = addSlot('Щит', '25');
    var slotCargo = addSlot('Грузовой отсек', '200');

    var catFrigate = addCat('ship', 'Фрегат', [durability.id, speed.id, mass.id]);
    var catCruiser = addCat('ship', 'Крейсер', [durability.id, speed.id, mass.id, cargo.id]);
    var catMetals = addCat('resource', 'Металлы', [rarity.id]);
    var catCrystals = addCat('resource', 'Кристаллы', [rarity.id]);
    var catWeapons = addCat('equipment', 'Оружие', [damage.id]);
    var catEngines = addCat('equipment', 'Двигатели', [speed.id, fuel.id]);
    var catDefense = addCat('equipment', 'Защита', [defense.id]);
    var catOther = addCat('equipment', 'Прочее', []);

    /* Масса предмета — базовое поле, именно она учитывается вместимостью слотов. */
    var iron = addItem('resources', 'Железо', catMetals, [[rarity, 'Обычный']], '8', null);
    var iridium = addItem('resources', 'Иридий', catMetals, [[rarity, 'Редкий']], '12', null);
    addItem('resources', 'Плазменный боеприпас', catCrystals, [[rarity, 'Необычный']], '3', slotWeapon);

    var laser = addItem('equipments', 'Лазер Mk I', catWeapons, [[damage, '35']], '6', slotWeapon);
    var rockets = addItem('equipments', 'Ракетная установка', catWeapons, [[damage, '70']], '18', slotWeapon);
    var engine = addItem('equipments', 'Ионный двигатель', catEngines, [[speed, '32'], [fuel, '3']], '25', slotEngine);
    var shield = addItem('equipments', 'Плазменный щит', catDefense, [[defense, '28']], '14', slotShield);
    var repairKit = addItem('equipments', 'Ремкомплект', catOther, [], '2', null);

    /* У корабля слоты могут повторяться — порядок и повторы сохраняются как заданы. */
    addShip('Сокол', catFrigate, [[durability, '90'], [speed, '26'], [mass, '45']], [
      { slot: slotWeapon, contents: [{ kind: 'equipment', item: laser, qty: 2 }] },
      { slot: slotWeapon, contents: [{ kind: 'equipment', item: rockets, qty: 1 }] },
      { slot: slotEngine, contents: [{ kind: 'equipment', item: engine, qty: 1 }] }
    ]);
    addShip('Титан', catCruiser, [[durability, '160'], [speed, '14'], [mass, '220'], [cargo, '400']], [
      { slot: slotWeapon, contents: [{ kind: 'equipment', item: rockets, qty: 1 }] },
      { slot: slotWeapon, contents: [{ kind: 'equipment', item: laser, qty: 2 }] },
      { slot: slotShield, contents: [{ kind: 'equipment', item: shield, qty: 1 }] },
      { slot: slotCargo, contents: [
        { kind: 'resource', item: iron, qty: 10 },
        { kind: 'resource', item: iridium, qty: 5 }
      ] },
      { slot: slotCargo, contents: [{ kind: 'equipment', item: repairKit, qty: 5 }] },
      { slot: slotCargo, contents: [] }
    ]);

    return d;
  }

  /* ---------- Публичный API ---------- */

  window.Store = {
    load: ensure,

    props: function () { return all('props'); },
    slots: function () { return all('slots'); },
    categories: function (type) {
      var list = all('categories');
      return type ? list.filter(function (c) { return c.type === type; }) : list;
    },
    ships: function () { return all('ships'); },
    resources: function () { return all('resources'); },
    equipments: function () { return all('equipments'); },

    byId: byId,
    nameTaken: nameTaken,
    patch: patch,
    drop: drop,

    createProp: function (name, value) { return insert('props', { name: name, value: value }); },
    createSlot: function (name, capacity) { return insert('slots', { name: name, capacity: capacity || '' }); },
    createCategory: function (type, name, propIds) { return insert('categories', { type: type, name: name, propIds: (propIds || []).slice() }); },
    createObject: function (coll, data) {
      var item = { name: data.name, categoryId: data.categoryId, values: data.values || {} };
      if (coll === 'ships') {
        item.slots = (data.slots || []).map(function (e) {
          return {
            slotId: e.slotId,
            contents: (e.contents || []).map(function (c) { return { kind: c.kind, itemId: c.itemId, qty: String(c.qty) }; })
          };
        });
      } else {
        item.mass = data.mass || '';
        item.slotId = data.slotId || null;
      }
      return insert(coll, item);
    },

    propUsage: propUsage,
    slotUsage: slotUsage,
    categoryUsage: categoryUsage,

    /* Вместимость слота: пусто или не число — без ограничения. */
    slotCapacity: function (slot) {
      if (!slot) return Infinity;
      var n = parseFloat(str(slot.capacity).replace(',', '.'));
      return isFinite(n) && n >= 0 ? n : Infinity;
    },
    /* Масса одной единицы предмета: пусто или не число — 0. */
    massOf: function (item) {
      if (!item) return 0;
      var n = parseFloat(str(item.mass).replace(',', '.'));
      return isFinite(n) && n > 0 ? n : 0;
    },
    /* Суммарная масса содержимого слота: масса предмета × количество. */
    usedMass: function (contents) {
      var sum = 0;
      (contents || []).forEach(function (c) {
        var item = byId(c.kind === 'resource' ? 'resources' : 'equipments', c.itemId);
        sum += (parseInt(c.qty, 10) || 0) * Store.massOf(item);
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
    loadDemo: function () { db = demoData(); persist(); },
    counts: counts
  };
})();
