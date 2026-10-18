// =============================================================================
// main.js — точка входа. Подготавливает канвас, ввод и панель, запускает
// главный цикл requestAnimationFrame, который каждый кадр:
//   1) двигает симуляционное время,
//   2) завершает удаления баз с вышедшим таймером и тикает карточку,
//   3) рисует мир (render.js),
//   4) рисует hover-подсказки поверх (hover.js),
//   5) обновляет HUD (ui.js).
// =============================================================================

import { state, resize } from './state.js';
import { MS_PER_DAY } from './config.js';
import { initInput } from './input.js';
import { updateBaseRemovals } from './bases.js';
import { renderScene } from './render.js';
import { drawHover } from './hover.js';
import { getHudElements, getSpeedButtons, updateHud, buildSidePanel, updateFlyTo, updateBaseTimerCard } from './ui.js';
import { drawSelection } from './hover.js';

// --- Инициализация --------------------------------------------------------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = getHudElements();

resize(canvas);
window.addEventListener('resize', () => resize(canvas));

initInput(canvas, getSpeedButtons());
buildSidePanel();

// Canvas не подгружает веб-шрифты сам: если Manrope ещё не использовал ни один
// DOM-элемент, подписи баз на карте молча отрисуются fallback-шрифтом. Просим
// начертание заранее — уже загруженный шрифт следующего кадра подхватит сам.
if (document.fonts && document.fonts.load) document.fonts.load('600 12px "Manrope"');

// --- Главный цикл -----------------------------------------------------------------
let lastFrame = performance.now();

function frame() {
    //
    // dt в секундах реального времени; симуляция продвигается на dt * timeScale.
    // Потолок 0.1 сек защищает от прыжка после сворачивания вкладки.
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;

    state.simDays += dt / MS_PER_DAY * 1000 * state.timeScale; // dt(сек) -> сутки
    state.time += dt * state.timeScale;

    updateFlyTo();   // полёт камеры к строке блока «Малые тела» — до отрисовки мира
    updateBaseRemovals();    // удаления баз: завершить те, у кого вышел таймер
    updateBaseTimerCard();   // и обновить открытую карточку с таймером (раз в секунду)

    // фон: очищаем весь канвас в экранных координатах
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, state.W, state.H);

    // мир (в мировой системе координат) + сбор тел для наведения
    const hoverTargets = renderScene(ctx);
    state.hoverTargets = hoverTargets; // для выбора по клику (input.js)

    // подсказки и орбиты поверх мира, уже в экранных координатах
    drawHover(ctx, hoverTargets);
    drawSelection(ctx, state.selected, hoverTargets);

    updateHud(hud);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
