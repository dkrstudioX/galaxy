// =============================================================================
// render.js — отрисовка сцены на канвас: фон, пол, малые тела, солнце,
// планеты, луны и звёздные базы.
//
// Карта — диметрия 2:1 (iso.js): мир-эклиптика сжимается по y, поэтому орбиты
// становятся эллипсами, а сферы остаются круглыми. Слои кадра:
//   небо -> световое пятно/ореол звезды -> постоянные орбиты -> пыль/пояс/
//   пути комет -> тени на полу -> тела по глубине (view.y) -> базы -> подписи.
//
// Тела слипаются по ЭКРАННОМУ расстоянию (scene.js clusterBodies): что ближе
// порога — в одну группу с общей подписью; планеты и солнце — якоря.
// Подписи раскладываются без наложений (scene.js placeLabel).
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================

import { state } from './state.js';
import { orbitAngle, orbitPoint3, keplerPos3, keplerPoly3 } from './math.js';
import { SUN_R, COLORS, ISO_K, ISO_Z } from './config.js';
import {
    planets, planetM0, moonsByPlanet, moonDist, moonPeriod, moonL0,
    moonInc, moonNode, moonOrbitRadius
} from './data.js';
import { stars, clusterBodies, resetLabels, placeLabel } from './scene.js';
import { smallBodyList, drawSmallBodiesFloor, drawSmallBody } from './smallbodies.js';
import { basesAt, drawBases } from './bases.js';
import { drawSky } from './sky.js';
import { project3, view3Poly } from './iso.js';
import { sphere, shadow, glow, sunSphere } from './paint.js';

/**
 * Луна Земли — такая же запись тела, как луны планет: своя дистанция
 * (moonDist), радиус (3) и период. В moonsByPlanet её нет.
 */
const EARTH_MOON = { n: 'Луна / Moon', r: 3, period: moonPeriod, c: '#c9cfd8' };

/**
 * Орбиты планет — реальные элементы (эксцентриситет и перигелий из data.js).
 * Считаются один раз: форма орбиты от времени не зависит. Хранятся сразу в
 * view-координатах — по ним рисуется орбита при наведении на планету.
 */
const PLANET_ORBITS = new Map();
planets.forEach(p => {
    const raw = keplerPoly3(p.dist, p.e, p.peri, 0, p.period, 160, v => v, p.inc, p.node);
    PLANET_ORBITS.set(p, view3Poly(raw));
});

/** Позиция планеты на орбите: Кеплер с эксцентриситетом и наклоном. */
function planetRawPos(p, t) {
    return keplerPos3(p.dist, p.e, p.peri, planetM0(p), p.period, t, v => v, p.inc, p.node);
}

/**
 * Замкнутая орбита луны вокруг планеты: круг в наклонённой плоскости
 * (inc/node), спроецированный в view. Точки уже абсолютные (центр — планета).
 */
