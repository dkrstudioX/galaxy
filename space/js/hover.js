// =============================================================================
// hover.js — наведение курсора: hit-тест по телам, орбита наведённого тела
// и текстовая подсказка с названием (просто текст без рамки).
// Вызывается из main.js ПОСЛЕ renderScene и уже вне мирового transform.
// =============================================================================

import { state } from './state.js';
import { screenToWorld } from './math.js';
import { COLORS } from './config.js';

/** Минимальный радиус попадания в пикселях экрана — чтобы легко попадать в мелкие луны. */
const MIN_HIT_MOON_PX = 6;
const MIN_HIT_PLANET_PX = 8;

/**
 * Найти тело под курсором и нарисовать его орбиту + подсказку.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} hoverTargets — результат renderScene() этого кадра
 */
export function drawHover(ctx, hoverTargets) {
    const { mouseX, mouseY } = state;
    if (mouseX < 0) return;

    const hover = hitTest(hoverTargets, mouseX, mouseY);
    if (!hover) return;

    // орбита наведённого тела (у солнца орбиты нет)
    if (hover.orbit) {
        drawOrbitOverlay(ctx, hover);
    }
    drawTooltip(ctx, hover.name, mouseX, mouseY);
}

/**
 * Hit-тест: перебираем цели с конца (планеты добавлены после солнца, луны
 * проверяются первыми — они мельче и лежат поверх).
 * @returns {?{kind: string, name: string, orbit: ?{cx, cy, r}}}
 */
function hitTest(hoverTargets, mouseX, mouseY) {
    const w = screenToWorld(mouseX, mouseY, state);

    for (let i = hoverTargets.length - 1; i >= 0; i--) {
        const t = hoverTargets[i];

        for (let j = t.moons.length - 1; j >= 0; j--) {
            const mh = t.moons[j];
            const hitR = Math.max(mh.m.r, MIN_HIT_MOON_PX / state.zoom);
            if ((w.x - mh.mx) ** 2 + (w.y - mh.my) ** 2 <= hitR * hitR) {
                // луна: орбита вокруг своей планеты
                return { kind: 'moon', name: mh.m.n, orbit: { cx: t.x, cy: t.y, r: mh.md } };
            }
        }

        const name = t.name || t.p.name;
        const bodyR = t.r || t.p.r;
        const hitR = Math.max(bodyR, MIN_HIT_PLANET_PX / state.zoom);
        if ((w.x - t.x) ** 2 + (w.y - t.y) ** 2 <= hitR * hitR) {
            // планета: орбита вокруг солнца; у самого солнца орбиты нет
            const orbit = t.kind === 'sun' ? null : { cx: 0, cy: 0, r: t.p.dist };
            return { kind: t.kind, name, orbit };
        }
    }
    return null;
}

/** Пунктирная орбита наведённого тела в мировой системе координат. */
function drawOrbitOverlay(ctx, hover) {
    const { zoom, camX, camY, W, H } = state;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.strokeStyle = hover.kind === 'planet' ? COLORS.orbitPlanet : COLORS.orbitMoon;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(hover.orbit.cx, hover.orbit.cy, hover.orbit.r, 0, Math.PI * 2);
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
