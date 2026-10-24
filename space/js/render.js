// =============================================================================
// render.js — отрисовка сцены на канвас: фон, пол, малые тела, солнце,
// планеты, луны и звёздные базы.
//
// Карта — диметрия 2:1 (iso.js): мир-эклиптика сжимается по y, поэтому орбиты
// становятся эллипсами, а сферы остаются круглыми. Слои кадра:
//   небо -> экранное гало звезды -> пол/пыль/пояс -> тени -> тела по глубине
//   -> подписи -> базы.
//
// Реальный масштаб: у тел настоящие радиусы (wu), поэтому на общем плане они
// меньше пикселя. LOD: экранный радиус >= TRUE_MIN_PX — настоящая сфера,
// иначе — полое кольцо-маркер фиксированного экранного размера. Близкие тела
// (< GROUP_PX) собираются в группу более массивного соседа; у группы своё
// кольцо, подпись «Имя · N» и список тел в карточке.
//
// Возвращает массив hoverTargets — цели наведения и клика.
// =============================================================================

import { state } from './state.js';
import { orbitAngle, orbitPoint3, keplerPos3, keplerPoly3 } from './math.js';
import { SUN_R, COLORS, ISO_K, ISO_Z, TRUE_MIN_PX, MARKER_PX } from './config.js';
import { planets, planetM0, moonsByPlanet, moonOrbitRadius } from './data.js';
import { GROUP_PX, resetLabels, placeLabel } from './scene.js';
import { smallBodyList, drawSmallBodiesFloor, drawSmallBody } from './smallbodies.js';
import { basesAt, drawBases } from './bases.js';
import { drawSky } from './sky.js';
import { project3, view3Poly } from './iso.js';
import { sphere, shadow, sunSphere } from './paint.js';
import { km } from './units.js';

/** Орбиты планет: реальные элементы, считаются один раз (форма не меняется). */
const PLANET_ORBITS = new Map();
planets.forEach(p => {
    const raw = keplerPoly3(p.dist, p.e, p.peri, 0, p.period, 160, v => v, p.inc, p.node);
    PLANET_ORBITS.set(p, view3Poly(raw));
});

/** Позиция планеты на орбите: Кеплер с эксцентриситетом и наклоном. */
function planetRawPos(p, t) {
    return keplerPos3(p.dist, p.e, p.peri, planetM0(p), p.period, t, v => v, p.inc, p.node);
}

/**
 * Локальная орбита луны в view-координатах (смещение от планеты). Кэшируется
 * на объекте луны: форма орбиты от времени не зависит, каждый кадр достаточно
 * прибавить позицию планеты.
 */
function moonOrbitLocal(m) {
    if (!m._orbitLocal) {
        const md = km(m.a);
        const raw = keplerPoly3(md, m.e, m.peri, 0, m.period, 96, v => v, m.inc, m.node);
        const pts = new Array(raw.length / 3 * 2);
        for (let i = 0, j = 0; i < raw.length; i += 3, j += 2) {
            const v = project3(raw[i], raw[i + 1], raw[i + 2]);
            pts[j] = v.x;
            pts[j + 1] = v.y;
        }
        m._orbitLocal = pts;
    }
    return m._orbitLocal;
}

/** Абсолютная орбита луны в view: локальная полилиния + позиция планеты. */
function moonOrbitAbs(m, px, py) {
    const local = moonOrbitLocal(m);
    const out = new Array(local.length);
    for (let i = 0; i < local.length; i += 2) {
        out[i] = local[i] + px;
        out[i + 1] = local[i + 1] + py;
    }
    return out;
}

/** Точка на экране в пределах кадра с запасом margin (px). */
function onScreen(x, y, margin = 40) {
    const sx = state.W / 2 + (x - state.camX) * state.zoom;
    const sy = state.H / 2 + (y - state.camY) * state.zoom;
    return sx >= -margin && sx <= state.W + margin &&
           sy >= -margin && sy <= state.H + margin;
}