function moonOrbitPoly(planetRaw, radius, inc, node, steps = 96) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const ang = k / steps * Math.PI * 2;
        const off = orbitPoint3(radius, ang, inc, node);
        const v = project3(planetRaw.x + off.x, planetRaw.y + off.y, planetRaw.z + off.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

/**
 * Нарисовать один кадр мира в мировой системе координат (save/restore внутри).
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Array} hoverTargets для hover.js
 */
export function renderScene(ctx) {
    const { zoom, simDays, time } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах.
    drawSky(ctx);

    // Раскладка подписей кадра — заново.
    resetLabels();

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);

    // === ТЕЛА КАДРА: позиции в view, затем слипание по экранному расстоянию ===
    // Планеты храним в raw (для лун и наклонных орбит) и в view (для отрисовки).
    const planetRaw = new Map();
    const planetPos = new Map();
    planets.forEach(p => {
        const raw = planetRawPos(p, simDays);
        const v = project3(raw.x, raw.y, raw.z);
        planetRaw.set(p, raw);
        planetPos.set(p, { x: v.x, y: v.y, z: raw.z, floorY: raw.y * ISO_K });
    });

    const bodies = [];

    // Планеты — якоря: видны всегда и в чужую группу не входят.
    planets.forEach(p => {
        const { x, y, z, floorY } = planetPos.get(p);
        bodies.push({
            anchor: true, system: p.name, kind: 'planet', p, x, y, z, floorY, r: p.r,
            label: p.ru || p.name,
            bases: basesAt('planet', p.name, null)
        });
    });

    // Луны планет и Луна Земли — круговые орбиты вокруг планеты, наклонённые
    // по реальным inc/node (плоскость экватора планеты). Периоды реальные,
    // расстояния сжаты той же шкалой, что и вся карта.
    planets.forEach(p => {
        const o = planetRaw.get(p);
        (moonsByPlanet[p.name] || []).forEach((m, i) => {
            const md = moonOrbitRadius(p, i);
            const mAng = orbitAngle(m.phase, m.period, simDays);
            const off = orbitPoint3(md, mAng, m.inc, m.node);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            // Луны — якоря: реальные спутники не должны пропадать в группе
            // с планетой или астероидом, иначе их нельзя навести/выбрать.
            bodies.push({
                anchor: true, system: p.name, kind: 'moon', p, m, md,
                x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                orbitPoly: moonOrbitPoly(o, md, m.inc, m.node),
                label: m.n,
                bases: basesAt('moon', p.name, m.n)
            });
        });

        if (p.name === 'Earth') {
            const mAng = orbitAngle(moonL0, moonPeriod, simDays);
            const off = orbitPoint3(moonDist, mAng, moonInc, moonNode);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            bodies.push({
                anchor: true, system: p.name, kind: 'moon', p, m: EARTH_MOON, md: moonDist,
                x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                orbitPoly: moonOrbitPoly(o, moonDist, moonInc, moonNode),
                label: EARTH_MOON.n,
                bases: basesAt('moon', p.name, EARTH_MOON.n)
            });
        }
    });

    // Малые тела: позиции уже в view (smallbodies.js).
    const small = smallBodyList();
    small.forEach(s => {
        bodies.push({
            // Кометы — якоря: пользователь просил показать все кометы, а не
            // только представителей групп. Остальные малые тела слипаются.
            anchor: s.kind === 'comet',
            system: null,
            kind: 'small', id: s.id, small: s.small, r: s.r,
            x: s.x, y: s.y, z: s.z || 0, floorY: s.floorY ?? s.y,
            label: s.label, bases: []
        });
    });

    // Порядок важности: якоря первыми, дальше крупные раньше мелких.
    const ordered = bodies.slice().sort((a, b) => (b.anchor - a.anchor) || (b.r - a.r));
    const groups = clusterBodies(ordered, zoom);

    // === ЧТО ПОКАЗАНО КАДРА ===
    const hostPos = {};             // view-позиции хост-тел для баз
    const quietIds = new Set();     // базы групп: маркеры без имён
    const shownSmall = new Set();   // id показанных малых тел
    const moonHits = new Map();     // планета -> [{ m, md, mx, my, orbitPoly }]

    bodies.forEach(b => {
        if (b.kind === 'planet') hostPos['planet:' + b.p.name] = { x: b.x, y: b.y };
        if (b.kind === 'moon') hostPos['moon:' + b.p.name + ':' + b.m.n] = { x: b.x, y: b.y };
    });

    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind === 'moon') {
            if (!moonHits.has(rep.p)) moonHits.set(rep.p, []);
            moonHits.get(rep.p).push({
                m: rep.m, md: rep.md, mx: rep.x, my: rep.y, orbitPoly: rep.orbitPoly
            });
        }
        if (rep.kind === 'small') shownSmall.add(rep.id);

        if (g.members.length < 2) return;

        g.members.forEach(m => {
            if (m.kind === 'moon' && m !== rep)
                hostPos['moon:' + m.p.name + ':' + m.m.n] = { x: rep.x, y: rep.y };
            m.bases.forEach(b => quietIds.add(b.id));
        });
    });

    // === ПОЛ ===
    // Световое пятно и ореол звезды — до тел; пыль и пояса — на полу.
    // Орбиты планет здесь не рисуются: они появляются только при наведении.
    drawStarFloor(ctx);
    drawSmallBodiesFloor(ctx);
    drawStarHalo(ctx);

    // Тени на полу — отдельным проходом, до всех сфер.
    drawFloorShadows(ctx, groups, planetPos, zoom);

    // === ТЕЛА ПО ГЛУБИНЕ ===
    // Дальние (меньший view.y) — раньше; звезда участвует в сортировке.
    const drawList = [];
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        drawList.push({ kind: 'planet', x, y, r: p.r, p });
    });
    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind === 'moon' || rep.kind === 'small') {
            drawList.push({ kind: rep.kind, x: rep.x, y: rep.y, r: rep.r, rep });
        }
    });
    drawList.push({ kind: 'sun', x: 0, y: 0, r: SUN_R });

    drawList.sort((a, b) => (a.y - b.y) || (b.r - a.r));

    const smallTargets = new Map();
    drawList.forEach(item => {
        if (item.kind === 'planet') {
            drawPlanet(ctx, item.x, item.y, item.p, zoom);
        } else if (item.kind === 'moon') {
            drawMoonBody(ctx, item.x, item.y, item.rep.m.r, item.rep.m.c, zoom);
        } else if (item.kind === 'small') {
            const t = drawSmallBody(ctx, item.rep.small);
            if (t) smallTargets.set(item.rep.small.id, t);
        } else if (item.kind === 'sun') {
            drawSunCore(ctx);
        }
    });

    // Проекции — поверх сфер: у крупных планет радиус больше высоты над полом,
    // иначе линия целиком пряталась бы за телом (видна была бы только у Меркурия).
    drawProjectionLines(ctx, groups, planetPos, zoom);

    // Подписи групп: имена тел через запятую, затем базы на них. Подписаны все
    // показанные тела — планеты, одиночные луны и малые тела: имя видно всегда,
    // а не только при наведении (подсказка при наведении остаётся).
    groups.forEach(g => {
        const baseNames = [];
        g.members.forEach(m => m.bases.forEach(b => baseNames.push(b.name)));
        drawGroupLabel(ctx, g.rep.x, g.rep.y, {
            label: g.members.map(m => m.label).join(', '),
            baseLabel: baseNames.length ? baseNames.join(', ') : null
        }, zoom);
    });

    // Солнце — тоже подпись всегда.
    drawSunLabel(ctx, zoom);

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты.
    const baseTargets = drawBases(ctx, hostPos, quietIds);
    baseTargets.forEach(t => { t.p = planets.find(x => x.name === t.local.planet); });

    ctx.restore();

    // === HOVER-ЦЕЛИ ===
    // Порядок прежний и не зависит от порядка отрисовки: малые тела -> солнце
    // -> планеты (с лунами) -> базы. findBodyAt идёт с конца.
    small.forEach(s => {
        if (!shownSmall.has(s.id)) return;
        const t = smallTargets.get(s.id);
        if (t) hoverTargets.push(t);
    });
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });
    planets.forEach(p => {
        const { x, y } = planetPos.get(p);
        hoverTargets.push({
            kind: 'planet', p, x, y, moons: moonHits.get(p) || [],
            orbit: PLANET_ORBITS.get(p)
        });
    });
    baseTargets.forEach(t => hoverTargets.push(t));

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

