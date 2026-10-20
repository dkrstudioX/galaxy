// =============================================================================
// catalog.js — данные витрины из data/store.js: строки объектов для магазина,
// табы категорий первого уровня и демо-список ресурсов вкладки «Ангар».
// Модуль только читает базу; состояние и рендер — в других файлах.
// =============================================================================

import { isMassName, iconForCategory } from './base.js';

/* ---------- Данные магазина (объекты из базы админки) ---------- */

/* Объекты админки -> строки витрины: имя, категория, масса и свойства. */
function buildShopItems() {
  if (!window.Store) return [];
  return Store.objects().map(function (o) {
    var cat = Store.byId('categories', o.categoryId);
    var slot = o.slotId ? Store.byId('slots', o.slotId) : null;
    var props = Store.categoryProps(o.categoryId).map(function (p) {
      return { name: p.name, value: (o.values && o.values[p.id]) || p.value || '' };
    }).filter(function (p) { return p.value && !isMassName(p.name); });
    return {
      id: o.id,
      name: o.name,
      categoryId: o.categoryId,
      parentCategoryId: o.parentCategoryId || (cat ? cat.parentId : ''),
      categoryName: cat ? cat.name : '—',
      categoryPath: cat ? Store.categoryPath(cat.id) : '—',
      icon: o.icon || (cat ? iconForCategory(cat.name) : 'grid'),
      mass: Store.massOf(o),
      price: Store.priceBuy(o),
      sale: Store.priceSale(o),
      isShip: Store.categoryIsShip(o.categoryId),
      isResource: Store.isResourceObject(o),
      slotId: o.slotId || '',
      slotName: slot ? slot.name : '',
      props: props
    };
  });
}

export var shopItems = buildShopItems();

/* ---------- Категории магазина ---------- */

/* Запасной набор: если в базе админки ещё нет ни одной категории. */
var FALLBACK_CATEGORIES = [
  { id: 'weapon', label: 'Оружие', icon: 'weapon' },
  { id: 'shield', label: 'Щиты', icon: 'shield' },
  { id: 'resource', label: 'Ресурсы', icon: 'resource' },
  { id: 'ship', label: 'Корабли', icon: 'ship' }
];


/* Табы: «Все» + категории первого уровня из базы админки (data/store.js). */
function buildCategories() {
  var roots = [];
  if (window.Store) {
    roots = Store.childCategories('').map(function (cat) {
      return { id: cat.id, label: cat.name, icon: cat.icon || iconForCategory(cat.name) };
    });
  }
  if (!roots.length) roots = FALLBACK_CATEGORIES.slice();
  return [{ id: 'all', label: 'Все', icon: 'grid' }].concat(roots);
}

export var categories = buildCategories();

export var hangarResources = [
  { id: '201', name: 'Плазменные ячейки', description: 'Стабилизированные энергетические элементы для импульсных систем вооружения.', stats: 'Энергия 80 МДж · Стабильность 96%' },
  { id: '202', name: 'Кристаллы ксенона', description: 'Очищенное топливо для маршевых двигателей и систем сверхсветового перехода.', stats: 'Чистота 99.4% · Класс топлива A' },
  { id: '203', name: 'Сплав «Титан-X»', description: 'Лёгкий композит для ремонта корпуса и усиления внешней брони.', stats: 'Прочность 840 МПа · Масса 12 кг' },
  { id: '204', name: 'Наноремкомплект', description: 'Автономный ремонтный модуль для восстановления обшивки в полевых условиях.', stats: 'Ремонт +320 · Цикл 18 сек.' }
];
