// =============================================================================
// math.js — чистые функции: астрономическая математика и форматирование.
// Не знают ни о канвасе, ни о состоянии — легко тестировать и переиспользовать.
// Единый линейный масштаб (units.js): а.е. -> wu, км -> wu, без «сжатых» шкал.
// Здесь же решение уравнения Кеплера и форматтеры масштаба/углов.
// =============================================================================

import { J2000_MS, MS_PER_DAY, MIN_ZOOM, MAX_ZOOM } from './config.js';
import { AU_KM, AU_WU, au, km, wuToKm, wuToAu } from './units.js';

/**
 * Угол тела на круговой орбите из симуляционного времени.
 * Формула средней долготы: L = L0 + 360° * t / T, против часовой стрелки
 * (как видно с севера эклиптики).
 * @param {number} l0     средняя долгота на J2000, градусы
 * @param {number} period сидерический период, сутки
 * @param {number} t      симуляционное время, сутки от J2000
 * @returns {number} угол в радианах
 */
export function orbitAngle(l0, period, t) {
    return (l0 + 360 * t / period) * Math.PI / 180;
}

/**
 * Симуляционные сутки -> строка даты «YYYY-MM-DD HH:MM» (UTC).
 * @param {number} t сутки от J2000
 */
export function formatSimDate(t) {
    const d = new Date(J2000_MS + t * MS_PER_DAY);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
           ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

/** Ограничить значение диапазоном [min, max]. */
export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * Экранные координаты -> мировые (учитывает камеру и зум).
 * @returns {{x: number, y: number}}
 */
export function screenToWorld(sx, sy, state) {
    return {
        x: state.camX + (sx - state.W / 2) / state.zoom,
        y: state.camY + (sy - state.H / 2) / state.zoom
    };
}

/** mulberry32 — маленький сидированный ПСЧ (сид -> функция [0..1)). */
export function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Астрономические единицы -> мировые единицы карты: единая линейная шкала
 * (1 а.е. = 1000 wu). Никаких якорей и кусочного сжатия.
 * @param {number} v расстояние, а.е.
 */
export function auToDist(v) {
    return au(v);
}

/** Период обращения по третьему закону Кеплера (a в а.е.), сутки. */
export function periodFromA(a) {
    return 365.256 * Math.pow(a, 1.5);
}

/**
 * Позиция тела на эллиптической орбите из симуляционного времени: средняя
 * аномалия -> уравнение Кеплера (итерации Ньютона) -> истинная аномалия.
 * Правило знаков как у планет (y вниз, движение против часовой с севера
 * эклиптики). При e = 0 совпадает с orbitAngle (m0 + peri = средняя долгота).
 * @param {number} a    большая полуось, а.е.
 * @param {number} e    эксцентриситет (0..0.99)
 * @param {number} peri долгота перигелия, градусы
 * @param {number} m0   средняя аномалия на J2000, градусы
 * @param {number} T    период, сутки
 * @param {number} t    симуляционное время, сутки от J2000
 * @param {Function} [mapDist] перевод радиуса в единицы карты; по умолчанию
 *        а.е. -> условные единицы (auToDist). Для планет с уже сжатым
 *        радиусом p.dist передаётся тождественная функция.
 * @returns {{x: number, y: number, rAu: number}} единицы мира + радиус, а.е.
 */
export function keplerPos(a, e, peri, m0, T, t, mapDist = auToDist) {
    let turns = (m0 / 360 + t / T) % 1;
    if (turns < 0) turns += 1;
    const M = turns * 2 * Math.PI;

    // стартовое приближение для высоких эксцентриситетов, затем итерации Ньютона
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const rAu = a * (1 - e * Math.cos(E));
    const th = nu + peri * Math.PI / 180;
    const r = mapDist(rAu);
    return { x: Math.cos(th) * r, y: -Math.sin(th) * r, rAu };
}

/** Градусы -> радианы для орбитальных элементов. */
const ORBIT_RAD = Math.PI / 180;

/**
 * Точка на орбите с наклонением. lon — долгота в плоскости эклиптики
 * (радианы), inc — наклонение, node — долгота восходящего узла (градусы).
 * Возвращает уже 3D-точку: x, y (вниз), z (высота над эклиптикой).
 */
export function orbitPoint3(radius, lon, incDeg = 0, nodeDeg = 0) {
    const inc = incDeg * ORBIT_RAD;
    const node = nodeDeg * ORBIT_RAD;
    const u = lon - node;                 // аргумент широты от узла
    const cu = Math.cos(u), su = Math.sin(u);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const co = Math.cos(node), so = Math.sin(node);

    // Поворот орбитальной плоскости: Rz(node) * Rx(inc) * Rz(-node),
    // затем перевод в экранные «y вниз».
    return {
        x: radius * (co * cu - so * su * ci),
        y: -radius * (so * cu + co * su * ci),
        z: radius * su * si
    };
}

/**
 * Позиция тела на наклонной орбите: те же элементы, что у keplerPos, плюс
 * реальные inc/node. Плоский случай (inc = node = 0) совпадает с keplerPos.
 * @returns {{x: number, y: number, z: number, rAu: number}}
 */
export function keplerPos3(a, e, peri, m0, T, t, mapDist = auToDist, inc = 0, node = 0) {
    const flat = keplerPos(a, e, peri, m0, T, t, mapDist);
    const r = Math.hypot(flat.x, flat.y);
    const lon = Math.atan2(-flat.y, flat.x);
    return Object.assign(orbitPoint3(r, lon, inc, node), { rAu: flat.rAu });
}

/**
 * Замкнутая полилиния орбиты по элементам: плоский массив x0, y0, x1, y1…
 * (сырые единицы карты). Нужна для эллиптических орбит, где descriptor
 * {a,b,rot} после проекции уже неудобен.
 * @param {Function} [mapDist] как у keplerPos
 */
export function keplerPoly(a, e, peri, m0, T, steps = 128, mapDist = auToDist) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const pos = keplerPos(a, e, peri, m0, T, k * T / steps, mapDist);
        pts.push(pos.x, pos.y);
    }
    return pts;
}

