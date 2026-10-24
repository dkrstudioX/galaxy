// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (масштаб/зум/скорость/дата), боковые
// блоки «СОЛНЕЧНАЯ СИСТЕМА» (дерево всех выбираемых тел: Солнце, планеты,
// группы лун с фильтром и малыми телами), «ОБЪЕКТ» (информация о выбранном;
// появляется только с выбором — шапка блока носит имя выбранного) и «МАЛЫЕ
// ТЕЛА» (группы малых тел: полёт камеры и выбор по клику).
//
// Реальный масштаб: карточки показывают радиус и диаметр в километрах,
// расстояния в а.е. и угловой размер в угловых секундах (пометка «в модели»);
// HUD — «1 px = N км» и «N px/а.е.» плюс линейка масштаба.
// Дерево лун ленивое: 456 строк не строятся одновременно — список планеты
// собирается при раскрытии, фильтр ищет по всем лунам, крупные показаны сразу.
// Выбор делается кликом по канвасу (selectBody вызывает input.js), по
// элементу дерева или по строке блока малых тел. Шапка каждого блока
// сворачивает его. Здесь же твин полёта камеры (flyToCamera/updateFlyTo),
// которым main.js двигает камеру, и модальный confirmDialog (общий стиль
// ангара: .slot-dialog). Работает с DOM, не с канвасом.
// =============================================================================

import { state } from './state.js';
import {
    formatSimDate, clamp, fitZoom, fmtKm, fmtAu, fmtScale, fmtPxPerAu,
    niceScale, angularArcsec, fmtArcsec
} from './math.js';
import { SUN_R, COLORS, MIN_ZOOM, MAX_ZOOM, BASE_ORBIT_K } from './config.js';
import { planets, moonTotals, moonsByPlanet, moonOrbitRadius, moonTree } from './data.js';
import { au, km, wuToKm, wuToAu, AU_KM } from './units.js';
import { notables, neaBodies, trojanBodies, cometBodies } from './smallbodies.js';
import {
    bases, basesAt, fitBaseRadius, startBaseRemoval, removalProgress,
    BASE_REMOVAL_MS, hostRadius, canHostBase
} from './bases.js';

// Русские имена для блока «ОБЪЕКТ»: планеты хранят их в данных (data.js, поле
// ru), здесь только солнце — на карте оно не в списке планет.
const RU = { Sun: 'Солнце' };
planets.forEach(p => { RU[p.name] = p.ru || p.name; });
const TYPES = {
    rocky: 'Каменная планета', earth: 'Обитаемая планета',
    gas: 'Газовый гигант', ice: 'Ледяной гигант'
};

/** Порог «крупной» луны: такие показываются в дереве сразу и в фазе планеты. */
const MOON_MAJOR_KM = 100;

/** Планет с малым числом лун показываем целиком, даже если они мелкие. */
const MOON_ALL_LIMIT = 8;

function fmtPeriod(days) {
    const d = Math.round(days * 100) / 100;
    return days >= 365.25
        ? d + ' сут (' + (days / 365.256).toFixed(2) + ' лет)'
        : d + ' сут';
}

/** «4 секунды», «1 секунда», «5 секунд» — для текста диалога удаления. */
function fmtSecondsWord(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' секунда';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' секунды';
    return n + ' секунд';
}

