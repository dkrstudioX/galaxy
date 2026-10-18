// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата), боковые блоки
// «КАРТА СИСТЕМЫ» (дерево планет/лун) и «ОБЪЕКТ» (информация о выбранном).
// Выбор делается кликом по канвасу (selectBody вызывает input.js) или по
// элементу дерева. Шапка каждого блока сворачивает его — отдельных кнопок
// «скрыть/показать» нет. Работает с DOM, не с канвасом.
// =============================================================================

import { state } from './state.js';
import { formatSimDate } from './math.js';
import { SUN_R, COLORS } from './config.js';
import { planets, moonTree, moonTotals, moonsByPlanet, moonDist, baseOrbitRadius } from './data.js';

// Русские названия и подписи классов для блока «ОБЪЕКТ».
const RU = {
    Sun: 'Солнце', Mercury: 'Меркурий', Venus: 'Венера', Earth: 'Земля', Mars: 'Марс',
    Jupiter: 'Юпитер', Saturn: 'Сатурн', Uranus: 'Уран', Neptune: 'Нептун'
};
const TYPES = {
    rocky: 'Каменная планета', earth: 'Обитаемая планета',
    gas: 'Газовый гигант', ice: 'Ледяной гигант'
};

function fmtPeriod(days) {
    const d = Math.round(days * 100) / 100;
    return days >= 365.25
        ? d + ' сут (' + (days / 365.256).toFixed(2) + ' лет)'
        : d + ' сут';
}

/** Собрать ссылки на элементы HUD. Вызывается один раз в main.js. */
export function getHudElements() {
    return {
        zEl: document.getElementById('z'),
        speedEl: document.getElementById('speed'),
        daysEl: document.getElementById('days'),
        dateEl: document.getElementById('date')
    };
}

/** Собрать ссылки на кнопки скорости. */
export function getSpeedButtons() {
    return {
        slowBtn: document.getElementById('slowBtn'),
        normalBtn: document.getElementById('normalBtn'),
        fastBtn: document.getElementById('fastBtn')
    };
}

/** Обновить HUD-показатели (каждый кадр из main.js). */
export function updateHud(hud) {
    // Счётчик дней привязан к орбитальному движению: тот же simDays,
    // что задаёт углы планет. Показывает время, прошедшее с загрузки страницы.
    hud.daysEl.textContent = (state.simDays - state.startSimDays).toFixed(4);
    hud.dateEl.textContent = formatSimDate(state.simDays);
    hud.zEl.textContent = state.zoom.toFixed(2) + 'x';
}

/** Построить дерево «планета → луны», блок «Объект» и сворачивание блоков. */
export function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    planets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'planet';
        li.dataset.kind = 'planet';
        li.dataset.name = p.name;
        const moons = moonTree[p.name] || [];
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + moonTotals[p.name] + '</span>' +
            '</div>' +
            '<ul class="loot">' +
                moons.map(([n, t]) =>
                    '<li data-kind="moon" data-name="' + n + '" data-planet="' + p.name + '">' +
                    n + '<i>' + t + '</i></li>').join('') +
            '</ul>';
        // клик по шапке планеты: выбрать планету; клик по карет-зоне — только раскрыть
        li.querySelector('.node').addEventListener('click', e => {
            li.classList.toggle('open');
            selectBody({ kind: 'planet', p });
        });
        li.querySelectorAll('.loot li').forEach(mEl => {
            mEl.addEventListener('click', () => {
                const pName = mEl.dataset.planet;
                const planet = planets.find(x => x.name === pName);
                const m = moonFromTree(planet, mEl.dataset.name);
                selectBody({ kind: 'moon', p: planet, m });
            });
        });
        treeEl.appendChild(li);
    });

    // Солнце в дереве нет — выбирается только кликом по канвасу.

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });
}

/**
 * Объект луны для выбора из дерева: настоящая луна из moonsByPlanet либо
 (у Земли) псевдо-луна, которую рисует render.js.
 */