/** Нарисовать один кадр мира в мировой системе координат (save/restore внутри). */
export function renderScene(ctx) {
    const { zoom, simDays } = state;
    const hoverTargets = [];

    // Дальний фон — отдельный слой sky.js, в экранных координатах.
    drawSky(ctx);

    // Экранное гало Солнца: на общем плане звезда должна быть видна, даже
    // когда её настоящий диск меньше пикселя.
    drawSunScreenGlow(ctx);

    resetLabels();

    // Мировая система координат: центр экрана -> камера -> зум.
    ctx.save();
    ctx.translate(state.W / 2, state.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -state.camY);

    // === ПОЗИЦИИ ТЕЛ КАДРА ===
    const planetRaw = new Map();
    const planetPos = new Map();
    state.planetPositions.clear();

    planets.forEach(p => {
        const raw = planetRawPos(p, simDays);
        const v = project3(raw.x, raw.y, raw.z);
        const pos = {
            x: v.x, y: v.y, z: raw.z, floorY: raw.y * ISO_K,
            rawX: raw.x, rawY: raw.y, rawZ: raw.z, r: p.r
        };
        planetRaw.set(p, raw);
        planetPos.set(p, pos);
        state.planetPositions.set(p.name, pos);
    });

    // === ТЕЛА: солнце, планеты, видимые луны, малые тела ===
    const bodies = [];
    bodies.push({
        kind: 'sun', x: 0, y: 0, z: 0, floorY: 0, r: SUN_R, mass: SUN_R,
        label: 'Солнце / Sun', p: null, m: null, small: null, bases: []
    });

    planets.forEach(p => {
        const pos = planetPos.get(p);
        bodies.push({
            kind: 'planet', p, x: pos.x, y: pos.y, z: pos.z, floorY: pos.floorY,
            r: p.r, mass: p.r, label: p.ru || p.name,
            orbit: PLANET_ORBITS.get(p),
            bases: basesAt('planet', p.name, null)
        });
    });

    state.moonPositions.clear();
    planets.forEach(p => {
        const o = planetRaw.get(p);
        const pv = planetPos.get(p);
        const list = moonsByPlanet[p.name] || [];
        for (let i = 0; i < list.length; i++) {
            const m = list[i];
            const md = moonOrbitRadius(p, i);
            // Орбита меньше 2 px — луна в кадр не попадает (иначе 456 лун
            // считались бы вхолостую). Планета за кадром — тоже пропуск.
            if (md * zoom < 2) continue;
            const margin = md * zoom + 40;
            const psx = state.W / 2 + (pv.x - state.camX) * zoom;
            const psy = state.H / 2 + (pv.y - state.camY) * zoom;
            if (psx < -margin || psx > state.W + margin ||
                psy < -margin || psy > state.H + margin) continue;

            const off = keplerPos3(md, m.e, m.peri, m.m0, m.period, simDays,
                v => v, m.inc, m.node);
            const wx = o.x + off.x, wy = o.y + off.y, wz = o.z + off.z;
            const v = project3(wx, wy, wz);
            if (!onScreen(v.x, v.y, 24)) continue;

            state.moonPositions.set(p.name + ':' + m.n, {
                x: v.x, y: v.y, floorY: wy * ISO_K,
                rawX: wx, rawY: wy, rawZ: wz, r: m.r
            });
            bodies.push({
                kind: 'moon', p, m, x: v.x, y: v.y, z: wz, floorY: wy * ISO_K,
                r: m.r, mass: m.r,
                label: m.ru ? m.ru + ' / ' + m.n : m.n,
                orbitLocal: { px: pv.x, py: pv.y },
                bases: basesAt('moon', p.name, m.n)
            });
        }
    });

    // Малые тела: позиции уже в view (smallbodies.js). В кадр попадают только
    // те, чей центр виден; остальные не рисуются и не подписываются.
    const small = smallBodyList();
    small.forEach(s => {
        if (!onScreen(s.x, s.y, 40)) return;
        bodies.push({
            kind: 'small', id: s.id, small: s.small, x: s.x, y: s.y,
            z: s.z || 0, floorY: s.floorY ?? s.y,
            r: s.r, mass: s.r || 1e-9, label: s.label, bases: []
        });
    });

    // Порядок важности: сначала массивные тела. Представителем группы всегда
    // становится более массивное тело (Солнце -> планета -> луна/малое тело).
    bodies.sort((a, b) => b.mass - a.mass);
    const groups = groupBodiesLocal(bodies, zoom);

    // === HOST-ПОЗИЦИИ ДЛЯ БАЗ ===
    const hostPos = {};
    planetPos.forEach((pos, p) => { hostPos['planet:' + p.name] = { x: pos.x, y: pos.y }; });
    state.moonPositions.forEach((pos, key) => {
        const [pn, ...rest] = key.split(':');
        hostPos['moon:' + pn + ':' + rest.join(':')] = { x: pos.x, y: pos.y };
    });

    // Базы лун, попавших в группы: их имена уже в подписи группы.
    const quietIds = new Set();
    groups.forEach(g => {
        if (g.members.length < 2) return;
        g.members.forEach(m => {
            if (m !== g.rep) m.bases.forEach(b => quietIds.add(b.id));
        });
    });

    // === ПОЛ ===
    drawSmallBodiesFloor(ctx);
    drawFloorShadows(ctx, groups, planetPos, zoom);

    // === ТЕЛА ПО ГЛУБИНЕ ===
    const drawList = groups.map(g => ({
        x: g.rep.x, y: g.rep.y, r: g.rep.r, rep: g.rep, group: g
    }));
    drawList.sort((a, b) => (a.y - b.y) || (b.r - a.r));

    const smallTargets = new Map();
    drawList.forEach(item => {
        const rep = item.rep;
        if (rep.kind === 'sun') drawSunCore(ctx, zoom);
        else if (rep.kind === 'planet') drawPlanet(ctx, item.x, item.y, rep.p, zoom);
        else if (rep.kind === 'moon') drawMoonBody(ctx, item.x, item.y, rep.m, zoom);
        else if (rep.kind === 'small') {
            const t = drawSmallBody(ctx, rep.small);
            if (t) smallTargets.set(rep.small.id, t);
        }

        if (item.group.members.length > 1) drawGroupRing(ctx, item.group, zoom);
    });

    // === ПОДПИСИ ===
    groups.forEach(g => {
        const baseNames = [];
        g.members.forEach(m => m.bases.forEach(b => baseNames.push(b.name)));
        const label = groupLabel(g, zoom);
        const rep = g.rep;
        const offset = Math.max(rep.r, markerPx(rep.kind) / zoom) + 4 / zoom;
        drawGroupLabel(ctx, rep.x + offset, rep.y, {
            label,
            baseLabel: baseNames.length ? baseNames.join(', ') : null
        }, zoom);
    });

    // === БАЗЫ ===
    const baseTargets = drawBases(ctx, hostPos, quietIds);
    baseTargets.forEach(t => { t.p = planets.find(x => x.name === t.local.planet); });

    ctx.restore();

    // === HOVER-ЦЕЛИ ===
    // Сначала группы, затем одиночные тела, затем базы: findBodyAt идёт с
    // конца, поэтому база перехватывает клик у тела, а тело — у группы.
    groups.forEach(g => {
        if (g.members.length > 1) hoverTargets.push(groupTarget(g, zoom));
    });

    groups.forEach(g => {
        if (g.members.length > 1) return;
        const b = g.rep;
        if (b.kind === 'sun') {
            hoverTargets.push({ kind: 'sun', name: 'Солнце / Sun', x: 0, y: 0, r: SUN_R, floorY: 0, moons: [] });
        } else if (b.kind === 'planet') {
            hoverTargets.push({
                kind: 'planet', name: b.label, p: b.p, x: b.x, y: b.y,
                floorY: b.floorY, r: b.r, orbit: b.orbit, moons: []
            });
        } else if (b.kind === 'moon') {
            const orbit = moonOrbitAbs(b.m, b.orbitLocal.px, b.orbitLocal.py);
            hoverTargets.push({
                kind: 'moon', name: b.label, p: b.p, m: b.m, x: b.x, y: b.y,
                floorY: b.floorY, r: b.r, orbit: { poly: orbit }, moons: []
            });
        } else if (b.kind === 'small') {
            const t = smallTargets.get(b.small.id);
            if (t) hoverTargets.push(t);
        }
    });

    baseTargets.forEach(t => hoverTargets.push(t));

    return hoverTargets;
}

