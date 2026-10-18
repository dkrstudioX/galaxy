// =============================================================================
// input.js — всё пользовательское управление: тач (перетаскивание, pinch),
// колесо мыши (зум к точке под курсором), панорамирование правой кнопкой,
// позиция курсора для hover (над выбираемыми объектами — курсор-указатель),
// кнопки скорости времени.
// Только меняет state и курсор канваса, ничего не рисует.
// =============================================================================

import { state } from './state.js';
import { clamp, screenToWorld } from './math.js';
import { MIN_ZOOM, MAX_ZOOM, MIN_SPEED, MAX_SPEED } from './config.js';
import { planets } from './data.js';
import { findBodyAt } from './hover.js';
import { selectBody, refreshObjectCard } from './ui.js';
import { createBase, moveBase, bases, baseRadiusRange } from './bases.js';

/**
 * Зум к точке экрана: мировая точка под (ax, ay) остаётся под ней после
 * смены масштаба — колесо приближает карту туда, где курсор, pinch — к
 * середине между пальцами. Если зум упёрся в предел, камера не сдвигается.
 */
function zoomAt(ax, ay, target) {
    const z0 = state.zoom;
    const z1 = clamp(target, MIN_ZOOM, MAX_ZOOM);
    if (z1 === z0) return;
    const k = 1 / z0 - 1 / z1;   // так cam сдвигается ровно под точку (ax, ay)
    state.camX += (ax - state.W / 2) * k;
    state.camY += (ay - state.H / 2) * k;
    state.zoom = z1;
}

/** Прицепить все обработчики ввода к канвасу и кнопкам. Вызывается один раз. */
export function initInput(canvas, ui) {
    // === ТАЧ: перетаскивание одним пальцем, pinch-зум двумя ===
    let touch1 = null, touch2 = null;
    let lastDist = 0, lastZoom = 1;
    let isDragging = false, dragStartX = 0, dragStartY = 0, camStartX = 0, camStartY = 0;

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        state.fly = null;   // тач-жест перебивает полёт камеры
        const touches = e.touches;
        if (touches.length === 1) {
            touch1 = touches[0];
            isDragging = true;
            dragStartX = touch1.clientX;
            dragStartY = touch1.clientY;
            camStartX = state.camX;
            camStartY = state.camY;
        } else if (touches.length === 2) {
            touch1 = touches[0]; touch2 = touches[1];
            isDragging = false;
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            lastDist = Math.sqrt(dx * dx + dy * dy);
            lastZoom = state.zoom;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && isDragging) {
            const t = touches[0];
            state.camX = camStartX + (t.clientX - dragStartX) / state.zoom;
            state.camY = camStartY + (t.clientY - dragStartY) / state.zoom;
        } else if (touches.length === 2) {
            const t1 = touches[0], t2 = touches[1];
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // зум к середине между пальцами
            zoomAt((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2,
                   lastZoom * (dist / lastDist));
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        if (e.touches.length < 2) touch2 = null;
        if (e.touches.length === 0) { touch1 = null; isDragging = false; }
    });

    // === КОЛЕСО МЫШИ: зум к точке под курсором ===
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        state.fly = null;   // ручной зум перебивает полёт камеры
        zoomAt(e.clientX, e.clientY, state.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    }, { passive: false });

    // === ПАНОРАМИРОВАНИЕ ПРАВОЙ КНОПКОЙ ===
    // Удерживайте правую кнопку — карта следует за курсором (удобно на большом зуме).
    let mouseDragging = false, mouseStartX = 0, mouseStartY = 0, camStartMX = 0, camStartMY = 0;

    // Левый клик без перетаскивания выбирает тело: солнце / планету / луну.
    let downX = 0, downY = 0;
    canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        downX = e.clientX;
        downY = e.clientY;
    });
    canvas.addEventListener('mouseup', e => {
        if (e.button !== 0) return;
        const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
        if (moved > 5 || !state.hoverTargets) return; // это было перетаскивание
        if (state.baseMode) { confirmBase(e.clientX, e.clientY); return; } // выбираем орбиту базы
        state.fly = null;   // клик по карте перебивает полёт камеры
        selectBody(findBodyAt(state.hoverTargets, e.clientX, e.clientY));
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        state.fly = null;                       // панорамирование перебивает полёт
        if (state.baseMode) cancelBaseMode();   // правая кнопка отменяет выбор орбиты
        mouseDragging = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        camStartMX = state.camX;
        camStartMY = state.camY;
        canvas.style.cursor = 'grabbing';
    });

    // Курсор-указатель над выбираемыми объектами — те же цели, что выбираются
    // кликом (hoverTargets из render.js): солнце, планеты, луны, база.
    const updateCursor = (x, y) => {
        if (state.baseMode) { canvas.style.cursor = 'crosshair'; return; } // выбираем орбиту
        canvas.style.cursor = (state.hoverTargets && findBodyAt(state.hoverTargets, x, y)) ? 'pointer' : '';
    };

    window.addEventListener('mousemove', e => {
        // позиция курсора нужна и без зажатой кнопки — для hover-подсказок
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        if (mouseDragging) {     // тянем карту — курсор остаётся «grabbing»
            state.camX = camStartMX + (e.clientX - mouseStartX) / state.zoom;
            state.camY = camStartMY + (e.clientY - mouseStartY) / state.zoom;
            return;
        }
        // режим выбора орбиты базы: радиус следит за курсором (только над картой,
        // чтобы курсор над панелью не утаскивал орбиту к случайному телу)
        if (state.baseMode && e.target === canvas) updateBaseRadius(e.clientX, e.clientY);
        updateCursor(e.clientX, e.clientY);
    });

    canvas.addEventListener('mouseleave', () => {
        state.mouseX = -1;
        state.mouseY = -1;
        if (!mouseDragging) canvas.style.cursor = '';
    });

    window.addEventListener('mouseup', e => {
        if (e.button !== 2) return;
        mouseDragging = false;
        updateCursor(e.clientX, e.clientY);
    });

    // отключаем системное контекстное меню, чтобы правая кнопка работала как панорамирование
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Esc отменяет выбор орбиты базы
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.baseMode) cancelBaseMode();
    });

    // === КНОПКИ СКОРОСТИ ВРЕМЕНИ ===
    // «Быстрее» удваивает скорость, «Медленнее» делит пополам, «Нормально» = реальное время.
    ui.slowBtn.addEventListener('click', () => {
        state.timeScale = Math.max(MIN_SPEED, state.timeScale / 2);
        updateSpeedUI(ui);
    });

    ui.fastBtn.addEventListener('click', () => {
        state.timeScale = Math.min(MAX_SPEED, state.timeScale * 2);
        updateSpeedUI(ui);
    });

    ui.normalBtn.addEventListener('click', () => {
        state.timeScale = 1;
        updateSpeedUI(ui);
    });

    updateSpeedUI(ui);
}

