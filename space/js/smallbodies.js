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
import { planets, beltNotables } from './data.js';
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

    return targets;
}