// --- Группировка (локальная обёртка над scene.js) ------------------------------

function groupBodiesLocal(bodies, zoom) {
    // Импорт scene.js уже даёт groupBodies, но здесь важна сортировка по массе:
    // Солнце всегда первое, поэтому группы собираются вокруг него.
    return groupBodies(bodies, zoom);
}

// --- Экранные размеры и маркеры -------------------------------------------------

/** Радиус маркера тела в экранных пикселях. */
function markerPx(kind) {
    if (kind === 'sun') return MARKER_PX.sun;
    if (kind === 'planet') return MARKER_PX.planet;
    if (kind === 'moon') return MARKER_PX.moon;
    return MARKER_PX.small;
}

/** Полое кольцо-маркер: размер фиксирован на экране, позиция — реальная. */
function drawMarker(ctx, x, y, rPx, color, zoom, width = 1.2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width / zoom;
    ctx.beginPath();
    ctx.arc(x, y, rPx / zoom, 0, Math.PI * 2);
    ctx.stroke();
}

/** Экранное гало Солнца и световое пятно на полу — до мирового transform. */
function drawSunScreenGlow(ctx) {
    const { W, H, zoom, camX, camY } = state;
    const sx = W / 2 + (0 - camX) * zoom;
    const sy = H / 2 + (0 - camY) * zoom;
    const r = Math.max(SUN_R * zoom * 5.2, 26);

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, 'rgba(255,206,122,0.42)');
    g.addColorStop(0.35, 'rgba(255,157,60,0.20)');
    g.addColorStop(0.7, 'rgba(255,157,60,0.06)');
    g.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Световое пятно на полу — эллипс 2:1, тоже с экранным минимумом.
    const fr = Math.max(SUN_R * zoom * 7.5, 18);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, ISO_K);
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr);
    fg.addColorStop(0, 'rgba(255,206,122,0.20)');
    fg.addColorStop(0.55, 'rgba(255,157,60,0.055)');
    fg.addColorStop(1, 'rgba(255,157,60,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// --- Тела ----------------------------------------------------------------------

/** Ядро Солнца: настоящая сфера или маркер видимости. */
function drawSunCore(ctx, zoom) {
    if (SUN_R * zoom >= TRUE_MIN_PX) sunSphere(ctx, 0, 0, SUN_R);
    else drawMarker(ctx, 0, 0, MARKER_PX.sun, '#ffce7a', zoom, 1.4);
}

/** Планета: сфера + кольца Сатурна; при малом экранном радиусе — маркер. */
function drawPlanet(ctx, x, y, p, zoom) {
    if (p.r * zoom < TRUE_MIN_PX) {
        drawMarker(ctx, x, y, MARKER_PX.planet, p.color, zoom, 1.3);
        return;
    }
    if (p.rings) drawRingHalf(ctx, x, y, p, true, zoom);
    sphere(ctx, x, y, p.r, p.color, { zoom });
    if (p.rings) drawRingHalf(ctx, x, y, p, false, zoom);
}

/** Половина кольца Сатурна: back — дальняя (верхняя), иначе передняя. */
function drawRingHalf(ctx, x, y, p, back, zoom) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.scale(1, 0.3);

    const a0 = back ? Math.PI : 0;
    const a1 = back ? Math.PI * 2 : Math.PI;

    ctx.strokeStyle = 'rgba(200,200,200,0.30)';
    ctx.lineWidth = 4 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 2.2, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220,220,220,0.46)';
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.7, a0, a1);
    ctx.stroke();

    ctx.restore();
}

