// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Карта — диметрия 2:1 (iso.js): все позиции здесь уже в view-координатах
// (y сжат вдвое). Орбитальные элементы — реальные; движение считается из
// общего simDays через Кеплер. Кометы дополнительно поднимаются над полом
// по наклонению inc/node — стилизованная 3D-орбита, как на референсах.
//
// Именованные тела (крупнейшие тела пояса, именованные ОЗА, троянцы L4/L5,
// кометы) слипаются по экранному расстоянию общим правилом scene.js
// clusterBodies: smallBodyList() отдаёт их позиции в кадр, а render.js
// рисует только показанных представителей через drawSmallBody. Пыль,
// частицы пояса и пути комет остаются в слое пола (drawSmallBodiesFloor).
// =============================================================================

import { state } from './state.js';
import {
    makeRng, auToDist, keplerPos3, periodFromA, orbitAngle, orbitPoint3, clamp
} from './math.js';
import { planets, beltNotables, neas, trojanNames, comets } from './data.js';
import { ISO_K } from './config.js';
import { orbitEllipsePath, project3 } from './iso.js';
import { rock, sphere } from './paint.js';

// --- Главный пояс: закон Кеплера от якорей Марс → Юпитер ---------------------
const MARS = planets.find(p => p.name === 'Mars');
const JUPITER = planets.find(p => p.name === 'Jupiter');
const KEPLER_EXP = Math.log(JUPITER.period / MARS.period) / Math.log(JUPITER.dist / MARS.dist);

/** Период обращения астероида на расстоянии d (условные единицы), сутки. */
function beltPeriod(d) {
    return MARS.period * Math.pow(d / MARS.dist, KEPLER_EXP);
}

// --- Главный пояс: частицы ----------------------------------------------------
const BELT_MIN = 270, BELT_MAX = 350;    // прежние границы (≈ 2.2–3.5 а.е.)
const BELT_COUNT = 400;
const BELT_SEED = 20261018;
const BELT_MID = (BELT_MIN + BELT_MAX) / 2;

// Щели Кирквуда — резонансы с Юпитером 2.50 / 2.82 / 2.95 / 3.27 а.е.:
// [радиус (а.е.), глубина провала, ширина (ед.)]. Плотность частиц в щели падает.
const BELT_GAPS = [
    [2.50, 0.85, 3.6],
    [2.82, 0.80, 3.0],
    [2.95, 0.80, 3.0],
    [3.27, 0.70, 3.2]
].map(([au, depth, w]) => ({ r: auToDist(au), depth, w }));

/** Плотность пояса в точке d — произведение провалов около резонансов. */
function beltDensity(d) {
    let p = 1;
    for (const g of BELT_GAPS) p *= 1 - g.depth * Math.exp(-Math.pow((d - g.r) / g.w, 2));
    return p;
}

// Частицы пояса. Генерация детерминированная и происходит при каждом запуске:
// пояс есть всегда, элементы адресуемы по id (задел под добычу/уничтожение).
const beltRng = makeRng(BELT_SEED);
export const asteroids = [];
for (let i = 0; i < BELT_COUNT; i++) {
    let d = BELT_MIN;
    for (let tries = 0; tries < 40; tries++) {
        d = BELT_MIN + beltRng() * (BELT_MAX - BELT_MIN);
        if (beltRng() < beltDensity(d)) break;
    }
    asteroids.push({
        id: 'belt-' + i,
        kind: 'asteroid',
        d,
        l0: beltRng() * 360,                                   // стартовая долгота
        period: beltPeriod(d) * (0.98 + beltRng() * 0.04),     // лёгкий разброс периодов
        s: 0.5 + beltRng() * 1.5                               // размер, пиксели мира
    });
}

/** Дескриптор эллипса орбиты для карточек/совместимости: центр, полуоси, поворот. */
function orbitEllipse(aAu, e, periDeg) {
    const A = auToDist(aAu);
    const p = periDeg * Math.PI / 180;
    return {
        cx: -A * e * Math.cos(p),
        cy: A * e * Math.sin(p),
        a: A,
        b: A * Math.sqrt(1 - e * e),
        rot: -p
    };
}

/**
 * Точки орбиты для hover/выбора: маппинг а.е.→единицы нелинеен, поэтому
 * «эллипс по (a, e)» верен лишь в линейных зонах шкалы. Сэмплируем положения
 * по тем же элементам, что и движение, и сразу переводим в view.
 * @returns {number[]} плоский массив x0, y0, x1, y1, … (view, замкнутая петля)
 */