/** Собрать ссылки на элементы HUD. Вызывается один раз в main.js. */
export function getHudElements() {
    return {
        zEl: document.getElementById('z'),
        scaleEl: document.getElementById('scale'),
        pxauEl: document.getElementById('pxau'),
        speedEl: document.getElementById('speed'),
        daysEl: document.getElementById('days'),
        dateEl: document.getElementById('date'),
        barEl: document.querySelector('#scalebar .scale-line'),
        barLabelEl: document.querySelector('#scalebar .scale-label')
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

    // Масштаб: «1 px = N км» (на широких видах — а.е.) и «N px/а.е.».
    if (hud.scaleEl) hud.scaleEl.textContent = fmtScale(state.zoom);
    if (hud.pxauEl) hud.pxauEl.textContent = fmtPxPerAu(state.zoom);
    if (hud.zEl) hud.zEl.textContent = state.zoom >= 0.01
        ? (state.zoom >= 1 ? state.zoom.toFixed(2) : state.zoom.toFixed(3)) + 'x'
        : state.zoom.toExponential(2) + 'x';

    // Линейка масштаба: сегмент фиксированной экранной длины с подписью.
    if (hud.barEl && hud.barLabelEl) {
        const s = niceScale(state.zoom, 120);
        hud.barEl.style.width = Math.max(8, s.px).toFixed(1) + 'px';
        hud.barLabelEl.textContent = s.label;
    }
}

/* ---------- Дерево «01 Солнечная система»: все выбираемые тела ---------- */

/**
 * Масштаб вида для тела/области. У планет — вписать внешнюю крупную луну
 * (радиус ≥ 100 км) или 20R, при этом диск планеты не меньше 8 px. У лун —
 * 40 px на радиус. У малых тел — MAX_ZOOM: карточка + маркер, а Церера,
 * Веста и Паллада при этом видны диском.
 */
function viewZoomFor(kind, obj) {
    const W = state.W || 900, H = state.H || 900;
    if (kind === 'sun') return fitZoom(SUN_R * 1.3, W, H);
    if (kind === 'inner') return fitZoom(au(1.523679), W, H);
    if (kind === 'planets') return fitZoom(au(30.11039), W, H);
    if (kind === 'belt') return fitZoom(au(3.5), W, H);
    if (kind === 'kuiper') return fitZoom(au(50), W, H);
    if (kind === 'oort') return clamp(fitZoom(au(100000), W, H), MIN_ZOOM, MAX_ZOOM);

    if (kind === 'planet') {
        const p = obj && obj.p ? obj.p : obj;
        const list = moonsByPlanet[p.name] || [];
        const major = list.filter(m => m.rad >= MOON_MAJOR_KM);
        const rOuter = major.length
            ? km(Math.max(...major.map(m => m.a)))
            : p.r * 20;
        return clamp(Math.max(fitZoom(rOuter, W, H), 8 / p.r), MIN_ZOOM, MAX_ZOOM);
    }
    if (kind === 'moon') {
        const m = obj && obj.m ? obj.m : obj;
        return clamp(40 / m.r, 20, MAX_ZOOM);
    }
    return MAX_ZOOM;   // asteroid / nea / trojan / comet
}

// Описание областей: у них нет карточки тела, но есть выбор, подсветка и
// короткая карточка области. target — ключ для viewZoomFor.
const REGION_INFO = {
    belt: {
        key: 'belt', target: 'belt', title: 'Пояс астероидов',
        kindLabel: 'пояс астероидов', color: '#b9a88f',
        distance: '2.2–3.5 <em>а.е.</em>',
        map: 'кольцо частиц между Марсом и Юпитером',
        rowTail: '4 тела',
        note: '99% метеоритов Земли — из главного пояса'
    },
    kuiper: {
        key: 'kuiper', target: 'kuiper', title: 'Пояс Койпера',
        kindLabel: 'пояс Койпера', color: '#8ea4b8',
        distance: '30–50 <em>а.е.</em>',
        map: '600 частиц пыли за Нептуном',
        rowTail: '30–50 а.е.',
        note: 'Родина короткопериодических комет'
    },
    oort: {
        key: 'oort', target: 'oort', title: 'Облако Оорта',
        kindLabel: 'облако Оорта', color: '#7f92a8',
        distance: '2 000–100 000 <em>а.е.</em>',
        map: '350 частиц на дальней границе карты',
        rowTail: 'до 100 000 а.е.',
        note: 'Родина долгопериодических комет'
    }
};

// Группы малых тел в дереве. В список попадают только именованные тела: у
// безымянных частиц пояса/облаков нет карточки и выбора на карте.
const TREE_SMALL_GROUPS = [
    { key: 'belt',   title: 'Пояс астероидов',  color: '#b9a88f', items: notables, region: REGION_INFO.belt },
    { key: 'nea',    title: 'Околоземные',      color: '#d8d8d8', items: neaBodies.filter(b => b.name) },
    { key: 'trojan', title: 'Троянцы Юпитера',  color: '#cfcfcf', items: trojanBodies },
    { key: 'comet',  title: 'Кометы',           color: '#bff6ff', items: cometBodies }
];

// Пояс Койпера и облако Оорта — не группы с телами, а отдельные области.
const TREE_REGION_ROWS = [REGION_INFO.kuiper, REGION_INFO.oort];

/** Экранировать текст для HTML-шаблона дерева. */
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Подпись луны: русское имя, если есть, иначе латиница. */
function moonLabel(m) {
    return m.ru ? m.ru + ' / ' + m.n : m.n;
}

function moonPeriodLabel(days) {
    if (days == null) return '';
    return (days < 100 ? days.toFixed(2) : days.toFixed(1)) + ' d';
}

function smallKindLabel(b) {
    if (b.kind === 'asteroid') return 'пояс';
    if (b.kind === 'nea') return 'ОЗА';
    if (b.kind === 'trojan') return b.camp === 4 ? 'L4' : 'L5';
    if (b.kind === 'comet') return 'комета';
    return '';
}

/** Цель текущего кадра для планеты: её view-координаты. */
function planetTarget(p) {
    const pos = state.planetPositions.get(p.name);
    return pos ? { x: pos.x, y: pos.y } : null;
}

/** Цель текущего кадра для луны; при сбое — планета, вокруг которой она летит. */
function moonTarget(p, m) {
    const pos = state.moonPositions.get(p.name + ':' + m.n);
    if (pos) return { x: pos.x, y: pos.y };
    return planetTarget(p);
}

/** Навести камеру на тело: масштаб считает viewZoomFor. */
function focusBody(kind, obj) {
    const x = Number.isFinite(obj && obj.x) ? obj.x : 0;
    const y = Number.isFinite(obj && obj.y) ? obj.y : 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    flyToCamera(x, y, viewZoomFor(kind, obj), 0.8);
}

/** Навести камеру на пояс/облако: центр карты и масштаб области. */
function focusRegion(region) {
    flyToCamera(0, 0, viewZoomFor(region.target), 0.9);
}

/**
 * Список лун планеты для дерева: фильтр по имени (латиница/кириллица) или
 * крупные/все. Фильтр ищет по всему каталогу, даже если показаны не все.
 * Сравнение без разделителей: «S/2019 S 1», «S2019_S_1» и «s 2019 s 1» —
 * одно и то же имя (в каталоге JPL пробелы заменены подчёркиваниями).
 */
function moonRowsFor(p, query, showAll) {
    const all = moonTree[p.name] || [];
    const norm = s => String(s || '').toLowerCase().replace(/[\s/_-]+/g, '');
    const q = norm(query);
    if (q) {
        // Сначала точное совпадение имени: «S/2019 S 1» не должно тянуть
        // за собой S2019_S_10…S2019_S_19 по подстроке.
        const exact = all.filter(m => norm(m.n) === q || norm(m.ru) === q);
        if (exact.length) return exact;
        return all.filter(m => norm(m.n).includes(q) || norm(m.ru).includes(q));
    }
    if (showAll || all.length <= MOON_ALL_LIMIT) return all;
    return all.filter(m => m.major);
}

/** Построить дерево «планета → луны», блок «Объект» и сворачивание блоков. */
export function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    // Солнце — первая строка: на карте оно выбирается, значит должно быть и здесь.
    const sunLi = document.createElement('li');
    sunLi.className = 'planet leaf';
    sunLi.dataset.kind = 'sun';
    sunLi.dataset.name = 'Sun';
    sunLi.innerHTML =
        '<div class="node">' +
            '<span class="dot" style="background:' + COLORS.sun + '"></span>' +
            '<span class="pname">' + RU.Sun + ' / Sun</span>' +
        '</div>';
    sunLi.querySelector('.node').addEventListener('click', () => {
        selectBody({ kind: 'sun', name: 'Солнце / Sun' });
        focusBody('sun');
    });
    treeEl.appendChild(sunLi);

    planets.forEach(p => {
        const total = moonTotals[p.name] || 0;
        const li = document.createElement('li');
        li.className = 'planet';
        li.dataset.kind = 'planet';
        li.dataset.name = p.name;
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + total + '</span>' +
            '</div>' +
            (total
                ? '<div class="moon-tools">' +
                    '<input class="moon-filter" type="search" placeholder="Фильтр лун" ' +
                        'aria-label="Фильтр лун ' + esc(p.name) + '">' +
                    '<button class="moon-more" type="button"></button>' +
                  '</div>'
                : '') +
            '<ul class="loot"></ul>';

        const ul = li.querySelector('.loot');
        const input = li.querySelector('.moon-filter');
        const more = li.querySelector('.moon-more');
        let showAll = false;

        const draw = () => {
            const rows = moonRowsFor(p, input ? input.value : '', showAll);
            const frag = document.createDocumentFragment();
            rows.forEach(m => {
                const el = document.createElement('li');
                el.dataset.kind = 'moon';
                el.dataset.name = m.n;
                el.dataset.planet = p.name;
                el.title = moonLabel(m);
                el.innerHTML = '<span class="mname">' + esc(m.ru || m.n) + '</span>' +
                    '<i>' + moonPeriodLabel(m.period) + '</i>';
                frag.appendChild(el);
            });
            ul.innerHTML = '';
            if (rows.length) {
                ul.appendChild(frag);
            } else {
                const empty = document.createElement('li');
                empty.className = 'moon-empty';
                empty.textContent = input && input.value.trim()
                    ? 'Ничего не найдено' : 'Крупных лун нет';
                ul.appendChild(empty);
            }
            if (more) {
                const canExpand = !input || !input.value.trim();
                more.hidden = !canExpand || total <= MOON_ALL_LIMIT;
                more.textContent = showAll ? 'Только крупные' : 'Показать все ' + total;
            }
        };

        li._drawMoons = draw;
        // Показать конкретную луну: снять фильтр и раскрыть весь список.
        li._showMoon = () => {
            showAll = true;
            if (input) input.value = '';
            draw();
        };
        if (input) input.addEventListener('input', draw);
        if (more) more.addEventListener('click', () => {
            showAll = !showAll;
            draw();
        });

        // клик по шапке планеты: выбрать планету; повторный — свернуть/раскрыть
        li.querySelector('.node').addEventListener('click', () => {
            li.classList.toggle('open');
            if (li.classList.contains('open') && !li.dataset.built) {
                li.dataset.built = '1';
                draw();
            }
            selectBody({ kind: 'planet', p });
            const t = planetTarget(p);
            if (t) focusBody('planet', { p, x: t.x, y: t.y });
        });

        // клик по луне — через делегирование: строки пересобираются фильтром
        ul.addEventListener('click', e => {
            const el = e.target.closest('li[data-kind="moon"]');
            if (!el) return;
            const planet = planets.find(x => x.name === el.dataset.planet);
            const m = moonFromTree(planet, el.dataset.name);
            if (!m) return;
            selectBody({ kind: 'moon', p: planet, m });
            const t = moonTarget(planet, m);
            if (t) focusBody('moon', { m, x: t.x, y: t.y });
        });

        treeEl.appendChild(li);
    });

    // Малые тела — четыре раскрывающиеся группы после планет. У пояса
    // астероидов шапка ещё и выбирает весь пояс: клик показывает кольцо и
    // раскрывает четыре крупных тела. У остальных групп шапка только раскрывает.
    TREE_SMALL_GROUPS.forEach(group => {
        if (!group.items.length) return;
        const li = document.createElement('li');
        li.className = 'planet small-group';
        li.dataset.kind = 'small-group';
        li.dataset.name = group.key;
        if (group.region) li.dataset.region = group.region.key;
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + group.color + '"></span>' +
                '<span class="pname">' + group.title + '</span>' +
                '<span class="cnt">' + group.items.length + '</span>' +
            '</div>' +
            '<ul class="loot small-loot">' +
                group.items.map((b, i) =>
                    '<li data-kind="small" data-id="' + esc(b.id) + '" data-index="' + i + '"' +
                        ' title="' + esc(b.name || b.ru) + '">' +
                        '<span class="sname">' + esc(b.ru || b.name) + '</span>' +
                        '<i>' + smallKindLabel(b) + '</i></li>').join('') +
            '</ul>';
        li.querySelector('.node').addEventListener('click', () => {
            li.classList.toggle('open');
            if (group.region) {
                selectBody({ kind: 'region', region: group.region });
                focusRegion(group.region);
            }
        });
        li.querySelectorAll('.loot li').forEach(el => {
            el.addEventListener('click', () => {
                const b = group.items[Number(el.dataset.index)];
                selectBody({ kind: b.kind, name: b.name,
                    orbit: b.poly ? { poly: b.poly } : b.orbit,
                    p: null, m: null, small: b });
                focusBody(b.kind, b);
            });
        });
        treeEl.appendChild(li);
    });

    // Области без отдельных тел: пояс Койпера и облако Оорта. Клик выбирает
    // область и показывает её кольцо целиком.
    TREE_REGION_ROWS.forEach(region => {
        const li = document.createElement('li');
        li.className = 'planet leaf region-row';
        li.dataset.kind = 'region';
        li.dataset.region = region.key;
        li.title = region.note;
        li.innerHTML =
            '<div class="node">' +
                '<span class="dot" style="background:' + region.color + '"></span>' +
                '<span class="pname">' + region.title + '</span>' +
                '<span class="cnt">' + region.rowTail + '</span>' +
            '</div>';
        li.querySelector('.node').addEventListener('click', () => {
            selectBody({ kind: 'region', region });
            focusRegion(region);
        });
        treeEl.appendChild(li);
    });

    // Блок «03 Малые тела»: статические строки-группы, клик — полёт и выбор.
    buildSmallBodiesBlock();

    // Пресеты камеры: «Внутренние», «Планеты», «Пояс», «Койпер», «Оорт», «Солнце».
    document.querySelectorAll('#presets [data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            flyToCamera(0, 0, viewZoomFor(key), 1.0);
        });
    });

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });

    // Блок «02 Объект» появляется только с выбором: на старте его нет вовсе.
    renderObjectInfo();
}

