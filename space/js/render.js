// =============================================================================
// render.js — отрисовка сцены на канвас: фон, малые тела (smallbodies.js),
// солнце, планеты, луны и звёздные базы. Тела слипаются по ЭКРАННОМУ расстоянию
// одним правилом (scene.js clusterBodies): что ближе порога на экране — в одну
// группу с общей подписью-списком; планеты и солнце — якоря, они видны всегда.
// Подписи кадра раскладываются без наложений (scene.js placeLabel).
// Стиль тел: у планет прозрачная заливка — тело читается только по обводке,
// одинаково толстой у всех; солнце — жёлтая заливка; луны — плоские серые
// круги. Орбит на карте нет — их рисует
// hover.js только при наведении. Дальний фон (небо) — отдельный слой sky.js.
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================

import { state } from './state.js';
import { orbitAngle } from './math.js';
import { SUN_R, COLORS, STROKE } from './config.js';
import { planets, moonsByPlanet, moonDist, moonPeriod, moonL0, moonOrbitRadius } from './data.js';
import { stars, clusterBodies, resetLabels, placeLabel } from './scene.js';
import { smallBodyList, drawSmallBodies } from './smallbodies.js';
import { basesAt, drawBases } from './bases.js';
import { drawSky } from './sky.js';

/**
 * Луна Земли — такая же запись тела, как луны планет: своя дистанция
 * (moonDist), радиус (3) и период. В moonsByPlanet её нет.
 */
const EARTH_MOON = { n: 'Луна / Moon', r: 3, period: moonPeriod };

/**
 * Нарисовать один кадр мира в мировой системе координат (save/restore внутри).
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Array} hoverTargets для hover.js
 */
export function renderScene(ctx) {
    const { zoom, simDays, time } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах:
    // камера и зум на небо не влияют (оно бесконечно далеко).
    drawSky(ctx);

    // Раскладка подписей кадра — заново: placeLabel разводит их по вертикали.
    resetLabels();

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);

    // === ТЕЛА КАДРА: позиции, затем слипание по экранному расстоянию ===
    // Угол строго из simDays: движение по орбите и счётчик дней — один таймер.
    // y с минусом: против часовой, как видно с севера эклиптики.
    const planetPos = new Map();
    planets.forEach(p => {
        const ang = orbitAngle(p.l0, p.period, simDays);
        planetPos.set(p, { x: Math.cos(ang) * p.dist, y: -Math.sin(ang) * p.dist });
    });

    // Тела-кандидаты: чем к телу привязана база, знает basesAt (hostKind и имя
    // хоста); у малых тел баз пока нет.
    const bodies = [];

    // Планеты — якоря: видны всегда и в чужую группу не входят.
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        bodies.push({
            anchor: true, kind: 'planet', p, x, y, r: p.r,
            label: p.ru || p.name,
            bases: basesAt('planet', p.name, null)
        });
    });

    // Луны планет и Луна Земли
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        (moonsByPlanet[p.name] || []).forEach((m, i) => {
            const md = moonOrbitRadius(p, i);   // радиус орбиты луны от планеты
            const mAng = orbitAngle(m.phase, m.period, simDays);
            bodies.push({
                anchor: false, kind: 'moon', p, m, md,
                x: x + Math.cos(mAng) * md,
                y: y - Math.sin(mAng) * md,
                label: m.n,
                bases: basesAt('moon', p.name, m.n)
            });
        });

        // Луна Земли — особый случай: своя дистанция и радиус, не в moonsByPlanet.
        // Базы на ней рисует общий слой баз (bases.js), как у остальных лун.
        if (p.name === 'Earth') {
            const mAng = orbitAngle(moonL0, moonPeriod, simDays);
            bodies.push({
                anchor: false, kind: 'moon', p, m: EARTH_MOON, md: moonDist,
                x: x + Math.cos(mAng) * moonDist,
                y: y - Math.sin(mAng) * moonDist,
                label: EARTH_MOON.n,
                bases: basesAt('moon', p.name, EARTH_MOON.n)
            });
        }
    });

    // Малые тела: позиции именованных считает smallbodies.js (smallBodyList) —
    // их же рисует drawSmallBodies по набору показанных (showSmall ниже).
    const small = smallBodyList();
    small.forEach(s => {
        bodies.push({
            anchor: false, kind: 'small', id: s.id, small: s.small, r: s.r,
            x: s.x, y: s.y, label: s.label, bases: []
        });
    });

    // Порядок важности: якоря первыми, дальше крупные раньше мелких — кто в
    // списке первый, тот и становится представителем группы.
    const ordered = bodies.slice().sort((a, b) => (b.anchor - a.anchor) || (b.r - a.r));
    const groups = clusterBodies(ordered, zoom);

    // === ЧТО ПОКАЗАНО КАДРА ===
    const hostPos = {};             // мировые позиции хост-тел для баз (ключи bases.js)
    const quietIds = new Set();     // базы групп: маркеры без имён — имена в подписи группы
    const shownSmall = new Set();   // id показанных малых тел (представители групп)
    const moonHits = new Map();     // планета -> [{ m, md, mx, my }] показанные луны

    // Хост-позиция тела по умолчанию — его собственные координаты.
    bodies.forEach(b => {
        if (b.kind === 'planet') hostPos['planet:' + b.p.name] = { x: b.x, y: b.y };
        if (b.kind === 'moon') hostPos['moon:' + b.p.name + ':' + b.m.n] = { x: b.x, y: b.y };
    });

    groups.forEach(g => {
        const rep = g.rep;

        // Точкой рисуется только тело-представитель группы.
        if (rep.kind === 'moon') {
            if (!moonHits.has(rep.p)) moonHits.set(rep.p, []);
            moonHits.get(rep.p).push({ m: rep.m, md: rep.md, mx: rep.x, my: rep.y });
        }
        if (rep.kind === 'small') shownSmall.add(rep.id);

        if (g.members.length < 2) return;

        // Скрытые тела группы «встают» в маркер представителя: базы на них
        // рисуются у группы (bases.js по hostPos), а имена баз гасятся —
        // они стоят в подписи группы (quietIds).
        g.members.forEach(m => {
            if (m.kind === 'moon' && m !== rep)
                hostPos['moon:' + m.p.name + ':' + m.m.n] = { x: rep.x, y: rep.y };
            m.bases.forEach(b => quietIds.add(b.id));
        });
    });

    // === ОТРИСОВКА ===
    // Малые тела (пояс, ОЗА, троянцы, кометы, дальние пояса) — под планетами:
    // пыль и частицы всегда, именованные — только показанные.
    hoverTargets.push(...drawSmallBodies(ctx, shownSmall));

    // Солнце — первая hover-цель (проверяется последней, т.к. планеты поверх)
    drawSun(ctx);
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });

    // Планеты-якоря и показанные луны (представители групп)
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        if (p.rings) drawRings(ctx, x, y, p);
        drawPlanetBody(ctx, x, y, p.r);
        hoverTargets.push({ kind: 'planet', p, x, y, moons: moonHits.get(p) || [] });
    });
    groups.forEach(g => {
        if (g.rep.kind === 'moon') drawMoonBody(ctx, g.rep.x, g.rep.y, g.rep.m.r);
    });

    // Подписи групп: имена тел через запятую, затем базы на них
    groups.forEach(g => {
        if (g.members.length < 2) return;
        const baseNames = [];
        g.members.forEach(m => m.bases.forEach(b => baseNames.push(b.name)));
        drawGroupLabel(ctx, g.rep.x, g.rep.y, {
            label: g.members.map(m => m.label).join(', '),
            baseLabel: baseNames.length ? baseNames.join(', ') : null
        }, zoom);
    });

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты;
    // базы групп (quietIds) — без имён: они в подписи группы
    drawBases(ctx, hostPos, quietIds).forEach(t => {
        t.p = planets.find(x => x.name === t.local.planet);
        hoverTargets.push(t);
    });

    ctx.restore();
    return hoverTargets;
}