/** Световое пятно на полу под звездой (эллипс 2:1). */
function drawStarFloor(ctx) {
    ctx.save();
    ctx.scale(1, ISO_K);
    const r = SUN_R * 7.5;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,206,122,0.22)');
    g.addColorStop(0.55, 'rgba(255,157,60,0.06)');
    g.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Большой ореол звезды — над полом, под телами. */
function drawStarHalo(ctx) {
    glow(ctx, 0, 0, SUN_R * 5.2, '#ff9d3c', 0.34);
    glow(ctx, 0, 0, SUN_R * 2.6, '#ffd27a', 0.28);
}

/** Тени на полу: планеты; показанные луны; показанные малые тела.
 *  Наклонные орбиты поднимают тело над эклиптикой — тень остаётся на полу
 *  (floorY), поэтому видно высоту. */
function drawFloorShadows(ctx, groups, planetPos, zoom) {
    planets.forEach(p => {
        const { x, floorY } = planetPos.get(p);
        shadow(ctx, x, floorY, p.r, zoom);
    });
    groups.forEach(g => {
        const rep = g.rep;
        const fy = rep.floorY ?? rep.y;
        if (rep.kind === 'moon' && rep.m.r >= 1.5) shadow(ctx, rep.x, fy, rep.m.r, zoom);
        if (rep.kind === 'small' && rep.r >= 1.5) shadow(ctx, rep.x, fy, rep.r, zoom);
    });
}