/** Подсветить активную кнопку и обновить надпись скорости в HUD. */
function updateSpeedUI(ui) {
    ui.normalBtn.classList.toggle('active', state.timeScale === 1);
    const speedEl = document.getElementById('speed');
    speedEl.textContent = (Math.round(state.timeScale * 10000) / 10000) + 'x';
}

/* ---------- Звёздные базы: режим выбора орбиты (кнопка в карточке) ---------- */

/** Позиция хост-тела (планеты/луны) в мировых координатах из целей кадра. */
function hostPosOf(host) {
    const tg = state.hoverTargets || [];
    const t = tg.find(t => t.kind === 'planet' && t.p.name === host.planet);
    if (!t) return null;
    if (host.kind === 'planet') return { x: t.x, y: t.y };
    const mh = t.moons.find(m => m.m.n === host.moon);
    return mh ? { x: mh.mx, y: mh.my } : null;
}

/** Снимок соседей для режима базы: планеты и их нарисованные луны (позиции — на момент снимка). */
function baseHosts() {
    const out = [];
    (state.hoverTargets || []).forEach(t => {
        if (t.kind !== 'planet') return;
        out.push({ kind: 'planet', planet: t.p.name, moon: null, x: t.x, y: t.y });
        t.moons.forEach(mh =>
            out.push({ kind: 'moon', planet: t.p.name, moon: mh.m.n, x: mh.mx, y: mh.my }));
    });
    return out;
}

/**
 * Радиус выбираемой орбиты: расстояние от курсора до ближайшего тела, с клампом.
 * Правило ближайшего тела: как только точка орбиты уходит дальше половины пути
 * до другого тела (курсор ближе к нему, чем к исходному), орбита переезжает к
 * этому телу — база на Венере, уведённая к Земле, окажется у Земли.
 * Позиции соседей (планет и видимых лун) снимаются один раз при старте режима
 * (mode.snap) и на каждом движении мыши НЕ пересчитываются.
 */
function updateBaseRadius(x, y) {
    const mode = state.baseMode;
    if (!mode) return;
    if (!mode.snap) mode.snap = baseHosts();   // снимок соседей — один раз на режим
    const w = screenToWorld(x, y, state);
    let best = null, bd = Infinity;
    for (const h of mode.snap) {
        const d = Math.hypot(w.x - h.x, w.y - h.y);
        if (d < bd) { bd = d; best = h; }
    }
    if (!best) return;
    if (best.kind !== mode.kind || best.planet !== mode.planet || (best.moon || null) !== (mode.moon || null)) {
        // {...mode} сохраняет snap и moveId (перенос базы) при переезде хоста
        state.baseMode = { ...mode, kind: best.kind, planet: best.planet, moon: best.moon };
    }
    const hp = hostPosOf(state.baseMode);   // радиус — от живого положения хоста
    const rg = baseRadiusRange(state.baseMode);   // коридор: не пересекать тела
    state.baseRadius = Math.min(rg.max, Math.max(rg.min,
        hp ? Math.hypot(w.x - hp.x, w.y - hp.y) : bd));
}

/** Клик в режиме выбора орбиты: создать базу или перенести существующую. */
function confirmBase(x, y) {
    if (!hostPosOf(state.baseMode)) return;   // хост не в кадре (луна скрыта зумом) — клик мимо
    updateBaseRadius(x, y);
    const mode = state.baseMode;   // хост мог только что переехать к ближайшему телу
    state.baseMode = null;
    if (mode.moveId) {             // перенос: та же запись на новой орбите
        const rec = bases.find(b => b.id === mode.moveId);
        if (!rec) { refreshObjectCard(); return; }
        moveBase(rec, mode, state.baseRadius);
        const p = planets.find(q => q.name === rec.planet);
        selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
        return;
    }
    const rec = createBase(mode, state.baseRadius);
    const p = planets.find(q => q.name === rec.planet);
    selectBody({ kind: 'base', name: rec.name, local: rec, p, m: null });
}

/** Выйти из режима выбора орбиты (Esc или правая кнопка). */
function cancelBaseMode() {
    state.baseMode = null;
    refreshObjectCard();   // вернуть кнопке надпись «Создать базу»
}