/* ---------- Блок «03 Малые тела»: группы-источники метеоритов Земли ---------- */

// Строки блока. У групп-представителей клик — полёт камеры и выбор тела;
// у Койпера и Оорта клик выбирает область и показывает кольцо; строки
// метеоритов (met) ведут к Марсу и Луне и подсвечены отдельным типом.
const SMALL_ROWS = [
    { name: 'Пояс астероидов',       note: '99% метеоритов Земли',    region: REGION_INFO.belt },
    { name: 'Околоземные (ОЗА)',     note: 'пересекают орбиту Земли', to: 'Эрос' },
    { name: 'Троянцы Юпитера',       note: 'попутчики Юпитера',       to: 'Гектор' },
    { name: 'Кометы',                note: 'метеорные потоки',        to: 'Галлея' },
    { name: 'Пояс Койпера',          note: 'родина короткопериодических комет', region: REGION_INFO.kuiper },
    { name: 'Облако Оорта',          note: 'родина долгопериодических комет',   region: REGION_INFO.oort },
    { name: 'Марсианские метеориты', note: '≈300 найдено на Земле',   to: 'Mars', met: true },
    { name: 'Лунные метеориты',      note: '≈500 найдено на Земле',   to: 'Moon', met: true }
];

/** Цель текущего кадра для строки блока: представитель, Марс или Луна. */
function smallRowTarget(row) {
    const tg = state.hoverTargets || [];
    if (row.to === 'Mars') {
        const t = tg.find(t => t.kind === 'planet' && t.p.name === 'Mars');
        return t || null;
    }
    if (row.to === 'Moon') {
        const earth = planets.find(p => p.name === 'Earth');
        const m = (moonsByPlanet.Earth || []).find(x => x.n === 'Moon');
        const pos = state.moonPositions.get('Earth:Moon');
        if (!earth || !m || !pos) return null;
        return { kind: 'moon', name: 'Moon', x: pos.x, y: pos.y, p: earth, m };
    }
    return tg.find(t => t.small && t.name.indexOf(row.to) === 0) || null;
}

