// =============================================================================
// math.js — чистые функции: астрономическая математика и форматирование.
// Не знают ни о канвасе, ни о состоянии — легко тестировать и переиспользовать.
// Плюс маппинг астрономических единиц в условные (якоря AU_ANCHORS из data.js)
// и решение уравнения Кеплера для эллиптических орбит малых тел.
// =============================================================================

import { J2000_MS, MS_PER_DAY } from './config.js';
import { AU_ANCHORS } from './data.js';

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
 * Астрономические единицы -> условные единицы карты: кусочно-линейно по
 * якорям AU_ANCHORS (орбиты планет, границы пояса, дальние зоны). За
 * последним якорем — линейное продолжение последнего отрезка.
 * @param {number} au расстояние, а.е.
 */
export function auToDist(au) {
    const A = AU_ANCHORS;
    if (au <= A[0][0]) {
        const k = (A[1][1] - A[0][1]) / (A[1][0] - A[0][0]);
        return Math.max(0, A[0][1] + (au - A[0][0]) * k);
    }
    for (let i = 1; i < A.length; i++) {
        if (au <= A[i][0]) {
            const [a0, d0] = A[i - 1], [a1, d1] = A[i];
            return d0 + (d1 - d0) * (au - a0) / (a1 - a0);
        }
    }
    const [a0, d0] = A[A.length - 2], [a1, d1] = A[A.length - 1];
    return d1 + (au - a1) * (d1 - d0) / (a1 - a0);
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
 * @returns {{x: number, y: number, rAu: number}} единицы мира + радиус, а.е.
 */
export function keplerPos(a, e, peri, m0, T, t) {
    let turns = (m0 / 360 + t / T) % 1;
    if (turns < 0) turns += 1;
    const M = turns * 2 * Math.PI;

    // стартовое приближение для высоких эксцентриситетов, затем итерации Ньютона
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const rAu = a * (1 - e * Math.cos(E));
    const th = nu + peri * Math.PI / 180;
    const r = auToDist(rAu);
    return { x: Math.cos(th) * r, y: -Math.sin(th) * r, rAu };
}