/** Луна: маленькая сфера или маркер. */
function drawMoonBody(ctx, x, y, m, zoom) {
    if (m.r * zoom < TRUE_MIN_PX) {
        drawMarker(ctx, x, y, MARKER_PX.moon, m.c || COLORS.moon, zoom, 1.1);
        return;
    }
    sphere(ctx, x, y, m.r, m.c || COLORS.moon, { zoom, rimAlpha: 0.12 });
}

/** Тени на полу: планеты и показанные крупные тела. */
function drawFloorShadows(ctx, groups, planetPos, zoom) {
    planets.forEach(p => {
        const pos = planetPos.get(p);
        shadow(ctx, pos.x, pos.floorY, p.r, zoom);
    });
    groups.forEach(g => {
        if (g.members.length > 1) return;
        const rep = g.rep;
        if (rep.kind !== 'small' && rep.kind !== 'moon') return;
        if (rep.r * zoom < TRUE_MIN_PX) return;
        shadow(ctx, rep.x, rep.floorY ?? rep.y, rep.r, zoom);
    });
}

// --- Группы --------------------------------------------------------------------

/** Подпись группы: у Солнца — «Внутренние планеты» / «Солнечная система». */
function groupLabel(g, zoom) {
    const rep = g.rep;
    // Одиночное тело — это не группа: подпись без счётчика «· 1».
    if (g.members.length === 1) return rep.label;
    if (rep.kind === 'sun') {
        const ps = g.members.filter(m => m.kind === 'planet');
        if (!ps.length) return 'Солнце / Sun';
        if (ps.length === planets.length || zoom < 0.01) {
            return 'Солнечная система · ' + g.members.length;
        }
        const inner = ps.every(m => ['Mercury', 'Venus', 'Earth', 'Mars'].includes(m.p.name));
        if (inner) return 'Внутренние планеты · ' + ps.length;
        return 'Солнце · ' + g.members.length;
    }
    return rep.label + ' · ' + g.members.length;
}