/** Клик по строке блока: полёт камеры и выбор (Койпер/Оорт — выбор области). */
function onSmallRowClick(row) {
    if (row.region) {
        selectBody({ kind: 'region', region: row.region });
        focusRegion(row.region);
        return;
    }
    const t = smallRowTarget(row);
    if (!t) return;
    if (t.small) {
        selectBody({ kind: t.kind, name: t.name,
            orbit: t.small.poly ? { poly: t.small.poly } : t.small.orbit,
            p: null, m: null, small: t.small });
        flyToCamera(t.x, t.y, viewZoomFor(t.kind, t), 0.8);
    } else if (t.kind === 'moon') {
        selectBody({ kind: 'moon', p: t.p, m: t.m });
        flyToCamera(t.x, t.y, viewZoomFor('moon', t), 0.8);
    } else {
        selectBody({ kind: 'planet', p: t.p });
        flyToCamera(t.x, t.y, viewZoomFor('planet', t), 0.8);
    }
}

/** Собрать строки блока «03 Малые тела» (клики — полёт камеры + выбор). */
function buildSmallBodiesBlock() {
    const list = document.getElementById('smallList');
    if (!list) return;
    SMALL_ROWS.forEach(row => {
        const el = document.createElement('div');
        el.className = 'sb-row' + (row.met ? ' met' : '');
        el.title = row.note;
        el.innerHTML = '<span class="sb-name">' + row.name + '</span>' +
                       '<span class="sb-note">' + row.note + '</span>';
        el.addEventListener('click', () => onSmallRowClick(row));
        list.appendChild(el);
    });
}

/**
 * Плавно переместить камеру к точке карты (длительность — секунды реального
 * времени). Полёт продвигает updateFlyTo() из кадрового цикла; жест
 * пользователя (колесо, панорамирование, тач, клик) полёт отменяет (input.js).
 */
export function flyToCamera(x, y, zoom, dur = 0.8) {
    state.fly = {
        t0: performance.now() / 1000,
        dur,
        from: { x: state.camX, y: state.camY, z: state.zoom },
        to: { x, y, z: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }
    };
}

/** Продвинуть полёт камеры (каждый кадр из main.js до отрисовки мира). */
export function updateFlyTo() {
    const f = state.fly;
    if (!f) return;
    const p = Math.min(1, (performance.now() / 1000 - f.t0) / f.dur);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;  // easeInOutCubic
    state.camX = f.from.x + (f.to.x - f.from.x) * e;
    state.camY = f.from.y + (f.to.y - f.from.y) * e;
    state.zoom = f.from.z * Math.pow(f.to.z / f.from.z, e);   // зум — геометрически
    if (p >= 1) state.fly = null;
}

/** Объект луны для выбора из дерева: луна из каталога moonsByPlanet. */
function moonFromTree(planet, name) {
    return (moonsByPlanet[planet.name] || []).find(m => m.n === name) || null;
}

/**
 * Выбрать объект (канвас или дерево): обновить state.selected, блок «Объект»
 * и подсветку в дереве. sel = null сбрасывает выбор.
 * Виды: {kind:'sun'|'planet'|'moon'|'small'|'region'|'base'|'group',
 *        p, m, small, region, group}.
 */
export function selectBody(sel) {
    state.selected = sel;
    renderObjectInfo();
    highlightTree();
}

/** Заполнить блок «Объект» данными выбранного тела. Без выбора блока нет вовсе,
 *  а его шапка носит имя выбранного — то же, что заголовок карточки. */