function orbitPoly(a, e, peri, T, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= 128; k++) {
        const pos = keplerPos3(a, e, peri, 0, T, k * T / 128, auToDist, inc, node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

/** Круговая орбита в view с наклонением inc/node (для троянцев). */
function circlePoly(r, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= 128; k++) {
        const lon = k / 128 * Math.PI * 2;
        const pos = orbitPoint3(r, lon, inc, node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

// --- Главный пояс: крупнейшие тела ---------------------------------------------
// Церера (карликовая планета), Веста, Паллада, Гигея — заметнее частиц пояса
// (ярче, крупнее, с обводкой) и выбираются кликом, как планеты.
export const notables = beltNotables.map(b => {
    const T = periodFromA(b.a);
    return {
        id: 'notable-' + b.n,
        kind: 'asteroid',
        name: b.ru + ' / ' + b.n,
        ru: b.ru,
        note: b.type === 'dwarf' ? 'Карликовая планета' : 'Крупный астероид',
        a: b.a, e: b.e, peri: b.peri, m0: b.m0, dia: b.dia,
        inc: b.inc, node: b.node,
        T,
        r: b.type === 'dwarf' ? 3.2 : 2.6,
        x: 0, y: 0,
        orbit: orbitEllipse(b.a, b.e, b.peri),
        poly: orbitPoly(b.a, b.e, b.peri, T, b.inc, b.node)
    };
});

// --- Околоземные астероиды (ОЗА) ----------------------------------------------

/** Малое тело карты: общие поля для hover и карточек (элементы, орбита, тип). */
function smallBody(id, kind, name, src, r, extra) {
    const T = periodFromA(src.a);
    const inc = src.inc ?? 0;
    const node = src.node ?? 0;
    return Object.assign({
        id, kind, name,
        a: src.a, e: src.e, peri: src.peri, m0: src.m0, dia: src.dia,
        inc, node,
        T,
        q: src.a * (1 - src.e), Q: src.a * (1 + src.e),
        r, x: 0, y: 0,
        orbit: orbitEllipse(src.a, src.e, src.peri),
        poly: orbitPoly(src.a, src.e, src.peri, T, inc, node)
    }, extra || {});
}

const NEA_SEED = 20261018;
const neaRng = makeRng(NEA_SEED);

export const neaBodies = neas.map(n =>
    smallBody('nea-' + n.n, 'nea', n.ru + ' / ' + n.n, n, 1.6, { group: n.group, ru: n.ru }));

for (let i = 0; i < 6; i++) {
    const group = ['amor', 'apollo', 'aten'][i % 3];
    let q, Q;
    if (group === 'amor') {
        q = 1.05 + neaRng() * 0.35;
        Q = 1.7 + neaRng() * 1.6;
    } else if (group === 'apollo') {
        q = 0.30 + neaRng() * 0.65;
        Q = (2.02 - q) + neaRng() * (3.7 - (2.02 - q));
    } else {
        const aAten = 0.85 + neaRng() * 0.14;
        q = 0.35 + neaRng() * (Math.min(0.85, 2 * aAten - 1.06) - 0.35);
        Q = 2 * aAten - q;
    }
    const a = (q + Q) / 2, e = (Q - q) / (Q + q);
    neaBodies.push(smallBody('nea-gen-' + i, 'nea', null,
        {
            a, e, peri: neaRng() * 360, m0: neaRng() * 360,
            inc: 0.5 + neaRng() * 24, node: neaRng() * 360
        }, 1.2, { group }));
}

// --- Троянцы Юпитера (L4/L5) ----------------------------------------------------
const TROJAN_SEED = 20261018;
const TROJAN_LIB_PERIOD = 54786;   // период либрации, сутки (~150 лет)
const TROJAN_LIB_AMP = 5;          // амплитуда либрации, градусы
const trojanRng = makeRng(TROJAN_SEED);

export const trojanClouds = [
    { camp: 4, points: [] },     // L4 — впереди Юпитера
    { camp: 5, points: [] }      // L5 — позади
];
trojanClouds.forEach((c, ci) => {
    const n = ci === 0 ? 60 : 40;
    for (let i = 0; i < n; i++) {
        c.points.push({
            id: 'trojan-' + c.camp + '-' + i,
            dAng: (trojanRng() - 0.5) * 16,
            dR: (trojanRng() - 0.5) * 28,
            s: 0.7 + trojanRng() * 0.6
        });
    }
});

/** Либрация облака L4/L5 вокруг точки ±60°, градусы. */
function trojanLib(t, camp) {
    return TROJAN_LIB_AMP * Math.sin(2 * Math.PI * t / TROJAN_LIB_PERIOD + (camp === 4 ? 0 : 2.1));
}

export const trojanBodies = trojanNames.map(t => ({
    id: 'trojan-' + t.n,
    kind: 'trojan',
    name: t.ru + ' / ' + t.n,
    ru: t.ru,
    camp: t.camp, dAng: t.dAng, dR: t.dR,
    r: 2.2, x: 0, y: 0,
    inc: JUPITER.inc, node: JUPITER.node,
    orbit: { cx: 0, cy: 0, r: JUPITER.dist },
    poly: circlePoly(JUPITER.dist, JUPITER.inc, JUPITER.node)
}));

// --- Пояс Койпера и облако Оорта ------------------------------------------------
const DUST_SEED = 20261018;
const dustRng = makeRng(DUST_SEED);

/** Собрать кольцо пыли: view-позиции, границы raw-радиусов и группы по цвету. */
function makeDustRing(list) {
    let rMin = Infinity, rMax = 0;
    const map = new Map();
    for (const p of list) {
        p.x = Math.cos(p.ang) * p.r;
        p.y = -Math.sin(p.ang) * p.r * ISO_K;
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        let g = map.get(p.col);
        if (!g) { g = { col: p.col, points: [] }; map.set(p.col, g); }
        g.points.push(p);
    }
    return { rMin, rMax, groups: [...map.values()] };
}

const kuiperDust = makeDustRing(Array.from({ length: 600 }, () => {
    const al = 0.22 + dustRng() * 0.23;
    return {
        ang: dustRng() * Math.PI * 2,
        r: auToDist(30 + dustRng() * 20),
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

const oortDust = makeDustRing(Array.from({ length: 350 }, () => {
    const al = 0.16 + dustRng() * 0.18;
    return {
        ang: dustRng() * Math.PI * 2,
        r: 1300 + dustRng() * 500,
        s: 0.8 + dustRng() * 1.0,
        col: 'rgba(150,150,150,' + al.toFixed(2) + ')'
    };
}));

/** Границы областей в view-единицах — для подсветки выбранного пояса/облака. */
export const REGION_BOUNDS = {
    belt: { rMin: BELT_MIN, rMax: BELT_MAX },
    kuiper: { rMin: kuiperDust.rMin, rMax: kuiperDust.rMax },
    oort: { rMin: oortDust.rMin, rMax: oortDust.rMax }
};

/** Нарисовать кольцо пыли: точки вне кадра пропускаются. */
function drawDustRing(ctx, ring, zoom) {
    const half = Math.hypot(state.W, state.H) / 2 / zoom + 2;
    // rMin/rMax — в raw, камера — в view: сравниваем в raw-единицах
    const camD = Math.hypot(state.camX, state.camY / ISO_K);
    if (camD + half < ring.rMin || camD - half > ring.rMax) return;

    const h2 = half * half;
    for (const g of ring.groups) {
        ctx.fillStyle = g.col;
        for (const p of g.points) {
            if ((p.x - state.camX) ** 2 + (p.y - state.camY) ** 2 > h2) continue;
            ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        }
    }
}

// --- Кометы ---------------------------------------------------------------------
// Ядро, кома и хвост, направленный от Солнца. Орбита действительно наклонена
// к эклиптике по реальным inc/node: положение считается в 3D и проецируется
// через project3, поэтому комета висит над полом на своей высоте z.

const RAD = Math.PI / 180;

/** Замкнутый путь кометы в view — с той же высотой, что и у тела. */
function cometOrbitPoly(b) {
    const pts = [];
    for (let k = 0; k <= 160; k++) {
        const pos = keplerPos3(b.a, b.e, b.peri, 0, b.T, k * b.T / 160,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        pts.push(v.x, v.y);
    }
    return pts;
}

export const cometBodies = comets.map(c => {
    const b = smallBody('comet-' + c.n, 'comet', c.ru + ' / ' + c.n, c, 1.4,
        { shower: c.shower, src: c.src, tailK: c.tailK, ru: c.ru, inc: c.inc, node: c.node });
    b.poly = cometOrbitPoly(b);
    return b;
});

/** Обновить позицию кометы из simDays: view-точка с высотой + точка на полу. */
function updateComet(b, t) {
    const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, t, auToDist, b.inc, b.node);
    const v = project3(pos.x, pos.y, pos.z);
    b.x = v.x;
    b.y = v.y;
    b.fx = pos.x;
    b.fy = pos.y * ISO_K;
    b.floorY = b.fy;
    b.z = pos.z;
    b.rAu = pos.rAu;
}

/**
 * Позиции всех именованных малых тел кадра — для общего правила слипания
 * (scene.js clusterBodies): крупнейшие тела пояса, именованные ОЗА, троянцы и
 * кометы. Безымянные (частицы пояса, досыпанные ОЗА, облака троянцев, пыль
 * дальних поясов) сюда не входят: их не выбирают и в подписи они не попадают.
 * @returns {Array} записи { id, kind, small, r, x, y, label } — view-координаты
 */
export function smallBodyList() {
    const { simDays } = state;
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    const list = [];

    function add(b, kind) {
        list.push({
            id: b.id, kind, small: b, r: b.r, x: b.x, y: b.y,
            z: b.z || 0, floorY: b.floorY ?? b.y, label: b.ru || b.name
        });
    }

    notables.forEach(b => {
        const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, simDays,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        add(b, 'asteroid');
    });

    neaBodies.forEach(b => {
        const pos = keplerPos3(b.a, b.e, b.peri, b.m0, b.T, simDays,
            auToDist, b.inc, b.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        b.rAu = pos.rAu;
        if (b.name) add(b, 'nea');
    });

    trojanBodies.forEach(b => {
        const ang = jupAng + b.camp * Math.PI / 3
            + (b.dAng + trojanLib(simDays, b.camp)) * RAD;
        const rr = JUPITER.dist + b.dR;
        const pos = orbitPoint3(rr, ang, JUPITER.inc, JUPITER.node);
        const v = project3(pos.x, pos.y, pos.z);
        b.x = v.x;
        b.y = v.y;
        b.z = pos.z;
        b.floorY = pos.y * ISO_K;
        add(b, 'trojan');
    });

    cometBodies.forEach(b => {
        updateComet(b, simDays);
        add(b, 'comet');
    });

    return list;
}

/**
 * Слой пола: пыль Койпера/Оорта, полоса и частицы главного пояса, облака
 * троянцев и пути комет. Hover-целей не даёт: именованные тела рисует
 * drawSmallBody в общем слое тел.
 */
export function drawSmallBodiesFloor(ctx) {
    const { simDays, zoom } = state;

    // Дальняя пыль фоном: пояс Койпера и облако Оорта.
    drawDustRing(ctx, kuiperDust, zoom);
    drawDustRing(ctx, oortDust, zoom);

    // Полоса пояса — «гравий» на полу, эллипс 2:1.
    ctx.save();
    ctx.strokeStyle = 'rgba(58,66,82,0.10)';
    ctx.lineWidth = 10 / zoom;
    ctx.beginPath();
    orbitEllipsePath(ctx, 0, 0, BELT_MID);
    ctx.stroke();
    ctx.restore();

    // Частицы пояса.
    ctx.fillStyle = '#6e6e6e';
    asteroids.forEach(a => {
        const ang = orbitAngle(a.l0, a.period, simDays);
        const x = Math.cos(ang) * a.d;
        const y = -Math.sin(ang) * a.d * ISO_K;
        ctx.beginPath();
        ctx.arc(x, y, a.s, 0, Math.PI * 2);
        ctx.fill();
    });

    // Безымянные досыпанные ОЗА — тусклые точки всегда.
    ctx.fillStyle = '#8a8a8a';
    neaBodies.forEach(b => {
        if (b.name) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация).
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    ctx.fillStyle = '#808080';
    trojanClouds.forEach(c => {
        const base = jupAng + c.camp * Math.PI / 3 + trojanLib(simDays, c.camp) * RAD;
        c.points.forEach(p => {
            const ang = base + p.dAng * RAD;
            const rr = JUPITER.dist + p.dR;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * rr, -Math.sin(ang) * rr * ISO_K, p.s, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Пути комет — наклонные, с высотой (полилиния уже в view).
    ctx.save();
    ctx.strokeStyle = 'rgba(111,184,216,0.35)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 5 / zoom]);
    cometBodies.forEach(b => {
        const poly = b.poly;
        if (!poly || poly.length < 4) return;
        ctx.beginPath();
        ctx.moveTo(poly[0], poly[1]);
        for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
        ctx.closePath();
        ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
}

/**
 * Нарисовать одно показанное именованное малое тело в общем слое тел.
 * @returns {?Object} hover-цель { kind, name, x, y, r, moons, small }
 */
export function drawSmallBody(ctx, b) {
    const zoom = state.zoom;

    if (b.kind === 'comet') return drawComet(ctx, b);

    // Камни пояса/ОЗА/троянцев: неровная форма, детерминированная id.
    if (b.r >= 1.4) {
        rock(ctx, b.x, b.y, b.r, b.id, '#b9a88f', zoom);
    } else {
        ctx.fillStyle = '#d8d8d8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    }

    return {
        kind: b.kind, name: b.name, x: b.x, y: b.y, r: b.r,
        moons: [], small: b
    };
}

/** Комета: ножка, тень, два хвоста от Солнца, кома и ядро. */
function drawComet(ctx, b) {
    const zoom = state.zoom;
    const pf = clamp(b.q / Math.max(b.rAu, 0.001), 0, 1);
    // Хвост растёт с зумом, но не остаётся гигантским при общем плане:
    // world-длина ~ 1/√zoom, экранная ~ √zoom.
    const len = (85 + 95 * pf) * b.tailK / Math.sqrt(zoom);

    // Направление от Солнца с учётом высоты: хвост уходит вверх-в сторону.
    const dx = b.x, dy = b.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const px = -uy, py = ux;

    const tipX = b.x + ux * len;
    const tipY = b.y + uy * len;

    // Ножка к полу и тень.
    ctx.strokeStyle = 'rgba(127,216,255,0.30)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.fx, b.fy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(127,216,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(b.fx, b.fy, 7 / zoom, 2.6 / zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Пылевой хвост — шире и чуть изогнут.
    const wd = 4.6 / Math.sqrt(zoom);
    const midX = b.x + ux * len * 0.55 + px * 7 / zoom;
    const midY = b.y + uy * len * 0.55 + py * 7 / zoom;
    let g = ctx.createLinearGradient(b.x, b.y, tipX, tipY);
    g.addColorStop(0, 'rgba(255,231,163,0.60)');
    g.addColorStop(0.6, 'rgba(255,231,163,0.20)');
    g.addColorStop(1, 'rgba(255,231,163,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x + px * wd, b.y + py * wd);
    ctx.quadraticCurveTo(midX + px * wd * 1.7, midY + py * wd * 1.7, tipX, tipY);
    ctx.quadraticCurveTo(midX - px * wd * 0.9, midY - py * wd * 0.9, b.x - px * wd, b.y - py * wd);
    ctx.closePath();
    ctx.fill();

    // Ионный хвост — узкий, почти прямой, голубой.
    const wi = 2.1 / Math.sqrt(zoom);
    const ionTipX = b.x + ux * len * 1.12;
    const ionTipY = b.y + uy * len * 1.12;
    g = ctx.createLinearGradient(b.x, b.y, ionTipX, ionTipY);
    g.addColorStop(0, 'rgba(191,246,255,0.85)');
    g.addColorStop(0.55, 'rgba(191,246,255,0.24)');
    g.addColorStop(1, 'rgba(191,246,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x + px * wi, b.y + py * wi);
    ctx.lineTo(ionTipX, ionTipY);
    ctx.lineTo(b.x - px * wi, b.y - py * wi);
    ctx.closePath();
    ctx.fill();

    // Кома — радиальное свечение вокруг ядра.
    const comaR = 12 / Math.sqrt(zoom);
    const coma = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, comaR);
    coma.addColorStop(0, 'rgba(255,255,255,0.95)');
    coma.addColorStop(0.35, 'rgba(223,248,255,0.42)');
    coma.addColorStop(0.7, 'rgba(127,216,255,0.14)');
    coma.addColorStop(1, 'rgba(127,216,255,0)');
    ctx.fillStyle = coma;
    ctx.beginPath();
    ctx.arc(b.x, b.y, comaR, 0, Math.PI * 2);
    ctx.fill();

    // Ядро — белая сфера (минимальный экранный размер, чтобы не пропадало).
    sphere(ctx, b.x, b.y, Math.max(b.r, 2.4 / zoom), '#ffffff', { zoom, rim: false });

    return {
        kind: 'comet', name: b.name, x: b.x, y: b.y,
        r: Math.max(b.r, 3 / zoom), moons: [], small: b
    };
}
