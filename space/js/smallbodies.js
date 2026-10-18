// =============================================================================
// smallbodies.js — малые тела Солнечной системы отдельным слоем мира:
// главный пояс (частицы + крупнейшие тела + щели Кирквуда), околоземные
// астероиды (Атон/Аполлон/Амур), троянцы Юпитера (L4/L5), кометы, пояс
// Койпера и облако Оорта.
//
// Каждое тело — сущность со своим типом (kind) и id: в будущем появится
// добыча/уничтожение астероидов, поэтому генерация выполняется при каждом
// запуске и детерминирована (сидированный ПСЧ) — пояс стабилен между
// загрузками, а уничтоженные можно будет исключать по id.
//
// Позиции считаются каждый кадр из общего simDays — как у планет. Элементы
// орбит реальные (a, e, долгота перигелия), карта — 2D-плоскость эклиптики.
// =============================================================================

import { state } from './state.js';
import { makeRng, auToDist, keplerPos, periodFromA, orbitAngle } from './math.js';
import { planets, beltNotables, neas, trojanNames } from './data.js';
import { STROKE } from './config.js';

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

/** Дескриптор эллипса орбиты для hover/выбора: центр, полуоси, поворот. */
function orbitEllipse(aAu, e, periDeg) {
    const A = auToDist(aAu);
    const p = periDeg * Math.PI / 180;
    return {
        cx: -A * e * Math.cos(p),          // центр — от солнца в сторону, обратную перигелию
        cy: A * e * Math.sin(p),
        a: A,
        b: A * Math.sqrt(1 - e * e),
        rot: -p
    };
}

// --- Главный пояс: крупнейшие тела ---------------------------------------------
// Церера (карликовая планета), Веста, Паллада, Гигея — заметнее частиц пояса
// (ярче, крупнее, с обводкой) и выбираются кликом, как планеты.
export const notables = beltNotables.map(b => ({
    id: 'notable-' + b.n,
    kind: 'asteroid',
    name: b.ru + ' / ' + b.n,
    note: b.type === 'dwarf' ? 'Карликовая планета' : 'Крупный астероид',
    a: b.a, e: b.e, peri: b.peri, m0: b.m0, dia: b.dia,
    T: periodFromA(b.a),
    r: b.type === 'dwarf' ? 3.2 : 2.6,
    x: 0, y: 0,
    orbit: orbitEllipse(b.a, b.e, b.peri)
}));

// --- Околоземные астероиды (ОЗА) ----------------------------------------------
/** Малое тело карты: общие поля для hover и карточек (элементы, эллипс, тип). */
function smallBody(id, kind, name, src, r, extra) {
    return Object.assign({
        id, kind, name,
        a: src.a, e: src.e, peri: src.peri, m0: src.m0, dia: src.dia,
        T: periodFromA(src.a),
        q: src.a * (1 - src.e), Q: src.a * (1 + src.e),
        r, x: 0, y: 0,
        orbit: orbitEllipse(src.a, src.e, src.peri)
    }, extra || {});
}

// Реальные элементы — из data.js; шесть безымянных досыпаны по границам групп:
// амур — перигелий между орбитами Земли и Марса; аполлон — пересекает орбиту
// Земли, a > 1; атон — пересекает, a < 1. Орбиты заметно эллиптические.
const NEA_SEED = 20261018;
const neaRng = makeRng(NEA_SEED);

export const neaBodies = neas.map(n =>
    smallBody('nea-' + n.n, 'nea', n.ru + ' / ' + n.n, n, 1.6, { group: n.group }));

for (let i = 0; i < 6; i++) {
    const group = ['amor', 'apollo', 'aten'][i % 3];
    let q, Q;
    if (group === 'amor') {
        q = 1.05 + neaRng() * 0.35;                        // 1.05–1.40: орбиту Земли не пересекает
        Q = 1.7 + neaRng() * 1.6;
    } else if (group === 'apollo') {
        q = 0.30 + neaRng() * 0.65;
        Q = (2.02 - q) + neaRng() * (3.7 - (2.02 - q));    // a > 1 а.е.
    } else {
        const aAten = 0.85 + neaRng() * 0.14;              // a < 1 а.е.
        q = 0.35 + neaRng() * (Math.min(0.85, 2 * aAten - 1.06) - 0.35);
        Q = 2 * aAten - q;                                 // афелий выше орбиты Земли
    }
    const a = (q + Q) / 2, e = (Q - q) / (Q + q);
    neaBodies.push(smallBody('nea-gen-' + i, 'nea', null,
        { a, e, peri: neaRng() * 360, m0: neaRng() * 360 }, 1.2, { group }));
}