function renderObjectInfo() {
    const box = document.getElementById('objectInfo');
    const sel = state.selected;

    document.getElementById('objectBlock').classList.toggle('hidden', !sel);

    if (!sel) {
        box.innerHTML = '<div class="obj-empty">Кликните по солнцу, планете, луне, области или базе на карте</div>';
        return;
    }

    let html = '';
    if (sel.kind === 'sun') {
        const rKm = wuToKm(SUN_R);
        html =
            '<div class="obj-title"><span class="dot" style="background:' + COLORS.sun + '"></span>' +
                '<strong>' + RU.Sun + ' / Sun</strong></div>' +
            '<div class="obj-kind">Звезда · G2V</div>' +
            '<div class="obj-rows">' +
                row('Радиус', fmtKm(rKm) + ' <em>км</em>') +
                row('Диаметр', fmtKm(rKm * 2) + ' <em>км</em>') +
                row('Масса', '1 M☉') +
                row('Угловой диаметр с Земли', fmtArcsec(angularArcsec(rKm, wuToKm(au(1)))) + ' <em>(в модели)</em>') +
            '</div>';
    } else if (sel.kind === 'planet') {
        const p = sel.p;
        const pos = state.planetPositions.get(p.name);
        const rAu = pos ? wuToAu(Math.hypot(pos.rawX, pos.rawY, pos.rawZ)) : p.aAu;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + p.color + '"></span>' +
                '<strong>' + (RU[p.name] || p.name) + ' / ' + p.name + '</strong></div>' +
            '<div class="obj-kind">' + (TYPES[p.type] || 'Планета') + '</div>' +
            '<div class="obj-rows">' +
                row('Радиус', fmtKm(p.radiusKm) + ' <em>км</em>') +
                row('Диаметр', fmtKm(p.radiusKm * 2) + ' <em>км</em>') +
                row('Большая полуось', fmtAu(p.aAu) + ' <em>а.е.</em>') +
                row('Расстояние до Солнца', fmtAu(rAu) + ' <em>а.е.</em>') +
                angularFromEarthRow(p) +
                row('Период обращения', fmtPeriod(p.period)) +
                row('Наклонение / узел', p.inc.toFixed(2) + '° / ' + p.node.toFixed(1) + '°') +
                row('Известных лун', moonTotals[p.name]) +
                row('Крупных на карте', (moonsByPlanet[p.name] || []).filter(m => m.rad >= MOON_MAJOR_KM).length) +
                (p.name === 'Mars' ? row('Марсианские метеориты', '≈300 <em>на Земле</em>', 'met') : '') +
            '</div>' +
            basesSectionHTML('planet', p.name, null);
    } else if (sel.kind === 'asteroid') {
        html = asteroidInfoHTML(sel.small);
    } else if (sel.kind === 'nea') {
        html = neaInfoHTML(sel.small);
    } else if (sel.kind === 'trojan') {
        html = trojanInfoHTML(sel.small);
    } else if (sel.kind === 'comet') {
        html = cometInfoHTML(sel.small);
    } else if (sel.kind === 'region') {
        html = regionInfoHTML(sel.region);
    } else if (sel.kind === 'base') {
        html = sel.local ? newBaseInfoHTML(sel.local) : '';
    } else if (sel.kind === 'group') {
        html = groupInfoHTML(sel.group);
    } else {
        const p = sel.p;
        const m = sel.m;
        const md = m.a != null ? m.a : wuToKm(moonOrbitRadius(p, 0));
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + moonLabel(m) + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            '<div class="obj-rows">' +
                row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
                row('Радиус', fmtKm(m.rad) + ' <em>км</em>') +
                row('Диаметр', fmtKm(m.rad * 2) + ' <em>км</em>') +
                row('Большая полуось', fmtKm(md) + ' <em>км</em> · ' + fmtAu(md / AU_KM) + ' <em>а.е.</em>') +
                (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
                (m.e != null ? row('Эксцентриситет', m.e.toFixed(4)) : '') +
                (m.inc != null ? row('Наклонение', m.inc.toFixed(2) + '°') : '') +
                row('Угловой диаметр с планеты', fmtArcsec(angularArcsec(m.rad, md)) + ' <em>(в модели)</em>') +
                (p.name === 'Earth' && m.n === 'Moon' ? row('Лунные метеориты', '≈500 <em>на Земле</em>', 'met') : '') +
            '</div>' +
            basesSectionHTML('moon', p.name, m.n);
    }
    box.innerHTML = html;
    wireObjectCard(box);

    // Имя в шапке блока — как заголовок карточки (у базы — «База …», у планеты —
    // «Земля / Earth»): один источник текста, шапка и карточка не разойдутся.
    const title = box.querySelector('.obj-title strong');
    document.getElementById('objectName').textContent = title ? title.textContent : 'Объект';
}

/** Расстояние от тела до Земли в км по его raw-координатам (модель карты). */
function bodyDistanceKm(pos) {
    const e = state.planetPositions.get('Earth');
    if (!e || !pos) return null;
    return wuToKm(Math.hypot(pos.rawX - e.rawX, pos.rawY - e.rawY, pos.rawZ - e.rawZ));
}

/** Строка «угловой диаметр с Земли» для планеты; у Земли — с Солнца. */
function angularFromEarthRow(p) {
    const pos = state.planetPositions.get(p.name);
    if (p.name === 'Earth') {
        const rAu = pos ? wuToAu(Math.hypot(pos.rawX, pos.rawY, pos.rawZ)) : p.aAu;
        return row('Угловой диаметр', fmtArcsec(angularArcsec(p.radiusKm, wuToKm(au(rAu)))) +
            ' <em>(в модели, с Солнца)</em>');
    }
    const d = bodyDistanceKm(pos);
    if (!d) return row('Угловой диаметр с Земли', '—');
    return row('Угловой диаметр с Земли', fmtArcsec(angularArcsec(p.radiusKm, d)) + ' <em>(в модели)</em>');
}

/** Строка «угловой диаметр с Земли» для малого тела. */
function smallAngularRow(b) {
    if (!b.dia) return '';
    const pos = b.rawX != null ? { rawX: b.rawX, rawY: b.rawY, rawZ: b.rawZ } : null;
    const d = bodyDistanceKm(pos);
    return row('Угловой диаметр с Земли',
        (d ? fmtArcsec(angularArcsec(b.dia / 2, d)) : '—') + ' <em>(в модели)</em>');
}

const NEA_GROUPS = { amor: 'Амур', apollo: 'Аполлон', aten: 'Атон' };

/** Блок «Объект» для околоземного астероида. */
function neaInfoHTML(b) {
    const crosses = b.q < 1.017 && b.Q > 0.983;   // заходит внутрь орбиты Земли
    return '<div class="obj-title"><span class="dot" style="background:#d8d8d8"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Околоземный астероид · группа «' + NEA_GROUPS[b.group] + '»</div>' +
        '<div class="obj-rows">' +
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', b.a.toFixed(3) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(3)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(3) + ' / ' + b.Q.toFixed(3) + ' <em>а.е.</em>') +
            row('Пересекает орбиту Земли', crosses ? 'да' : 'сближается') +
            smallAngularRow(b) +
        '</div>' +
        '<div class="obj-note">Околоземный объект — цель исследовательских миссий</div>';
}

/** Блок «Объект» для троянца Юпитера. */
function trojanInfoHTML(b) {
    const jupPeriod = planets.find(p => p.name === 'Jupiter').period;
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Троянец Юпитера · точка ' + (b.camp === 4 ? 'L4' : 'L5') + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Орбита', 'как у Юпитера · ' + fmtAu(b.a) + ' <em>а.е.</em>') +
            row('Положение', b.camp === 4 ? 'опережает Юпитер на 60°' : 'отстаёт от Юпитера на 60°') +
            row('Период обращения', fmtPeriod(jupPeriod)) +
            row('Либрация', '±5° за ~150 лет') +
            smallAngularRow(b) +
        '</div>' +
        '<div class="obj-note">Реликтовое вещество ранней Солнечной системы</div>';
}

const COMET_SRC = { oort: 'облако Оорта', kuiper: 'пояс Койпера' };

/** Блок «Объект» для кометы. */
function cometInfoHTML(b) {
    const years = b.T / 365.256;
    return '<div class="obj-title"><span class="dot" style="background:#f0f0f0"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Комета · ' + (years < 200 ? 'короткопериодическая' : 'долгопериодическая') + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус ядра', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр ядра', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', b.a.toFixed(1) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(4)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(2) + ' / ' + b.Q.toFixed(1) + ' <em>а.е.</em>') +
            row('Источник', COMET_SRC[b.src] || '—') +
            (b.shower ? row('Метеорный поток', b.shower) : '') +
            smallAngularRow(b) +
        '</div>' +
        '<div class="obj-note">Хвост направлен от Солнца и ярче всего у перигелия</div>';
}

/** Короткая карточка области: пояс астероидов, пояс Койпера, облако Оорта. */
function regionInfoHTML(region) {
    return '<div class="obj-title"><span class="dot" style="background:' + region.color + '"></span>' +
            '<strong>' + region.title + '</strong></div>' +
        '<div class="obj-kind">Область · ' + region.kindLabel + '</div>' +
        '<div class="obj-rows">' +
            row('Расстояние', region.distance) +
            row('На карте', region.map) +
        '</div>' +
        '<div class="obj-note">' + region.note + '</div>';
}

