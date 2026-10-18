// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата), боковые блоки
// «КАРТА СИСТЕМЫ» (дерево планет/лун), «ОБЪЕКТ» (информация о выбранном) и
// «МАЛЫЕ ТЕЛА» (группы малых тел: полёт камеры и выбор по клику).
// Выбор делается кликом по канвасу (selectBody вызывает input.js), по
// элементу дерева или по строке блока малых тел. Шапка каждого блока
// сворачивает его — отдельных кнопок «скрыть/показать» нет. Здесь же твин
// полёта камеры (flyToCamera/updateFlyTo), которым main.js двигает камеру,
// и модальный confirmDialog (общий стиль ангара: .slot-dialog).
// Работает с DOM, не с канвасом.
// =============================================================================

import { state } from './state.js';
import { formatSimDate, clamp } from './math.js';
import { SUN_R, COLORS, MIN_ZOOM, MAX_ZOOM } from './config.js';
import { planets, moonTree, moonTotals, moonsByPlanet, moonDist, moonOrbitRadius, moonPeriod, baseOrbitRadius } from './data.js';
import { bases, basesAt, baseRadiusRange, startBaseRemoval, removalProgress, BASE_REMOVAL_MS } from './bases.js';

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

    // Блок «03 Малые тела»: статические строки-группы, клик — полёт и выбор.
    buildSmallBodiesBlock();

    // Шапки блоков сворачивают своё тело: отдельные кнопки «скрыть/показать» не нужны.
    document.querySelectorAll('#sidePanel .panel-head').forEach(head => {
        head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
    });
}

/* ---------- Блок «03 Малые тела»: группы-источники метеоритов Земли ---------- */

// Строки блока. У групп-представителей клик — полёт камеры и выбор тела;
// у Койпера и Оорта выбора нет — камера просто показывает кольцо; строки
// метеоритов (met) ведут к Марсу и Луне и подсвечены отдельным типом.
const SMALL_ROWS = [
    { name: 'Главный пояс',          note: '99% метеоритов Земли',    to: 'Церера', z: 4 },
    { name: 'Околоземные (ОЗА)',     note: 'пересекают орбиту Земли', to: 'Эрос',   z: 4 },
    { name: 'Троянцы Юпитера',       note: 'попутчики Юпитера',       to: 'Гектор', z: 4 },
    { name: 'Кометы',                note: 'метеорные потоки',        to: 'Галлея', z: 3.5 },
    { name: 'Пояс Койпера',          note: 'родина короткопериодических комет', cam: [0, 0, 0.38] },
    { name: 'Облако Оорта',          note: 'родина долгопериодических комет',   cam: [0, 0, 0.3] },
    { name: 'Марсианские метеориты', note: '≈300 найдено на Земле',   to: 'Mars',   z: 5, met: true },
    { name: 'Лунные метеориты',      note: '≈500 найдено на Земле',   to: 'Луна',   z: 8, met: true }
];

/** Цель текущего кадра для строки блока: представитель, Марс или Луна. */
function smallRowTarget(row) {
    const tg = state.hoverTargets || [];
    if (row.to === 'Mars') return tg.find(t => t.kind === 'planet' && t.p.name === 'Mars') || null;
    if (row.to === 'Луна') {
        const earth = tg.find(t => t.kind === 'planet' && t.p.name === 'Earth');
        const mh = earth && earth.moons.find(x => x.m.n.indexOf('Луна') === 0);
        return mh ? { kind: 'moon', name: mh.m.n, x: mh.mx, y: mh.my, p: earth.p, m: mh.m } : null;
    }
    return tg.find(t => t.small && t.name.indexOf(row.to) === 0) || null;
}

