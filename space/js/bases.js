// =============================================================================
// bases.js — звёздные базы игрока: хранилище, создание и отрисовка.
//
// База прикреплена к планете или луне и летает по круговой орбите вокруг неё.
// Новые базы создаются прямо на карте: кнопка «Создать базу» в карточке
// планеты/луны включает режим выбора орбиты — радиус берётся от курсора,
// клик подтверждает (input.js). У созданной базы в карточке есть кнопка
// «Переместить базу» — тот же режим; клик переносит запись на выбранную
// орбиту (хост при этом выбирается по правилу ближайшего тела). При переносе
// база встаёт со стороны курсора: направление от центра хозяина к курсору
// становится её положением на орбите и в превью, и в записи (phase0); новая
// база тоже появляется с этой стороны, а не в случайной точке. Радиус орбиты
// зажат в коридор baseRadiusRange: от поверхности хозяина до поверхности
// ближайшего соседа (луны планеты или планеты луны) — орбита не пересекает
// небесные тела. Период обращения — как у Луны: одни сутки на радиусе
// baseOrbitRadius, дальше по закону Кеплера.
//
// Хранение — ОТДЕЛЬНЫЙ ключ localStorage («galaxy_space_bases_v1»): данные
// админки/ангара (window.Store) не задействованы. Пока это только создание
// и отображение; корабли и экономика — позже.
//
// Рисуется из render.js в мировой системе координат; позиции хост-тел
// (планет/лун) передаются картой hostPos после их отрисовки.
// =============================================================================

import { state } from './state.js';
import { screenToWorld } from './math.js';
import { COLORS } from './config.js';
import { planets, moonsByPlanet, moonDist, baseOrbitRadius, basePeriod, moonOrbitRadius } from './data.js';

const STORAGE_KEY = 'galaxy_space_bases_v1';

// Абсолютный потолок радиуса орбиты базы (единицы мира): дальше она теряется
// на фоне системы. Нижняя граница и потолок по соседям — в baseRadiusRange().
export const BASE_MAX_R = 300;

// Запас между орбитой базы и поверхностью тел: хозяина и соседей (единицы мира).
const BASE_CLEAR = 4;

/** Период обращения базы на радиусе r: как у Луны, дальше — по Кеплеру. */
export function basePeriodAt(r) {
    return basePeriod * Math.pow(r / baseOrbitRadius, 1.5);
}

/**
 * Допустимый коридор радиуса орбиты для хоста: от поверхности хозяина до
 * поверхности ближайшего соседа — лун у планеты (все их орбиты-кольца, даже
 * невидимые при текущем зуме) или самой планеты у луны. Так орбита базы
 * никогда не пересекает небесные тела, а не только «не налезает на хозяина».
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @returns {{min: number, max: number}} границы радиуса, единицы мира
 */
export function baseRadiusRange(host) {
    const p = planets.find(q => q.name === host.planet);
    if (!p) return { min: BASE_CLEAR, max: BASE_MAX_R };

    if (host.kind === 'moon') {
        const list = moonsByPlanet[host.planet] || [];
        const idx = list.findIndex(m => m.n === host.moon);
        // Луна Земли рисуется отдельным блоком (render.js): своя дистанция и радиус
        const mr = idx >= 0 ? list[idx].r : 3;
        const md = idx >= 0 ? moonOrbitRadius(p, idx) : moonDist;
        const min = mr + BASE_CLEAR;
        return { min, max: Math.max(min, Math.min(BASE_MAX_R, md - p.r - BASE_CLEAR)) };
    }

    let max = BASE_MAX_R;
    (moonsByPlanet[p.name] || []).forEach((m, i) => {
        max = Math.min(max, moonOrbitRadius(p, i) - m.r - BASE_CLEAR);
    });
    if (p.name === 'Earth') max = Math.min(max, moonDist - 3 - BASE_CLEAR); // Луна Земли (r=3, render.js)
    const min = p.r + BASE_CLEAR;
    return { min, max: Math.max(min, max) };
}

/** Прочитать базы из localStorage; битые данные не роняют карту. */
function loadBases() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr)
            ? arr.filter(b => b && b.id && b.planet && b.orbitRadius > 0)
            : [];
    } catch (e) {
        return [];
    }
}

/** Записать базы в localStorage (ключ отдельный от данных проекта). */
function saveBases() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bases));
    } catch (e) { /* нет доступа/переполнено — базы просто не сохранятся */ }
}