/** Блок «Объект» для малого тела главного пояса (Церера, Веста, Паллада, Гигея). */
function asteroidInfoHTML(b) {
    return '<div class="obj-title"><span class="dot" style="background:#cfcfcf"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">' + b.note + ' · Пояс астероидов</div>' +
        '<div class="obj-rows">' +
            row('Радиус', fmtKm(b.dia / 2) + ' <em>км</em>') +
            row('Диаметр', fmtKm(b.dia) + ' <em>км</em>') +
            row('Большая полуось', fmtAu(b.a) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', (b.a * (1 - b.e)).toFixed(2) + ' / ' + (b.a * (1 + b.e)).toFixed(2) + ' <em>а.е.</em>') +
            smallAngularRow(b) +
        '</div>' +
        '<div class="obj-note">Пояс астероидов — главный источник метеоритов Земли</div>';
}

/**
 * Карточка группы тел: список участников (Солнце/планеты/луны/малые тела).
 * Клик по строке — полёт к телу и его выбор; так с общего плана можно
 * «разобрать» группу «Внутренние планеты · 4» или «Сатурн · 12».
 */
function groupInfoHTML(g) {
    const rows = g.members.map((b, i) => {
        const color = b.kind === 'sun' ? COLORS.sun
            : b.kind === 'planet' ? b.p.color
            : b.kind === 'moon' ? (b.m.c || '#a8a8a8')
            : '#cfcfcf';
        const kind = b.kind === 'sun' ? 'звезда'
            : b.kind === 'planet' ? 'планета'
            : b.kind === 'moon' ? 'луна'
            : 'малое тело';
        return '<div class="group-row" data-gi="' + i + '">' +
            '<span class="dot" style="background:' + color + '"></span>' +
            '<span class="gname">' + esc(b.label) + '</span>' +
            '<small>' + kind + '</small></div>';
    }).join('');
    return '<div class="obj-title"><span class="dot" style="background:' + COLORS.tooltip + '"></span>' +
            '<strong>' + esc(g.label) + '</strong></div>' +
        '<div class="obj-kind">Группа тел · ' + g.members.length + '</div>' +
        '<div class="group-list">' + rows + '</div>' +
        '<div class="obj-note">Тела ближе 28 px на экране собраны в группу — клик по строке летит к телу</div>';
}

/* ---------- Звёздные базы: секция в карточке, кнопка создания ---------- */

/** Секция «Звёздные базы» в карточке планеты/луны: список + кнопка создания. */
function basesSectionHTML(kind, planet, moon) {
    const rows = [];
    basesAt(kind, planet, moon).forEach(b => rows.push(baseRowHTML(b.id, b.name,
        'орбита ' + fmtKm(wuToKm(b.orbitRadius)) + ' км', b)));

    const active = state.baseMode && state.baseMode.kind === kind &&
        state.baseMode.planet === planet && (state.baseMode.moon || null) === (moon || null);

    const host = { kind, planet, moon: moon || null };
    const allowed = canHostBase(host);
    const list = rows.length
        ? '<div class="base-list">' + rows.join('') + '</div>'
        : '<div class="obj-note">' + (allowed
            ? 'Баз пока нет — создайте первую на орбите'
            : 'Тело слишком мало для базы (нужен радиус ≥ 50 км)') + '</div>';
    const btn = allowed
        ? '<button class="base-create' + (active ? ' active' : '') + '" id="baseCreateBtn"' +
            ' data-host-kind="' + kind + '" data-host-planet="' + planet + '" data-host-moon="' + (moon || '') + '">' +
            (active ? 'Отмена — выберите орбиту' : 'Создать базу') + '</button>'
        : '';

    return '<div class="obj-sub-title"><span>Звёздные базы</span>' +
            (rows.length ? '<small>' + rows.length + '</small>' : '') + '</div>' +
        list + btn;
}

/**
 * Строка базы в списке: имя и хвостик-подпись. У удаляемой базы (rec.status
 * 'removing') хвостик со временем заменяется красной полоской прогресса под
 * именем.
 */
function baseRowHTML(id, name, tail, rec) {
    const removing = rec && rec.status === 'removing' ? rec : null;
    return '<div class="base-row' + (removing ? ' removing' : '') + '" data-base="' + id + '">' +
        '<span class="b-dot"></span>' +
        '<span class="b-body"><span class="b-name">' + name + '</span>' +
            (removing ? removalBarHTML(removing) : '') + '</span>' +
        (removing ? '' : '<small>' + tail + '</small>') +
        '</div>';
}

/**
 * Красная полоска прогресса разбора под именем базы. Ширина растёт
 * CSS-анимацией на BASE_REMOVAL_MS; отрицательная задержка ставит её сразу
 * на текущий прогресс (карточка перерисовывается раз в секунду — полоска
 * между перерисовками не дёргается).
 */
function removalBarHTML(rec) {
    const elapsed = Math.round(removalProgress(rec) * BASE_REMOVAL_MS);
    return '<span class="rm-bar"><i style="animation-duration:' + BASE_REMOVAL_MS +
        'ms;animation-delay:-' + elapsed + 'ms"></i></span>';
}

/** Кнопка «Войти на базу»: переход в интерьер базы (приложение ангара). */
function enterBaseButtonHTML(b) {
    const off = b.status !== 'active' ? ' disabled' : '';   // разбираемую не открываем
    return '<button class="base-create" id="baseEnterBtn"' +
        ' data-enter-id="' + b.id + '"' + off + '>Войти на базу</button>';
}

/** Кнопка «Переместить базу» у созданной базы — в том же месте, что «Создать базу». */
function moveBaseButtonHTML(b) {
    const active = state.baseMode && state.baseMode.moveId === b.id;
    const off = b.status !== 'active' ? ' disabled' : '';   // удаляемую не переносим
    return '<button class="base-create' + (active ? ' active' : '') + '" id="baseMoveBtn"' +
        ' data-move-id="' + b.id + '"' + off + '>' +
        (active ? 'Отмена — выберите орбиту' : 'Переместить базу') + '</button>';
}

/** Кнопка «Удалить базу» — рядом с переносом, там же под описанием базы. */
function deleteBaseButtonHTML(b) {
    const off = b.status !== 'active' ? ' disabled' : '';   // повторно не удаляем
    return '<button class="base-create" id="baseDeleteBtn"' +
        ' data-delete-id="' + b.id + '"' + off + '>Удалить базу</button>';
}

/** Выбрать хозяина базы (планету или луну) — карточка с её списком баз. */
function selectBaseHost(rec) {
    const p = planets.find(q => q.name === rec.planet);
    if (!p) { selectBody(null); return; }
    if (rec.hostKind === 'moon') {
        const m = (moonsByPlanet[rec.planet] || []).find(x => x.n === rec.moon);
        if (m) { selectBody({ kind: 'moon', name: rec.moon, p, m }); return; }
    }
    selectBody({ kind: 'planet', name: p.name, p, m: null });
}

/**
 * Оживить карточку после innerHTML: клики по строкам баз (выбор) и кнопка
 * «Создать базу» — включает режим выбора орбиты на карте (подтверждает клик,
 * отменяют Esc и правая кнопка; обработка — в input.js). У карточки базы —
 * «Войти на базу» (переход в интерьер базы, приложение ангара),
 * «Переместить базу» (тот же режим) и «Удалить базу» (запись убирается).
 * У группы тел — строки участников: полёт к телу и выбор.
 */
function wireObjectCard(box) {
    box.querySelectorAll('.base-row').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.base;
            const rec = bases.find(b => b.id === id);
            if (!rec) return;
            const p = planets.find(x => x.name === rec.planet);
            selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
        });
    });

    box.querySelectorAll('.group-row').forEach(el => {
        el.addEventListener('click', () => {
            const g = state.selected && state.selected.group;
            if (!g) return;
            const b = g.members[Number(el.dataset.gi)];
            if (!b) return;
            if (b.kind === 'sun') {
                selectBody({ kind: 'sun', name: 'Солнце / Sun' });
                flyToCamera(0, 0, viewZoomFor('sun'), 0.8);
            } else if (b.kind === 'planet') {
                selectBody({ kind: 'planet', p: b.p });
                flyToCamera(b.x, b.y, viewZoomFor('planet', { p: b.p }), 0.8);
            } else if (b.kind === 'moon') {
                selectBody({ kind: 'moon', p: b.p, m: b.m });
                flyToCamera(b.x, b.y, viewZoomFor('moon', { m: b.m }), 0.8);
            } else if (b.small) {
                selectBody({ kind: b.small.kind, name: b.label,
                    p: null, m: null, small: b.small });
                flyToCamera(b.x, b.y, MAX_ZOOM, 0.8);
            }
        });
    });

    const btn = box.querySelector('#baseCreateBtn');
    if (btn) btn.addEventListener('click', () => {
        const kind = btn.dataset.hostKind;
        const planet = btn.dataset.hostPlanet;
        const moon = btn.dataset.hostMoon || null;
        // Режим уже активен (хост мог переехать к ближайшему телу) — отменяем его,
        // иначе начинаем выбор орбиты у этой планеты/луны.
        state.baseMode = state.baseMode ? null : { kind, planet, moon };
        if (state.baseMode) {
            // Стартовый радиус — 3 радиуса хозяина, дальше коридор и разведение.
            const r0 = BASE_ORBIT_K * hostRadius(state.baseMode);
            state.baseRadius = fitBaseRadius(r0, state.baseMode, null);
        }
        renderObjectInfo();   // надпись кнопки: «Создать базу» <-> «Отмена»
    });

    const enterBtn = box.querySelector('#baseEnterBtn');
    if (enterBtn) enterBtn.addEventListener('click', () => {
        const rec = bases.find(b => b.id === enterBtn.dataset.enterId);
        if (!rec || rec.status !== 'active') return;   // разбираемую не открываем
        // Интерьер базы — приложение ангара (орбитальная звёздная база); имя базы
        // уходит в адрес, чтобы станция знала, на какую базу вошёл игрок.
        window.location.href = '../hangar/index.html?base=' + encodeURIComponent(rec.name);
    });

    const mvBtn = box.querySelector('#baseMoveBtn');
    if (mvBtn) mvBtn.addEventListener('click', () => {
        // Тот же режим выбора орбиты, но запись не создаётся, а переносится:
        // клик по карте сменит хост (по правилу ближайшего тела) и радиус базы.
        if (state.baseMode) {
            state.baseMode = null;
        } else {
            const rec = bases.find(b => b.id === mvBtn.dataset.moveId);
            if (!rec || rec.status !== 'active') return;   // удаляемую не переносим
            state.baseMode = { kind: rec.hostKind, planet: rec.planet, moon: rec.moon || null, moveId: rec.id };
            // Стартуем с текущего радиуса базы — по механизму: коридор хоста и
            // разведение с другими базами (сама переносимая не мешает).
            state.baseRadius = fitBaseRadius(rec.orbitRadius, state.baseMode, rec.id);
        }
        renderObjectInfo();   // надпись кнопки: «Переместить базу» <-> «Отмена»
    });

    const delBtn = box.querySelector('#baseDeleteBtn');
    if (delBtn) delBtn.addEventListener('click', () => {
        const rec = bases.find(b => b.id === delBtn.dataset.deleteId);
        if (!rec || rec.status !== 'active') return;
        // Спрашиваем подтверждение в общем стиле ангара — сразу не удаляем.
        confirmDialog({
            eyebrow: 'Звёздная база',
            title: 'Удалить базу?',
            text: 'База <b>«' + rec.name + '»</b> будет разбираться ' +
                fmtSecondsWord(Math.round(BASE_REMOVAL_MS / 1000)) + ': ей нельзя будет пользоваться, ' +
                'затем она исчезнет с орбиты, а запись переедет в архив.',
            okLabel: 'Удалить',
            onOk: () => {
                // Если эта база как раз переносилась — сначала выходим из режима.
                if (state.baseMode && state.baseMode.moveId === rec.id) state.baseMode = null;
                if (!startBaseRemoval(rec)) return;
                renderObjectInfo();   // карточка покажет статус и таймер до конца разбора
            }
        });
    });
}

