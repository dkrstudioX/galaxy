// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата), боковые блоки
// «КАРТА СИСТЕМЫ» (дерево планет/лун) и «ОБЪЕКТ» (информация о выбранном).
// Выбор делается кликом по канвасу (selectBody вызывает input.js) или по
// элементу дерева. Шапка каждого блока сворачивает его — отдельных кнопок
// «скрыть/показать» нет. Работает с DOM, не с канвасом.
// =============================================================================

import { state } from './state.js';
import { formatSimDate } from './math.js';
import { SUN_R } from './config.js';
import { planets, moonTree, moonTotals, moonsByPlanet, moonDist } from './data.js';

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
        box.innerHTML = '<div class="obj-empty">Кликните по солнцу, планете или луне на карте</div>';
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

function row(k, v) {
    return '<div class="obj-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

/** Подсветить выбранный объект в дереве и раскрыть его планету. */
function highlightTree() {
    const sel = state.selected;
    document.querySelectorAll('#lootTree .sel').forEach(el => el.classList.remove('sel'));

    if (!sel || sel.kind === 'sun') return;

    const tree = document.getElementById('lootTree');
    const li = Array.from(tree.children).find(el => el.dataset.name === sel.p.name);
    if (!li) return;
    li.classList.add('open');

    if (sel.kind === 'planet') {
        li.classList.add('sel');
    } else {
        const mEl = li.querySelector('.loot li[data-name="' + sel.m.n + '"]');
        if (mEl) mEl.classList.add('sel');
    }
}