/**
 * То же, но с наклонением: x0,y0,z0,x1,y1,z1… (сырые единицы карты).
 * @param {Function} [mapDist] как у keplerPos
 */
export function keplerPoly3(a, e, peri, m0, T, steps = 128, mapDist = auToDist, inc = 0, node = 0) {
    const pts = [];
    for (let k = 0; k <= steps; k++) {
        const pos = keplerPos3(a, e, peri, m0, T, k * T / steps, mapDist, inc, node);
        pts.push(pos.x, pos.y, pos.z);
    }
    return pts;
}

// --- Форматирование реального масштаба ----------------------------------------

/**
 * Зум, при котором радиус rWu вписан в меньшую сторону экрана с запасом pad.
 * @param {number} rWu радиус в мировых единицах
 * @param {number} W ширина канваса, px
 * @param {number} H высота канваса, px
 * @param {number} [pad=1.05] запас 5 %
 */
export function fitZoom(rWu, W, H, pad = 1.05) {
    const side = Math.min(W || 900, H || 900);
    const z = side / 2 / Math.max(rWu * pad, 1e-12);
    return clamp(z, MIN_ZOOM, MAX_ZOOM);
}

/** Километры в компактной записи: 1 737, 12.4, 0.00074. */
export function fmtKm(v, digits = 1) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + ' млн';
    if (a >= 1e3) return Math.round(v).toLocaleString('ru-RU');
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(digits);
    return Number(v.toPrecision(3)).toString();
}

/** Астрономические единицы в компактной записи. */
export function fmtAu(v, digits = 3) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString('ru-RU');
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(digits);
    if (a >= 0.01) return v.toFixed(4);
    if (a >= 0.001) return v.toFixed(5);
    return v.toExponential(2);
}

/** «1 px = N км» или «1 px = N а.е.» для HUD. */
export function fmtScale(zoom) {
    const wuPerPx = 1 / zoom;
    const kmPerPx = wuToKm(wuPerPx);
    return kmPerPx >= AU_KM * 0.1
        ? fmtAu(wuToAu(wuPerPx)) + ' а.е.'
        : fmtKm(kmPerPx) + ' км';
}

/** «N px/а.е.» для HUD. */
export function fmtPxPerAu(zoom) {
    const v = zoom * AU_WU;
    if (v >= 100) return Math.round(v).toLocaleString('ru-RU');
    if (v >= 1) return v.toFixed(1);
    if (v >= 0.01) return v.toFixed(3);
    return v.toExponential(2);
}

/** Угловой диаметр тела: радиус и расстояние в км -> угловые секунды. */
export function angularArcsec(radiusKm, distanceKm) {
    if (!(distanceKm > 0) || !(radiusKm > 0)) return null;
    return 2 * Math.atan(radiusKm / distanceKm) * 206264.806247;
}

/** Угловой размер в угловых секундах/минутах/градусах. */
export function fmtArcsec(v) {
    if (v == null || !isFinite(v)) return '—';
    if (v >= 3600) return (v / 3600).toFixed(2) + '°';
    if (v >= 60) return (v / 60).toFixed(2) + '′';
    if (v >= 1) return v.toFixed(1) + '″';
    return v.toFixed(3) + '″';
}

// Круглые значения для линейки масштаба.
const KM_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
    10000, 20000, 50000, 100000, 200000, 500000, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9];
const AU_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50,
    100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** Ближайшее круглое значение из списка. */
function nearestStep(steps, target) {
    return steps.reduce((best, x) =>
        Math.abs(x - target) < Math.abs(best - target) ? x : best, steps[0]);
}

/**
 * Линейка масштаба: круглое расстояние, которое занимает около targetPx.
 * @returns {{wu: number, px: number, label: string}}
 */
export function niceScale(zoom, targetPx = 120) {
    const wuTarget = targetPx / zoom;
    const auTarget = wuToAu(wuTarget);
    if (auTarget >= 0.05) {
        const v = nearestStep(AU_STEPS, auTarget);
        return { wu: au(v), px: au(v) * zoom, label: fmtAu(v) + ' а.е.' };
    }
    const v = nearestStep(KM_STEPS, wuToKm(wuTarget));
    return { wu: km(v), px: km(v) * zoom, label: fmtKm(v) + ' км' };
}