/** Групповое кольцо: круг в экранных пикселях вокруг представителя. */
function drawGroupRing(ctx, g, zoom) {
    const ringPx = groupRingPx(g, zoom);
    const rep = g.rep;
    const color = rep.kind === 'sun' ? '#ffce7a'
        : rep.kind === 'planet' ? rep.p.color
        : rep.kind === 'moon' ? (rep.m.c || COLORS.moon)
        : '#cfcfcf';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.beginPath();
    ctx.arc(rep.x, rep.y, ringPx / zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

/** Радиус группового кольца в пикселях: по самому дальнему участнику. */
function groupRingPx(g, zoom) {
    let max = 0;
    g.members.forEach(m => {
        const d = Math.hypot((m.x - g.rep.x) * zoom, (m.y - g.rep.y) * zoom);
        if (d > max) max = d;
    });
    return Math.max(8, max + 4);
}

/** Hover-цель группы: клик открывает список тел. */
function groupTarget(g, zoom) {
    return {
        kind: 'group',
        name: groupLabel(g, zoom),
        x: g.rep.x, y: g.rep.y, r: groupRingPx(g, zoom) / zoom,
        group: {
            label: groupLabel(g, zoom),
            repKind: g.rep.kind,
            members: g.members.map(b => ({
                kind: b.kind, label: b.label, p: b.p, m: b.m, small: b.small,
                x: b.x, y: b.y, floorY: b.floorY, r: b.r
            }))
        }
    };
}

// --- Подписи -------------------------------------------------------------------

/**
 * Подпись группы тел у её представителя: две строки, имя группы и базы на ней.
 */
function drawGroupLabel(ctx, mx, my, group, zoom) {
    const lines = [{ text: group.label, color: COLORS.tooltip }];
    if (group.baseLabel) lines.push({ text: group.baseLabel, color: COLORS.base });

    ctx.font = `${10 / zoom}px monospace`;
    const lx = mx + 6 / zoom;
    const lh = 12 / zoom;
    const top = my - 14 / zoom;
    const w = Math.max(...lines.map(l => ctx.measureText(l.text).width));
    const h = (lines.length - 1) * lh + 14 / zoom;
    const off = placeLabel(lx, top, w, h);

    lines.forEach((l, i) => {
        groupLine(ctx, l.text, lx, top + off + 10 / zoom + i * lh, l.color, zoom);
    });
}

/** Строка подписи группы: тень со сдвигом в 1 px, затем текст в цвете. */
function groupLine(ctx, text, x, y, color, zoom) {
    ctx.fillStyle = COLORS.tooltipShadow;
    ctx.fillText(text, x + 1 / zoom, y + 1 / zoom);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}