/** Записи баз + позиции x/y, обновляемые каждый кадр при отрисовке. */
export const bases = loadBases();

/** Ключ хоста: 'planet:Mars' или 'moon:Mars:Фобос / Phobos'. */
export function hostKey(kind, planet, moon) {
    return kind === 'planet' ? 'planet:' + planet : 'moon:' + planet + ':' + moon;
}

/** Имя следующей базы: BASE-2, BASE-3… (BASE-1 — стартовая LUNA-ORBIT). */
function nextName() {
    let max = 1;
    bases.forEach(b => {
        const m = /^BASE-(\d+)$/.exec(b.name || '');
        if (m && +m[1] > max) max = +m[1];
    });
    return 'BASE-' + (max + 1);
}

/** Радиус орбиты: округлён до десятых и зажат в коридор хоста (baseRadiusRange). */
function radiusOf(r, host) {
    const { min, max } = baseRadiusRange(host);
    return Math.round(Math.min(Math.max(r, min), max) * 10) / 10;
}

/**
 * Фаза базы (phase0) так, чтобы прямо сейчас (state.simDays) она стояла на
 * направлении ang от центра хоста: phase0 = ang − 2π·t/период. null — угол не
 * задан (курсор в самом центре тела): создание берёт случайную точку, перенос
 * оставляет прежнюю сторону орбиты.
 */
function phaseFor(ang, period) {
    if (typeof ang !== 'number' || !isFinite(ang)) return null;
    const twoPi = Math.PI * 2;
    return ((ang - twoPi * state.simDays / period) % twoPi + twoPi) % twoPi;
}

/**
 * Создать базу на орбите радиуса r у планеты/луны; запись сразу пишется в
 * localStorage. Карточку/список обновляет вызывающий код (input.js).
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {number} r радиус орбиты, единицы мира (клампится в коридор хоста)
 * @param {?number} ang угол от центра хоста к курсору (радианы): база появится
 *   с этой стороны; не задан — случайная точка орбиты
 */
export function createBase(host, r, ang) {
    const orbitRadius = radiusOf(r, host);
    const period = basePeriodAt(orbitRadius);
    const phase = phaseFor(ang, period);
    const rec = {
        id: 'base-' + Date.now().toString(36),
        name: nextName(),
        hostKind: host.kind,
        planet: host.planet,
        moon: host.moon || null,
        orbitRadius,
        period,
        phase0: phase === null ? Math.random() * Math.PI * 2 : phase,
        created: new Date().toISOString()
    };
    bases.push(rec);
    saveBases();
    return rec;
}

/**
 * Переместить созданную базу на орбиту радиуса r у планеты/луны (хост выбирает
 * режим на карте, в том числе по правилу ближайшего тела). База встаёт со
 * стороны курсора: направление ang от центра хоста становится её положением на
 * орбите. Период пересчитывается, запись сразу пишется в localStorage;
 * карточку обновляет вызывающий код (input.js).
 * @param {Object} rec запись базы
 * @param {{kind: string, planet: string, moon: ?string}} host
 * @param {number} r радиус орбиты, единицы мира (клампится)
 * @param {?number} ang угол от центра хоста к курсору (радианы); не задан —
 *   сторона орбиты у базы сохраняется
 */
export function moveBase(rec, host, r, ang) {
    rec.hostKind = host.kind;
    rec.planet = host.planet;
    rec.moon = host.moon || null;
    rec.orbitRadius = radiusOf(r, host);
    rec.period = basePeriodAt(rec.orbitRadius);
    const phase = phaseFor(ang, rec.period);
    if (phase !== null) rec.phase0 = phase;
    saveBases();
    return rec;
}

/** Базы на данном хосте — для списка в карточке планеты/луны. */
export function basesAt(kind, planet, moon) {
    return bases.filter(b => b.hostKind === kind && b.planet === planet && (b.moon || null) === (moon || null));
}

/**
 * Отрисовать все базы (орбита-пунктир, свечение, квадрат, пульс, подпись) и
 * превью выбираемой орбиты, если включён режим создания.
 * @param {Object} hostPos 'planet:Mars' / 'moon:Earth:Луна / Moon' -> {x, y}
 * @returns {Array} hoverTargets баз
 */