/** Клик по строке блока: полёт камеры и выбор (Койпер/Оорт — только полёт). */
function onSmallRowClick(row) {
    if (row.cam) {   // выбора нет — просто показываем кольцо издалека
        flyToCamera(row.cam[0], row.cam[1], row.cam[2], 1.0);
        return;
    }
    const t = smallRowTarget(row);
    if (!t) return;
    flyToCamera(t.x, t.y, row.z, 0.8);
    if (t.small) {
        selectBody({ kind: t.kind, name: t.name,
            orbit: t.small.poly ? { poly: t.small.poly } : t.small.orbit,
            p: null, m: null, small: t.small });
    } else if (t.kind === 'moon') {
        selectBody({ kind: 'moon', p: t.p, m: t.m });
    } else {
        selectBody({ kind: 'planet', p: t.p });
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
            row('На карте (крупные)', mapMoons.length) +
            (p.name === 'Mars' ? row('Марсианские метеориты', '≈300 <em>на Земле</em>', 'met') : '') +
            basesSectionHTML('planet', p.name, null);
    } else if (sel.kind === 'asteroid') {
        html = asteroidInfoHTML(sel.small);
    } else if (sel.kind === 'nea') {
        html = neaInfoHTML(sel.small);
    } else if (sel.kind === 'trojan') {
        html = trojanInfoHTML(sel.small);
    } else if (sel.kind === 'comet') {
        html = cometInfoHTML(sel.small);
    } else if (sel.kind === 'base') {
        html = sel.local ? newBaseInfoHTML(sel.local) : baseInfoHTML();
    } else {
        const p = sel.p;
        const m = sel.m;
        const idx = (moonsByPlanet[p.name] || []).findIndex(x => x.n === m.n);
        const md = idx >= 0 ? moonOrbitRadius(p, idx) : moonDist;
        html =
            '<div class="obj-title"><span class="dot" style="background:' + (m.c || '#a8a8a8') + '"></span>' +
                '<strong>' + m.n + '</strong></div>' +
            '<div class="obj-kind">Спутник · ' + (RU[p.name] || p.name) + '</div>' +
            row('Планета', (RU[p.name] || p.name) + ' / ' + p.name) +
            (m.period ? row('Период обращения', fmtPeriod(m.period)) : '') +
            row('Радиус орбиты', Math.round(md * 10) / 10 + ' <em>ед.</em>') +
            (p.name === 'Earth' && m.n.indexOf('Луна') === 0 ? row('Лунные метеориты', '≈500 <em>на Земле</em>', 'met') : '') +
            basesSectionHTML('moon', p.name, m.n);
    }
    box.innerHTML = html;
    wireObjectCard(box);
}

const NEA_GROUPS = { amor: 'Амур', apollo: 'Аполлон', aten: 'Атон' };