// --- Фон -----------------------------------------------------------------------

/** Звёзды: мерцание синусом с индивидуальной фазой каждой звезды. */
function drawStars(ctx, time) {
    stars.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + s.b * 10);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + twinkle * 0.7})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    });
}

// --- Тела ----------------------------------------------------------------------

/** Солнце: жёлтая заливка и самая толстая обводка. */
function drawSun(ctx) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.sun;
    circle(ctx, 0, 0, SUN_R);
    ctx.fill();

    ctx.strokeStyle = COLORS.sunStroke;
    ctx.lineWidth = STROKE.sun / z;
    circle(ctx, 0, 0, SUN_R);
    ctx.stroke();
}

/** Планета: прозрачная заливка — видна только обводка, у всех одна толщина. */
function drawPlanetBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.strokeStyle = COLORS.planetStroke;
    ctx.lineWidth = STROKE.planet / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/** Кольца Сатурна: два сплюснутых эллипса под наклоном. */
function drawRings(ctx, x, y, p) {
    const z = state.zoom;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.lineWidth = 4 / z;
    circle(ctx, 0, 0, p.r * 2.2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    ctx.lineWidth = 3 / z;
    circle(ctx, 0, 0, p.r * 1.7);
    ctx.stroke();

    ctx.restore();
}

/** Луна: плоский серый круг с самой тонкой обводкой. */
function drawMoonBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.moon;
    circle(ctx, x, y, r);
    ctx.fill();

    ctx.strokeStyle = COLORS.moonStroke;
    ctx.lineWidth = STROKE.moon / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/**
 * Подпись группы тел у её представителя (scene.js clusterBodies) — общая для
 * всех тел: две строки, имена тел группы и базы на них. Стиль подсказки hover:
 * тень 1 px, кегль постоянный на экране (10 / zoom). Первая строка белая,
 * вторая — цианом (цвет баз). Место подписи подбирает раскладка кадра
 * (scene.js placeLabel): подписи не перекрываются, сдвигаясь по вертикали.
 */
function drawGroupLabel(ctx, mx, my, group, zoom) {
    const lines = [{ text: group.label, color: COLORS.tooltip }];
    if (group.baseLabel) lines.push({ text: group.baseLabel, color: COLORS.base });

    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom;              // подпись — справа от маркера
    const lh = 12 / zoom;                  // межстрочный шаг
    const top = my - 14 / zoom;            // верх коробки раскладки
    const w = Math.max(...lines.map(l => ctx.measureText(l.text).width));
    const h = (lines.length - 1) * lh + 14 / zoom;
    const off = placeLabel(lx, top, w, h);

    lines.forEach((l, i) => {
        groupLine(ctx, l.text, lx, top + off + 10 / zoom + i * lh, l.color, zoom);
    });
}

/** Строка подписи группы: тень со сдвигом в 1 px, затем текст в цвете. */
function groupLine(ctx, text, x, y, color, zoom) {
    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(text, x + 1 / zoom, y + 1 / zoom);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

/** Начать путь-окружность (без fill/stroke — их выбирает вызывающий). */
function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
}