export function drawBases(ctx, hostPos) {
    const { simDays, zoom, time } = state;
    const targets = [];

    bases.forEach(b => {
        const mode = state.baseMode;
        // База в режиме переноса рисуется сразу по превью: хост режима и
        // текущий радиус выбора (до подтверждения запись не меняется).
        const moving = mode && mode.moveId === b.id;
        const hk = moving ? hostKey(mode.kind, mode.planet, mode.moon)
                          : hostKey(b.hostKind, b.planet, b.moon);
        const hp = hostPos[hk];
        if (!hp) return;   // хост не в кадре (например, луна скрыта зумом)
        const orbitR = moving ? state.baseRadius : b.orbitRadius;
        const period = moving ? basePeriodAt(orbitR) : b.period;
        // Перенос рисуется со стороны курсора (mode.ang считает input.js по
        // позиции над картой) — база встанет туда же после подтверждения.
        let ang = b.phase0 + 2 * Math.PI * simDays / period;
        if (moving && typeof mode.ang === 'number') ang = mode.ang;
        b.x = hp.x + Math.cos(ang) * orbitR;
        b.y = hp.y - Math.sin(ang) * orbitR;

        drawBaseMarker(ctx, hp, b, zoom, time, orbitR);
        targets.push({
            kind: 'base', name: b.name, x: b.x, y: b.y, r: 4 / zoom,
            orbitCx: hp.x, orbitCy: hp.y, orbitR,
            local: b, moons: []
        });
    });

    if (state.baseMode) drawBasePreview(ctx, hostPos);
    return targets;
}

/** Маркер базы: орбита вокруг хоста, свечение, квадрат, пульс и подпись. */
function drawBaseMarker(ctx, hp, b, zoom, time, orbitR) {
    ctx.strokeStyle = 'rgba(0,255,255,0.27)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.setLineDash([1 / zoom, 1 / zoom]);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, orbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const bs = 4 / zoom;

    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, bs * 2);
    glow.addColorStop(0, 'rgba(0,255,255,0.6)');
    glow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, bs * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.base;
    ctx.fillRect(b.x - bs / 2, b.y - bs / 2, bs, bs);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(b.x - bs / 2, b.y - bs / 2, bs, bs);

    const pulse = (Math.sin(time * 4) + 1) * 0.5;
    ctx.strokeStyle = `rgba(0,255,255,${0.5 - pulse * 0.5})`;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.arc(b.x, b.y, bs + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.base;
    ctx.font = `bold ${Math.max(9, 10 / zoom)}px monospace`;
    ctx.fillText(b.name, b.x + bs + 3 / zoom, b.y - 3 / zoom);
}

/** Превью режима «выбрать орбиту»: окружность радиуса, лучик и подсказка. */
function drawBasePreview(ctx, hostPos) {
    const mode = state.baseMode;
    const hp = hostPos[hostKey(mode.kind, mode.planet, mode.moon)];
    if (!hp || state.mouseX < 0) return;

    const { zoom } = state;
    const r = state.baseRadius;

    ctx.strokeStyle = 'rgba(0,255,255,0.55)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const w = screenToWorld(state.mouseX, state.mouseY, state);
    // луч — направление будущего положения базы: угол от центра хоста к
    // курсору (mode.ang; до первого движения над картой — по позиции мыши)
    let ux, uy;
    if (typeof mode.ang === 'number') {
        ux = Math.cos(mode.ang);
        uy = -Math.sin(mode.ang);
    } else {
        const dx = w.x - hp.x, dy = w.y - hp.y, d = Math.hypot(dx, dy) || 1;
        ux = dx / d;
        uy = dy / d;
    }

    ctx.strokeStyle = 'rgba(0,255,255,0.25)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(hp.x + ux * r, hp.y + uy * r);
    ctx.stroke();

    const l1 = 'Орбита: ' + Math.round(r) + ' ед.';
    const l2 = (mode.moveId ? 'клик — переместить базу' : 'клик — создать') + ' · Esc — отмена';
    ctx.font = `${11 / zoom}px monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(l1, w.x + 15 / zoom, w.y - 19 / zoom);
    ctx.fillText(l2, w.x + 15 / zoom, w.y - 4 / zoom);
    ctx.fillStyle = '#bffcfc';
    ctx.fillText(l1, w.x + 14 / zoom, w.y - 20 / zoom);
    ctx.fillStyle = 'rgba(191,252,252,0.75)';
    ctx.fillText(l2, w.x + 14 / zoom, w.y - 5 / zoom);
}