/** Перерисовать карточку выбранного объекта (зовёт input.js при отмене режима). */
export function refreshObjectCard() {
    renderObjectInfo();
}

/* ---------- Диалог подтверждения (общий стиль ангара: .slot-dialog) ---------- */

let dialogEl = null;   // открытый оверлей: одновременно не больше одного

function closeDialog() {
    if (dialogEl && dialogEl.parentNode) dialogEl.parentNode.removeChild(dialogEl);
    dialogEl = null;
    document.removeEventListener('keydown', dialogKey, true);
}

/** Esc закрывает диалог и не доходит до карты — режим выбора орбиты остаётся. */
function dialogKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeDialog();
}

/**
 * Модальное подтверждение в общем стиле (как .slot-modal/.slot-dialog в
 * ангаре): eyebrow, заголовок, текст и две кнопки — «Отмена» и действие
 * (opts.okLabel). Клик по фону, «×» и Esc закрывают без действия; кнопка
 * действия закрывает диалог и зовёт opts.onOk.
 * @param {{eyebrow?: string, title: string, text: string, okLabel: string, onOk: Function}} opts
 */
export function confirmDialog(opts) {
    closeDialog();
    const ov = document.createElement('div');
    ov.className = 'dlg-overlay';
    ov.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true">' +
            '<div class="dlg-head"><div>' +
                (opts.eyebrow ? '<span class="dlg-eyebrow">' + opts.eyebrow + '</span>' : '') +
                '<h3>' + opts.title + '</h3></div>' +
            '<button class="dlg-close" aria-label="Закрыть">×</button></div>' +
            '<div class="dlg-text">' + opts.text + '</div>' +
            '<div class="dlg-foot">' +
                '<button class="dlg-btn" data-act="cancel">Отмена</button>' +
                '<button class="dlg-btn danger" data-act="ok">' + opts.okLabel + '</button>' +
            '</div>' +
        '</div>';
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeDialog(); });   // клик по фону
    ov.querySelector('.dlg-close').addEventListener('click', closeDialog);
    ov.querySelector('[data-act="cancel"]').addEventListener('click', closeDialog);
    ov.querySelector('[data-act="ok"]').addEventListener('click', () => {
        closeDialog();
        if (opts.onOk) opts.onOk();
    });
    document.addEventListener('keydown', dialogKey, true);
    document.getElementById('modal-root').appendChild(ov);
    dialogEl = ov;
}