/**
 * Вертикальные линии от тел до их проекции на плоскость эклиптики. Это тот
 * же приём, что у кометы (drawComet рисует свою ножку сам), но для планет,
 * лун и остальных показанных малых тел. Рисуется поверх сфер: иначе у планет
 * с радиусом больше высоты над полом линия полностью скрыта телом. Фон —
 * пыль и безымянные частицы — линий не получает: это не выбираемые тела.
 */
function drawProjectionLines(ctx, groups, planetPos, zoom) {
    const minH = 1 / zoom;
    ctx.save();
    ctx.strokeStyle = 'rgba(127,216,255,0.45)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();

    planets.forEach(p => {
        const pos = planetPos.get(p);
        projectionLine(ctx, pos.x, pos.y, pos.floorY, minH);
    });

    groups.forEach(g => {
        const rep = g.rep;
        if (rep.kind !== 'moon' && rep.kind !== 'small') return;
        // У кометы уже есть собственная ножка и тень — не дублируем.
        if (rep.kind === 'small' && rep.small && rep.small.kind === 'comet') return;
        const fy = rep.floorY ?? rep.y;
        projectionLine(ctx, rep.x, rep.y, fy, minH);
    });

    ctx.stroke();
    ctx.restore();
}

/** Одна вертикальная линия; слишком короткую (меньше пикселя) не рисуем. */
function projectionLine(ctx, x, y, floorY, minH) {
    if (Math.abs(y - floorY) < minH) return;
    ctx.moveTo(x, y);
    ctx.lineTo(x, floorY);
}

// --- Тела ----------------------------------------------------------------------

/** Ядро солнца — сфера; ореол и пятно света нарисованы в слое пола. */
function drawSunCore(ctx) {
    sunSphere(ctx, 0, 0, SUN_R);
}

/** Подпись Солнца — постоянная, как у остальных тел. */
function drawSunLabel(ctx, zoom) {
    drawGroupLabel(ctx, SUN_R * 0.6, 0, { label: 'Солнце / Sun', baseLabel: null }, zoom);
}

/** Планета: сфера + кольца Сатурна (задняя половина до сферы, передняя после). */
function drawPlanet(ctx, x, y, p, zoom) {
    if (p.rings) drawRingHalf(ctx, x, y, p, true, zoom);
    sphere(ctx, x, y, p.r, p.color, { zoom });
    if (p.rings) drawRingHalf(ctx, x, y, p, false, zoom);
}

/** Половина кольца Сатурна: back — дальняя (верхняя), иначе передняя. */
function drawRingHalf(ctx, x, y, p, back, zoom) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    const a0 = back ? Math.PI : 0;
    const a1 = back ? Math.PI * 2 : Math.PI;

    ctx.strokeStyle = 'rgba(200,200,200,0.30)';
    ctx.lineWidth = 4 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 2.2, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.46)';
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.7, a0, a1);
    ctx.stroke();

    ctx.restore();
}

/** Луна: маленькая сфера; тень нарисована в слое пола. */
function drawMoonBody(ctx, x, y, r, color, zoom) {
    sphere(ctx, x, y, r, color || COLORS.moon, { zoom, rimAlpha: 0.12 });
}

/**
 * Подпись группы тел у её представителя (scene.js clusterBodies) — общая для
 * всех тел: две строки, имена тел группы и базы на них.
 */
function drawGroupLabel(ctx, mx, my, group, zoom) {
    const lines = [{ text: group.label, color: COLORS.tooltip }];
    if (group.baseLabel) lines.push({ text: group.baseLabel, color: COLORS.base });

    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom;
    const lh = 12 / zoom;
    const top = my - 14 / zoom;
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

