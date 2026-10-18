// =============================================================================
// render.js — отрисовка сцены на канвас: фон, малые тела (smallbodies.js),
// солнце, планеты, луны (скрытые зумом — группой, scene.js groupPlan),
// звёздные базы.
// Стиль тел: у планет прозрачная заливка — тело читается только по обводке,
// одинаково толстой у всех; солнце — жёлтая заливка; луны — плоские серые
// круги. Орбит на карте нет — их рисует
// hover.js только при наведении. Дальний фон (небо) — отдельный слой sky.js.
//
// Возвращает массив hoverTargets — позиции всех тел для hit-теста наведения.
// =============================================================================

import { state } from './state.js';
import { orbitAngle } from './math.js';
import { SUN_R, COLORS, STROKE } from './config.js';
import { planets, moonsByPlanet, moonDist, moonPeriod, moonL0, baseOrbitRadius, basePeriod, moonOrbitRadius } from './data.js';
import { stars, groupPlan, visibleMoons } from './scene.js';
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
    const groupBaseIds = new Set();   // базы лунных групп: имена — в подписи группы
    planets.forEach(p => {
        // Угол строго из simDays: движение по орбите и счётчик дней — один таймер.
        // y с минусом: против часовой, как видно с севера эклиптики.
        const ang = orbitAngle(p.l0, p.period, simDays);
        const x = Math.cos(ang) * p.dist;
        const y = -Math.sin(ang) * p.dist;

        if (p.rings) drawRings(ctx, x, y, p);

        drawPlanetBody(ctx, x, y, p.r);

        const moonHits = drawPlanetMoons(ctx, x, y, p, hostPos, groupBaseIds);

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

    // Звёздные базы (bases.js): маркеры, орбиты и превью выбора орбиты;
    // базы лунных групп (groupBaseIds) — без имён: они в подписи группы
    drawBases(ctx, hostPos, groupBaseIds).forEach(t => {
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

/** Солнце: жёлтая заливка и самая толстая обводка. */
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

/** Планета: прозрачная заливка — видна только обводка, у всех одна толщина. */
function drawPlanetBody(ctx, x, y, r) {
    const z = state.zoom;
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
 * Луны планеты — по плану группировки scene.js groupPlan. Показанные луны
 * рисуются точками и становятся hover-целями. Скрытые луны группы «встают»
 * в маркер-представитель: их хост-позиция для баз — позиция представителя
 * (bases.js рисует базы у группы), а у самого маркера — подпись группы в две
 * строки (луны, затем базы — drawGroupLabel). Имена баз группы у маркеров не
 * рисуются — их id собираются в groupBaseIds (drawBases гасит их подписи).
 * @param {Set} groupBaseIds  сюда складываются id баз групп (для bases.js)
 * @returns {Array} хиты для hover: { m, md, mx, my }
 */
function drawPlanetMoons(ctx, x, y, p, hostPos, groupBaseIds) {
    const { simDays, zoom } = state;
    // Группировка лун: помещается visibleMoons() штук, базы игрока — те, что
    // стоят именно на луне (hostKind 'moon'); удалённые в подпись не берём.
    const plan = groupPlan(moonsByPlanet[p.name] || [], visibleMoons(), {
        baseOf: m => bases.filter(b => b.status !== 'removed'
            && b.hostKind === 'moon' && b.planet === p.name && b.moon === m.n)
    });
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
        plan.group.items.forEach(m => {
            hostPos['moon:' + p.name + ':' + m.n] = { x: rep.mx, y: rep.my };
        });
        // Подпись группы: первая строка — луны, вторая — базы на них
        // (id баз группы уходят в groupBaseIds — bases.js нарисует их
        // маркеры без имён: имена уже стоят в подписи).
        drawGroupLabel(ctx, rep.mx, rep.my, plan.group, zoom, groupBaseIds);
    }
    return hits;
}

/**
 * Подпись группы тел у маркера-представителя (plan.group из scene.js
 * groupPlan) — общая для лун, а дальше планет, систем и малых тел: две
 * строки, имена тел и базы на них. Стиль подсказки hover: тень 1 px, кегль
 * постоянный на экране (10 / zoom). Первая строка белая, вторая — цианом
 * (цвет баз). Базы группы складываются в quietIds: bases.js нарисует их
 * маркеры без имён — имена уже стоят в подписи.
 */
function drawGroupLabel(ctx, mx, my, group, zoom, quietIds) {
    group.bases.forEach(b => quietIds.add(b.id));
    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom, ly = my - 4 / zoom;
    groupLine(ctx, group.label, lx, ly, COLORS.tooltip, zoom);
    if (group.baseLabel)
        groupLine(ctx, group.baseLabel, lx, ly + 12 / zoom, COLORS.base, zoom);
}

/** Строка подписи группы лун: тень со сдвигом в 1 px, затем текст в цвете. */
function groupLine(ctx, text, x, y, color, zoom) {
    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(text, x + 1 / zoom, y + 1 / zoom);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
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
    ctx.font = `600 ${10 / z}px "Manrope", sans-serif`;
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
