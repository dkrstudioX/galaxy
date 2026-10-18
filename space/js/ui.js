// =============================================================================
// ui.js — DOM-интерфейс: HUD-показатели (зум/скорость/дата) и боковая панель
// «ЛУНЫ СИСТЕМЫ» с деревом планет. Работает с DOM, не с канвасом.
// =============================================================================

import { state } from './state.js';
import { formatSimDate } from './math.js';
import { planets, moonTree, moonTotals } from './data.js';

/** Собрать ссылки на элементы HUD. Вызывается один раз в main.js. */
export function getHudElements() {
    return {
        zEl: document.getElementById('z'),
        speedEl: document.getElementById('speed'),
        daysEl: document.getElementById('days'),
        dateEl: document.getElementById('date')
    };
}

/** Собрать ссылки на кнопки скорости. */
export function getSpeedButtons() {
    return {
        slowBtn: document.getElementById('slowBtn'),
        normalBtn: document.getElementById('normalBtn'),
        fastBtn: document.getElementById('fastBtn')
    };
}

/** Обновить HUD-показатели (каждый кадр из main.js). */
export function updateHud(hud) {
    // Счётчик дней привязан к орбитальному движению: тот же simDays,
    // что задаёт углы планет. Показывает время, прошедшее с загрузки страницы.
    hud.daysEl.textContent = (state.simDays - state.startSimDays).toFixed(4);
    hud.dateEl.textContent = formatSimDate(state.simDays);
    hud.zEl.textContent = state.zoom.toFixed(2) + 'x';
}

/** Построить дерево «планета → главные луны» и логику сворачивания панели. */
export function buildSidePanel() {
    const treeEl = document.getElementById('lootTree');

    planets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'planet';
        const moons = moonTree[p.name] || [];
        li.innerHTML =
            '<div class="node">' +
                '<span class="caret">▶</span>' +
                '<span class="dot" style="background:' + p.color + '"></span>' +
                '<span class="pname">' + p.name + '</span>' +
                '<span class="cnt">☾ ' + moonTotals[p.name] + '</span>' +
            '</div>' +
            '<ul class="loot">' +
                moons.map(([n, t]) => '<li>' + n + '<i>' + t + '</i></li>').join('') +
            '</ul>';
        li.querySelector('.node').addEventListener('click', () => li.classList.toggle('open'));
        treeEl.appendChild(li);
    });

    // Кнопка сворачивания панели целиком
    const sidePanel = document.getElementById('sidePanel');
    const panelToggle = document.getElementById('panelToggle');
    panelToggle.addEventListener('click', () => {
        sidePanel.classList.toggle('collapsed');
        panelToggle.textContent = sidePanel.classList.contains('collapsed') ? '◀' : '▶';
        panelToggle.title = sidePanel.classList.contains('collapsed') ? 'Развернуть' : 'Свернуть';
    });
}
