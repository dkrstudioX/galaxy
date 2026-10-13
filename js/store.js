/* Galaxy Admin — слой данных.
   Всё хранится только локально, в localStorage браузера. Никаких серверов и Node.js. */
(function () {
  'use strict';

  var KEY = 'galaxy_admin_db_v1';
  var TYPE_LABEL = { ship: 'корабли', resource: 'ресурсы', equipment: 'оборудование' };

  var db = null;

  function blank() {
    return { props: [], slots: [], categories: [], ships: [], resources: [], equipments: [] };
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
      return { id: str(s.id) || uid(), name: str(s.name).trim() };
    }).filter(function (s) { return s.name; });

    out.categories = arr(data.categories).filter(isObj).map(function (c) {
      var type = c.type === 'resource' || c.type === 'equipment' ? c.type : 'ship';
      return { id: str(c.id) || uid(), type: type, name: str(c.name).trim(), propIds: arr(c.propIds).map(str) };
    }).filter(function (c) { return c.name; });

    out.ships = arr(data.ships).filter(isObj).map(function (s) {
      return { id: str(s.id) || uid(), name: str(s.name).trim(), categoryId: str(s.categoryId), values: obj(s.values), slotIds: arr(s.slotIds).map(str) };
    }).filter(function (s) { return s.name; });

    out.resources = arr(data.resources).filter(isObj).map(makeItem).filter(function (r) { return r.name; });
    out.equipments = arr(data.equipments).filter(isObj).map(makeItem).filter(function (e) { return e.name; });

    pruneRefs(out);
    return out;

    function makeItem(o) {
      return { id: str(o.id) || uid(), name: str(o.name).trim(), categoryId: str(o.categoryId), values: obj(o.values), slotId: o.slotId ? str(o.slotId) : null };
    }
  }

  /* Убираем ссылки на несуществующие записи, чтобы база всегда была согласованной. */
  function pruneRefs(out) {
    var propIds = {}, catIds = {}, slotIds = {};
    out.props.forEach(function (p) { propIds[p.id] = true; });
    out.categories.forEach(function (c) { catIds[c.id] = true; });
    out.slots.forEach(function (s) { slotIds[s.id] = true; });

    out.categories.forEach(function (c) {
      c.propIds = c.propIds.filter(function (id) { return propIds[id]; });
    });
    out.ships.forEach(function (s) {
      if (!catIds[s.categoryId]) s.categoryId = '';
      s.slotIds = s.slotIds.filter(function (id) { return slotIds[id]; });
    });
    out.resources.concat(out.equipments).forEach(function (item) {
      if (!catIds[item.categoryId]) item.categoryId = '';
      if (item.slotId && !slotIds[item.slotId]) item.slotId = null;
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
      ships: all('ships').filter(function (s) { return s.slotIds.indexOf(slotId) > -1; }).map(function (s) { return s.name; }),
      resources: all('resources').filter(function (r) { return r.slotId === slotId; }).map(function (r) { return r.name; }),
      equipments: all('equipments').filter(function (e) { return e.slotId === slotId; }).map(function (e) { return e.name; })
    };
  }

  function categoryUsage(categoryId) {
    var cat = byId('categories', categoryId);
    if (!cat) return [];
    var coll = cat.type === 'ship' ? 'ships' : (cat.type === 'resource' ? 'resources' : 'equipments');
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
    function addSlot(name) { var s = { id: uid(), name: name }; d.slots.push(s); return s; }
    function addCat(type, name, propIds) { var c = { id: uid(), type: type, name: name, propIds: propIds }; d.categories.push(c); return c; }
    function vals(pairs) {
      var out = {};
      for (var i = 0; i < pairs.length; i++) out[pairs[i][0].id] = pairs[i][1];
      return out;
    }
    function addShip(name, cat, valuePairs, slotList) {
      d.ships.push({ id: uid(), name: name, categoryId: cat.id, values: vals(valuePairs), slotIds: slotList.map(function (s) { return s.id; }) });
    }
    function addItem(coll, name, cat, valuePairs, slot) {
      d[coll].push({ id: uid(), name: name, categoryId: cat.id, values: vals(valuePairs), slotId: slot ? slot.id : null });
    }

    var durability = addProp('Прочность', '100');
    var speed = addProp('Скорость', '20');
    var mass = addProp('Масса', '10');
    var cargo = addProp('Вместимость', '200');
    var damage = addProp('Урон', '25');
    var defense = addProp('Защита', '10');
    var fuel = addProp('Расход топлива', '2');
    var rarity = addProp('Редкость', 'Обычный');

    var slotWeapon = addSlot('Оружие');
    var slotEngine = addSlot('Двигатель');
    var slotShield = addSlot('Щит');
    var slotCargo = addSlot('Грузовой отсек');

    var catFrigate = addCat('ship', 'Фрегат', [durability.id, speed.id, mass.id]);
    var catCruiser = addCat('ship', 'Крейсер', [durability.id, speed.id, mass.id, cargo.id]);
    var catMetals = addCat('resource', 'Металлы', [mass.id, rarity.id]);
    var catCrystals = addCat('resource', 'Кристаллы', [rarity.id]);
    var catWeapons = addCat('equipment', 'Оружие', [damage.id, mass.id]);
    var catEngines = addCat('equipment', 'Двигатели', [speed.id, fuel.id]);
    var catDefense = addCat('equipment', 'Защита', [defense.id, mass.id]);
    var catOther = addCat('equipment', 'Прочее', [mass.id]);

    /* У корабля слоты могут повторяться — порядок и повторы сохраняются как заданы. */
    addShip('Сокол', catFrigate, [[durability, '90'], [speed, '26'], [mass, '45']], [slotWeapon, slotWeapon, slotEngine]);
    addShip('Титан', catCruiser, [[durability, '160'], [speed, '14'], [mass, '220'], [cargo, '400']], [slotWeapon, slotWeapon, slotShield, slotCargo, slotCargo, slotCargo]);

    addItem('resources', 'Железо', catMetals, [[mass, '8'], [rarity, 'Обычный']], null);
    addItem('resources', 'Иридий', catMetals, [[mass, '12'], [rarity, 'Редкий']], null);
    addItem('resources', 'Плазменный боеприпас', catCrystals, [[rarity, 'Необычный']], slotWeapon);

    addItem('equipments', 'Лазер Mk I', catWeapons, [[damage, '35'], [mass, '6']], slotWeapon);
    addItem('equipments', 'Ракетная установка', catWeapons, [[damage, '70'], [mass, '18']], slotWeapon);
    addItem('equipments', 'Ионный двигатель', catEngines, [[speed, '32'], [fuel, '3']], slotEngine);
    addItem('equipments', 'Плазменный щит', catDefense, [[defense, '28'], [mass, '14']], slotShield);
    addItem('equipments', 'Ремкомплект', catOther, [[mass, '2']], null);

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
    createSlot: function (name) { return insert('slots', { name: name }); },
    createCategory: function (type, name, propIds) { return insert('categories', { type: type, name: name, propIds: (propIds || []).slice() }); },
    createObject: function (coll, data) {
      var item = { name: data.name, categoryId: data.categoryId, values: data.values || {} };
      if (coll === 'ships') item.slotIds = (data.slotIds || []).slice();
      else item.slotId = data.slotId || null;
      return insert(coll, item);
    },

    propUsage: propUsage,
    slotUsage: slotUsage,
    categoryUsage: categoryUsage,

    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAll: clearAll,
    loadDemo: function () { db = demoData(); persist(); },
    counts: counts
  };
})();
