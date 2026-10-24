// =============================================================================
// paint.js — «живопись» карты: сферы, тени, свечения, ромб базы, камни.
// Все функции рисуют в текущей (мировой/view) системе координат. Размеры в
// world-единицах; экранные пиксели делятся на zoom вызывающим кодом.
// =============================================================================

import { makeRng } from './math.js';
import { SHADOW } from './config.js';

const rgbCache = new Map();

/** '#rgb' / '#rrggbb' -> {r,g,b}; неизвестное — серый. */
export function parseColor(color) {
    if (rgbCache.has(color)) return rgbCache.get(color);
    let out = { r: 200, g: 200, b: 200 };
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
    if (m) {
        let h = m[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        out = {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }
    rgbCache.set(color, out);
    return out;
}

/** Цвет с прозрачностью: hex -> rgba(...). */
export function alpha(color, a) {
    const c = parseColor(color);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}

/** Смешать два цвета: k=0 — color, k=1 — target. */
export function mix(color, target, k) {
    const a = parseColor(color), b = parseColor(target);
    const f = (x, y) => Math.round(x + (y - x) * k);
    return 'rgb(' + f(a.r, b.r) + ',' + f(a.g, b.g) + ',' + f(a.b, b.b) + ')';
}

/**
 * Сфера с бликом в верхней левой части и тёмным краем.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x,y,r  view-координаты и радиус, world-единицы
 * @param {string} color  основной цвет тела
 * @param {{zoom?: number, rim?: boolean, rimAlpha?: number}} [opts]
 */
export function sphere(ctx, x, y, r, color, opts = {}) {
    if (!(r > 0)) return;
    const hi = mix(color, '#ffffff', 0.58);
    const lo = mix(color, '#000000', 0.78);
    const g = ctx.createRadialGradient(
        x - r * 0.33, y - r * 0.33, Math.max(r * 0.06, 1e-9),
        x, y, r * 1.18
    );
    g.addColorStop(0, hi);
    g.addColorStop(0.42, color);
    g.addColorStop(0.78, mix(color, '#000000', 0.42));
    g.addColorStop(1, lo);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (opts.rim !== false) {
        const z = opts.zoom || 1;
        ctx.strokeStyle = 'rgba(255,255,255,' + (opts.rimAlpha ?? 0.15) + ')';
        ctx.lineWidth = 0.55 / z;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/**
 * Мягкая тень-эллипс на полу под телом.
 * @param {number} alphaOpacity 0..1
 */
export function shadow(ctx, x, y, r, zoom, alphaOpacity = SHADOW.alpha) {
    if (!(r > 0)) return;
    const rx = Math.max(r * SHADOW.rx, 1.2 / zoom);
    const dy = r * SHADOW.dy + 1.5 / zoom;
    ctx.save();
    ctx.translate(x, y + dy);
    ctx.scale(1, SHADOW.ry);
    const g = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,' + alphaOpacity + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + alphaOpacity * 0.55 + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Радиальное свечение вокруг точки (ореол, блик базы). */
export function glow(ctx, x, y, r, color, alphaValue = 0.5) {
    if (!(r > 0)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(color, alphaValue));
    g.addColorStop(0.45, alpha(color, alphaValue * 0.35));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Солнечная сфера: белое ядро -> жёлтый -> оранжевый край. Без пульсации. */
export function sunSphere(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#fffef7');
    g.addColorStop(0.4, '#ffe7a3');
    g.addColorStop(0.74, '#ff9d3c');
    g.addColorStop(1, '#ff7a18');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Ромб базы: квадрат, повёрнутый на 45°. size — сторона квадрата до поворота. */
export function diamond(ctx, x, y, size, stroke, fill, zoom) {
    const s = Math.max(size, 1 / zoom);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = fill;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
}

/** Детерминированный хеш строки для формы камня. */
function hashSeed(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * Неровный камень: многоугольник с детерминированной формой.
 * @param {string} seed id тела — форма не дрожит между кадрами
 */
export function rock(ctx, x, y, r, seed, color = '#b9a88f', zoom = 1) {
    if (!(r > 0)) return;
    const rng = makeRng(hashSeed(seed));
    const n = 9;
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.16;
        const rr = r * (0.78 + rng() * 0.36);
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }

    const hi = mix(color, '#fff3dc', 0.55);
    const lo = mix(color, '#120c08', 0.75);
    const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.08, x, y, r * 1.2);
    g.addColorStop(0, hi);
    g.addColorStop(0.5, color);
    g.addColorStop(1, lo);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.stroke();
}
