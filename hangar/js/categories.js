// =============================================================================
// categories.js — дерево категорий и фильтры витрины: подкатегории выбранной
// ветки, отбор объектов, группировка списка и выбор текущей позиции.
// Читает shopItems/categories из catalog.js и state.js, базу — через Store.
// =============================================================================

import { iconForCategory, byId } from './base.js';
import { shopItems, hangarResources } from './catalog.js';
import { state } from './state.js';

/* Категория подходит объекту, если он в ней самой или в любой её подкатегории
   на любую глубину: дерево категорий не ограничено двумя уровнями
   («Ресурсы» → «Топливо» → «Топливные баки»). */
var subtreeCache = {};
function subtreeIds(categoryId) {
  if (!subtreeCache[categoryId]) {
    var set = {};
    if (window.Store) Store.categoryDescendants(categoryId).forEach(function (c) { set[c.id] = true; });
    subtreeCache[categoryId] = set;
  }
  return subtreeCache[categoryId];
}
export function inSubtree(itemCategoryId, categoryId) {
  if (categoryId === 'all') return true;
  if (!itemCategoryId) return false;
  return itemCategoryId === categoryId || !!subtreeIds(categoryId)[itemCategoryId];
}
export function inCategory(item, categoryId) { return inSubtree(item.categoryId, categoryId); }

/* Подкатегории выбранной ветки: id, имя и сколько объектов в каждой (с вложенными). */
export function buildSubcategories(rootId) {
  if (!window.Store || !rootId || rootId === 'all') return [];
  return Store.childCategories(rootId).map(function (cat) {
    return {
      id: cat.id,
      label: cat.name,
      icon: cat.icon || iconForCategory(cat.name),
      count: shopItems.filter(function (it) { return inSubtree(it.categoryId, cat.id); }).length
    };
  });
}

export function filteredItems() {
  return shopItems.filter(function (it) {
    if (!inCategory(it, state.category)) return false;
    if (state.subcategory && !inSubtree(it.categoryId, state.subcategory)) return false;
    return true;
  });
}

/* Ветка, по которой сейчас собран список: выбранный чип или таб. */
export function activeBranch() {
  return state.category === 'all' ? 'all' : (state.subcategory || state.category);
}
/* Категория-группа объекта: ближайшая подкатегория выбранной ветки. */
export function groupCategoryId(itemCategoryId, branch) {
  var chain = window.Store ? Store.categoryChain(itemCategoryId) : [];
  if (!chain.length) return '';
  if (branch === 'all') return chain[0].id;
  for (var i = 0; i < chain.length; i++) {
    if (chain[i].id === branch) return chain[i + 1] ? chain[i + 1].id : chain[i].id;
  }
  return chain[0].id;
}
/* Порядок категорий в дереве — группы идут как в админке. */
var categoryOrder = null;
export function categoryOrderIndex() {
  if (categoryOrder) return categoryOrder;
  categoryOrder = {};
  var i = 0;
  if (window.Store) (function walk(parentId) {
    Store.childCategories(parentId).forEach(function (cat) {
      categoryOrder[cat.id] = i++;
      walk(cat.id);
    });
  })('');
  return categoryOrder;
}
/* Список магазина блоками: позиции собираются под заголовком своей подкатегории. */
export function groupedShopItems(list) {
  var branch = activeBranch();
  var groups = [], index = {};
  list.forEach(function (it) {
    var id = groupCategoryId(it.categoryId, branch);
    if (!index[id]) {
      index[id] = { cat: window.Store && id ? Store.byId('categories', id) : null, items: [] };
      groups.push(index[id]);
    }
    index[id].items.push(it);
  });
  var order = categoryOrderIndex();
  groups.sort(function (a, b) {
    var oa = a.cat ? (order[a.cat.id] || 0) : 0;
    var ob = b.cat ? (order[b.cat.id] || 0) : 0;
    return oa - ob;
  });
  return groups;
}

export function currentShop() {
  var item = byId(shopItems, state.selectedShop);
  var inBranch = item && inCategory(item, state.category) &&
    (!state.subcategory || inSubtree(item.categoryId, state.subcategory));
  if (inBranch) return item;
  return filteredItems()[0] || null;
}
export function activeResource() { return byId(hangarResources, state.selectedResource) || hangarResources[0]; }
