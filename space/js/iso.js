// =============================================================================
// iso.js — проекция карты в диметрию 2:1.
//
// Мир (raw) — плоскость эклиптики: окружности, радиусы, коридоры баз.
// Вид (view) — та же плоскость, сжатая по вертикали: y *= ISO_K.
// Высота z над эклиптикой проецируется отдельно: y -= z * ISO_Z. Это даёт
// реальный наклон орбит по inc/node, а не только декоративный подъём.
// Вся отрисовка, камера, hover-цели и подписи живут в view; физика — в raw.
//
// Здесь только чистые функции: без canvas, состояния и данных.
// =============================================================================

import { ISO_K, ISO_Z } from './config.js';

/**
 * 3D-точка эклиптики (x, y, z) -> view.
 * x — долгота, y — поперечная ось (вниз), z — высота над плоскостью.
 */
export function project3(x, y, z = 0) {
    return { x, y: y * ISO_K - z * ISO_Z };
}

/** raw -> view для плоской орбиты (z = 0). */
export function view(x, y) {
    return project3(x, y, 0);
}

/** raw-y -> view-y. */
export function viewY(y) {
    return y * ISO_K;
}

/** view-y -> raw-y (обратный перевод для физики базы). */
export function unviewY(y) {
    return y / ISO_K;
}

/**
 * Точка на круговой орбите вокруг центра: угол против часовой, y — вниз.
 * Центр и результат — в view-координатах.
 */
export function orbitPoint(cx, cy, r, ang) {
    return {
        x: cx + Math.cos(ang) * r,
        y: cy - Math.sin(ang) * r * ISO_K
    };
}

/**
 * Начать путь эллипса орбиты вокруг центра (view).
 * У круговой орбиты радиуса r на карте rx = r, ry = r * ISO_K.
 */
export function orbitEllipsePath(ctx, cx, cy, r, rot = 0) {
    ctx.ellipse(cx, cy, Math.abs(r), Math.abs(r) * ISO_K, rot, 0, Math.PI * 2);
}

/** Плоский массив x0,y0,x1,y1… из raw -> view. */
export function viewPoly(poly) {
    const out = new Array(poly.length);
    for (let i = 0; i < poly.length; i += 2) {
        out[i] = poly[i];
        out[i + 1] = poly[i + 1] * ISO_K;
    }
    return out;
}

/** Плоский массив x0,y0,z0,x1,y1,z1… из raw -> view x/y. */
export function view3Poly(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i += 3) {
        const v = project3(poly[i], poly[i + 1], poly[i + 2]);
        out.push(v.x, v.y);
    }
    return out;
}

/** Расстояние в raw-единицах по смещению в view. */
export function rawDist(dx, dy) {
    return Math.hypot(dx, dy / ISO_K);
}

/** Угол орбиты (как в orbitAngle) по смещению в view. */
export function rawAngle(dx, dy) {
    return Math.atan2(-(dy / ISO_K), dx);
}

/** Пиксели экрана -> мировые единицы view (для теней/ножек/хвостов). */
export function px(pxValue, zoom) {
    return pxValue / zoom;
}