// --- Троянцы Юпитера (L4/L5) ----------------------------------------------------
// Два облака точек на 60° впереди и позади Юпитера вдоль его орбиты (60 и 40
// точек) с медленной либрацией ±5° за ~150 лет; точки движутся синхронно с
// Юпитером. Именованные (Ахиллес, Гектор…) — заметнее и выбираются.
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
            dAng: (trojanRng() - 0.5) * 16,   // ±8° вокруг центра облака
            dR: (trojanRng() - 0.5) * 28,     // ±14 ед. поперёк орбиты
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
    camp: t.camp, dAng: t.dAng, dR: t.dR,
    r: 2.2, x: 0, y: 0,
    orbit: { cx: 0, cy: 0, r: JUPITER.dist }
}));

/**
 * Нарисовать малые тела в мировой системе координат (вызывается из render.js
 * после звёзд). Возвращает hoverTargets именованных тел.
 * @returns {Array} цели для hover/выбора
 */
export function drawSmallBodies(ctx) {
    const { simDays, zoom } = state;
    const targets = [];

    // Частицы пояса
    ctx.fillStyle = '#6e6e6e';
    asteroids.forEach(a => {
        const ang = orbitAngle(a.l0, a.period, simDays);
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * a.d, -Math.sin(ang) * a.d, a.s, 0, Math.PI * 2);
        ctx.fill();
    });

    // Крупнейшие тела пояса — заметные точки с обводкой, выбираются
    notables.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cfcfcf';
        ctx.fill();
        ctx.strokeStyle = '#efefef';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();

        targets.push({ kind: 'asteroid', name: b.name, x: pos.x, y: pos.y, r: b.r, moons: [], small: b });
    });

    // ОЗА: именованные ярче и с обводкой; безымянные — тусклые точки
    neaBodies.forEach(b => {
        const pos = keplerPos(b.a, b.e, b.peri, b.m0, b.T, simDays);
        b.x = pos.x;
        b.y = pos.y;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.name ? '#d8d8d8' : '#8a8a8a';
        ctx.fill();
        if (b.name) {
            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = STROKE.moon / zoom;
            ctx.stroke();
            targets.push({ kind: 'nea', name: b.name, x: pos.x, y: pos.y, r: b.r, moons: [], small: b });
        }
    });

    // Троянцы: два облака точек, синхронных с Юпитером (плюс либрация)
    const jupAng = orbitAngle(JUPITER.l0, JUPITER.period, simDays);
    ctx.fillStyle = '#808080';
    trojanClouds.forEach(c => {
        const base = jupAng + c.camp * Math.PI / 3 + trojanLib(simDays, c.camp) * Math.PI / 180;
        c.points.forEach(p => {
            const ang = base + p.dAng * Math.PI / 180;
            const rr = JUPITER.dist + p.dR;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * rr, -Math.sin(ang) * rr, p.s, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Именованные троянцы — заметные точки с обводкой, выбираются
    trojanBodies.forEach(b => {
        const ang = jupAng + b.camp * Math.PI / 3 + (b.dAng + trojanLib(simDays, b.camp)) * Math.PI / 180;
        const rr = JUPITER.dist + b.dR;
        b.x = Math.cos(ang) * rr;
        b.y = -Math.sin(ang) * rr;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cfcfcf';
        ctx.fill();
        ctx.strokeStyle = '#efefef';
        ctx.lineWidth = STROKE.moon / zoom;
        ctx.stroke();

        targets.push({ kind: 'trojan', name: b.name, x: b.x, y: b.y, r: b.r, moons: [], small: b });
    });

    return targets;
}
