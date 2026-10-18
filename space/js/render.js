// =============================================================================
// render.js — отрисовка сцены на канвас: фон, малые тела (smallbodies.js),
// солнце, планеты, луны (скрытые зумом — группой, scene.js moonGroupPlan),
// звёздные базы.
// Монохромный стиль: все тела — плоские круги, различаются яркостью заливки
// и толщиной обводки (солнце > планеты > луны). Орбит на карте нет — их рисует
// hover.js только при наведении. Дальний фон (небо) — отдельный слой sky.js.
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================

import { state } from './state.js';
import { orbitAngle } from './math.js';
import { SUN_R, COLORS, STROKE } from './config.js';
import { planets, moonDist, moonPeriod, moonL0, baseOrbitRadius, basePeriod, moonOrbitRadius } from './data.js';
import { stars, moonGroupPlan } from './scene.js';
import { drawSmallBodies } from './smallbodies.js';
import { bases, drawBases } from './bases.js';
import { drawSky } from './sky.js';

/**
 * Нарисовать один кадр мира в мировой системе координат (save/restore внутри).
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Array} hoverTargets для hover.js
 */
export function renderScene(ctx) {
    const { zoom, simDays, time } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах:
    // камера и зум на небо не влияют (оно бесконечно далеко).
    drawSky(ctx);

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    drawStars(ctx, time);

    // Малые тела (пояс, ОЗА, троянцы, кометы, дальние пояса) — отдельный слой
    // smallbodies.js: частицы рисует сам, именованные тела отдаёт как hover-цели.
    hoverTargets.push(...drawSmallBodies(ctx));

    // Солнце — первая hover-цель (проверяется последней, т.к. планеты поверх)
    drawSun(ctx);
    hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, moons: [] });

    // === ПЛАНЕТЫ ===
    const hostPos = {};   // мировые позиции хост-тел для звёздных баз (ключи bases.js)
    planets.forEach(p => {
        // Угол строго из simDays: движение по орбите и счётчик дней — один таймер.
        // y с минусом: против часовой, как видно с севера эклиптики.
        const ang = orbitAngle(p.l0, p.period, simDays);
        const x = Math.cos(ang) * p.dist;
        const y = -Math.sin(ang) * p.dist;

        if (p.rings) drawRings(ctx, x, y, p);

        drawPlanetBody(ctx, x, y, p.r);

        const moonHits = drawPlanetMoons(ctx, x, y, p, hostPos);

        // Луна Земли + орбитальная база — особый случай (hasBase у Земли)
        let baseHit = null;
        if (p.hasBase) {
            const hit = drawEarthMoonAndBase(ctx, x, y);
            if (hit) {
                moonHits.push(hit.moon);
                // База — отдельная цель выбора, как планета или луна.
                baseHit = {
                    kind: 'base',
                    name: 'База LUNA-ORBIT',
                    x: hit.base.bx, y: hit.base.by, r: hit.base.r,
                    orbitCx: hit.moon.mx, orbitCy: hit.moon.my, orbitR: baseOrbitRadius,
                    p, moons: []
                };
            }
        }

        hoverTargets.push({ kind: 'planet', p, x, y, moons: moonHits });
        // база добавляется после планеты: рисуется поверх и проверяется первой
        if (baseHit) hoverTargets.push(baseHit);

        // позиции хост-тел для звёздных баз: планета и её луны (скрытые
        // луны группы встают в маркер-представителя — см. drawPlanetMoons)
        hostPos['planet:' + p.name] = { x, y };
        moonHits.forEach(h => { hostPos['moon:' + p.name + ':' + h.m.n] = { x: h.mx, y: h.my }; });
    });

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты
    drawBases(ctx, hostPos).forEach(t => {
        t.p = planets.find(x => x.name === t.local.planet);
        hoverTargets.push(t);
    });

    ctx.restore();
    return hoverTargets;
}

// --- Фон -----------------------------------------------------------------------

/** Звёзды: мерцание синусом с индивидуальной фазой каждой звезды. */
function drawStars(ctx, time) {
    stars.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + s.b * 10);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + twinkle * 0.7})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    });
}

// --- Тела ----------------------------------------------------------------------

/** Солнце: плоский круг с самой толстой обводкой. */
function drawSun(ctx) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.sun;
    circle(ctx, 0, 0, SUN_R);
    ctx.fill();

    ctx.strokeStyle = COLORS.sunStroke;
    ctx.lineWidth = STROKE.sun / z;
    circle(ctx, 0, 0, SUN_R);
    ctx.stroke();
}

/** Планета: плоский серый круг, обводка тоньше солнечной. */
function drawPlanetBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.planet;
    circle(ctx, x, y, r);
    ctx.fill();

    ctx.strokeStyle = COLORS.planetStroke;
    ctx.lineWidth = STROKE.planet / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/** Кольца Сатурна: два сплюснутых эллипса под наклоном. */
