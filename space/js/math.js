// =============================================================================
// math.js — чистые функции: астрономическая математика и форматирование.
// Не знают ни о канвасе, ни о состоянии — легко тестировать и переиспользовать.
// =============================================================================

import { J2000_MS, MS_PER_DAY } from './config.js';

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
