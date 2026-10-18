// =============================================================================
// input.js — всё пользовательское управление: тач, колесо мыши, панорамирование
// правой кнопкой, позиция курсора для hover, кнопки скорости времени.
// Только меняет state, ничего не рисует.
// =============================================================================

import { state } from './state.js';
import { clamp } from './math.js';
import { MIN_ZOOM, MAX_ZOOM, MIN_SPEED, MAX_SPEED } from './config.js';
import { findBodyAt } from './hover.js';
import { selectBody } from './ui.js';

/** Прицепить все обработчики ввода к канвасу и кнопкам. Вызывается один раз. */
export function initInput(canvas, ui) {
    // === ТАЧ: перетаскивание одним пальцем, pinch-зум двумя ===
    let touch1 = null, touch2 = null;
    let lastDist = 0, lastZoom = 1;
    let isDragging = false, dragStartX = 0, dragStartY = 0, camStartX = 0, camStartY = 0;

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
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
            state.zoom = clamp(lastZoom * (dist / lastDist), MIN_ZOOM, MAX_ZOOM);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        if (e.touches.length < 2) touch2 = null;
        if (e.touches.length === 0) { touch1 = null; isDragging = false; }
    });

    // === КОЛЕСО МЫШИ: зум ===
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        state.zoom = clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
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
        selectBody(findBodyAt(state.hoverTargets, e.clientX, e.clientY));
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button !== 2) return;
        mouseDragging = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        camStartMX = state.camX;
        camStartMY = state.camY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        // позиция курсора нужна и без зажатой кнопки — для hover-подсказок
        state.mouseX = e.clientX;
        state.mouseY = e.clientY;
        if (!mouseDragging) return;
        state.camX = camStartMX + (e.clientX - mouseStartX) / state.zoom;
        state.camY = camStartMY + (e.clientY - mouseStartY) / state.zoom;
    });

    canvas.addEventListener('mouseleave', () => {
        state.mouseX = -1;
        state.mouseY = -1;
    });

    window.addEventListener('mouseup', e => {
        if (e.button !== 2) return;
        mouseDragging = false;
        canvas.style.cursor = '';
    });

    // отключаем системное контекстное меню, чтобы правая кнопка работала как панорамирование
    canvas.addEventListener('contextmenu', e => e.preventDefault());

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
