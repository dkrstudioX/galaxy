// =============================================================================
// hover.js — наведение курсора: hit-тест по телам, орбита наведённого тела
// и текстовая подсказка с названием (просто текст без рамки).
// Здесь же — орбита и маркер ВЫБРАННОГО объекта (клик) и экспорт findBodyAt
// для обработчика клика в input.js.
// Вызывается из main.js ПОСЛЕ renderScene и уже вне мирового transform.
// =============================================================================

import { state } from './state.js';
import { screenToWorld } from './math.js';
import { COLORS, ISO_K } from './config.js';
import { orbitEllipsePath } from './iso.js';
import { REGION_BOUNDS } from './smallbodies.js';

/** Минимальный радиус попадания в пикселях экрана — чтобы легко попадать в мелкие луны. */
const MIN_HIT_MOON_PX = 6;
const MIN_HIT_PLANET_PX = 8;

/**
 * Найти тело под курсором и нарисовать его орбиту (если есть) + подсказку.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
export function drawHover(ctx, hoverTargets) {
    const { mouseX, mouseY } = state;
    if (mouseX < 0) return;

    const hover = findBodyAt(hoverTargets, mouseX, mouseY);
    if (!hover) return;

    // орбита наведённой планеты/луны/базы; у солнца и комет орбиты нет
    const isComet = hover.kind === 'comet' || (hover.small && hover.small.kind === 'comet');
    if (hover.orbit && !isComet) {
        drawOrbitOverlay(ctx, hover, COLORS.orbitPlanet);
    }
    drawTooltip(ctx, hover.name, mouseX, mouseY);
}

/**
 * Нарисовать орбиту выбранного кликом тела: пунктир держится для лун, баз и
 * областей. У планет орбита видна только при наведении, у комет не рисуется.
 * @param {CanvasRenderingContext2D} ctx
 * @param {?{kind: string, p: object, m: object}} sel — текущий выбор (state.selected)
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
export function drawSelection(ctx, sel, hoverTargets) {
    if (!sel) return;

    // Планета: орбита только в hover. Комета: орбита не показывается вовсе.
    if (sel.kind === 'planet' || sel.kind === 'comet' ||
        (sel.small && sel.small.kind === 'comet')) return;

    // У области нет тела и орбиты — показываем её границы пунктиром, иначе
    // разреженная пыль Койпера/Оорта почти не читается на общем плане.
    if (sel.kind === 'region') {
        const bounds = REGION_BOUNDS[sel.region.key];
        if (!bounds) return;
        [bounds.rMin, bounds.rMax].forEach(r => {
            drawOrbitOverlay(ctx, { kind: 'region', orbit: { cx: 0, cy: 0, r } },
                'rgba(127,216,255,0.32)');
        });
        return;
    }

    const target = hoverTargets.find(t =>
        sel.kind === 'sun' ? t.kind === 'sun' :
        sel.kind === 'base' ? (t.kind === 'base' && (sel.local ? t.local === sel.local : !t.local)) :
        sel.small ? t.small === sel.small : t.p === sel.p);
    if (!target) return; // тело ещё не в кадре (луна скрыта зумом и т.п.)

    if (sel.kind === 'sun') return; // у солнца орбиты нет

    let orbit = null;
    if (sel.small) {
        // малое тело: орбита по сэмплированным элементам (poly), у троянцев — круг
        orbit = sel.small.poly ? { poly: sel.small.poly } : sel.small.orbit;
    } else if (sel.kind === 'base') {
        // база летает вокруг Луны Земли — орбита от Луны, не от солнца
        orbit = { cx: target.orbitCx, cy: target.orbitCy, r: target.orbitR };
    } else {
        // луна ищется по имени: объекты лун в кадре и в дереве — разные ссылки
        const mh = target.moons.find(x => x.m.n === sel.m.n);
        if (!mh) return;
        orbit = mh.orbitPoly
            ? { poly: mh.orbitPoly }
            : { cx: target.x, cy: target.y, r: mh.md };
    }
    drawOrbitOverlay(ctx, { kind: sel.kind, orbit }, COLORS.orbitSelected);
}

/**
 * Hit-тест: перебираем цели с конца (планеты добавлены после солнца, луны
 * проверяются первыми — они мельче и лежат поверх).
 * Экспортируется для выбора объекта по клику (input.js).
 * @returns {?{kind: string, name: string, orbit: ?{cx, cy, r}, p: object, m: object}}
 */