/** Блок «Объект» для околоземного астероида. */
function neaInfoHTML(b) {
    const crosses = b.q < 1.017 && b.Q > 0.983;   // заходит внутрь орбиты Земли
    return '<div class="obj-title"><span class="dot" style="background:#d8d8d8"></span>' +
            '<strong>' + b.name + '</strong></div>' +
        '<div class="obj-kind">Околоземный астероид · группа «' + NEA_GROUPS[b.group] + '»</div>' +
        '<div class="obj-rows">' +
            row('Большая полуось', b.a.toFixed(3) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(3)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(3) + ' / ' + b.Q.toFixed(3) + ' <em>а.е.</em>') +
            row('Пересекает орбиту Земли', crosses ? 'да' : 'сближается') +
            row('Диаметр', (b.dia != null ? b.dia : '—') + ' <em>км</em>') +
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
            row('Орбита', 'как у Юпитера · 5.2 <em>а.е.</em>') +
            row('Положение', b.camp === 4 ? 'опережает Юпитер на 60°' : 'отстаёт от Юпитера на 60°') +
            row('Период обращения', fmtPeriod(jupPeriod)) +
            row('Либрация', '±5° за ~150 лет') +
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
            row('Большая полуось', b.a.toFixed(1) + ' <em>а.е.</em>') +
            row('Эксцентриситет', b.e.toFixed(4)) +
            row('Период обращения', fmtPeriod(b.T)) +
            row('Перигелий / афелий', b.q.toFixed(2) + ' / ' + b.Q.toFixed(1) + ' <em>а.е.</em>') +
            row('Источник', COMET_SRC[b.src] || '—') +
            (b.shower ? row('Метеорный поток', b.shower) : '') +
            row('Ядро', b.dia + ' <em>км</em>') +
        '</div>' +
        '<div class="obj-note">Хвост направлен от Солнца и ярче всего у перигелия</div>';
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

/* ---------- Звёздные базы: секция в карточке, кнопка создания ---------- */

/** Секция «Звёздные базы» в карточке планеты/луны: список + кнопка создания. */
function basesSectionHTML(kind, planet, moon) {
    const rows = [];
    if (kind === 'moon' && planet === 'Earth' && moon === 'Луна / Moon') {
        rows.push(baseRowHTML('', 'LUNA-ORBIT', 'орбита ' + Math.round(baseOrbitRadius) + ' ед.', null)); // стартовая база
    }
    basesAt(kind, planet, moon).forEach(b => rows.push(baseRowHTML(b.id, b.name,
        'орбита ' + Math.round(b.orbitRadius) + ' ед.', b)));

    const active = state.baseMode && state.baseMode.kind === kind &&
        state.baseMode.planet === planet && (state.baseMode.moon || null) === (moon || null);

    return '<div class="obj-sub-title"><span>Звёздные базы</span>' +
            (rows.length ? '<small>' + rows.length + '</small>' : '') + '</div>' +
        (rows.length
            ? '<div class="base-list">' + rows.join('') + '</div>'
            : '<div class="obj-note">Баз пока нет — создайте первую на орбите</div>') +
        '<button class="base-create' + (active ? ' active' : '') + '" id="baseCreateBtn"' +
            ' data-host-kind="' + kind + '" data-host-planet="' + planet + '" data-host-moon="' + (moon || '') + '">' +
            (active ? 'Отмена — выберите орбиту' : 'Создать базу') + '</button>';
}

/**
 * Строка базы в списке: имя и хвостик-подпись (id пустой — стартовая
 * LUNA-ORBIT). У удаляемой базы (rec.status 'removing') хвостик со временем
 * заменяется красной полоской прогресса под именем.
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
        // Луна Земли рисуется отдельным блоком (render.js) — как и там
        const m = (moonsByPlanet[rec.planet] || []).find(x => x.n === rec.moon) ||
            { n: rec.moon, r: 3, period: moonPeriod };
        selectBody({ kind: 'moon', name: rec.moon, p, m });
    } else {
        selectBody({ kind: 'planet', name: p.name, p, m: null });
    }
}

/**
 * Оживить карточку после innerHTML: клики по строкам баз (выбор) и кнопка
 * «Создать базу» — включает режим выбора орбиты на карте (подтверждает клик,
 * отменяют Esc и правая кнопка; обработка — в input.js). У карточки базы —
 * «Переместить базу» (тот же режим) и «Удалить базу» (запись убирается).
 */
function wireObjectCard(box) {
    box.querySelectorAll('.base-row').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.base;
            if (!id) {   // стартовая база LUNA-ORBIT — её рисует render.js
                const p = planets.find(x => x.name === 'Earth');
                selectBody({ kind: 'base', name: 'База LUNA-ORBIT', p, m: null });
                return;
            }
            const rec = bases.find(b => b.id === id);
            if (!rec) return;
            const p = planets.find(x => x.name === rec.planet);
            selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
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
        // Стартовый радиус 60 — но в коридоре хоста (орбита не пересекает тела).
        const rg = state.baseMode ? baseRadiusRange(state.baseMode) : null;
        state.baseRadius = rg ? Math.min(rg.max, Math.max(rg.min, 60)) : 60;
        renderObjectInfo();   // надпись кнопки: «Создать базу» <-> «Отмена»
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
            // Стартуем с текущего радиуса базы, но в коридоре хоста.
            const rg = baseRadiusRange(state.baseMode);
            state.baseRadius = Math.min(rg.max, Math.max(rg.min, rec.orbitRadius));
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
        ? 'луна ' + b.moon
        : 'планета ' + (RU[b.planet] || b.planet);
    const removing = b.status === 'removing';   // идёт разбор: имя краснеет, под ним полоска прогресса, кнопки выключены
    return '<div class="obj-title' + (removing ? ' danger' : '') + '"><span class="dot" style="background:' + COLORS.base + ';box-shadow:0 0 8px rgba(0,255,255,.6)"></span>' +
            '<strong>База ' + b.name + '</strong></div>' +
        (removing ? removalBarHTML(b) : '') +
        '<div class="obj-kind">Звёздная база · ' + host + '</div>' +
        '<div class="obj-rows">' +
            row('Радиус орбиты', b.orbitRadius + ' <em>ед.</em>') +
            row('Период обращения', fmtPeriod(b.period)) +
            row('Создана', (b.created || '').slice(0, 10)) +
            (removing ? row('Статус', 'удаляется') : '') +
        '</div>' +
        '<div class="obj-note">' + (removing
            ? 'База разбирается — перенос и повторное удаление недоступны'
            : 'Новая база на орбите — корабли и постройки появятся позже') + '</div>' +
        moveBaseButtonHTML(b) +
        deleteBaseButtonHTML(b);
}

function row(k, v, cls) {
    return '<div class="obj-row' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
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