function moonFromTree(planet, name) {
    const real = (moonsByPlanet[planet.name] || []).find(m => m.n === name);
    if (real) return real;
    return { n: name, period: planet.hasBase ? 27.321661 : 0, r: 3 };
}

/**
 * Выбрать объект (канвас или дерево): обновить state.selected, блок «Объект»
 * и подсветку в дереве. sel = null сбрасывает выбор.
 * Виды: {kind:'sun'|'planet'|'moon'|'base', p, m}.
 */
export function selectBody(sel) {
    state.selected = sel;
    renderObjectInfo();
    highlightTree();
}

/** Заполнить блок «Объект» данными выбранного тела. */
function renderObjectInfo() {
    const box = document.getElementById('objectInfo');
    const sel = state.selected;

    if (!sel) {
        box.innerHTML = '<div class="obj-empty">Кликните по солнцу, планете, луне или базе на карте</div>';
        return;
    }

    let html = '';
    if (sel.kind === 'sun') {
        html =
            '<div class="obj-title"><span class="dot" style="background:#eeeeee"></span>' +
                '<strong>' + RU.Sun + ' / Sun</strong></div>' +
            '<div class="obj-kind">Звезда · G2V</div>' +
            row('Радиус отрисовки', SUN_R + ' <em>ед.</em>');
    } else if (sel.kind === 'planet') {
        const p = sel.p;
        const orbitR = Math.round(p.dist * 10) / 10;
        const mapMoons = moonsByPlanet[p.name] || [];
        html =
            '<div class="obj-title"><span class="dot" style="background:' + p.color + '"></span>' +
                '<strong>' + (RU[p.name] || p.name) + ' / ' + p.name + '</strong></div>' +
            '<div class="obj-kind">' + (TYPES[p.type] || 'Планета') + '</div>' +
            row('Период обращения', fmtPeriod(p.period)) +
            row('Радиус орбиты', orbitR + ' <em>ед.</em>') +
            row('Известных лун', moonTotals[p.name]) +
            row('На карте (крупные)', mapMoons.length);
    } else if (sel.kind === 'asteroid') {
        html = asteroidInfoHTML(sel.small);
    } else if (sel.kind === 'base') {
        html = baseInfoHTML();
    } else {
        const p = sel.p;
        const m = sel.m;
        const idx = (moonsByPlanet[p.name] || []).findIndex(x => x.n === m.n);
        const md = idx >= 0 ? p.r + 12 + idx * 7 : moonDist;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + m.n + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
            (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
            row('Радиус орбиты', Math.round(md * 10) / 10 + ' <em>ед.</em>') +
            (p.hasBase && m.n.indexOf('Луна') === 0 ? row('На орбите', 'База LUNA-ORBIT') : '');
    }
    box.innerHTML = html;
}

/** Блок «Объект» для малого тела главного пояса (Церера, Веста, Паллада, Гигея). */
function asteroidInfoHTML(b) {
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">' + b.note + ' · Главный пояс</div>' +
        row('Большая полуось', b.a + ' <em>а.е.</em>') +
        row('Эксцентриситет', b.e) +
        row('Период обращения', fmtPeriod(b.T)) +
        row('Перигелий / афелий', (b.a * (1 - b.e)).toFixed(2) + ' / ' + (b.a * (1 + b.e)).toFixed(2) + ' <em>а.е.</em>') +
        row('Диаметр', fmtRu(b.dia) + ' <em>км</em>') +
        '<div class="obj-note">Главный пояс — главный источник метеоритов Земли</div>';
}

function row(k, v) {
    return '<div class="obj-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

/* ---------- База: купленные корабли из data/store.js ---------- */

/**
 * Блок «Объект» для базы: параметры орбиты и список купленных кораблей
 * в формате списка «В продаже» из ангара (имя, масса, категория, цена).
 * Данные — общие с админкой и ангаром (window.Store, ключ galaxy_admin_db_v1).
 */
function baseInfoHTML() {
    const ships = readUserShips();

    let html =
        '<div class="obj-title"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(0,255,255,.6)"></span>' +
            '<strong>База LUNA-ORBIT</strong></div>' +
        '<div class="obj-kind">Орбитальная база · Луна</div>' +
        '<div class="obj-rows">' +
            row('Луна', 'Луна / Moon') +
            row('Радиус орбиты', baseOrbitRadius + ' <em>ед.</em>') +
            (ships.length ? row('Куплено кораблей', ships.length) : '') +
        '</div>';

    html += '<div class="obj-sub-title"><span>Купленные корабли</span>' +
        (ships.length ? '<small>' + ships.length + ' ' + pluralRu(ships.length, ['позиция', 'позиции', 'позиций']) + '</small>' : '') +
        '</div>';

    if (!window.Store) {
        html += '<div class="obj-note">Данные админки недоступны — проверьте подключение data/store.js</div>';
    } else if (!ships.length) {
        html += '<div class="obj-note">Купленных кораблей пока нет — оформите покупку в ангаре</div>';
    } else {
        html += '<div class="ship-list">' + ships.map(shipRowHTML).join('') + '</div>';
    }
    return html;
}

/**
 * Строка купленного корабля — как строка «В продаже» в ангаре:
 * иконка, имя, «Масса N кг», категория и цена покупки.
 */
function shipRowHTML(rec) {
    let obj = null, cat = null, mass = 0;
    try {
        obj = Store.byId('objects', rec.shipId);
        cat = Store.byId('categories', rec.categoryId) ||
            (obj ? Store.byId('categories', obj.categoryId) : null);
        mass = Store.massOf(obj);
    } catch (e) { /* база повреждена — покажем запись без деталей */ }

    const price = parseFloat(String(rec.price || '').replace(',', '.'));
    const iconKey = (obj && obj.icon) || (cat && window.Icons ? Icons.forCategory(cat.name) : 'ship');
    const iconSVG = window.Icons ? Icons.svg(iconKey, 18) : '';

    return '<div class="ship-row">' +
        '<span class="ship-icon">' + iconSVG + '</span>' +
        '<span class="ship-copy"><strong>' + rec.name + '</strong>' +
            '<span>' + (mass ? 'Масса ' + fmtRu(mass) + ' кг' : 'Масса не задана') + '</span></span>' +
        '<span class="ship-meta"><small>' + (cat ? cat.name : '—') + '</small>' +
            (price > 0 ? '<b>' + fmtRu(price) + ' ¤</b>' : '') + '</span>' +
        '</div>';
}

/** Купленные корабли из общего хранилища; пусто, если база недоступна. */
function readUserShips() {
    try {
        const ships = window.Store && Store.userShips();
        return Array.isArray(ships) ? ships : [];
    } catch (e) {
        return [];
    }
}

function fmtRu(n) { return n.toLocaleString('ru-RU'); }

function pluralRu(n, forms) {
    const d = n % 10, dd = n % 100;
    if (d === 1 && dd !== 11) return forms[0];
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
    return forms[2];
}

/** Подсветить выбранный объект в дереве и раскрыть его планету. */
function highlightTree() {
    const sel = state.selected;
    document.querySelectorAll('#lootTree .sel').forEach(el => el.classList.remove('sel'));

    if (!sel || sel.kind === 'sun' || !sel.p) return; // у малых тел строки в дереве нет

    const tree = document.getElementById('lootTree');
    const li = Array.from(tree.children).find(el => el.dataset.name === sel.p.name);
    if (!li) return;
    li.classList.add('open');

    if (sel.kind === 'base') return; // у базы нет строки в дереве — раскрываем только Землю

    if (sel.kind === 'planet') {
        li.classList.add('sel');
    } else {
        const mEl = li.querySelector('.loot li[data-name="' + sel.m.n + '"]');
        if (mEl) mEl.classList.add('sel');
    }
}
