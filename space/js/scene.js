// =============================================================================
// scene.js — правила показа тел при масштабе и раскладка подписей.
//
// Группировка: тело входит в группу более массивного соседа, если их центры
// ближе GROUP_PX экранных пикселей. Правило одно для всей карты:
//   • Солнце собирает планеты (на видах Койпера/Оорта — принудительно);
//   • планета собирает свои луны;
//   • крупное малое тело собирает мелкие малые тела.
// Якоря-исключения не нужны: представителем группы всегда становится более
// массивное тело, поэтому подпись и выбор остаются у главного объекта.
//
// Подписи раскладываются без наложений (placeLabel). Позиции тел здесь не
// считаются — это делает render.js каждый кадр из simDays.
// =============================================================================

import { state } from './state.js';

/** Порог группировки — в ЭКРАННЫХ пикселях (маркеры ближе уже не подписать). */
export const GROUP_PX = 28;

/**
 * Сгруппировать тела кадра по экранному расстоянию.
 * @param {Array} bodies тела с x, y, kind, p, mass; отсортированы по массе
 *                (сначала Солнце, затем планеты, луны, малые тела)
 * @param {number} zoom
 * @returns {Array} группы { rep, members } (members[0] === rep)
 */
export function groupBodies(bodies, zoom) {
    const lim = GROUP_PX / zoom;
    const lim2 = lim * lim;
    const groups = [];
    const forceSolar = zoom < 0.01;

    bodies.forEach(b => {
        // На дальних видах планетная система — одна группа «Солнечная система».
        if (forceSolar && b.kind === 'planet') {
            const sun = groups.find(g => g.rep.kind === 'sun');
            if (sun) { sun.members.push(b); return; }
        }

        let host = null, best = Infinity;
        for (const g of groups) {
            if (!canJoin(g.rep, b)) continue;
            const dx = b.x - g.rep.x, dy = b.y - g.rep.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; host = g; }
        }
        if (host && best <= lim2) {
            host.members.push(b);
            return;
        }
        groups.push({ rep: b, members: [b] });
    });

    return groups;
}

/** Может ли тело b войти в группу представителя rep. */
function canJoin(rep, b) {
    if (rep === b) return false;
    if (rep.kind === 'sun') return b.kind === 'planet';
    if (rep.kind === 'planet') return b.kind === 'moon' && b.p === rep.p;
    if (rep.kind === 'small') return b.kind === 'small';
    return false;
}

// --- Раскладка подписей: без наложений ----------------------------------------

// Коробки уже поставленных подписей кадра (мировые единицы). Подпись перед
// отрисовкой спрашивает место: если её коробка пересекается с чужой, подпись
// сдвигается по вертикали шагами в строку — так подписи не наезжают друг на
// друга. Порядок постановки = порядок отрисовки: сначала подписи групп тел,
// затем подписи баз.
const labelBoxes = [];

/** Начать раскладку подписей кадра — render.js вызывает в начале кадра. */
export function resetLabels() {
    labelBoxes.length = 0;
}

/**
 * Подобрать сдвиг подписи по вертикали, чтобы она не пересекалась с уже
 * поставленными: 0, вверх на строку, вниз на строку, вверх на две… Если места
 * нет — подпись остаётся на месте (лучше наложение, чем пропавшая подпись).
 * @param {number} x    левый край коробки
 * @param {number} yTop верх коробки
 * @param {number} w    ширина коробки
 * @param {number} h    высота коробки
 * @returns {number} сдвиг по y (мировые единицы) — прибавить к желаемой позиции
 */
export function placeLabel(x, yTop, w, h) {
    const step = h + 2 / state.zoom;
    for (let k = 0; k < 16; k++) {
        const off = Math.ceil(k / 2) * step * (k % 2 ? -1 : 1);
        const box = { x, y: yTop + off, w, h };
        if (!labelBoxes.some(b => cross(b, box))) {
            labelBoxes.push(box);
            return off;
        }
    }
    labelBoxes.push({ x, y: yTop, w, h });
    return 0;
}

/** Пересекаются ли коробки подписей. */
function cross(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
}