function drawRings(ctx, x, y, p) {
    const z = state.zoom;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.lineWidth = 4 / z;
    circle(ctx, 0, 0, p.r * 2.2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    ctx.lineWidth = 3 / z;
    circle(ctx, 0, 0, p.r * 1.7);
    ctx.stroke();

    ctx.restore();
}

/** Луна: плоский серый круг с самой тонкой обводкой. */
function drawMoonBody(ctx, x, y, r) {
    const z = state.zoom;
    ctx.fillStyle = COLORS.moon;
    circle(ctx, x, y, r);
    ctx.fill();

    ctx.strokeStyle = COLORS.moonStroke;
    ctx.lineWidth = STROKE.moon / z;
    circle(ctx, x, y, r);
    ctx.stroke();
}

/**
 * Луны планеты — по плану группировки scene.js moonGroupPlan. Показанные луны
 * рисуются точками и становятся hover-целями. Скрытые луны группы «встают»
 * в маркер-представитель: их хост-позиция для баз — позиция представителя
 * (bases.js рисует базы у группы), а у самого маркера — подпись со списком
 * лун группы. Если у группы есть базы, подпись-список лун не рисуется: её
 * заменяют сами базы у группы со своими именами.
 * @returns {Array} хиты для hover: { m, md, mx, my }
 */
function drawPlanetMoons(ctx, x, y, p, hostPos) {
    const { simDays, zoom } = state;
    const plan = moonGroupPlan(p, bases);
    const hits = [];

    plan.shown.forEach(({ m, i }) => {
        const md = moonOrbitRadius(p, i); // радиус орбиты луны от планеты
        const mAng = orbitAngle(m.phase, m.period, simDays);
        const mx = x + Math.cos(mAng) * md;
        const my = y - Math.sin(mAng) * md;

        drawMoonBody(ctx, mx, my, m.r);
        hits.push({ m, md, mx, my });
    });

    if (plan.group) {
        const rep = hits[plan.group.at];   // маркер-представитель группы
        // Скрытые луны группы считаются стоящими в маркере: базы на них
        // рисуются у группы (bases.js по hostPos), а не пропадают из кадра.
        plan.group.moons.forEach(m => {
            hostPos['moon:' + p.name + ':' + m.n] = { x: rep.mx, y: rep.my };
        });
        if (plan.group.label) {
            // Подпись группы — как подсказка hover: белый текст с тенью
            // (кегль держим постоянным на экране: 10 / zoom мировых пикселей).
            ctx.font = `${10 / zoom}px monospace`;
            ctx.fillStyle = COLORS.tooltipShadow;
            ctx.fillText(plan.group.label, rep.mx + 6 / zoom + 1 / zoom, rep.my - 4 / zoom + 1 / zoom);
            ctx.fillStyle = COLORS.tooltip;
            ctx.fillText(plan.group.label, rep.mx + 6 / zoom, rep.my - 4 / zoom);
        }
    }
    return hits;
}

/**
 * Луна Земли + орбитальная база игрока. База — циановый маркер с пульсом
 * и подписью BASE; её орбита вокруг Луны показывается всегда (это не орбиты
 * планет, которые скрыты до наведения).
 * @returns {{moon: {m, md, mx, my}, base: {bx, by, r}}} хиты Луны и базы
 */
function drawEarthMoonAndBase(ctx, x, y) {
    const { zoom: z, simDays, time } = state;

    const mAng = orbitAngle(moonL0, moonPeriod, simDays);
    const mx = x + Math.cos(mAng) * moonDist;
    const my = y - Math.sin(mAng) * moonDist;

    drawMoonBody(ctx, mx, my, 3);

    // орбита базы вокруг Луны — мелкий пунктир
    const bAng = orbitAngle(0, basePeriod, simDays);
    const bx = mx + Math.cos(bAng) * baseOrbitRadius;
    const by = my - Math.sin(bAng) * baseOrbitRadius;

    ctx.strokeStyle = '#00ffff44';
    ctx.lineWidth = 0.5 / z;
    ctx.setLineDash([1 / z, 1 / z]);
    circle(ctx, mx, my, baseOrbitRadius);
    ctx.stroke();
    ctx.setLineDash([]);

    // маркер базы: свечение, квадрат, пульсирующее кольцо, подпись
    const bs = 4 / z;

    const baseGlow = ctx.createRadialGradient(bx, by, 0, bx, by, bs * 2);
    baseGlow.addColorStop(0, 'rgba(0,255,255,0.6)');
    baseGlow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = baseGlow;
    circle(ctx, bx, by, bs * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.base;
    ctx.fillRect(bx - bs / 2, by - bs / 2, bs, bs);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / z;
    ctx.strokeRect(bx - bs / 2, by - bs / 2, bs, bs);

    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    ctx.strokeStyle = `rgba(0,255,255,${0.5 - pulse * 0.5})`;
    ctx.lineWidth = 1 / z;
    circle(ctx, bx, by, bs + pulse * 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.base;
    ctx.font = `bold ${Math.max(9, 10 / z)}px monospace`;
    ctx.fillText('BASE', bx + bs + 3 / z, by - 3 / z);

    return {
        moon: { m: { n: 'Луна / Moon', r: 3, period: moonPeriod }, md: moonDist, mx, my },
        base: { bx, by, r: bs }
    };
}

/** Начать путь-окружность (без fill/stroke — их выбирает вызывающий). */
function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
}