/* ---------- Удаление баз: секундный тик карточки ---------- */

let cardTickSec = -1;            // секунда последней перерисовки карточки
let cardTickHadRemoving = false; // была ли удаляемая база на прошлом тике

/**
 * Кадр (main.js): пока идёт удаление, раз в секунду обновлять открытую
 * карточку — в ней тикает таймер. Когда выбранная база доудалилась,
 * карточка сама переключается на её хозяина (планету или луну).
 */
export function updateBaseTimerCard() {
    const sel = state.selected;
    if (sel && sel.local && sel.local.status === 'removed') {
        selectBaseHost(sel.local);
        return;
    }
    const removing = bases.some(b => b.status === 'removing');
    const relevant = sel && (sel.kind === 'base' || sel.kind === 'planet' || sel.kind === 'moon');
    if (!relevant) { cardTickHadRemoving = removing; return; }
    const wasRemoving = cardTickHadRemoving;
    cardTickHadRemoving = removing;
    if (!removing && !wasRemoving) return;      // ничего не удаляется — карточку не трогаем
    const s = Math.floor(Date.now() / 1000);
    if (removing && s === cardTickSec) return;  // идёт разбор: не чаще раза в секунду
    cardTickSec = s;
    renderObjectInfo();
}

/** Блок «Объект» для звездной базы, созданной игроком на карте. */
function newBaseInfoHTML(b) {
    const host = b.hostKind === 'moon'
        ? 'луна ' + moonHostLabel(b.planet, b.moon)
        : 'планета ' + (RU[b.planet] || b.planet);
    const removing = b.status === 'removing';   // идёт разбор: имя краснеет, под ним полоска прогресса, кнопки выключены
    const fleet = !!b.fleet;    // стартовая LUNA-ORBIT: в карточке — купленные корабли
    return '<div class="obj-title' + (removing ? ' danger' : '') + '"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(53,232,216,.6)"></span>' +
            '<strong>База ' + b.name + '</strong></div>' +
        (removing ? removalBarHTML(b) : '') +
        '<div class="obj-kind">Звёздная база · ' + host + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус орбиты', fmtKm(wuToKm(b.orbitRadius)) + ' <em>км</em>') +
            row('Период обращения', fmtPeriod(b.period)) +
            row('Создана', (b.created || '').slice(0, 10)) +
            (removing ? row('Статус', 'удаляется') : '') +
        '</div>' +
        (removing
            ? '<div class="obj-note">База разбирается — перенос и повторное удаление недоступны</div>'
            : fleet ? '' : '<div class="obj-note">Новая база на орбите — корабли и постройки появятся позже</div>') +
        (fleet && !removing ? shipsSectionHTML() : '') +
        enterBaseButtonHTML(b) +
        moveBaseButtonHTML(b) +
        deleteBaseButtonHTML(b);
}

/** Русская подпись луны-хозяина базы: «Луна / Moon» → «Луна». */
function moonHostLabel(planet, name) {
    const m = (moonsByPlanet[planet] || []).find(x => x.n === name);
    return m && m.ru ? m.ru + ' / ' + m.n : (name || '—');
}

function row(k, v, cls) {
    return '<div class="obj-row' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

/* ---------- База: купленные корабли из data/store.js ---------- */

/**
 * Секция «Купленные корабли» для карточки базы: список в формате «В продаже»
 * из ангара (имя, масса, категория, цена). Данные — общие с админкой и ангаром
 * (window.Store, ключ galaxy_admin_db_v1). Показывается у базы игрока (флаг
 * fleet — стартовая LUNA-ORBIT).
 */
function shipsSectionHTML() {
    const ships = readUserShips();
    let html = '<div class="obj-sub-title"><span>Купленные корабли</span>' +
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

/** Подсветить выбранный объект в дереве и раскрыть его группу. */
function highlightTree() {
    const sel = state.selected;
    document.querySelectorAll('#lootTree .sel').forEach(el => el.classList.remove('sel'));

    if (!sel) return;
    const tree = document.getElementById('lootTree');

    if (sel.kind === 'sun') {
        const sunLi = tree.querySelector('li[data-kind="sun"]');
        if (sunLi) sunLi.classList.add('sel');
        return;
    }

    // Группа тел: строки в дереве нет — подсвечивать нечего.
    if (sel.kind === 'group') return;

    // Область: пояс астероидов — шапка группы, Койпер/Оорт — отдельные строки.
    if (sel.kind === 'region') {
        const regionLi = tree.querySelector('li[data-region="' + sel.region.key + '"]');
        if (regionLi) regionLi.classList.add('sel');
        return;
    }

    // Малые тела: строка в одной из четырёх групп; группу раскрываем.
    if (sel.small) {
        const smallLi = Array.from(tree.querySelectorAll('li[data-kind="small"]'))
            .find(el => el.dataset.id === sel.small.id);
        if (!smallLi) return;
        const group = smallLi.closest('.small-group');
        if (group) group.classList.add('open');
        smallLi.classList.add('sel');
        return;
    }

    if (!sel.p) return;
    const li = Array.from(tree.children).find(el => el.dataset.name === sel.p.name);
    if (!li) return;
    li.classList.add('open');

    if (sel.kind === 'base') return; // у базы нет строки в дереве — раскрываем только планету

    if (sel.kind === 'planet') {
        li.classList.add('sel');
    } else if (sel.m) {
        // Луна могла быть не отрисована (крупные по умолчанию) — раскрываем все.
        if (!li.dataset.built && li._drawMoons) {
            li.dataset.built = '1';
            li._drawMoons();
        }
        let mEl = Array.from(li.querySelectorAll('.loot li'))
            .find(el => el.dataset.kind === 'moon' && el.dataset.name === sel.m.n);
        if (!mEl && li._showMoon) {
            li._showMoon();
            mEl = Array.from(li.querySelectorAll('.loot li'))
                .find(el => el.dataset.kind === 'moon' && el.dataset.name === sel.m.n);
        }
        if (mEl) {
            mEl.classList.add('sel');
            mEl.scrollIntoView({ block: 'nearest' });
        }
    }
}