export function findBodyAt(hoverTargets, mouseX, mouseY) {
    const w = screenToWorld(mouseX, mouseY, state);

    for (let i = hoverTargets.length - 1; i >= 0; i--) {
        const t = hoverTargets[i];

        for (let j = t.moons.length - 1; j >= 0; j--) {
            const mh = t.moons[j];
            const hitR = Math.max(mh.m.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - mh.mx) ** 2 + (w.y - mh.my) ** 2 <= hitR * hitR) {
                // луна: наклонная орбита вокруг своей планеты
                return {
                    kind: 'moon', name: mh.m.n,
                    orbit: mh.orbitPoly ? { poly: mh.orbitPoly } : { cx: t.x, cy: t.y, r: mh.md },
                    p: t.p, m: mh.m
                };
            }
        }

        // база: орбита вокруг Луны Земли, радиус попадания как у лун
        if (t.kind === 'base') {
            const hitR = Math.max(t.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
                return { kind: 'base', name: t.name, orbit: { cx: t.orbitCx, cy: t.orbitCy, r: t.orbitR }, p: t.p, m: null, local: t.local || null };
            }
            continue;
        }

        const name = t.name || (t.p ? t.p.name : '');
        const bodyR = t.r || (t.p ? t.p.r : 0);
        const hitR = Math.max(bodyR, MIN_HIT_PLANET_PX / state.zoom);
        if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
            // орбита: у малых тел — из их элементов (эллипс), у планет — вокруг
            // солнца; у самого солнца орбиты нет
            let orbit = null;
            if (t.small) orbit = t.small.poly ? { poly: t.small.poly } : t.small.orbit;
            else if (t.kind !== 'sun') orbit = t.orbit ? { poly: t.orbit } : { cx: 0, cy: 0, r: t.p.dist };
            return { kind: t.kind, name, orbit, p: t.p || null, m: null, small: t.small || null };
        }
    }
    return null;
}

/** Пунктирная орбита тела в мировой системе координат. */
function drawOrbitOverlay(ctx, hover, color) {
    const { zoom, camX, camY, W, H } = state;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    if (hover.orbit.poly) {
        // сэмплированная петля (малые тела, кометы, планеты): эллипс по (a,e)
        // неверен после нелинейного сжатия шкалы и наклонной орбиты кометы
        const p = hover.orbit.poly;
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.closePath();
    } else if (hover.orbit.rot !== undefined) {
        // запасной путь для старого эллипса: сэмплируем в raw и проецируем,
        // иначе наклонный эллипс после сжатия по y не совпадёт с орбитой
        const o = hover.orbit;
        const cr = Math.cos(o.rot), sr = Math.sin(o.rot);
        for (let i = 0; i <= 96; i++) {
            const t = i / 96 * Math.PI * 2;
            const ex = Math.cos(t) * o.a, ey = Math.sin(t) * o.b;
            const x = o.cx + ex * cr - ey * sr;
            const y = o.cy + ex * sr + ey * cr;
            if (i === 0) ctx.moveTo(x, y * ISO_K);
            else ctx.lineTo(x, y * ISO_K);
        }
    } else {
        orbitEllipsePath(ctx, hover.orbit.cx, hover.orbit.cy, hover.orbit.r);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

/** Подсказка у курсора: белый текст с тенью смещённой на 1px, без рамки. */
function drawTooltip(ctx, name, mouseX, mouseY) {
    const { W } = state;

    ctx.font = '12px monospace';
    const tw = ctx.measureText(name).width;
    const tx = Math.min(mouseX + 14, W - tw - 20); // не выезжать за правый край
    const ty = Math.max(mouseY - 24, 8);           // не выезжать за верх

    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(name, tx + 1, ty + 11);
    ctx.fillStyle = COLORS.tooltip;
    ctx.fillText(name, tx, ty + 10);
}
